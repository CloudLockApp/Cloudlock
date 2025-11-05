// HaveIBeenPwned Integration Module
// Checks emails and passwords against breach databases

const HIBP_API_BASE = 'https://api.pwnedpasswords.com';
const HIBP_BREACH_API = 'https://haveibeenpwned.com/api/v3';

// Configuration
const HIBP_CONFIG = {
    userAgent: 'CloudLock-Password-Manager',
    apiKey: null, // Users should set this in config.js for breach checking
    rateLimit: 1500, // milliseconds between requests
    cacheExpiry: 24 * 60 * 60 * 1000 // 24 hours
};

// Cache for breach results
let breachCache = {
    emails: new Map(),
    passwords: new Map()
};

// ==========================================
// PASSWORD BREACH CHECK (K-Anonymity)
// ==========================================

/**
 * Check if a password has been pwned using k-anonymity
 * Only sends first 5 chars of SHA-1 hash to API
 * @param {string} password - Password to check
 * @returns {Promise<number>} Number of times password appears in breaches (0 = safe)
 */
async function checkPasswordPwned(password) {
    try {
        // Check cache first
        const cacheKey = CryptoJS.SHA1(password).toString();
        const cached = breachCache.passwords.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < HIBP_CONFIG.cacheExpiry) {
            return cached.count;
        }

        // Generate SHA-1 hash
        const hash = CryptoJS.SHA1(password).toString().toUpperCase();
        const prefix = hash.substring(0, 5);
        const suffix = hash.substring(5);

        // Query HIBP API with k-anonymity
        const response = await fetch(`${HIBP_API_BASE}/range/${prefix}`, {
            headers: {
                'Add-Padding': 'true' // Adds random padding to prevent traffic analysis
            }
        });

        if (!response.ok) {
            throw new Error('HIBP API error: ' + response.status);
        }

        const text = await response.text();
        const hashes = text.split('\n');

        // Find matching hash
        let pwnCount = 0;
        for (const line of hashes) {
            const [hashSuffix, count] = line.split(':');
            if (hashSuffix === suffix) {
                pwnCount = parseInt(count, 10);
                break;
            }
        }

        // Cache result
        breachCache.passwords.set(cacheKey, {
            count: pwnCount,
            timestamp: Date.now()
        });

        return pwnCount;

    } catch (error) {
        console.error('Error checking password:', error);
        return -1; // Return -1 to indicate error, not breach
    }
}

/**
 * Check multiple passwords in batch
 * @param {Array<{id: string, password: string}>} passwords - Array of password objects
 * @returns {Promise<Array<{id: string, count: number}>>}
 */
async function checkMultiplePasswords(passwords) {
    const results = [];
    
    for (let i = 0; i < passwords.length; i++) {
        const { id, password } = passwords[i];
        const count = await checkPasswordPwned(password);
        
        results.push({
            id: id,
            count: count,
            breached: count > 0
        });

        // Rate limiting
        if (i < passwords.length - 1) {
            await sleep(HIBP_CONFIG.rateLimit);
        }
    }
    
    return results;
}

// ==========================================
// EMAIL BREACH CHECK
// ==========================================

/**
 * Check if an email has appeared in data breaches
 * Requires API key from haveibeenpwned.com
 * @param {string} email - Email address to check
 * @returns {Promise<Array>} Array of breach objects
 */
async function checkEmailBreaches(email) {
    try {
        // Check cache first
        const cached = breachCache.emails.get(email);
        if (cached && Date.now() - cached.timestamp < HIBP_CONFIG.cacheExpiry) {
            return cached.breaches;
        }

        // Check if API key is configured
        if (!HIBP_CONFIG.apiKey && CONFIG.hibp && CONFIG.hibp.apiKey) {
            HIBP_CONFIG.apiKey = CONFIG.hibp.apiKey;
        }

        if (!HIBP_CONFIG.apiKey) {
            console.warn('HIBP API key not configured. Email breach checking disabled.');
            return [];
        }

        const response = await fetch(
            `${HIBP_BREACH_API}/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`,
            {
                headers: {
                    'hibp-api-key': HIBP_CONFIG.apiKey,
                    'user-agent': HIBP_CONFIG.userAgent
                }
            }
        );

        if (response.status === 404) {
            // No breaches found (good news!)
            breachCache.emails.set(email, {
                breaches: [],
                timestamp: Date.now()
            });
            return [];
        }

        if (!response.ok) {
            throw new Error('HIBP API error: ' + response.status);
        }

        const breaches = await response.json();

        // Cache result
        breachCache.emails.set(email, {
            breaches: breaches,
            timestamp: Date.now()
        });

        return breaches;

    } catch (error) {
        console.error('Error checking email breaches:', error);
        return [];
    }
}

