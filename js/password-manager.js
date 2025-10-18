// Password Manager Module - Full CRUD Operations with Security Scores


let passwords = [];
let editingPasswordId = null;


// Load all passwords for current user
async function loadPasswords() {
    if (!firebase.auth().currentUser) {
        console.log('No user logged in');
        return;
    }


    const userId = firebase.auth().currentUser.uid;
    const passwordList = document.getElementById('password-list');


    try {
        // Show loading state
        passwordList.innerHTML = '<div class="spinner"></div>';


        // Fetch passwords from Firestore
        const snapshot = await firebase.firestore()
            .collection('passwords')
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .get();


        passwords = [];
        snapshot.forEach(doc => {
            passwords.push({ id: doc.id, ...doc.data() });
        });


        // Display passwords
        displayPasswords(passwords);


        // Generate AI alerts onto database
        if (typeof unsecureDetector === 'function') {
            unsecureDetector(passwords);
        }


        console.log(`📂 Loaded ${passwords.length} passwords`);
    } catch (error) {
        console.error('Error loading passwords:', error);
        passwordList.innerHTML = `
            <div style="text-align: center; padding: 40px; opacity: 0.6;">
                <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 15px;"></i>
                <p>Error loading passwords. Please try again.</p>
            </div>
        `;
        showToast('Failed to load passwords', 'error');
    }
}


// Calculate password strength and return score info
function getPasswordStrengthInfo(password) {
    const strength = calculatePasswordStrength(password);
   
    let scoreText, scoreColor, scoreClass;
   
    if (strength <= 2) {
        scoreText = 'Weak';
        scoreColor = '#ef4444';
        scoreClass = 'weak';
    } else if (strength === 3) {
        scoreText = 'Fair';
        scoreColor = '#f59e0b';
        scoreClass = 'fair';
    } else if (strength === 4) {
        scoreText = 'Good';
        scoreColor = '#a78bfa';
        scoreClass = 'good';
    } else {
        scoreText = 'Strong';
        scoreColor = '#10b981';
        scoreClass = 'strong';
    }
   
    return { scoreText, scoreColor, scoreClass, strength };
}


// Display passwords in the UI
function displayPasswords(passwordsToDisplay) {
    const passwordList = document.getElementById('password-list');


    if (passwordsToDisplay.length === 0) {
        passwordList.innerHTML = `
            <div style="text-align: center; padding: 40px; opacity: 0.6;">
                <i class="fas fa-lock" style="font-size: 3rem; margin-bottom: 15px;"></i>
                <p>No passwords stored yet. Add your first password to get started!</p>
            </div>
        `;
        return;
    }


    passwordList.innerHTML = passwordsToDisplay.map(password => {
        const decryptedPassword = decrypt(password.password);
        const maskedPassword = '•'.repeat(12);
        const strengthInfo = getPasswordStrengthInfo(decryptedPassword);
       
        // Get security insight for this password
        const insight = typeof showDashboardInsight === 'function'
            ? showDashboardInsight(password.id, decryptedPassword, password.siteName)
            : '';
       
        return `
            <div class="password-item" data-id="${password.id}">
                <div class="password-info">
                    <div class="password-title">
                        <i class="fas fa-globe" style="margin-right: 8px; color: var(--primary-light);"></i>
                        ${password.siteName}
                        ${insight}
                        <span class="password-strength-badge ${strengthInfo.scoreClass}" style="background: ${strengthInfo.scoreColor};">
                            ${strengthInfo.scoreText}
                        </span>
                    </div>
                    <div class="password-username">${password.username}</div>
                    ${password.url ? `<div style="font-size: 0.8rem; opacity: 0.6; margin-top: 5px;">${password.url}</div>` : ''}
                </div>
                <div class="ai-insight-wrapper" style="margin-top: 10px; position: relative; overflow: visible;">
                    <button class="ai-insight-btn"
                        style="background: rgba(215, 30, 30, 0.06); color: white; border: none; border-radius: 6px; padding: 6px 10px; cursor: pointer; font-size: 0.9rem; margin-left: 15px; margin-right: 15px; margin-bottom: 10px;">
                        💡 AI Insight
                    </button>
                    <div id="ai-insight-${password.id}"
                        class="ai-pass-insight"
                        style="display: none; position: absolute; top: 120%; left: 0; background: #222; color: #fff; padding: 10px; border-radius: 6px; width: 250px; font-size: 0.9rem; box-shadow: 0 2px 6px rgba(0,0,0,0.3); z-index: 1000;">
                    </div>
                </div>
                <div class="password-actions">
                    <button class="icon-btn" onclick="togglePasswordVisibility('${password.id}')" title="Show/Hide Password">
                        <i class="fas fa-eye" id="eye-${password.id}"></i>
                    </button>
                    <button class="icon-btn" onclick="copyPassword('${password.id}')" title="Copy Password">
                        <i class="fas fa-copy"></i>
                    </button>
                    <button class="icon-btn" onclick="editPassword('${password.id}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="icon-btn" onclick="deletePassword('${password.id}')" title="Delete" style="border-color: var(--danger);">
                        <i class="fas fa-trash" style="color: var(--danger);"></i>
                    </button>
                </div>
                <div class="password-display" id="pass-${password.id}" style="display: none; margin-top: 10px; padding: 10px; background: rgba(15, 15, 35, 0.8); border-radius: 8px; font-family: monospace;">
                    ${maskedPassword}
                </div>
            </div>
        `;
    }).join('');


    document.querySelectorAll('.ai-insight-btn').forEach(button => {
        const insightDiv = button.nextElementSibling;


        button.addEventListener('mouseenter', () => {
            insightDiv.style.display = 'block';
        });


        button.addEventListener('mouseleave', () => {
            insightDiv.style.display = 'none';
        });
    });
}


