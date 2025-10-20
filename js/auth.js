// Authentication Module with Password Strength Indicator and Name

let encryptionKey = null;
let isShowingDashboard = false; // Flag to prevent double dashboard load

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
    
    const name = document.getElementById('reg-name').value;
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
        
        // Store user data including name
        await firebase.firestore().collection('users').doc(userCredential.user.uid).set({
            name: name,
            email: email,
            twoFactorEnabled: enable2FA,
            createdAt: new Date()
        });
        
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

// Typewriter effect for welcome message
function typeWriter(element, text, speed = 50) {
    let i = 0;
    element.textContent = '';
    
    function type() {
        if (i < text.length) {
            element.textContent += text.charAt(i);
            i++;
            setTimeout(type, speed);
        }
    }
    
    type();
}

// Show dashboard after successful login
async function showDashboard(user) {
    // Prevent double execution
    if (isShowingDashboard) return;
    isShowingDashboard = true;
    
    document.getElementById('auth-container').style.display = 'none';
    
    // Hide hero and info sections when logged in
    const heroSection = document.getElementById('hero-section');
    const infoSection = document.getElementById('features');
    const navLinks = document.getElementById('nav-links');
    
    if (heroSection) heroSection.style.display = 'none';
    if (infoSection) infoSection.style.display = 'none';
    if (navLinks) navLinks.style.display = 'none';
    
    document.getElementById('dashboard').classList.add('active');
    document.getElementById('nav-user').style.display = 'block';
    document.getElementById('user-email').textContent = user.email;
    
    // Clear and reset the dashboard title immediately
    const dashboardTitle = document.querySelector('.dashboard-header h1');
    dashboardTitle.textContent = ''; // Clear it first
    
    // Get user's name from Firestore
    try {
        const userDoc = await firebase.firestore().collection('users').doc(user.uid).get();
        
        if (userDoc.exists && userDoc.data().name) {
            const userName = userDoc.data().name;
            
            // Create typewriter effect for welcome message
            const welcomeMessages = [
                `Welcome back, ${userName}.`,
                `Identity verified. Welcome, ${userName}.`,
                `You're in, ${userName}. Let's keep your world secure.`
            ];
            
            // Pick a random message
            const message = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];
            
            // Apply typewriter effect
            typeWriter(dashboardTitle, message, 60);
        } else {
            // Fallback if no name found
            typeWriter(dashboardTitle, 'Access granted. Your vault is secure.', 60);
        }
    } catch (error) {
        console.error('Error fetching user data:', error);
        typeWriter(dashboardTitle, 'Welcome to Your Secure Vault', 60);
    }
    
    // Load user's passwords
    loadPasswords();
}

// Logout function
async function logout() {
    try {
        await firebase.auth().signOut();
        encryptionKey = null;
        isShowingDashboard = false;
        
        // Hide auth container initially - user must click to show it
        document.getElementById('auth-container').style.display = 'none';
        
        // Show hero and info sections when logged out
        const heroSection = document.getElementById('hero-section');
        const infoSection = document.getElementById('features');
        const navLinks = document.getElementById('nav-links');
        
        if (heroSection) heroSection.style.display = 'block';
        if (infoSection) infoSection.style.display = 'block';
        if (navLinks) navLinks.style.display = 'flex';
        
        document.getElementById('dashboard').classList.remove('active');
        document.getElementById('nav-user').style.display = 'none';
        
        // Reset dashboard title
        const dashboardTitle = document.querySelector('.dashboard-header h1');
        dashboardTitle.textContent = 'Welcome to Your Secure Vault';
        
        showToast('Logged out successfully', 'success');
    } catch (error) {
        console.error('Logout error:', error);
        showToast('Logout failed', 'error');
    }
}

// Check authentication state on page load
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        // User is signed in - only show dashboard if not already showing
        if (!isShowingDashboard) {
            showDashboard(user);
        }
    } else {
        // User is signed out
        isShowingDashboard = false;
        
        // IMPORTANT: Keep auth container hidden on landing page
        // It will be shown when user clicks "Sign In" button
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('dashboard').classList.remove('active');
        
        // Make sure landing sections are visible
        const heroSection = document.getElementById('hero-section');
        const infoSection = document.getElementById('features');
        const navLinks = document.getElementById('nav-links');
        
        if (heroSection) heroSection.style.display = 'block';
        if (infoSection) infoSection.style.display = 'block';
        if (navLinks) navLinks.style.display = 'flex';
    }
});