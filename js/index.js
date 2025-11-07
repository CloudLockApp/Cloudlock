const functions = require('firebase-functions');
const admin = require('firebase-admin');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');


admin.initializeApp();
const db = admin.firestore();


function normalizeAnswer(a) {
  return (a || '').trim().toLowerCase();
}


// derive a hash for an answer using PBKDF2
function hashAnswer(answer, salt) {
  const iterations = 100000;
  const keylen = 64;
  const digest = 'sha256';
  return crypto.pbkdf2Sync(answer, salt, iterations, keylen, digest).toString('hex');
}


exports.startRecovery = functions.https.onCall(async (data, context) => {
  const email = (data && data.email || '').trim().toLowerCase();
  if (!email) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing email');
  }


  // Find user by email
  const usersSnap = await db.collection('users').where('email', '==', email).limit(1).get();
  if (usersSnap.empty) {
    // Do not leak existence info
    throw new functions.https.HttpsError('not-found', 'No account found');
  }


  const userDoc = usersSnap.docs[0];
  const uid = userDoc.id;
  const userData = userDoc.data();
  const questions = userData.securityQuestions || [];


  if (!questions || questions.length < 1) {
    throw new functions.https.HttpsError('failed-precondition', 'Recovery questions not set up');
  }


  // Create a short-lived recovery session
  const sessionId = uuidv4();
  const now = admin.firestore.Timestamp.now();
  const expires = admin.firestore.Timestamp.fromMillis(Date.now() + (15 * 60 * 1000)); // 15 minutes


  await db.collection('recoverySessions').doc(sessionId).set({
    uid,
    email,
    createdAt: now,
    expiresAt: expires,
    attempts: 0,
    verified: false
  });


  // Return questions without answers
  const questionPayload = questions.map((q, i) => ({
    id: q.id || `q${i}`,
    question: q.question
  }));


  return { sessionId, questions: questionPayload };
});


exports.verifyRecovery = functions.https.onCall(async (data, context) => {
  const sessionId = data && data.sessionId;
  const answers = Array.isArray(data && data.answers) ? data.answers : [];


  if (!sessionId || answers.length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing sessionId or answers');
  }


  const sessionRef = db.collection('recoverySessions').doc(sessionId);
  const sessionSnap = await sessionRef.get();
  if (!sessionSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Recovery session not found');
  }


  const session = sessionSnap.data();


  // Check expiry
  if (session.expiresAt && session.expiresAt.toMillis() < Date.now()) {
    throw new functions.https.HttpsError('deadline-exceeded', 'Session expired');
  }


  // Rate-limit attempts
  if ((session.attempts || 0) >= 5) {
    throw new functions.https.HttpsError('resource-exhausted', 'Too many attempts');
  }


  const userRef = db.collection('users').doc(session.uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'User not found');
  }


  const user = userSnap.data();
  const storedQuestions = user.securityQuestions || [];


  let allMatch = true;


  for (let i = 0; i < storedQuestions.length; i++) {
    const stored = storedQuestions[i];
    const provided = normalizeAnswer(answers[i] || '');


    if (stored.hash && stored.salt) {
      // Hashed storage
      const computed = hashAnswer(provided, stored.salt);
      if (computed !== stored.hash) { allMatch = false; break; }
    } else if (typeof stored.answer === 'string') {
      if (provided !== normalizeAnswer(stored.answer)) { allMatch = false; break; }
    } else {
      allMatch = false; break;
    }
  }


  // increment attempts
  await sessionRef.update({ attempts: admin.firestore.FieldValue.increment(1) });


  if (!allMatch) {
    throw new functions.https.HttpsError('permission-denied', 'Answers do not match');
  }


  // Mark session verified
  await sessionRef.update({ verified: true, verifiedAt: admin.firestore.Timestamp.now() });


  return { success: true };
});


exports.resetPassword = functions.https.onCall(async (data, context) => {
  const sessionId = data && data.sessionId;
  const newPassword = data && data.newPassword;


  if (!sessionId || !newPassword || newPassword.length < 8) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing/invalid parameters');
  }


  const sessionRef = db.collection('recoverySessions').doc(sessionId);
  const sessionSnap = await sessionRef.get();
  if (!sessionSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Recovery session not found');
  }


  const session = sessionSnap.data();
  if (!session.verified) {
    throw new functions.https.HttpsError('permission-denied', 'Session not verified');
  }


  // Check expiry
  if (session.expiresAt && session.expiresAt.toMillis() < Date.now()) {
    throw new functions.https.HttpsError('deadline-exceeded', 'Session expired');
  }


  const uid = session.uid;
  try {
    await admin.auth().updateUser(uid, { password: newPassword });


    // Cleanup session
    await sessionRef.delete();


    return { success: true };
  } catch (err) {
    console.error('Error resetting password:', err);
    throw new functions.https.HttpsError('internal', 'Failed to reset password');
  }
});
