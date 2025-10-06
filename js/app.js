// Main Application Logic
let currentUser = null;

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 CloudLock initializing...');
    
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            console.log('✅ User logged in:', user.email);
            currentUser = user;
            // Load passwords when user is authenticated
            loadPasswords();
        } else {
            console.log('❌ No user logged in');
            currentUser = null;
        }
    });

    console.log('✅ CloudLock initialized successfully');
});

// Note: loadPasswords() is now in password-manager.js
// Note: searchPasswords() is now in password-manager.js
// Note: openAddPasswordModal() is now in password-manager.js
// Note: savePassword() is now in password-manager.js
// Note: generateSecurePassword() is now in password-manager.js
// Note: confirmSelfDestruct() is now in security-monitor.js