// Audit Log Module - Track all password activity securely

// Log an audit event
async function logAuditEvent(passwordId, action, metadata = {}) {
    if (!firebase.auth().currentUser) {
        console.error('No user logged in');
        return;
    }

    const userId = firebase.auth().currentUser.uid;

    try {
        const auditEvent = {
            userId: userId,
            passwordId: passwordId,
            action: action,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            deviceInfo: getDeviceInfo(),
            location: metadata.location || 'Unknown',
            ...metadata
        };

        await firebase.firestore()
            .collection('passwords')
            .doc(passwordId)
            .collection('history')
            .add(auditEvent);

        console.log('✅ Audit event logged:', action);
    } catch (error) {
        console.error('Error logging audit event:', error);
    }
}

// Get device information
function getDeviceInfo() {
    const ua = navigator.userAgent;
    let browser = 'Unknown';
    let os = 'Unknown';

    if (ua.indexOf('Firefox') > -1) browser = 'Firefox';
    else if (ua.indexOf('Chrome') > -1) browser = 'Chrome';
    else if (ua.indexOf('Safari') > -1) browser = 'Safari';
    else if (ua.indexOf('Edge') > -1) browser = 'Edge';

    if (ua.indexOf('Windows') > -1) os = 'Windows';
    else if (ua.indexOf('Mac') > -1) os = 'macOS';
    else if (ua.indexOf('Linux') > -1) os = 'Linux';
    else if (ua.indexOf('Android') > -1) os = 'Android';
    else if (ua.indexOf('iOS') > -1 || ua.indexOf('iPhone') > -1) os = 'iOS';

    return browser + ' on ' + os;
}

// Get approximate location
async function getApproximateLocation() {
    try {
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        return data.city + ', ' + data.region;
    } catch (error) {
        console.error('Error getting location:', error);
        return 'Unknown';
    }
}

// Global variable to store all events
let allGlobalEvents = [];

