// Enhanced Authentication Module - Comprehensive MFA/2FA System - FIXED VERSION

let encryptionKey = null;
let currentAuthStep = 1;
let currentUser = null;
let currentUserEmail = null; // Store email for re-authentication
let currentUserPassword = null; // Store password for re-authentication
let mfaSecret = null;
let backupCodes = [];
let resendTimer = 60;
let resendInterval = null;

// Password requirements
const requirements = {
    length: (password) => password.length >= 8,
    uppercase: (password) => /[A-Z]/.test(password),
    lowercase: (password) => /[a-z]/.test(password),
    number: (password) => /[0-9]/.test(password),
    special: (password) => /[!@#$%^&*(),.?":{}|<>]/.test(password),
};

// ========================================
// INITIALIZATION
// ========================================

document.addEventListener('DOMContentLoaded', function() {
    initializeAuthListeners();
    checkExistingSession();
});

function initializeAuthListeners() {
    // Password strength checker
    const regPassword = document.getElementById('reg-password');
    if (regPassword) {
        regPassword.addEventListener('input', updatePasswordStrength);
    }

    const regConfirm = document.getElementById('reg-confirm');
    if (regConfirm) {
        regConfirm.addEventListener('input', updateSubmitButton);
    }

    // Code input auto-advance
    document.querySelectorAll('.code-digit').forEach((input, index, inputs) => {
        input.addEventListener('input', function(e) {
            if (this.value.length === 1 && index < inputs.length - 1) {
                inputs[index + 1].focus();
            }
        });

        input.addEventListener('keydown', function(e) {
            if (e.key === 'Backspace' && this.value === '' && index > 0) {
                inputs[index - 1].focus();
            }
        });

        // Only allow numbers
        input.addEventListener('input', function() {
            this.value = this.value.replace(/[^0-9]/g, '');
        });
    });

    // Backup codes confirmation checkbox
    const confirmSaved = document.getElementById('confirm-saved-codes');
    if (confirmSaved) {
        confirmSaved.addEventListener('change', function() {
            const btn = document.getElementById('complete-registration-btn');
            if (btn) {
                btn.disabled = !this.checked;
            }
        });
    }
}

function checkExistingSession() {
    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            // Check if registration is complete
            const userDoc = await firebase.firestore().collection('users').doc(user.uid).get();
            const userData = userDoc.data();
            
            if (userData && userData.registrationComplete !== false) {
                // Fully registered user, redirect to dashboard
                window.location.href = 'dashboard.html';
            }
            // If registrationComplete is false, stay on registration page
        }
    });
}

// ========================================
// TAB SWITCHING
// ========================================

function switchTab(tab) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    // Hide all flows
    hideAllFlows();

    // Show selected flow
    if (tab === 'login') {
        showFlow('login');
        updateSteps(1);
    } else if (tab === 'register') {
        showFlow('register');
        updateSteps(1);
    }
}

function hideAllFlows() {
    document.querySelectorAll('.auth-flow').forEach(flow => {
        flow.style.display = 'none';
    });
    document.querySelectorAll('.auth-step-content').forEach(step => {
        step.classList.remove('active');
    });
}

function showFlow(flowName) {
    const flow = document.getElementById(`${flowName}-flow`);
    if (flow) {
        flow.style.display = 'block';
        const firstStep = flow.querySelector('.auth-step-content');
        if (firstStep) {
            firstStep.classList.add('active');
        }
    }
}

function showStep(flowName, stepNumber) {
    // Hide all steps in this flow
    document.querySelectorAll(`#${flowName}-flow .auth-step-content`).forEach(step => {
        step.classList.remove('active');
    });

    // Show target step
    const targetStep = document.getElementById(`${flowName}-step-${stepNumber}`);
    if (targetStep) {
        targetStep.classList.add('active');
    }

    // Update step indicator
    const stepNum = parseInt(stepNumber) || 1;
    updateSteps(stepNum);
}

