// Password Manager Module - CLEAN AI INSIGHTS BUTTON

let passwords = [];
let editingPasswordId = null;

async function loadPasswords() {
    if (!firebase.auth().currentUser) {
        console.log('No user logged in');
        return;
    }

    const userId = firebase.auth().currentUser.uid;
    const passwordList = document.getElementById('password-list');

    try {
        passwordList.innerHTML = '<div class="spinner"></div>';

        const snapshot = await firebase.firestore()
            .collection('passwords')
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .get();

        passwords = [];
        snapshot.forEach(doc => {
            passwords.push({ id: doc.id, ...doc.data() });
        });

        displayPasswords(passwords);
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

function getPasswordStrengthInfo(password) {
    const strength = calculatePasswordStrength(password);
   
    let scoreText, scoreColor, scoreClass;
   
    if (strength <= 40) {
        scoreText = 'Weak';
        scoreColor = '#ef4444';
        scoreClass = 'weak';
    } else if (strength <= 60) {
        scoreText = 'Fair';
        scoreColor = '#f59e0b';
        scoreClass = 'fair';
    } else if (strength <= 80) {
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

function createCircularScore(strength, scoreColor, scoreText) {
    const radius = 14;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (strength / 100) * circumference;
    
    return `
        <div class="circular-score-container" title="${scoreText}: ${strength}/100">
            <svg width="36" height="36" class="circular-score">
                <circle
                    cx="18"
                    cy="18"
                    r="${radius}"
                    fill="none"
                    stroke="${scoreColor}"
                    stroke-width="2.5"
                    stroke-dasharray="${circumference}"
                    stroke-dashoffset="${offset}"
                    stroke-linecap="round"
                    transform="rotate(-90 18 18)"
                    style="filter: drop-shadow(0 0 3px ${scoreColor}); opacity: 0.9;"
                />
            </svg>
            <div class="circular-score-text" style="color: ${scoreColor};">
                ${strength}
            </div>
        </div>
    `;
}

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
       
        return `
            <div class="password-item" data-id="${password.id}">
                <div class="password-info">
                    <div class="password-title">
                        <i class="fas fa-globe" style="margin-right: 8px; color: var(--primary-light);"></i>
                        <span style="flex: 1;">${password.siteName}</span>
                    </div>
                    <div class="password-username">${password.username}</div>
                    ${password.url ? `<div style="font-size: 0.8rem; opacity: 0.6; margin-top: 5px;">${password.url}</div>` : ''}
                    
                    <div style="display: flex; gap: 10px; margin-top: 10px; flex-wrap: wrap; align-items: center;">
                        <button class="audit-log-btn" onclick="openAuditLogModal('${password.id}')" title="View History">
                            <i class="fas fa-history"></i>
                            View History
                        </button>
                        
                        <!-- AI INSIGHTS BUTTON - NO INLINE STYLES, USES CSS CLASS -->
                        <div class="ai-insight-wrapper">
                            <button class="ai-insight-btn">
                                <i class="fas fa-brain"></i> AI Insights
                            </button>
                            <div id="ai-insight-${password.id}" class="ai-pass-insight" style="display: none;">
                                <div style="text-align: center; padding: 10px;">
                                    <i class="fas fa-spinner fa-spin" style="font-size: 1.5rem; color: #a78bfa;"></i>
                                    <p style="margin-top: 10px; opacity: 0.8;">Loading AI insights...</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- ACTIONS ROW WITH SCORE -->
                <div class="password-actions-row">
                    ${createCircularScore(strengthInfo.strength, strengthInfo.scoreColor, strengthInfo.scoreText)}
                    
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
                </div>
                
                <div class="password-display" id="pass-${password.id}" style="display: none; margin-top: 10px; padding: 10px; background: rgba(15, 15, 35, 0.8); border-radius: 8px; font-family: monospace;">
                    ${maskedPassword}
                </div>
            </div>
        `;
    }).join('');

    // Add event listeners for AI Insights buttons
    document.querySelectorAll('.ai-insight-btn').forEach(button => {
        const passwordItem = button.closest('.password-item');
        const passwordId = passwordItem.dataset.id;
        const insightDiv = document.getElementById(`ai-insight-${passwordId}`);

        button.addEventListener('click', async (e) => {
            e.stopPropagation();
            
            if (insightDiv.style.display === 'none') {
                insightDiv.style.display = 'block';
                
                if (typeof unsecureDetector === 'function' && !insightDiv.dataset.loaded) {
                    await unsecureDetector(passwordId);
                }
            } else {
                insightDiv.style.display = 'none';
            }
        });
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.ai-insight-wrapper')) {
            document.querySelectorAll('.ai-pass-insight').forEach(insight => {
                insight.style.display = 'none';
            });
        }
    });
}

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
        const location = typeof getApproximateLocation === 'function' 
            ? await getApproximateLocation() 
            : 'Unknown';

        if (passwordId) {
            const oldDoc = await firebase.firestore()
                .collection('passwords')
                .doc(passwordId)
                .get();
            
            const oldPassword = oldDoc.exists ? decrypt(oldDoc.data().password) : '';
            
            await firebase.firestore()
                .collection('passwords')
                .doc(passwordId)
                .update(passwordData);
            
            if (typeof logAuditEvent === 'function') {
                await logAuditEvent(passwordId, 'PASSWORD_CHANGED', {
                    previousPasswordHash: CryptoJS.SHA256(oldPassword).toString(),
                    strengthBefore: calculatePasswordStrength(oldPassword),
                    strengthAfter: calculatePasswordStrength(password),
                    location: location
                });
            }
           
            showToast('Password updated successfully!', 'success');
        } else {
            passwordData.createdAt = new Date();
            
            const docRef = await firebase.firestore()
                .collection('passwords')
                .add(passwordData);
            
            if (typeof logAuditEvent === 'function') {
                await logAuditEvent(docRef.id, 'PASSWORD_CREATED', {
                    strengthAfter: calculatePasswordStrength(password),
                    location: location
                });
            }
           
            showToast('Password saved successfully!', 'success');
        }

        closeModal('password-modal');
        loadPasswords();
    } catch (error) {
        console.error('Error saving password:', error);
        showToast('Failed to save password', 'error');
    }
}

