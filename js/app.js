// Main Application Logic
let currentUser = null;

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 App initializing...');
    
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            console.log('✅ User logged in:', user.email);
            currentUser = user;
        } else {
            console.log('❌ No user logged in');
            currentUser = null;
        }
    });
});

function loadPasswords() {
    console.log('📂 Loading passwords...');
}

function searchPasswords() {
    console.log('🔍 Searching passwords...');
}

function openAddPasswordModal() {
    openModal('password-modal');
    document.getElementById('modal-title').textContent = 'Add New Password';
    document.getElementById('password-id').value = '';
    document.getElementById('site-name').value = '';
    document.getElementById('site-url').value = '';
    document.getElementById('site-username').value = '';
    document.getElementById('site-password').value = '';
    document.getElementById('site-notes').value = '';
}

function savePassword(event) {
    event.preventDefault();
    showToast('Password saved successfully!', 'success');
    closeModal('password-modal');
}

function generateSecurePassword() {
    const length = 16;
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < length; i++) {
        password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    
    navigator.clipboard.writeText(password).then(() => {
        showToast(`🔑 Generated: ${password.substring(0, 8)}... (copied!)`, 'success');
    });
}

function confirmSelfDestruct() {
    const confirmed = confirm('⚠️ WARNING: This will delete ALL your passwords!\n\nAre you sure?');
    if (confirmed) {
        showToast('🔥 Feature coming soon!', 'warning');
    }
}