/**
 * Get detailed breach information
 * @param {string} breachName - Name of the breach
 * @returns {Promise<Object>} Breach details
 */
async function getBreachDetails(breachName) {
    try {
        const response = await fetch(`${HIBP_BREACH_API}/breach/${breachName}`);
        
        if (!response.ok) {
            throw new Error('Failed to get breach details');
        }

        return await response.json();
    } catch (error) {
        console.error('Error getting breach details:', error);
        return null;
    }
}

// ==========================================
// FIREBASE INTEGRATION
// ==========================================

/**
 * Scan all user passwords for breaches
 * @returns {Promise<Object>} Scan results summary
 */
async function scanUserPasswords() {
    if (!firebase.auth().currentUser) {
        throw new Error('User not authenticated');
    }

    const userId = firebase.auth().currentUser.uid;
    
    try {
        showToast('🔍 Scanning passwords for breaches...', 'warning');
        
        // Get all passwords
        const snapshot = await firebase.firestore()
            .collection('passwords')
            .where('userId', '==', userId)
            .get();

        if (snapshot.empty) {
            return { total: 0, breached: 0, passwords: [] };
        }

        const passwords = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            passwords.push({
                id: doc.id,
                siteName: data.siteName,
                password: decrypt(data.password)
            });
        });

        // Check each password
        const results = await checkMultiplePasswords(passwords);

        // Store breach status in Firestore
        const updatePromises = results.map(result => {
            if (result.count > 0) {
                return firebase.firestore()
                    .collection('passwords')
                    .doc(result.id)
                    .update({
                        breached: true,
                        breachCount: result.count,
                        lastBreachCheck: firebase.firestore.FieldValue.serverTimestamp()
                    });
            }
            return Promise.resolve();
        });

        await Promise.all(updatePromises);

        const breachedCount = results.filter(r => r.breached).length;
        
        const summary = {
            total: passwords.length,
            breached: breachedCount,
            safe: passwords.length - breachedCount,
            passwords: results.filter(r => r.breached).map(r => {
                const pwd = passwords.find(p => p.id === r.id);
                return {
                    id: r.id,
                    siteName: pwd.siteName,
                    breachCount: r.count
                };
            })
        };

        if (breachedCount > 0) {
            showToast(`⚠️ ${breachedCount} password(s) found in ${breachedCount} data breach(es)!`, 'error');
        } else {
            showToast('✅ All passwords are safe!', 'success');
        }

        return summary;

    } catch (error) {
        console.error('Error scanning passwords:', error);
        showToast('Failed to scan passwords', 'error');
        throw error;
    }
}

/**
 * Check user's email for breaches
 * @returns {Promise<Object>} Breach summary
 */
async function checkUserEmailBreaches() {
    if (!firebase.auth().currentUser) {
        throw new Error('User not authenticated');
    }

    const email = firebase.auth().currentUser.email;
    
    try {
        showToast('🔍 Checking email for breaches...', 'warning');
        
        const breaches = await checkEmailBreaches(email);

        // Store in Firestore
        await firebase.firestore()
            .collection('users')
            .doc(firebase.auth().currentUser.uid)
            .update({
                emailBreaches: breaches.length,
                lastEmailCheck: firebase.firestore.FieldValue.serverTimestamp()
            });

        if (breaches.length > 0) {
            showToast(`⚠️ Email found in ${breaches.length} data breach(es)!`, 'error');
        } else {
            showToast('✅ Email not found in any breaches!', 'success');
        }

        return {
            email: email,
            breached: breaches.length > 0,
            count: breaches.length,
            breaches: breaches.map(b => ({
                name: b.Name,
                title: b.Title,
                domain: b.Domain,
                date: b.BreachDate,
                pwnCount: b.PwnCount,
                dataClasses: b.DataClasses
            }))
        };

    } catch (error) {
        console.error('Error checking email breaches:', error);
        showToast('Failed to check email', 'error');
        throw error;
    }
}

// ==========================================
// UI FUNCTIONS
// ==========================================

/**
 * Display breach scan results modal
 * @param {Object} results - Scan results
 */