function updateSteps(activeStep) {
    document.querySelectorAll('.auth-step').forEach((step, index) => {
        const stepNum = index + 1;
        step.classList.remove('active', 'completed');
        
        if (stepNum < activeStep) {
            step.classList.add('completed');
        } else if (stepNum === activeStep) {
            step.classList.add('active');
        }
    });
}

// ========================================
// PASSWORD UTILITIES
// ========================================

function updatePasswordStrength() {
    const password = document.getElementById('reg-password').value;
    const strengthBar = document.getElementById('strengthBar');
    const strengthText = document.getElementById('strengthText');
    let metCount = 0;

    Object.keys(requirements).forEach((req) => {
        const requirementItem = document.querySelector(`[data-requirement="${req}"]`);
        if (!requirementItem) return;

        const isMet = requirements[req](password);

        if (isMet) {
            requirementItem.classList.add('met');
            metCount++;
        } else {
            requirementItem.classList.remove('met');
        }

        if (password.length > 0) {
            requirementItem.classList.add('active');
        } else {
            requirementItem.classList.remove('active');
        }
    });

    if (strengthBar && strengthText) {
        strengthBar.className = 'strength-bar';
        if (metCount === 0) {
            strengthBar.style.width = '0%';
            strengthText.textContent = '';
        } else if (metCount <= 2) {
            strengthBar.classList.add('weak');
            strengthText.textContent = 'Weak Password';
            strengthText.style.color = '#ef4444';
        } else if (metCount === 3) {
            strengthBar.classList.add('fair');
            strengthText.textContent = 'Fair Password';
            strengthText.style.color = '#f59e0b';
        } else if (metCount === 4) {
            strengthBar.classList.add('good');
            strengthText.textContent = 'Good Password';
            strengthText.style.color = '#a78bfa';
        } else if (metCount === 5) {
            strengthBar.classList.add('strong');
            strengthText.textContent = 'Strong Password!';
            strengthText.style.color = '#10b981';
        }
    }

    updateSubmitButton();
}

function updateSubmitButton() {
    const password = document.getElementById('reg-password').value;
    const confirmPassword = document.getElementById('reg-confirm').value;
    const submitBtn = document.getElementById('register-step-1-btn');

    if (!submitBtn) return;

    const allMet = Object.keys(requirements).every((req) =>
        requirements[req](password)
    );
    const passwordsMatch = password === confirmPassword && password.length > 0;

    submitBtn.disabled = !(allMet && passwordsMatch);
}