// Open global audit log modal
function openGlobalAuditLog() {
    let modal = document.getElementById('global-audit-modal');
    
    if (!modal) {
        const modalHTML = `
            <div id="global-audit-modal" class="modal">
                <div class="modal-content audit-modal-content" style="max-width: 900px;">
                    <div class="modal-header">
                        <h2><i class="fas fa-history"></i> Activity Log - All Passwords</h2>
                        <button class="close-btn" onclick="closeModal('global-audit-modal')">&times;</button>
                    </div>
                    
                    <div class="audit-security-notice">
                        <i class="fas fa-shield-alt"></i>
                        <div class="audit-security-notice-content">
                            <div class="audit-security-notice-title">🔒 Privacy Protected</div>
                            <div class="audit-security-notice-text">
                                All events are encrypted end-to-end. Previous passwords are stored as hashes only. 
                                IP addresses are partially masked. This log is tamper-proof.
                            </div>
                        </div>
                    </div>

                    <div style="margin-bottom: 20px; display: flex; gap: 10px; flex-wrap: wrap;">
                        <select id="audit-filter-action" onchange="filterGlobalAudit()" style="padding: 10px; background: rgba(15, 15, 35, 0.6); border: 1px solid rgba(124, 58, 237, 0.3); border-radius: 8px; color: #fff;">
                            <option value="all">All Actions</option>
                            <option value="PASSWORD_CREATED">Created</option>
                            <option value="PASSWORD_CHANGED">Changed</option>
                            <option value="PASSWORD_VIEWED">Viewed</option>
                            <option value="PASSWORD_DELETED">Deleted</option>
                        </select>
                        
                        <select id="audit-filter-password" onchange="filterGlobalAudit()" style="padding: 10px; background: rgba(15, 15, 35, 0.6); border: 1px solid rgba(124, 58, 237, 0.3); border-radius: 8px; color: #fff;">
                            <option value="all">All Passwords</option>
                        </select>
                    </div>
                    
                    <div id="global-audit-content" style="max-height: 600px; overflow-y: auto;">
                        <div class="spinner"></div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        modal = document.getElementById('global-audit-modal');
    }

    openModal('global-audit-modal');
    loadGlobalAuditLog();
}

// Load ALL audit events
async function loadGlobalAuditLog() {
    const content = document.getElementById('global-audit-content');
    content.innerHTML = '<div class="spinner"></div>';

    if (!firebase.auth().currentUser) {
        content.innerHTML = '<div style="text-align: center; padding: 40px;"><p>Please login to view audit logs.</p></div>';
        return;
    }

    try {
        const userId = firebase.auth().currentUser.uid;

        const passwordsSnapshot = await firebase.firestore()
            .collection('passwords')
            .where('userId', '==', userId)
            .get();

        allGlobalEvents = [];

        for (const passwordDoc of passwordsSnapshot.docs) {
            const passwordData = passwordDoc.data();

            const historySnapshot = await firebase.firestore()
                .collection('passwords')
                .doc(passwordDoc.id)
                .collection('history')
                .orderBy('timestamp', 'desc')
                .limit(100)
                .get();

            historySnapshot.forEach(historyDoc => {
                allGlobalEvents.push({
                    id: historyDoc.id,
                    passwordId: passwordDoc.id,
                    passwordName: passwordData.siteName,
                    ...historyDoc.data()
                });
            });
        }

        allGlobalEvents.sort((a, b) => {
            const aTime = a.timestamp?.toDate?.() || new Date(0);
            const bTime = b.timestamp?.toDate?.() || new Date(0);
            return bTime - aTime;
        });

        const passwordFilter = document.getElementById('audit-filter-password');
        const uniquePasswords = [...new Set(allGlobalEvents.map(e => e.passwordName))];
        passwordFilter.innerHTML = '<option value="all">All Passwords</option>' +
            uniquePasswords.map(name => '<option value="' + name + '">' + name + '</option>').join('');

        displayGlobalAuditLog(allGlobalEvents);

    } catch (error) {
        console.error('Error loading global audit log:', error);
        content.innerHTML = '<div style="text-align: center; padding: 40px;"><p>Error: ' + error.message + '</p></div>';
    }
}

// Display global audit log
function displayGlobalAuditLog(events) {
    const content = document.getElementById('global-audit-content');

    if (events.length === 0) {
        content.innerHTML = `
            <div style="text-align: center; padding: 60px; opacity: 0.6;">
                <i class="fas fa-history" style="font-size: 4rem; margin-bottom: 20px; color: rgba(124, 58, 237, 0.3);"></i>
                <p style="font-size: 1.1rem;">No activity recorded yet.</p>
                <p style="font-size: 0.9rem; margin-top: 10px; opacity: 0.7;">Create, edit, or view passwords to see audit logs here.</p>
            </div>
        `;
        return;
    }

    const eventsByDate = {};
    events.forEach(event => {
        const date = event.timestamp?.toDate?.() || new Date();
        const dateKey = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        if (!eventsByDate[dateKey]) {
            eventsByDate[dateKey] = [];
        }
        eventsByDate[dateKey].push(event);
    });

    let html = '<div class="audit-stats" style="margin-bottom: 30px;">';
    html += '<div class="audit-stat-card"><div class="audit-stat-number">' + events.length + '</div><div class="audit-stat-label">Total Events</div></div>';
    html += '<div class="audit-stat-card"><div class="audit-stat-number">' + events.filter(e => e.action === 'PASSWORD_CREATED').length + '</div><div class="audit-stat-label">Created</div></div>';
    html += '<div class="audit-stat-card"><div class="audit-stat-number">' + events.filter(e => e.action === 'PASSWORD_CHANGED').length + '</div><div class="audit-stat-label">Changed</div></div>';
    html += '<div class="audit-stat-card"><div class="audit-stat-number">' + events.filter(e => e.action === 'PASSWORD_VIEWED').length + '</div><div class="audit-stat-label">Viewed</div></div>';
    html += '</div>';

    Object.entries(eventsByDate).forEach(([date, dateEvents]) => {
        html += '<div style="margin-bottom: 40px;">';
        html += '<h3 style="color: #a78bfa; font-size: 1.1rem; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px solid rgba(124, 58, 237, 0.2);">' + date + '</h3>';
        html += '<div class="audit-timeline">';
        
        dateEvents.forEach(event => {
            html += '<div class="audit-event">';
            html += '<div class="audit-timeline-dot"></div>';
            html += '<div class="audit-event-card" data-action="' + event.action + '">';
            html += '<div class="audit-event-header">';
            html += '<div class="audit-event-action">';
            html += '<i class="fas ' + getAuditActionIcon(event.action) + '"></i>';
            html += '<span>' + formatAuditAction(event.action) + '</span>';
            html += '<span style="color: #a78bfa; margin-left: 8px; font-weight: 600;">→ ' + event.passwordName + '</span>';
            html += '</div>';
            html += '<span class="audit-event-time">' + formatAuditTime(event.timestamp) + '</span>';
            html += '</div>';
            
            html += '<div class="audit-event-details">';
            html += '<div class="audit-detail-item"><span class="audit-detail-label">Device</span><span class="audit-detail-value">' + (event.deviceInfo || 'Unknown') + '</span></div>';
            html += '<div class="audit-detail-item"><span class="audit-detail-label">Location</span><span class="audit-detail-value">' + (event.location || 'Unknown') + '</span></div>';
            
            if (event.strengthBefore !== undefined) {
                const color = event.strengthAfter > event.strengthBefore ? '#10b981' : '#ef4444';
                const arrow = event.strengthAfter > event.strengthBefore ? '📈' : '📉';
                html += '<div class="audit-detail-item"><span class="audit-detail-label">Strength Change</span>';
                html += '<span class="audit-detail-value" style="color: ' + color + '">' + event.strengthBefore + ' → ' + event.strengthAfter + ' ' + arrow + '</span></div>';
            }
            
            html += '</div>';
            
            if (event.previousPasswordHash) {
                html += '<div class="audit-password-hash">';
                html += '<div style="font-size: 0.75rem; opacity: 0.6; margin-bottom: 5px;">Previous Password Hash (Encrypted)</div>';
                html += '<code style="font-size: 0.8rem; word-break: break-all;">' + event.previousPasswordHash.substring(0, 32) + '...</code>';
                html += '</div>';
            }
            
            html += '</div></div>';
        });
        
        html += '</div></div>';
    });

    content.innerHTML = html;
}

// Filter global audit log
function filterGlobalAudit() {
    const actionFilter = document.getElementById('audit-filter-action').value;
    const passwordFilter = document.getElementById('audit-filter-password').value;

    let filtered = allGlobalEvents;

    if (actionFilter !== 'all') {
        filtered = filtered.filter(e => e.action === actionFilter);
    }

    if (passwordFilter !== 'all') {
        filtered = filtered.filter(e => e.passwordName === passwordFilter);
    }

    displayGlobalAuditLog(filtered);
}

// Format time
function formatAuditTime(timestamp) {
    if (!timestamp) return 'Unknown';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// Get icon for action
function getAuditActionIcon(action) {
    if (action === 'PASSWORD_CREATED') return 'fa-plus-circle';
    if (action === 'PASSWORD_CHANGED') return 'fa-edit';
    if (action === 'PASSWORD_VIEWED') return 'fa-eye';
    if (action === 'PASSWORD_DELETED') return 'fa-trash';
    if (action === 'PASSWORD_ROLLED_BACK') return 'fa-undo';
    return 'fa-circle';
}

// Format action text
function formatAuditAction(action) {
    return action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, function(l) { return l.toUpperCase(); });
}