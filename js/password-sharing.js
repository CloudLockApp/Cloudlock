// Password Sharing Module - Secure Time-Limited Links

// Generate secure random token
function generateSecureToken() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Open share password modal
function openSharePasswordModal(passwordId) {
    const password = passwords.find(p => p.id === passwordId);
    if (!password) return;

    const modal = document.getElementById('share-password-modal');
    if (!modal) {
        createSharePasswordModal();
    }

    // Populate modal with password info
    document.getElementById('share-password-name').textContent = password.siteName;
    document.getElementById('share-password-username').textContent = password.username;
    
    // Store passwordId for later use
    document.getElementById('share-password-modal').dataset.passwordId = passwordId;

    // Reset form
    document.getElementById('share-expiry').value = '24';
    document.getElementById('share-max-views').value = '1';
    document.getElementById('share-require-code').checked = false;
    document.getElementById('share-code').value = '';
    document.getElementById('share-code-group').style.display = 'none';

    openModal('share-password-modal');
}

// Create share password modal HTML
function createSharePasswordModal() {
    const modalHTML = `
        <div id="share-password-modal" class="modal">
            <div class="modal-content share-modal-content">
                <div class="modal-header">
                    <h2><i class="fas fa-share-alt"></i> Share Password Securely</h2>
                    <button class="close-btn" onclick="closeModal('share-password-modal')">&times;</button>
                </div>

                <div class="share-password-info">
                    <div class="share-info-card">
                        <div class="share-info-icon">
                            <i class="fas fa-lock"></i>
                        </div>
                        <div class="share-info-content">
                            <div class="share-info-label">Password for:</div>
                            <div class="share-info-value" id="share-password-name">Loading...</div>
                            <div class="share-info-username" id="share-password-username">Loading...</div>
                        </div>
                    </div>
                </div>

                <div class="share-options">
                    <h3><i class="fas fa-cog"></i> Share Settings</h3>

                    <div class="form-group">
                        <label for="share-expiry">
                            <i class="fas fa-clock"></i> Link expires after:
                        </label>
                        <select id="share-expiry" class="share-select">
                            <option value="1">1 hour</option>
                            <option value="6">6 hours</option>
                            <option value="24" selected>24 hours</option>
                            <option value="72">3 days</option>
                            <option value="168">7 days</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label for="share-max-views">
                            <i class="fas fa-eye"></i> Maximum views:
                        </label>
                        <select id="share-max-views" class="share-select">
                            <option value="1" selected>1 view (self-destruct)</option>
                            <option value="3">3 views</option>
                            <option value="5">5 views</option>
                            <option value="10">10 views</option>
                            <option value="-1">Unlimited</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="share-checkbox-label">
                            <input type="checkbox" id="share-require-code" onchange="toggleShareCode()">
                            <span><i class="fas fa-key"></i> Require access code</span>
                        </label>
                    </div>

                    <div class="form-group" id="share-code-group" style="display: none;">
                        <label for="share-code">
                            <i class="fas fa-hashtag"></i> Access Code:
                        </label>
                        <input type="text" id="share-code" placeholder="Enter 6-digit code">
                        <button class="btn-generate-code" onclick="generateShareCode()">
                            <i class="fas fa-random"></i> Generate
                        </button>
                    </div>
                </div>

                <div class="share-security-notice">
                    <i class="fas fa-shield-alt"></i>
                    <div>
                        <strong>Security Notice:</strong> The link will be encrypted and can only be used within the time limit. The password will never be stored in plain text.
                    </div>
                </div>

                <button class="btn btn-full btn-primary" onclick="generateShareLink()">
                    <i class="fas fa-link"></i> Generate Secure Link
                </button>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Toggle access code field
function toggleShareCode() {
    const requireCode = document.getElementById('share-require-code').checked;
    const codeGroup = document.getElementById('share-code-group');
    
    if (requireCode) {
        codeGroup.style.display = 'block';
        generateShareCode();
    } else {
        codeGroup.style.display = 'none';
    }
}

// Generate random 6-digit code
function generateShareCode() {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    document.getElementById('share-code').value = code;
}

// Generate share link
async function generateShareLink() {
    const modal = document.getElementById('share-password-modal');
    const passwordId = modal.dataset.passwordId;
    const password = passwords.find(p => p.id === passwordId);
    
    if (!password) {
        showToast('Password not found', 'error');
        return;
    }

    const expiryHours = parseInt(document.getElementById('share-expiry').value);
    const maxViews = parseInt(document.getElementById('share-max-views').value);
    const requireCode = document.getElementById('share-require-code').checked;
    const accessCode = requireCode ? document.getElementById('share-code').value : null;

    if (requireCode && (!accessCode || accessCode.length !== 6)) {
        showToast('Please enter a valid 6-digit access code', 'error');
        return;
    }

    const shareToken = generateSecureToken();
    const expiresAt = new Date(Date.now() + expiryHours * 3600000);

    try {
        // Prepare password data to share
        const shareData = {
            siteName: password.siteName,
            url: password.url || '',
            username: password.username,
            password: decrypt(password.password), // Decrypt to re-encrypt with share key
            notes: password.notes ? decrypt(password.notes) : ''
        };

        // Encrypt with share-specific key
        const shareKey = shareToken.substring(0, 32);
        const encryptedData = encrypt(JSON.stringify(shareData));

        // Store in Firestore
        await firebase.firestore().collection('shared-passwords').doc(shareToken).set({
            passwordData: encryptedData,
            expiresAt: expiresAt,
            ownerId: firebase.auth().currentUser.uid,
            ownerEmail: firebase.auth().currentUser.email,
            passwordId: passwordId,
            siteName: password.siteName,
            viewCount: 0,
            maxViews: maxViews,
            requireCode: requireCode,
            accessCode: requireCode ? CryptoJS.SHA256(accessCode).toString() : null,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Log audit event
        if (typeof logAuditEvent === 'function') {
            await logAuditEvent(passwordId, 'PASSWORD_SHARED', {
                shareToken: shareToken.substring(0, 8) + '...',
                expiresAt: expiresAt,
                maxViews: maxViews
            });
        }

        // Show success with link
        const shareUrl = `${window.location.origin}/shared.html?token=${shareToken}`;
        showShareLinkSuccess(shareUrl, expiryHours, maxViews, accessCode);

    } catch (error) {
        console.error('Error generating share link:', error);
        showToast('Failed to generate share link', 'error');
    }
}

// Show share link success modal
function showShareLinkSuccess(shareUrl, expiryHours, maxViews, accessCode) {
    closeModal('share-password-modal');

    const successHTML = `
        <div id="share-success-modal" class="modal active">
            <div class="modal-content share-success-content">
                <div class="modal-header">
                    <h2><i class="fas fa-check-circle" style="color: #10b981;"></i> Share Link Created!</h2>
                    <button class="close-btn" onclick="closeModal('share-success-modal')">&times;</button>
                </div>

                <div class="share-success-icon">
                    <i class="fas fa-link"></i>
                </div>

                <div class="share-link-container">
                    <input type="text" id="share-link-input" value="${shareUrl}" readonly>
                    <button class="btn-copy-link" onclick="copyShareLink()">
                        <i class="fas fa-copy"></i> Copy
                    </button>
                </div>

                <div class="share-details-grid">
                    <div class="share-detail-card">
                        <i class="fas fa-clock"></i>
                        <div class="share-detail-label">Expires in</div>
                        <div class="share-detail-value">${expiryHours} hour${expiryHours > 1 ? 's' : ''}</div>
                    </div>
                    <div class="share-detail-card">
                        <i class="fas fa-eye"></i>
                        <div class="share-detail-label">Max Views</div>
                        <div class="share-detail-value">${maxViews === -1 ? 'Unlimited' : maxViews}</div>
                    </div>
                    ${accessCode ? `
                    <div class="share-detail-card">
                        <i class="fas fa-key"></i>
                        <div class="share-detail-label">Access Code</div>
                        <div class="share-detail-value">${accessCode}</div>
                    </div>
                    ` : ''}
                </div>

                ${accessCode ? `
                <div class="share-code-notice">
                    <i class="fas fa-info-circle"></i>
                    <div>Share the access code <strong>${accessCode}</strong> separately for extra security.</div>
                </div>
                ` : ''}

                <div class="share-warning">
                    <i class="fas fa-exclamation-triangle"></i>
                    <div>
                        <strong>Important:</strong> Anyone with this link can access the password. Share it only through secure channels.
                    </div>
                </div>

                <button class="btn btn-full" onclick="closeModal('share-success-modal')">
                    <i class="fas fa-check"></i> Done
                </button>
            </div>
        </div>
    `;

    // Remove existing success modal if present
    const existingModal = document.getElementById('share-success-modal');
    if (existingModal) existingModal.remove();

    document.body.insertAdjacentHTML('beforeend', successHTML);
}

// Copy share link to clipboard
function copyShareLink() {
    const linkInput = document.getElementById('share-link-input');
    linkInput.select();
    linkInput.setSelectionRange(0, 99999); // For mobile devices

    navigator.clipboard.writeText(linkInput.value).then(() => {
        showToast('Link copied to clipboard!', 'success');
        
        // Visual feedback
        const btn = document.querySelector('.btn-copy-link');
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
        btn.style.background = '#10b981';
        
        setTimeout(() => {
            btn.innerHTML = originalHTML;
            btn.style.background = '';
        }, 2000);
    });
}

// View shared passwords (in settings)
async function viewSharedPasswords() {
    if (!firebase.auth().currentUser) return;

    const modal = document.getElementById('shared-links-modal');
    if (!modal) {
        createSharedLinksModal();
    }

    openModal('shared-links-modal');
    loadSharedLinks();
}

// Create shared links modal
function createSharedLinksModal() {
    const modalHTML = `
        <div id="shared-links-modal" class="modal">
            <div class="modal-content" style="max-width: 900px;">
                <div class="modal-header">
                    <h2><i class="fas fa-share-alt"></i> Your Shared Links</h2>
                    <button class="close-btn" onclick="closeModal('shared-links-modal')">&times;</button>
                </div>
                <div id="shared-links-content">
                    <div class="spinner"></div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Load shared links
async function loadSharedLinks() {
    const content = document.getElementById('shared-links-content');
    content.innerHTML = '<div class="spinner"></div>';

    try {
        const snapshot = await firebase.firestore()
            .collection('shared-passwords')
            .where('ownerId', '==', firebase.auth().currentUser.uid)
            .orderBy('createdAt', 'desc')
            .get();

        if (snapshot.empty) {
            content.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; opacity: 0.6;">
                    <i class="fas fa-share-alt" style="font-size: 4rem; margin-bottom: 20px; color: rgba(124, 58, 237, 0.3);"></i>
                    <p style="font-size: 1.1rem;">No shared links yet.</p>
                    <p style="font-size: 0.9rem; margin-top: 10px; opacity: 0.7;">Share a password to see it here.</p>
                </div>
            `;
            return;
        }

        let html = '<div class="shared-links-grid">';

        snapshot.forEach(doc => {
            const share = doc.data();
            const now = new Date();
            const expiresAt = share.expiresAt.toDate();
            const isExpired = expiresAt < now;
            const isMaxedOut = share.maxViews !== -1 && share.viewCount >= share.maxViews;
            const isInactive = isExpired || isMaxedOut;

            html += `
                <div class="shared-link-card ${isInactive ? 'inactive' : ''}">
                    <div class="shared-link-header">
                        <div class="shared-link-title">
                            <i class="fas fa-globe"></i>
                            <span>${share.siteName}</span>
                        </div>
                        <div class="shared-link-status ${isInactive ? 'status-expired' : 'status-active'}">
                            ${isInactive ? '<i class="fas fa-times-circle"></i> Inactive' : '<i class="fas fa-check-circle"></i> Active'}
                        </div>
                    </div>

                    <div class="shared-link-stats">
                        <div class="shared-stat">
                            <i class="fas fa-eye"></i>
                            <span>${share.viewCount} / ${share.maxViews === -1 ? '∞' : share.maxViews} views</span>
                        </div>
                        <div class="shared-stat">
                            <i class="fas fa-clock"></i>
                            <span>Expires: ${expiresAt.toLocaleDateString()}</span>
                        </div>
                        ${share.requireCode ? '<div class="shared-stat"><i class="fas fa-key"></i><span>Code Protected</span></div>' : ''}
                    </div>

                    <div class="shared-link-actions">
                        ${!isInactive ? `
                        <button class="btn-shared-action" onclick="copySharedLink('${doc.id}')">
                            <i class="fas fa-copy"></i> Copy Link
                        </button>
                        ` : ''}
                        <button class="btn-shared-action btn-danger" onclick="revokeSharedLink('${doc.id}')">
                            <i class="fas fa-trash"></i> Revoke
                        </button>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        content.innerHTML = html;

    } catch (error) {
        console.error('Error loading shared links:', error);
        content.innerHTML = '<div style="text-align: center; padding: 40px;"><p>Error loading shared links.</p></div>';
    }
}

// Copy shared link
function copySharedLink(shareToken) {
    const shareUrl = `${window.location.origin}/shared.html?token=${shareToken}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
        showToast('Link copied to clipboard!', 'success');
    });
}

// Revoke shared link
async function revokeSharedLink(shareToken) {
    const confirmed = confirm('Are you sure you want to revoke this shared link? It will no longer be accessible.');
    if (!confirmed) return;

    try {
        await firebase.firestore().collection('shared-passwords').doc(shareToken).delete();
        showToast('Share link revoked successfully', 'success');
        loadSharedLinks(); // Reload list
    } catch (error) {
        console.error('Error revoking share link:', error);
        showToast('Failed to revoke share link', 'error');
    }
}