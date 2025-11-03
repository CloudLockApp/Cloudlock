// Security Monitor Module

// Simulate dark web monitoring
function startDarkWebMonitoring() {
    if (!firebase.auth().currentUser) return;

    // Simulate checking every 30 seconds
    setInterval(() => {
        checkDarkWebStatus();
    }, 30000);

    // Check immediately on load
    checkDarkWebStatus();
}

// Check dark web breach status
async function checkDarkWebStatus() {
    const statusElement = document.getElementById('dark-web-status');
    if (!statusElement) return;

    // Simulate random breach detection (5% chance)
    const isBreached = Math.random() < 0.05;

    if (isBreached) {
        statusElement.className = 'status-indicator status-danger';
        statusElement.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Breach Detected!';
        showToast('⚠️ Potential credential breach detected! Please review your passwords.', 'warning');
    } else {
        statusElement.className = 'status-indicator status-active';
        statusElement.innerHTML = '<i class="fas fa-check-circle"></i> No Breaches Detected';
    }

    // Update last scan time
    const scanTime = document.querySelector('#dark-web-status').parentElement.querySelector('p');
    if (scanTime) {
        const now = new Date();
        scanTime.textContent = `Last scan: ${now.toLocaleTimeString()}`;
    }
}

// Analyze password strength across all passwords
async function analyzePasswordSecurity() {
    if (!firebase.auth().currentUser) return;

    const userId = firebase.auth().currentUser.uid;

    try {
        const snapshot = await firebase.firestore()
            .collection('passwords')
            .where('userId', '==', userId)
            .get();

        let weakPasswords = 0;
        let reusedPasswords = new Set();
        let passwordMap = new Map();

        snapshot.forEach(doc => {
            const data = doc.data();
            const decryptedPassword = decrypt(data.password);

            // Check password strength
            const strength = calculatePasswordStrength(decryptedPassword);
            if (strength < 3) {
                weakPasswords++;
            }

            // Check for reused passwords
            if (passwordMap.has(decryptedPassword)) {
                reusedPasswords.add(decryptedPassword);
            }
            passwordMap.set(decryptedPassword, doc.id);
        });

        // Show warnings if issues found
        if (weakPasswords > 0) {
            console.warn(`⚠️ ${weakPasswords} weak passwords detected`);
        }

        if (reusedPasswords.size > 0) {
            console.warn(`⚠️ ${reusedPasswords.size} passwords are reused`);
            showToast(`Warning: ${reusedPasswords.size} passwords are reused across multiple sites`, 'warning');
        }

        return {
            total: snapshot.size,
            weak: weakPasswords,
            reused: reusedPasswords.size
        };
    } catch (error) {
        console.error('Error analyzing password security:', error);
        return null;
    }
}

// Calculate password strength score (1-100)
function calculatePasswordStrength(password) {
    let strength = 0;

    // Length check
    if (password.length <= 4) {
        strength -= 20;
    }
    else if (password.length <= 7){
        strength -= 10;
    }
    else if (password.length <= 10){
        strength += 5;
    }
    else if (password.length <= 15) {
        strength += 15;
    }
    else {
        strength += 25;
    }

    // Character variety checks
    if (/[a-z]/.test(password)){
         strength += 5;
    }
    if (/[A-Z]/.test(password)) {
        strength += 10;
    }
    if (/[0-9]/.test(password)) {
        strength += 10;
    }
    
    const symbolCount = (password.match(/[^A-Za-z0-9]/g) || []).length;
    if (symbolCount > 0){
        strength += 20 + (symbolCount - 1) * 10;
    }

    // Deduct for repeated characters
    for (let i = 1; i < password.length; i++) {
        if (password[i] === password[i - 1]) {
            strength -= 5;
        }
    }
    if (/^[0-9]+$/.test(password)) strength -= 30; // Only numbers
    if (/^[a-zA-Z]+$/.test(password)) strength -= 30; // Only letters

    (function applySequentialPenalty() {
      const lower = password.toLowerCase();
      const sources = [
        "abcdefghijklmnopqrstuvwxyz",
        "01234567890",
        "qwertyuiopasdfghjklzxcvbnm"
      ];

      function countRuns(source) {
        let penalty = 0;

        // forward + reversed
        const reversed = source.split("").reverse().join("");
        const both = [source, reversed];
    
        for (const seq of both) {
          for (let i = 0; i < lower.length - 2; i++) {
            const slice = lower.substr(i, 3);
            if (seq.includes(slice)) {
              penalty += 20;
            }
          }
        }
        return penalty;
      }
    
      for (const s of sources) {
        strength -= countRuns(s);
      }
    })();
    
    // Top common passwords mostly according to NordPass and SplashData
    const commonPasswords = ["password", "qwerty123", "secret", "iloveyou", "dragon", "monkey", "1q2w3e4r", "admin", "lovely", "welcome", "princess", "dragon", "hello", "hi", "google", "computer", "login", "football", "starwars", "baseball", "superman"];

    const lower = password.toLowerCase();
    for (const w of commonPasswords) {
        if (lower.includes(w)) {
            strength -= 100;
            break; // no need to continue checking further
        }
    }

    if (strength > 100) strength = 100;
    if (strength < 0) strength = 0;

    return strength;
}

