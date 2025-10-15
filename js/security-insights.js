// Security Insights Module - Contextual password education
// Shows helpful tips when users create weak passwords

// Pattern detection rules
const securityPatterns = {
    seasonal: {
        regex: /(spring|summer|fall|autumn|winter)\d{4}/i,
        message: "Seasonal patterns like 'Summer2024' are commonly checked by hackers.",
        severity: "medium"
    },
    sequential: {
        regex: /(123|234|345|456|567|678|789|abc|bcd|cde)/i,
        message: "Sequential characters are easy to guess and crack.",
        severity: "high"
    },
    keyboard: {
        regex: /(qwerty|asdf|zxcv|qazwsx)/i,
        message: "Keyboard patterns are among the first things hackers try.",
        severity: "high"
    },
    repeated: {
        regex: /(.)\1{2,}/,
        message: "Repeating characters significantly weaken your password.",
        severity: "high"
    },
    common: {
        words: ['password', 'admin', 'welcome', 'letmein', 'monkey', 'dragon'],
        message: "This is a commonly used password found in breach databases.",
        severity: "critical"
    },
    personal: {
        regex: /(name|birthday|address|phone|email)/i,
        message: "Avoid personal information - it's easily discoverable online.",
        severity: "high"
    },
    yearOnly: {
        regex: /^\d{4}$/,
        message: "Years alone are extremely weak passwords.",
        severity: "critical"
    },
    simple: {
        regex: /^[a-z]+$/i,
        message: "Passwords with only letters are vulnerable to dictionary attacks.",
        severity: "high"
    },
    numbersOnly: {
        regex: /^\d+$/,
        message: "Numeric-only passwords can be cracked in seconds.",
        severity: "critical"
    },
    shortLength: {
        check: (pwd) => pwd.length < 8,
        message: "Short passwords are exponentially easier to crack. Aim for 12+ characters.",
        severity: "critical"
    },
    noSpecialChars: {
        check: (pwd) => !/[!@#$%^&*(),.?":{}|<>]/.test(pwd),
        message: "Adding special characters makes passwords significantly stronger.",
        severity: "medium"
    },
    noNumbers: {
        check: (pwd) => !/\d/.test(pwd),
        message: "Including numbers increases password complexity.",
        severity: "medium"
    },
    leetspeak: {
        regex: /[0-9@$!][a-z][0-9@$!]/i,
        message: "Simple substitutions (3 for E, 0 for O) don't fool modern cracking tools.",
        severity: "medium"
    }
};

// Track dismissed insights per password
const dismissedInsights = new Set();

// Analyze password and return detected issues
function analyzePasswordPatterns(password) {
    const issues = [];
    
    // Check regex patterns
    for (const [key, pattern] of Object.entries(securityPatterns)) {
        if (pattern.regex && pattern.regex.test(password)) {
            issues.push({
                type: key,
                message: pattern.message,
                severity: pattern.severity
            });
        }
        
        // Check custom functions
        if (pattern.check && pattern.check(password)) {
            issues.push({
                type: key,
                message: pattern.message,
                severity: pattern.severity
            });
        }
        
        // Check word lists
        if (pattern.words) {
            const lowerPwd = password.toLowerCase();
            for (const word of pattern.words) {
                if (lowerPwd.includes(word)) {
                    issues.push({
                        type: key,
                        message: pattern.message,
                        severity: pattern.severity
                    });
                    break;
                }
            }
        }
    }
    
    // Prioritize by severity
    issues.sort((a, b) => {
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return severityOrder[a.severity] - severityOrder[b.severity];
    });
    
    return issues;
}

// Show insight notification
function showSecurityInsight(password, siteName = null) {
    const issues = analyzePasswordPatterns(password);
    
    // If password is strong, don't show anything
    if (issues.length === 0) {
        dismissInsight();
        return false;
    }
    
    // Check if this is "Add New Password" mode (no password-id)
    const passwordId = document.getElementById('password-id')?.value;
    const isNewPassword = !passwordId || passwordId === '';
    
    // ONLY show insights when EDITING existing passwords, not adding new ones
    if (isNewPassword) {
        dismissInsight();
        return false;
    }
    
    // Get the most critical issue
    const primaryIssue = issues[0];
    
    // Create insight card with "Did you know?" style
    const insightHTML = `
        <div class="security-insight" id="security-insight">
            <div class="insight-content">
                <div class="insight-icon">💡</div>
                <div class="insight-text">
                    <div class="insight-title">Did you know?</div>
                    <div class="insight-message">${primaryIssue.message}</div>
                </div>
                <button class="insight-dismiss" onclick="dismissInsight()" title="Dismiss">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="insight-actions">
                <button class="btn-insight" onclick="generateBetterPasswordFromInsight(event)">
                    <i class="fas fa-magic"></i>
                    Generate Better
                </button>
                ${issues.length > 1 ? `<button class="btn-insight-secondary" onclick="showAllIssues(event, ${JSON.stringify(issues).replace(/"/g, '&quot;')})">All Issues (${issues.length})</button>` : ''}
            </div>
        </div>
    `;
    
    // Remove existing insight if present
    dismissInsight();
    
    // Insert after password input in modal
    const passwordInput = document.getElementById('site-password');
    if (passwordInput) {
        passwordInput.insertAdjacentHTML('afterend', insightHTML);
        
        // Animate in
        setTimeout(() => {
            const insight = document.getElementById('security-insight');
            if (insight) insight.classList.add('show');
        }, 100);
        
        return true;
    }
    
    return false;
}

// Show insight on dashboard for existing passwords - DISABLED (WEAK badge is enough)
function showDashboardInsight(passwordId, password, siteName) {
    // Disabled - the WEAK/FAIR/GOOD badge is sufficient
    return '';
}

// Ignore/dismiss dashboard insight
function ignoreDashboardInsight(event, passwordId) {
    event.preventDefault();
    event.stopPropagation();
    
    const insightKey = `${passwordId}`;
    dismissedInsights.add(insightKey);
    
    const insightElement = document.getElementById(`insight-${passwordId}`);
    if (insightElement) {
        insightElement.style.opacity = '0';
        insightElement.style.transform = 'scale(0.8)';
        setTimeout(() => insightElement.remove(), 300);
    }
}

// Dismiss insight notification
function dismissInsight() {
    const insight = document.getElementById('security-insight');
    if (insight) {
        insight.classList.remove('show');
        setTimeout(() => insight.remove(), 300);
    }
}

// Show all detected issues in a modal
function showAllIssues(event, issues) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    const issuesHTML = issues.map(issue => {
        const severityColor = {
            critical: '#ef4444',
            high: '#f97316',
            medium: '#f59e0b',
            low: '#10b981'
        };
        
        return `
            <div class="issue-item">
                <div class="issue-severity" style="background: ${severityColor[issue.severity]};">
                    ${issue.severity}
                </div>
                <div class="issue-message">${issue.message}</div>
            </div>
        `;
    }).join('');
    
    const modal = `
        <div class="modal active" id="issues-modal" onclick="closeIssuesModalBackground(event)">
            <div class="modal-content" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h2>Security Issues Detected</h2>
                    <button class="close-btn" onclick="closeIssuesModal(event)">&times;</button>
                </div>
                <div class="issues-list">
                    ${issuesHTML}
                </div>
                <button class="btn btn-full" onclick="closeIssuesModal(event)">
                    Got It
                </button>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modal);
}

