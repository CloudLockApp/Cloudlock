// Authentication Module with Password Strength Indicator

let encryptionKey = null;

// Password requirements validation
const requirements = {
    length: password => password.length >= 8,
    uppercase: password => /[A-Z]/.test(password),
    lowercase: password => /[a-z]/.test(password),
    number: password => /[0-9]/.test(password),
    special: password => /[!@#$%^&*(),.?":{}|<>]/.test(password)
};

// Initialize password strength checker when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    const passwordInput = document.getElementById('reg-password');
    const confirmPasswordInput = document.getElementById('reg-confirm');
    
    if (passwordInput) {
        passwordInput.addEventListener('input', updatePasswordStrength);
    }
    
    if (confirmPasswordInput) {
        confirmPasswordInput.addEventListener('input', updateSubmitButton);
    }
});

// Update password strength indicator
function updatePasswordStrength() {
    const password = document.getElementById('reg-password').value;
    const strengthBar = document.getElementById('strengthBar');
    const strengthText = document.getElementById('strengthText');
    let metCount = 0;

    // Check each requirement
    Object.keys(requirements).forEach(req => {
        const requirementItem = document.querySelector(`[data-requirement="${req}"]`);
        if (!requirementItem) return;
        
        const isMet = requirements[req](password);

        if (isMet) {
            requirementItem.classList.add('met');
            metCount++;
        } else {
            requirementItem.classList.remove('met');
        }

        // Add active class when typing
        if (password.length > 0) {
            requirementItem.classList.add('active');
        } else {
            requirementItem.classList.remove('active');
        }
    });

    // Update strength bar
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

    // Enable/disable submit button
    updateSubmitButton();
}

// Update submit button state
function updateSubmitButton() {
    const password = document.getElementById('reg-password').value;
    const confirmPassword = document.getElementById('reg-confirm').value;
    const submitBtn = document.getElementById('registerSubmitBtn');
    
    if (!submitBtn) return;
    
    const allMet = Object.keys(requirements).every(req => requirements[req](password));
    const passwordsMatch = password === confirmPassword && password.length > 0;

    if (allMet && passwordsMatch) {
        submitBtn.classList.add('enabled');
        submitBtn.style.opacity = '1';
        submitBtn.style.pointerEvents = 'all';
    } else {
        submitBtn.classList.remove('enabled');
        submitBtn.style.opacity = '0.5';
        submitBtn.style.pointerEvents = 'none';
    }
}

// Switch between login and register tabs
function switchTab(tab) {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const tabs = document.querySelectorAll('.tab-btn');
    
    tabs.forEach(btn => btn.classList.remove('active'));
    
    if (tab === 'login') {
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
        tabs[0].classList.add('active');
    } else {
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
        tabs[1].classList.add('active');
    }
}

// Handle user registration
async function handleRegister(event) {
    event.preventDefault();
    
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const confirmPassword = document.getElementById('reg-confirm').value;
    const enable2FA = document.getElementById('enable-2fa').checked;
    
    // Validate password match
    if (password !== confirmPassword) {
        showToast('Passwords do not match!', 'error');
        return;
    }
    
    // Validate all password requirements are met
    const allMet = Object.keys(requirements).every(req => requirements[req](password));
    if (!allMet) {
        showToast('Please meet all password requirements', 'error');
        return;
    }
    
    try {
        // Show loading state
        const submitBtn = event.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Account...';
        submitBtn.disabled = true;
        
        // Create user with Firebase
        const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
        
        // Set encryption key
        encryptionKey = password;
        
        // Store user preferences (2FA setting)
        if (enable2FA) {
            // In production, you would set up 2FA here
            await firebase.firestore().collection('users').doc(userCredential.user.uid).set({
                email: email,
                twoFactorEnabled: enable2FA,
                createdAt: new Date()
            });
        }
        
        showToast('Account created successfully!', 'success');
        
        // Auto-login after registration
        showDashboard(userCredential.user);
        
    } catch (error) {
        console.error('Registration error:', error);
        let errorMessage = 'Registration failed. Please try again.';
        
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = 'This email is already registered. Please login instead.';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Invalid email address.';
        } else if (error.code === 'auth/weak-password') {
            errorMessage = 'Password is too weak.';
        }
        
        showToast(errorMessage, 'error');
        
        // Reset button
        const submitBtn = event.target.querySelector('button[type="submit"]');
        submitBtn.innerHTML = '<i class="fas fa-user-plus"></i> Create Secure Account';
        submitBtn.disabled = false;
    }
}

// Handle user login
async function handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const twoFactorCode = document.getElementById('login-2fa').value;
    
    try {
        // Show loading state
        const submitBtn = event.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
        submitBtn.disabled = true;
        
        // Sign in with Firebase
        const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
        
        // Set encryption key
        encryptionKey = password;
        
        // Check if 2FA is required
        if (twoFactorCode) {
            // In production, verify 2FA code here
            // For now, we'll just accept it
        }
        
        showToast('Login successful!', 'success');
        showDashboard(userCredential.user);
        
    } catch (error) {
        console.error('Login error:', error);
        let errorMessage = 'Login failed. Please check your credentials.';
        
        if (error.code === 'auth/user-not-found') {
            errorMessage = 'No account found with this email.';
        } else if (error.code === 'auth/wrong-password') {
            errorMessage = 'Incorrect password.';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Invalid email address.';
        }
        
        showToast(errorMessage, 'error');
        
        // Reset button
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// Show dashboard after successful login
function showDashboard(user) {
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('dashboard').classList.add('active');
    document.getElementById('nav-user').style.display = 'block';
    document.getElementById('user-email').textContent = user.email;
    
    // Load user's passwords
    loadPasswords();
}

// Logout function
async function logout() {
    try {
        await firebase.auth().signOut();
        encryptionKey = null;
        
        document.getElementById('auth-container').style.display = 'block';
        document.getElementById('dashboard').classList.remove('active');
        document.getElementById('nav-user').style.display = 'none';
        
        showToast('Logged out successfully', 'success');
    } catch (error) {
        console.error('Logout error:', error);
        showToast('Logout failed', 'error');
    }
}

// Check authentication state on page load
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        // User is signed in
        showDashboard(user);
    } else {
        // User is signed out
        document.getElementById('auth-container').style.display = 'block';
        document.getElementById('dashboard').classList.remove('active');
    }
});