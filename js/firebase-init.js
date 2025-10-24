// Firebase Initialization - COMPAT SDK
// This works with the firebase-compat.js files loaded in HTML

try {
    // Initialize Firebase with compat SDK
    firebase.initializeApp(CONFIG.firebase);
    console.log('✅ Firebase initialized successfully');
    
    // Set up auth and firestore references
    window.auth = firebase.auth();
    window.db = firebase.firestore();
    
    // Set persistence to LOCAL (stays logged in after browser close)
    firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
        .then(() => {
            console.log('✅ Auth persistence set to LOCAL');
        })
        .catch((error) => {
            console.error('⚠️ Persistence error:', error);
        });
    
    console.log('✅ Firebase Auth and Firestore ready');
} catch (error) {
    console.error('❌ Firebase initialization error:', error);
}