// Close issues modal
function closeIssuesModal(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    const modal = document.getElementById('issues-modal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
    }
}

// Close modal when clicking background
function closeIssuesModalBackground(event) {
    if (event.target.id === 'issues-modal') {
        closeIssuesModal(event);
    }
}

// Generate better password and fill it in
function generateBetterPasswordFromInsight(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    dismissInsight();
    
    // Check if password generator modal exists
    if (typeof openPasswordGeneratorModal === 'function') {
        openPasswordGeneratorModal();
    } else {
        // Fallback: generate simple strong password
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
        let newPassword = '';
        for (let i = 0; i < 16; i++) {
            newPassword += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        
        const passwordInput = document.getElementById('site-password');
        if (passwordInput) {
            passwordInput.value = newPassword;
            passwordInput.dispatchEvent(new Event('input'));
            showToast('Strong password generated!', 'success');
        }
    }
}

// Fix password from dashboard
function fixPasswordFromDashboard(event, passwordId) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    editPassword(passwordId);
    
    // Show tip when modal opens AND check the pre-filled password
    setTimeout(() => {
        const passwordInput = document.getElementById('site-password');
        if (passwordInput && passwordInput.value) {
            const currentPassword = passwordInput.value;
            // Manually trigger insight check for pre-filled password
            showSecurityInsight(currentPassword);
        }
    }, 500);
}

// Check password in real-time as user types
function enableRealtimeInsights() {
    const passwordInput = document.getElementById('site-password');
    if (!passwordInput) return;
    
    // Check if already has listener
    if (passwordInput.dataset.insightEnabled === 'true') {
        return;
    }
    
    passwordInput.dataset.insightEnabled = 'true';
    
    let debounceTimer;
    
    passwordInput.addEventListener('input', function(e) {
        clearTimeout(debounceTimer);
        
        // Wait for user to stop typing
        debounceTimer = setTimeout(() => {
            const password = e.target.value;
            
            // Only show if password has substance
            if (password.length >= 4) {
                const siteName = document.getElementById('site-name')?.value;
                showSecurityInsight(password, siteName);
            } else {
                dismissInsight();
            }
        }, 1000); // 1 second delay
    });
    
    // ADDED: Check if there's already a password value when modal opens (for edit mode)
    setTimeout(() => {
        if (passwordInput.value && passwordInput.value.length >= 4) {
            const siteName = document.getElementById('site-name')?.value;
            showSecurityInsight(passwordInput.value, siteName);
        }
    }, 1500); // Slight delay to let the modal populate
}

// Initialize insights on page load
document.addEventListener('DOMContentLoaded', function() {
    // Enable real-time insights when password modal opens
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.target.id === 'password-modal' && 
                mutation.target.classList.contains('active')) {
                enableRealtimeInsights();
            }
        });
    });
    
    const passwordModal = document.getElementById('password-modal');
    if (passwordModal) {
        observer.observe(passwordModal, {
            attributes: true,
            attributeFilter: ['class']
        });
    }
});