function togglePasswordField(fieldId, button) {
    const field = document.getElementById(fieldId);
    const icon = button.querySelector('i');
    
    if (field.type === 'password') {
        field.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        field.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

// ========================================
// LOGIN FLOW
// ========================================

async function handleLoginStep1(event) {
    event.preventDefault();

    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const rememberDevice = document.getElementById('remember-device').checked;

    const btn = document.getElementById('login-step-1-btn');
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Authenticating...';
    btn.disabled = true;

    try {
        // Attempt login
        const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
        currentUser = userCredential.user;
        encryptionKey = password;

        // Get user data to check 2FA status
        const userDoc = await firebase.firestore().collection('users').doc(currentUser.uid).get();
        const userData = userDoc.data();

        // Check if registration is complete
        if (userData.registrationComplete === false) {
            showToast('Please complete your registration first', 'warning');
            await firebase.auth().signOut();
            btn.innerHTML = originalHTML;
            btn.disabled = false;
            return;
        }

        // Check if device is trusted (if remember was checked previously)
        if (rememberDevice && await checkTrustedDevice(currentUser.uid)) {
            // Skip 2FA
            completeLogin();
            return;
        }

        if (userData && userData.twoFactorEnabled) {
            // Show 2FA step
            showMFAMethods(userData);
            showStep('login', 2);
        } else {
            // No 2FA, complete login
            completeLogin();
        }

    } catch (error) {
        console.error('Login error:', error);
        let errorMessage = 'Login failed. Please check your credentials.';

        if (error.code === 'auth/user-not-found') {
            errorMessage = 'No account found with this email.';
        } else if (error.code === 'auth/wrong-password') {
            errorMessage = 'Incorrect password.';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Invalid email address.';
        } else if (error.code === 'auth/too-many-requests') {
            errorMessage = 'Too many failed attempts. Please try again later.';
        }

        showToast(errorMessage, 'error');
        btn.innerHTML = originalHTML;
        btn.disabled = false;
    }
}

async function showMFAMethods(userData) {
    const methodsContainer = document.getElementById('mfa-methods');
    methodsContainer.innerHTML = '';

    // Authenticator app
    if (userData.mfaAuthenticator) {
        const btn = createMFAMethodButton('authenticator', 'Authenticator App', 'fa-mobile-alt');
        methodsContainer.appendChild(btn);
    }

    // SMS
    if (userData.mfaSMS) {
        const btn = createMFAMethodButton('sms', 'SMS Code', 'fa-sms');
        methodsContainer.appendChild(btn);
    }

    // Email
    if (userData.mfaEmail) {
        const btn = createMFAMethodButton('email', 'Email Code', 'fa-envelope');
        methodsContainer.appendChild(btn);
    }

    // Backup codes
    const backupBtn = createMFAMethodButton('backup', 'Backup Code', 'fa-key');
    methodsContainer.appendChild(backupBtn);
}

function createMFAMethodButton(method, name, icon) {
    const btn = document.createElement('div');
    btn.className = 'mfa-method-btn';
    btn.onclick = () => selectMFAMethod(method);
    btn.innerHTML = `
        <i class="fas ${icon}"></i>
        <div class="method-name">${name}</div>
    `;
    return btn;
}

function selectMFAMethod(method) {
    // Hide all MFA contents
    document.querySelectorAll('.mfa-method-content').forEach(content => {
        content.style.display = 'none';
    });

    // Show selected method
    const content = document.getElementById(`mfa-${method}`);
    if (content) {
        content.style.display = 'block';
    }

    // Handle method-specific logic
    if (method === 'sms' || method === 'email') {
        sendVerificationCode(method);
    }

    // Mark button as active
    document.querySelectorAll('.mfa-method-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.closest('.mfa-method-btn').classList.add('active');
}

async function sendVerificationCode(method) {
    try {
        // In production, this would trigger actual SMS/email sending
        // For now, simulate it
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Store code temporarily (in production, store server-side)
        sessionStorage.setItem('verificationCode', code);

        // Update contact display
        const contactEl = document.getElementById('mfa-contact');
        if (contactEl) {
            if (method === 'sms') {
                contactEl.textContent = '+1 (***) ***-1234'; // Masked phone
            } else {
                contactEl.textContent = 'user@*****.com'; // Masked email
            }
        }

        showToast(`Verification code sent via ${method.toUpperCase()}`, 'success');
        startResendTimer();

    } catch (error) {
        console.error('Error sending code:', error);
        showToast('Failed to send verification code', 'error');
    }
}

function startResendTimer() {
    resendTimer = 60;
    const btn = document.getElementById('resend-btn');
    const timerSpan = document.getElementById('resend-timer');
    
    if (btn) btn.disabled = true;

    resendInterval = setInterval(() => {
        resendTimer--;
        if (timerSpan) timerSpan.textContent = `(${resendTimer}s)`;

        if (resendTimer <= 0) {
            clearInterval(resendInterval);
            if (btn) btn.disabled = false;
            if (timerSpan) timerSpan.textContent = '';
        }
    }, 1000);
}

function resendCode() {
    const method = document.getElementById('mfa-sms-email').style.display !== 'none' ? 'sms' : 'email';
    sendVerificationCode(method);
}

async function verifyAuthenticatorCode(event) {
    event.preventDefault();

    const code = Array.from(document.querySelectorAll('#mfa-authenticator .code-digit'))
        .map(input => input.value)
        .join('');

    if (code.length !== 6) {
        showToast('Please enter complete 6-digit code', 'error');
        return;
    }

    try {
        // In production, verify against stored secret using TOTP
        // For demo, accept any 6-digit code
        await completeLogin();
    } catch (error) {
        showToast('Invalid code. Please try again.', 'error');
    }
}

async function verifySMSEmailCode(event) {
    event.preventDefault();

    const code = document.getElementById('sms-email-code').value;
    const storedCode = sessionStorage.getItem('verificationCode');

    if (code === storedCode) {
        await completeLogin();
    } else {
        showToast('Invalid code. Please try again.', 'error');
    }
}

async function verifyBackupCode(event) {
    event.preventDefault();

    const code = document.getElementById('backup-code').value.replace(/-/g, '');

    try {
        // In production, verify against stored backup codes
        // Mark code as used
        await completeLogin();
        showToast('Backup code accepted. Please generate new codes in settings.', 'warning');
    } catch (error) {
        showToast('Invalid backup code', 'error');
    }
}

async function completeLogin() {
    showStep('login', 3);
    
    // Remember device if checked
    const rememberDevice = document.getElementById('remember-device').checked;
    if (rememberDevice && currentUser) {
        await saveTrustedDevice(currentUser.uid);
    }

    setTimeout(() => {
        window.location.href = 'dashboard.html';
    }, 2000);
}

// ========================================
// REGISTER FLOW - FIXED VERSION
// ========================================

async function handleRegisterStep1(event) {
    event.preventDefault();

    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const confirmPassword = document.getElementById('reg-confirm').value;

    if (password !== confirmPassword) {
        showToast('Passwords do not match!', 'error');
        return;
    }

    const allMet = Object.keys(requirements).every((req) =>
        requirements[req](password)
    );
    if (!allMet) {
        showToast('Please meet all password requirements', 'error');
        return;
    }

    const btn = document.getElementById('register-step-1-btn');
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Account...';
    btn.disabled = true;

    try {
        // Create Firebase account
        const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
        currentUser = userCredential.user;
        
        // Store credentials for later re-authentication
        currentUserEmail = email;
        currentUserPassword = password;
        encryptionKey = password;

        // Store basic user data with registrationComplete = false
        await firebase.firestore().collection('users').doc(currentUser.uid).set({
            name: name,
            email: email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            twoFactorEnabled: false,
            registrationComplete: false // Mark as incomplete until 2FA setup
        });

        showToast('Account created! Please set up two-factor authentication.', 'success');

        // Move to 2FA setup (stay logged in for setup process)
        showStep('register', 2);
        updateSteps(2);

    } catch (error) {
        console.error('Registration error:', error);
        let msg = 'Registration failed. Please try again.';
        
        if (error.code === 'auth/email-already-in-use') {
            msg = 'This email is already registered.';
        } else if (error.code === 'auth/invalid-email') {
            msg = 'Invalid email address.';
        } else if (error.code === 'auth/weak-password') {
            msg = 'Password is too weak.';
        }
        
        showToast(msg, 'error');
        btn.innerHTML = originalHTML;
        btn.disabled = false;
    }
}

// ========================================
// MFA SETUP
// ========================================

function setupAuthenticator() {
    showStep('register', '2a');
    updateSteps(2);
    generateQRCode();
}

function setupSMS() {
    showStep('register', '2b');
    updateSteps(2);
}

function setupEmail() {
    const email = currentUserEmail || document.getElementById('reg-email').value;
    document.getElementById('user-email-display').textContent = email;
    showStep('register', '2c');
    updateSteps(2);
}

async function skipMFA() {
    if (confirm('Skipping 2FA reduces your account security. Continue anyway?')) {
        // Mark registration as complete
        if (currentUser) {
            await firebase.firestore().collection('users').doc(currentUser.uid).update({
                registrationComplete: true
            });
        }
        
        showStep('register', 4); // Jump to security questions
        updateSteps(3);
    }
}

async function generateQRCode() {
    try {
        // Generate secret (32-character base32)
        mfaSecret = generateBase32Secret();
        
        // Display secret
        document.getElementById('secret-key').textContent = formatSecret(mfaSecret);

        // Generate QR code
        const issuer = 'CloudLock';
        const accountName = currentUserEmail || currentUser.email;
        const otpauthURL = `otpauth://totp/${issuer}:${accountName}?secret=${mfaSecret}&issuer=${issuer}`;

        const qrContainer = document.getElementById('qr-code');
        qrContainer.innerHTML = '';
        
        new QRCode(qrContainer, {
            text: otpauthURL,
            width: 220,
            height: 220,
            colorDark: '#1a1a2e',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.H
        });

    } catch (error) {
        console.error('QR code generation error:', error);
        showToast('Failed to generate QR code', 'error');
    }
}

function generateBase32Secret() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let secret = '';
    for (let i = 0; i < 32; i++) {
        secret += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return secret;
}

function formatSecret(secret) {
    return secret.match(/.{1,4}/g).join(' ');
}

function toggleManualEntry() {
    const manual = document.getElementById('manual-entry');
    manual.style.display = manual.style.display === 'none' ? 'block' : 'none';
}

function copySecretKey() {
    const secret = document.getElementById('secret-key').textContent;
    navigator.clipboard.writeText(secret.replace(/\s/g, '')).then(() => {
        showToast('Secret key copied!', 'success');
    });
}

async function verifyAuthenticatorSetup(event) {
    event.preventDefault();

    const code = Array.from(document.querySelectorAll('#register-step-2a .code-digit'))
        .map(input => input.value)
        .join('');

    if (code.length !== 6) {
        showToast('Please enter complete 6-digit code', 'error');
        return;
    }

    try {
        // In production, verify TOTP code
        // For demo, accept any 6-digit code

        // Save MFA settings
        if (currentUser) {
            await firebase.firestore().collection('users').doc(currentUser.uid).update({
                twoFactorEnabled: true,
                mfaAuthenticator: true,
                mfaSecret: mfaSecret // In production, encrypt this!
            });
        }

        // Generate and show backup codes
        generateBackupCodes();
        showStep('register', 3);
        updateSteps(3);

    } catch (error) {
        console.error('Verification error:', error);
        showToast('Verification failed. Please try again.', 'error');
    }
}

async function setupSMSVerification(event) {
    event.preventDefault();

    const phone = document.getElementById('phone-number').value;

    try {
        // In production, send verification SMS
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        sessionStorage.setItem('smsVerificationCode', code);

        if (currentUser) {
            await firebase.firestore().collection('users').doc(currentUser.uid).update({
                twoFactorEnabled: true,
                mfaSMS: true,
                phoneNumber: phone // In production, encrypt this!
            });
        }

        generateBackupCodes();
        showStep('register', 3);
        updateSteps(3);

    } catch (error) {
        console.error('SMS setup error:', error);
        showToast('Failed to set up SMS verification', 'error');
    }
}

async function setupEmailVerification(event) {
    event.preventDefault();

    try {
        // In production, send verification email
        if (currentUser) {
            await firebase.firestore().collection('users').doc(currentUser.uid).update({
                twoFactorEnabled: true,
                mfaEmail: true
            });
        }

        generateBackupCodes();
        showStep('register', 3);
        updateSteps(3);

    } catch (error) {
        console.error('Email setup error:', error);
        showToast('Failed to set up email verification', 'error');
    }
}

function goBackToMFAOptions() {
    showStep('register', 2);
    updateSteps(2);
}

// ========================================
// BACKUP CODES
// ========================================

function generateBackupCodes() {
    backupCodes = [];
    for (let i = 0; i < 8; i++) {
        const code = generateBackupCode();
        backupCodes.push(code);
    }

    displayBackupCodes();
    saveBackupCodes();
}

function generateBackupCode() {
    const segments = [];
    for (let i = 0; i < 4; i++) {
        segments.push(Math.floor(1000 + Math.random() * 9000).toString());
    }
    return segments.join('-');
}

function displayBackupCodes() {
    const container = document.getElementById('backup-codes-list');
    container.innerHTML = '';

    backupCodes.forEach(code => {
        const codeDiv = document.createElement('div');
        codeDiv.className = 'backup-code-item';
        codeDiv.textContent = code;
        container.appendChild(codeDiv);
    });
}

async function saveBackupCodes() {
    try {
        // Hash codes before storing
        const hashedCodes = backupCodes.map(code => 
            CryptoJS.SHA256(code).toString()
        );

        if (currentUser) {
            await firebase.firestore().collection('users').doc(currentUser.uid).update({
                backupCodes: hashedCodes
            });
        }
    } catch (error) {
        console.error('Error saving backup codes:', error);
    }
}

function downloadBackupCodes() {
    const text = backupCodes.join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cloudlock-backup-codes.txt';
    a.click();
    showToast('Backup codes downloaded', 'success');
}

function printBackupCodes() {
    const printWindow = window.open('', '', 'width=600,height=400');
    printWindow.document.write('<html><head><title>CloudLock Backup Codes</title>');
    printWindow.document.write('<style>body { font-family: monospace; padding: 20px; }</style>');
    printWindow.document.write('</head><body>');
    printWindow.document.write('<h2>CloudLock Backup Codes</h2>');
    printWindow.document.write('<p>Store these codes in a safe place. Each can only be used once.</p>');
    printWindow.document.write('<ul>');
    backupCodes.forEach(code => {
        printWindow.document.write(`<li>${code}</li>`);
    });
    printWindow.document.write('</ul>');
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.print();
}

function copyBackupCodes() {
    const text = backupCodes.join('\n');
    navigator.clipboard.writeText(text).then(() => {
        showToast('All backup codes copied!', 'success');
    });
}

async function completeRegistration() {
    showStep('register', 4);
    updateSteps(3);
}

// ========================================
// SECURITY QUESTIONS
// ========================================

async function saveSecurityQuestions(event) {
    event.preventDefault();

    const q1 = document.getElementById('question1-select').value;
    const a1 = document.getElementById('question1').value;
    const q2 = document.getElementById('question2-select').value;
    const a2 = document.getElementById('question2').value;
    const q3 = document.getElementById('question3-select').value;
    const a3 = document.getElementById('question3').value;

    if (!q1 || !q2 || !q3 || !a1 || !a2 || !a3) {
        showToast('Please answer all security questions', 'error');
        return;
    }

    try {
        if (currentUser) {
            await firebase.firestore().collection('users').doc(currentUser.uid).update({
                securityQuestions: {
                    question1: {
                        question: q1,
                        answer: CryptoJS.SHA256(a1.toLowerCase().trim()).toString()
                    },
                    question2: {
                        question: q2,
                        answer: CryptoJS.SHA256(a2.toLowerCase().trim()).toString()
                    },
                    question3: {
                        question: q3,
                        answer: CryptoJS.SHA256(a3.toLowerCase().trim()).toString()
                    }
                },
                registrationComplete: true // Mark registration as complete
            });
        }

        showStep('register', 5);
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 3000);

    } catch (error) {
        console.error('Error saving security questions:', error);
        showToast('Failed to save security questions', 'error');
    }
}

// ========================================
// FORGOT PASSWORD
// ========================================

function showForgotPassword() {
    hideAllFlows();
    showFlow('forgot-password');
    updateSteps(1);
}

async function handleForgotPasswordStep1(event) {
    event.preventDefault();

    const email = document.getElementById('forgot-email').value;

    try {
        // Check if user exists
        const userQuery = await firebase.firestore()
            .collection('users')
            .where('email', '==', email)
            .get();

        if (userQuery.empty) {
            showToast('No account found with this email', 'error');
            return;
        }

        const userData = userQuery.docs[0].data();
        
        // Load and display security questions
        if (userData.securityQuestions) {
            loadSecurityQuestions(userData.securityQuestions);
            showStep('forgot-password', 2);
        } else {
            showToast('Security questions not set up for this account', 'error');
        }

    } catch (error) {
        console.error('Password reset error:', error);
        showToast('An error occurred. Please try again.', 'error');
    }
}

function loadSecurityQuestions(questions) {
    const container = document.getElementById('recovery-questions');
    container.innerHTML = '';

    const questionTexts = {
        pet: "What was the name of your first pet?",
        city: "In what city were you born?",
        school: "What is the name of your elementary school?",
        car: "What was the make of your first car?",
        food: "What is your favorite food?",
        teacher: "What was your favorite teacher's name?",
        maiden: "What is your mother's maiden name?",
        street: "What street did you grow up on?",
        job: "What was your first job?",
        movie: "What is your favorite movie?",
        book: "What is your favorite book?",
        vacation: "Where did you go on your first vacation?",
        nickname: "What was your childhood nickname?",
        friend: "What is your best friend's name?",
        sport: "What is your favorite sport?",
        sibling: "What is your oldest sibling's name?",
        color: "What is your favorite color?",
        hospital: "In what hospital were you born?"
    };

    Object.entries(questions).forEach(([key, data], index) => {
        const questionDiv = document.createElement('div');
        questionDiv.className = 'form-group';
        questionDiv.innerHTML = `
            <label>
                <span class="question-number">${index + 1}</span>
                ${questionTexts[data.question] || data.question}
            </label>
            <input type="text" id="recovery-answer-${index}" 
                   required placeholder="Your answer..." 
                   class="security-question-input" />
        `;
        container.appendChild(questionDiv);
    });
}

async function verifySecurityQuestions(event) {
    event.preventDefault();

    // In production, verify answers against stored hashes
    showStep('forgot-password', 3);
}

async function resetPassword(event) {
    event.preventDefault();

    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-new-password').value;

    if (newPassword !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
    }

    try {
        // In production, use Firebase password reset
        if (firebase.auth().currentUser) {
            await firebase.auth().currentUser.updatePassword(newPassword);
        }
        
        showToast('Password reset successful!', 'success');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 2000);

    } catch (error) {
        console.error('Password reset error:', error);
        showToast('Failed to reset password', 'error');
    }
}

// ========================================
// TRUSTED DEVICES
// ========================================

async function saveTrustedDevice(userId) {
    try {
        const deviceId = await getDeviceFingerprint();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

        await firebase.firestore().collection('trustedDevices').doc(`${userId}-${deviceId}`).set({
            userId: userId,
            deviceId: deviceId,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            expiresAt: expiresAt
        });
    } catch (error) {
        console.error('Error saving trusted device:', error);
    }
}

async function checkTrustedDevice(userId) {
    try {
        const deviceId = await getDeviceFingerprint();
        const doc = await firebase.firestore()
            .collection('trustedDevices')
            .doc(`${userId}-${deviceId}`)
            .get();

        if (!doc.exists) return false;

        const data = doc.data();
        const expiresAt = data.expiresAt.toDate();
        
        return expiresAt > new Date();
    } catch (error) {
        console.error('Error checking trusted device:', error);
        return false;
    }
}

async function getDeviceFingerprint() {
    // Simple device fingerprinting (in production, use a library like FingerprintJS)
    const ua = navigator.userAgent;
    const screen = `${window.screen.width}x${window.screen.height}`;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    const fingerprint = `${ua}-${screen}-${timezone}`;
    return CryptoJS.SHA256(fingerprint).toString();
}

// ========================================
// NAVIGATION HELPERS
// ========================================

function goBackToLogin() {
    hideAllFlows();
    showFlow('login');
    showStep('login', 1);
}

function showAlternativeMFA() {
    // Go back to MFA methods selection
    document.querySelectorAll('.mfa-method-content').forEach(content => {
        content.style.display = 'none';
    });
    document.getElementById('mfa-methods').style.display = 'grid';
}