// Self-destruct functionality
function confirmSelfDestruct() {
    const confirmed = confirm('⚠️ CRITICAL WARNING ⚠️\n\nThis will PERMANENTLY DELETE all your passwords across all devices and cloud storage!\n\nThis action CANNOT be undone!\n\nType "DELETE" in the next prompt to confirm.');
    
    if (confirmed) {
        const finalConfirmation = prompt('Type DELETE to confirm self-destruct:');
        
        if (finalConfirmation === 'DELETE') {
            executeSelfDestruct();
        } else {
            showToast('Self-destruct cancelled', 'warning');
        }
    }
}

// Execute self-destruct
async function executeSelfDestruct() {
    if (!firebase.auth().currentUser) {
        showToast('Not authenticated', 'error');
        return;
    }

    const userId = firebase.auth().currentUser.uid;

    try {
        showToast('🔥 Initiating self-destruct sequence...', 'warning');

        // Delete all passwords
        const snapshot = await firebase.firestore()
            .collection('passwords')
            .where('userId', '==', userId)
            .get();

        const deletePromises = [];
        snapshot.forEach(doc => {
            deletePromises.push(doc.ref.delete());
        });

        await Promise.all(deletePromises);

        // Delete user data
        await firebase.firestore()
            .collection('users')
            .doc(userId)
            .delete();

        showToast('✅ All data has been permanently deleted', 'success');

        // Log out user
        setTimeout(() => {
            logout();
        }, 2000);

    } catch (error) {
        console.error('Self-destruct error:', error);
        showToast('Failed to complete self-destruct', 'error');
    }
}

// Monitor user activity for security
let lastActivity = Date.now();
let inactivityTimer = null;

function initializeSecurityMonitoring() {
    // Track user activity
    ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(event => {
        document.addEventListener(event, () => {
            lastActivity = Date.now();
        });
    });

    // Check for inactivity every minute
    inactivityTimer = setInterval(() => {
        const inactiveTime = Date.now() - lastActivity;
        const inactiveMinutes = Math.floor(inactiveTime / 60000);

        // Auto-logout after 30 minutes of inactivity
        if (inactiveMinutes >= 30 && firebase.auth().currentUser) {
            showToast('Auto-logout due to inactivity', 'warning');
            logout();
        }
    }, 60000);
}

// Check if browser is secure (HTTPS)
function checkBrowserSecurity() {
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
        console.warn('⚠️ WARNING: Not using HTTPS! Connection is not secure.');
        showToast('Warning: Connection is not secure. Please use HTTPS.', 'warning');
    }
}

// Initialize security monitoring on load
document.addEventListener('DOMContentLoaded', () => {
    initializeSecurityMonitoring();
    checkBrowserSecurity();
    
    // Start dark web monitoring when user logs in
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            startDarkWebMonitoring();
            analyzePasswordSecurity();
        }
    });
});

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        startDarkWebMonitoring,
        checkDarkWebStatus,
        analyzePasswordSecurity,
        calculatePasswordStrength,
        confirmSelfDestruct,
        executeSelfDestruct
    };
}