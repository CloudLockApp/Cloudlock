// Firebase Initialization
try {
    firebase.initializeApp(CONFIG.firebase);
    console.log('✅ Firebase initialized successfully');
    window.auth = firebase.auth();
    window.db = firebase.firestore();
    console.log('✅ Firebase Auth and Firestore ready');
} catch (error) {
    console.error('❌ Firebase initialization error:', error);
}