// Search passwords
function searchPasswords() {
    const searchTerm = document.getElementById('search-passwords').value.toLowerCase();
   
    if (!searchTerm) {
        displayPasswords(passwords);
        return;
    }


    const filtered = passwords.filter(password =>
        password.siteName.toLowerCase().includes(searchTerm) ||
        password.username.toLowerCase().includes(searchTerm) ||
        (password.url && password.url.toLowerCase().includes(searchTerm))
    );


    displayPasswords(filtered);
}


// Save password (Create or Update)
async function savePassword(event) {
    event.preventDefault();


    if (!firebase.auth().currentUser) {
        showToast('Please login first', 'error');
        return;
    }


    const userId = firebase.auth().currentUser.uid;
    const siteName = document.getElementById('site-name').value;
    const url = document.getElementById('site-url').value;
    const username = document.getElementById('site-username').value;
    const password = document.getElementById('site-password').value;
    const notes = document.getElementById('site-notes').value;
    const passwordId = document.getElementById('password-id').value;


    // Encrypt the password
    const encryptedPassword = encrypt(password);


    const passwordData = {
        userId: userId,
        siteName: siteName,
        url: url,
        username: username,
        password: encryptedPassword,
        notes: encrypt(notes),
        updatedAt: new Date()
    };


    try {
        if (passwordId) {
            // Update existing password
            await firebase.firestore()
                .collection('passwords')
                .doc(passwordId)
                .update(passwordData);
           
            showToast('Password updated successfully!', 'success');
        } else {
            // Create new password
            passwordData.createdAt = new Date();
            await firebase.firestore()
                .collection('passwords')
                .add(passwordData);
           
            showToast('Password saved successfully!', 'success');
        }


        closeModal('password-modal');
        loadPasswords();
    } catch (error) {
        console.error('Error saving password:', error);
        showToast('Failed to save password', 'error');
    }
}


// Edit password
function editPassword(passwordId) {
    const password = passwords.find(p => p.id === passwordId);
    if (!password) return;


    // Populate modal with password data
    document.getElementById('modal-title').textContent = 'Edit Password';
    document.getElementById('password-id').value = password.id;
    document.getElementById('site-name').value = password.siteName;
    document.getElementById('site-url').value = password.url || '';
    document.getElementById('site-username').value = password.username;
    document.getElementById('site-password').value = decrypt(password.password);
    document.getElementById('site-notes').value = decrypt(password.notes) || '';


    openModal('password-modal');
}


// Delete password
async function deletePassword(passwordId) {
    const password = passwords.find(p => p.id === passwordId);
    if (!password) return;


    const confirmed = confirm(`Are you sure you want to delete the password for ${password.siteName}?`);
    if (!confirmed) return;


    try {
        await firebase.firestore()
            .collection('passwords')
            .doc(passwordId)
            .delete();


        showToast('Password deleted successfully', 'success');
        loadPasswords();
    } catch (error) {
        console.error('Error deleting password:', error);
        showToast('Failed to delete password', 'error');
    }
}


// Toggle password visibility
function togglePasswordVisibility(passwordId) {
    const password = passwords.find(p => p.id === passwordId);
    if (!password) return;


    const passwordDisplay = document.getElementById(`pass-${passwordId}`);
    const eyeIcon = document.getElementById(`eye-${passwordId}`);


    if (passwordDisplay.style.display === 'none') {
        // Show password
        passwordDisplay.textContent = decrypt(password.password);
        passwordDisplay.style.display = 'block';
        eyeIcon.classList.remove('fa-eye');
        eyeIcon.classList.add('fa-eye-slash');
    } else {
        // Hide password
        passwordDisplay.textContent = '•'.repeat(12);
        passwordDisplay.style.display = 'none';
        eyeIcon.classList.remove('fa-eye-slash');
        eyeIcon.classList.add('fa-eye');
    }
}


// Copy password to clipboard
function copyPassword(passwordId) {
    const password = passwords.find(p => p.id === passwordId);
    if (!password) return;


    const decryptedPassword = decrypt(password.password);
   
    navigator.clipboard.writeText(decryptedPassword).then(() => {
        showToast('Password copied to clipboard!', 'success');
    }).catch(err => {
        showToast('Failed to copy password', 'error');
    });
}


// Generate secure password - Opens advanced generator
function generateSecurePassword() {
    openPasswordGeneratorModal();
}


// Open add password modal
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