function showBreachResults(results) {
    const modalHTML = `
        <div id="breach-results-modal" class="modal active">
            <div class="modal-content" style="max-width: 700px;">
                <div class="modal-header">
                    <h2><i class="fas fa-shield-alt"></i> Breach Scan Results</h2>
                    <button class="close-btn" onclick="closeModal('breach-results-modal')">&times;</button>
                </div>

                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 30px;">
                    <div class="stat-card">
                        <div class="stat-number">${results.total}</div>
                        <div class="stat-label">Total Passwords</div>
                    </div>
                    <div class="stat-card" style="border-color: ${results.breached > 0 ? '#ef4444' : '#10b981'};">
                        <div class="stat-number" style="color: ${results.breached > 0 ? '#ef4444' : '#10b981'};">${results.breached}</div>
                        <div class="stat-label">Breached</div>
                    </div>
                    <div class="stat-card" style="border-color: #10b981;">
                        <div class="stat-number" style="color: #10b981;">${results.safe}</div>
                        <div class="stat-label">Safe</div>
                    </div>
                </div>

                ${results.breached > 0 ? `
                    <div class="alert alert-warning" style="margin-bottom: 20px;">
                        <i class="fas fa-exclamation-triangle"></i>
                        <span><strong>Action Required:</strong> The following passwords have been found in data breaches and should be changed immediately.</span>
                    </div>

                    <div style="max-height: 400px; overflow-y: auto;">
                        ${results.passwords.map(pwd => `
                            <div class="breach-item" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 10px; padding: 15px; margin-bottom: 10px;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                                    <strong style="color: #fff; font-size: 1.1rem;">${pwd.siteName}</strong>
                                    <span style="color: #ef4444; font-size: 0.85rem; font-weight: 600;">
                                        <i class="fas fa-exclamation-circle"></i> 
                                        Seen ${pwd.breachCount.toLocaleString()} times
                                    </span>
                                </div>
                                <p style="font-size: 0.85rem; color: rgba(255,255,255,0.7); margin-bottom: 10px;">
                                    This password has appeared in ${pwd.breachCount.toLocaleString()} data breaches.
                                </p>
                                <button class="btn" onclick="editPassword('${pwd.id}'); closeModal('breach-results-modal');" style="padding: 8px 16px; font-size: 0.9rem;">
                                    <i class="fas fa-key"></i> Change Password
                                </button>
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <div style="text-align: center; padding: 40px 20px;">
                        <div style="width: 80px; height: 80px; margin: 0 auto 20px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 2.5rem; color: #fff;">
                            <i class="fas fa-check"></i>
                        </div>
                        <h3 style="font-size: 1.5rem; margin-bottom: 10px;">All Clear!</h3>
                        <p style="color: rgba(255,255,255,0.7);">None of your passwords have been found in data breaches.</p>
                    </div>
                `}

                <button class="btn btn-full" onclick="closeModal('breach-results-modal')" style="margin-top: 20px;">
                    <i class="fas fa-check"></i> Close
                </button>
            </div>
        </div>
    `;

    // Remove existing modal if present
    const existing = document.getElementById('breach-results-modal');
    if (existing) existing.remove();

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

/**
 * Display email breach results
 * @param {Object} results - Email breach results
 */
function showEmailBreachResults(results) {
    const modalHTML = `
        <div id="email-breach-modal" class="modal active">
            <div class="modal-content" style="max-width: 700px;">
                <div class="modal-header">
                    <h2><i class="fas fa-envelope"></i> Email Breach Check</h2>
                    <button class="close-btn" onclick="closeModal('email-breach-modal')">&times;</button>
                </div>

                ${results.breached ? `
                    <div class="alert alert-warning" style="margin-bottom: 20px;">
                        <i class="fas fa-exclamation-triangle"></i>
                        <span><strong>Email Compromised:</strong> Your email address has been found in ${results.count} data breach(es).</span>
                    </div>

                    <div style="max-height: 500px; overflow-y: auto;">
                        ${results.breaches.map(breach => `
                            <div style="background: rgba(15, 15, 35, 0.6); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 10px; padding: 20px; margin-bottom: 15px;">
                                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                                    <div>
                                        <h3 style="margin: 0 0 5px 0; color: #fff;">${breach.title}</h3>
                                        <div style="font-size: 0.85rem; color: rgba(255,255,255,0.6);">
                                            <i class="fas fa-globe"></i> ${breach.domain} • 
                                            <i class="fas fa-calendar"></i> ${new Date(breach.date).toLocaleDateString()}
                                        </div>
                                    </div>
                                    <span style="padding: 5px 10px; background: rgba(239, 68, 68, 0.2); border-radius: 20px; font-size: 0.75rem; font-weight: 600; color: #ef4444; white-space: nowrap;">
                                        ${breach.pwnCount.toLocaleString()} accounts
                                    </span>
                                </div>
                                <p style="font-size: 0.9rem; color: rgba(255,255,255,0.8); margin-bottom: 10px;">
                                    <strong>Compromised data:</strong>
                                </p>
                                <div style="display: flex; flex-wrap: wrap; gap: 5px;">
                                    ${breach.dataClasses.map(dc => `
                                        <span style="padding: 4px 10px; background: rgba(167, 139, 250, 0.2); border: 1px solid rgba(167, 139, 250, 0.3); border-radius: 15px; font-size: 0.8rem; color: #a78bfa;">
                                            ${dc}
                                        </span>
                                    `).join('')}
                                </div>
                            </div>
                        `).join('')}
                    </div>

                    <div style="margin-top: 20px; padding: 15px; background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 10px;">
                        <strong style="color: #f59e0b;"><i class="fas fa-lightbulb"></i> Recommendation:</strong>
                        <p style="margin-top: 8px; font-size: 0.9rem; color: rgba(255,255,255,0.8);">
                            Change passwords for any accounts associated with this email, especially if you've reused passwords.
                        </p>
                    </div>
                ` : `
                    <div style="text-align: center; padding: 40px 20px;">
                        <div style="width: 80px; height: 80px; margin: 0 auto 20px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 2.5rem; color: #fff;">
                            <i class="fas fa-check"></i>
                        </div>
                        <h3 style="font-size: 1.5rem; margin-bottom: 10px;">Email is Safe!</h3>
                        <p style="color: rgba(255,255,255,0.7); margin-bottom: 5px;">
                            Your email address <strong style="color: #a78bfa;">${results.email}</strong> has not been found in any known data breaches.
                        </p>
                    </div>
                `}

                <button class="btn btn-full" onclick="closeModal('email-breach-modal')" style="margin-top: 20px;">
                    <i class="fas fa-check"></i> Close
                </button>
            </div>
        </div>
    `;

    // Remove existing modal if present
    const existing = document.getElementById('email-breach-modal');
    if (existing) existing.remove();

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

/**
 * Add breach check button to dashboard
 */
function addBreachCheckButton() {
    // Check if button already exists
    if (document.getElementById('breach-scan-btn')) return;

    const vaultControls = document.querySelector('.vault-controls');
    if (!vaultControls) return;

    const buttonHTML = `
        <button class="btn" id="breach-scan-btn" onclick="runFullBreachScan()" style="background: #ef4444;">
            <i class="fas fa-shield-alt"></i>
            Scan for Breaches
        </button>
    `;

    vaultControls.insertAdjacentHTML('beforeend', buttonHTML);
}

/**
 * Run full breach scan (passwords + email)
 */
async function runFullBreachScan() {
    try {
        // Scan passwords
        const passwordResults = await scanUserPasswords();
        
        // Check email
        const emailResults = await checkUserEmailBreaches();

        // Show combined results
        showBreachResults(passwordResults);

        // If email breached, also show that
        if (emailResults.breached) {
            setTimeout(() => {
                showEmailBreachResults(emailResults);
            }, 1000);
        }

    } catch (error) {
        console.error('Error running breach scan:', error);
        showToast('Failed to complete breach scan', 'error');
    }
}

/**
 * Check single password during creation/edit
 * @param {string} password - Password to check
 * @returns {Promise<Object>} Breach info
 */
async function checkPasswordOnTheFly(password) {
    const count = await checkPasswordPwned(password);
    
    return {
        breached: count > 0,
        count: count,
        severity: count > 100000 ? 'critical' : count > 10000 ? 'high' : count > 1000 ? 'medium' : 'low'
    };
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ==========================================
// INITIALIZATION
// ==========================================

// Add breach check button when dashboard loads
document.addEventListener('DOMContentLoaded', () => {
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            setTimeout(() => {
                addBreachCheckButton();
            }, 1000);
        }
    });
});

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        checkPasswordPwned,
        checkEmailBreaches,
        scanUserPasswords,
        checkUserEmailBreaches,
        checkPasswordOnTheFly,
        runFullBreachScan
    };
}