function editPassword(passwordId) {
    const password = passwords.find(p => p.id === passwordId);
    if (!password) return;

    document.getElementById('modal-title').textContent = 'Edit Password';
    document.getElementById('password-id').value = password.id;
    document.getElementById('site-name').value = password.siteName;
    document.getElementById('site-url').value = password.url || '';
    document.getElementById('site-username').value = password.username;
    document.getElementById('site-password').value = decrypt(password.password);
    document.getElementById('site-notes').value = decrypt(password.notes) || '';

    openModal('password-modal');
}

async function deletePassword(passwordId) {
    const password = passwords.find(p => p.id === passwordId);
    if (!password) return;

    const confirmed = confirm(`Are you sure you want to delete the password for ${password.siteName}?`);
    if (!confirmed) return;

    try {
        if (typeof logAuditEvent === 'function') {
            const location = typeof getApproximateLocation === 'function' 
                ? await getApproximateLocation() 
                : 'Unknown';
                
            await logAuditEvent(passwordId, 'PASSWORD_DELETED', {
                location: location,
                deletedPasswordHash: CryptoJS.SHA256(decrypt(password.password)).toString()
            });
        }

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

async function togglePasswordVisibility(passwordId) {
    const password = passwords.find(p => p.id === passwordId);
    if (!password) return;

    const passwordDisplay = document.getElementById(`pass-${passwordId}`);
    const eyeIcon = document.getElementById(`eye-${passwordId}`);

    if (passwordDisplay.style.display === 'none') {
        passwordDisplay.textContent = decrypt(password.password);
        passwordDisplay.style.display = 'block';
        eyeIcon.classList.remove('fa-eye');
        eyeIcon.classList.add('fa-eye-slash');
        
        if (typeof logAuditEvent === 'function') {
            const location = typeof getApproximateLocation === 'function' 
                ? await getApproximateLocation() 
                : 'Unknown';
                
            logAuditEvent(passwordId, 'PASSWORD_VIEWED', {
                location: location
            });
        }
    } else {
        passwordDisplay.textContent = '•'.repeat(12);
        passwordDisplay.style.display = 'none';
        eyeIcon.classList.remove('fa-eye-slash');
        eyeIcon.classList.add('fa-eye');
    }
}

async function copyPassword(passwordId) {
    const password = passwords.find(p => p.id === passwordId);
    if (!password) return;

    const decryptedPassword = decrypt(password.password);
   
    navigator.clipboard.writeText(decryptedPassword).then(async () => {
        showToast('Password copied to clipboard!', 'success');
        
        if (typeof logAuditEvent === 'function') {
            const location = typeof getApproximateLocation === 'function' 
                ? await getApproximateLocation() 
                : 'Unknown';
                
            logAuditEvent(passwordId, 'PASSWORD_VIEWED', {
                location: location,
                action: 'copied'
            });
        }
    }).catch(err => {
        showToast('Failed to copy password', 'error');
    });
}

function generateSecurePassword() {
    openPasswordGeneratorModal();
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