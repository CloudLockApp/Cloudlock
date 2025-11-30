// Background Service Worker - CloudLock Extension
// Using Firebase REST API and local CryptoJS for encryption compatibility

// Import local CryptoJS implementation
importScripts('crypto-js-simple.js');

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDyHH0DXSEaxb_Ft-cmuGpaCQP8xSx105U",
  authDomain: "cloudlock-8a59b.firebaseapp.com",
  projectId: "cloudlock-8a59b",
  storageBucket: "cloudlock-8a59b.firebasestorage.app",
  messagingSenderId: "723019842397",
  appId: "1:723019842397:web:886db24af7ed5587351eb4"
};

let authenticatedUser = null;
let cachedPasswords = [];
let sessionKey = null;
let authToken = null;

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('CloudLock extension installed');

  // Create context menu
  chrome.contextMenus.create({
    id: 'cloudlock-fill',
    title: 'Fill with CloudLock',
    contexts: ['editable']
  });

  chrome.contextMenus.create({
    id: 'cloudlock-generate',
    title: 'Generate Password',
    contexts: ['editable']
  });

  chrome.contextMenus.create({
    id: 'cloudlock-save',
    title: 'Save to CloudLock',
    contexts: ['editable']
  });
});

// Restore session on startup
chrome.runtime.onStartup.addListener(async () => {
  console.log('CloudLock: Restoring session...');
  await restoreSession();
});

// Also restore session when service worker wakes up
(async function initializeOnLoad() {
  console.log('CloudLock: Service worker initialized');
  await restoreSession();
})();

// Restore authenticated session from storage
async function restoreSession() {
  try {
    const stored = await chrome.storage.local.get([
      'cloudlock_user',
      'cloudlock_uid',
      'cloudlock_token',
      'cloudlock_session_key',
      'cloudlock_passwords'
    ]);

    if (stored.cloudlock_token && stored.cloudlock_uid && stored.cloudlock_user) {
      authToken = stored.cloudlock_token;
      sessionKey = stored.cloudlock_session_key;

      authenticatedUser = {
        email: stored.cloudlock_user,
        uid: stored.cloudlock_uid,
        timestamp: Date.now()
      };

      // Load cached passwords
      if (stored.cloudlock_passwords) {
        cachedPasswords = stored.cloudlock_passwords;
        console.log(`✅ Session restored with ${cachedPasswords.length} cached passwords`);
      }

      // Try to sync passwords from Firestore in background
      syncPasswords().catch(err => {
        console.log('Background sync failed, using cached passwords:', err.message);
      });

      return true;
    } else {
      console.log('No stored session found');
      return false;
    }
  } catch (error) {
    console.error('Failed to restore session:', error);
    return false;
  }
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'cloudlock-fill') {
    chrome.tabs.sendMessage(tab.id, { action: 'showPasswordList' });
  } else if (info.menuItemId === 'cloudlock-generate') {
    const password = generateSecurePassword();
    chrome.tabs.sendMessage(tab.id, { 
      action: 'fillPassword', 
      password: password 
    });
  } else if (info.menuItemId === 'cloudlock-save') {
    chrome.tabs.sendMessage(tab.id, { action: 'saveCurrentPassword' });
  }
});

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'authenticate') {
    handleAuthentication(request.data)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.action === 'getPasswords') {
    getPasswords()
      .then(passwords => sendResponse({ success: true, passwords: passwords }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.action === 'savePassword') {
    savePassword(request.data)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.action === 'generatePassword') {
    const password = generateSecurePassword(request.options);
    sendResponse({ success: true, password: password });
    return true;
  }
  
  if (request.action === 'logout') {
    logout();
    sendResponse({ success: true });
    return true;
  }
  
  if (request.action === 'checkAuth') {
    sendResponse({ 
      success: true, 
      authenticated: !!authenticatedUser,
      user: authenticatedUser 
    });
    return true;
  }
});

// Authentication handler using Firebase REST API
async function handleAuthentication(credentials) {
  try {
    // Use Firebase REST API for authentication
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_CONFIG.apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: credentials.email,
          password: credentials.password,
          returnSecureToken: true
        })
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error.message || 'Authentication failed');
    }

    const data = await response.json();
    authToken = data.idToken;
    
    // Store credentials in Chrome storage
    await chrome.storage.local.set({
      cloudlock_user: credentials.email,
      cloudlock_uid: data.localId,
      cloudlock_token: authToken,
      cloudlock_session_key: credentials.password
    });

    authenticatedUser = {
      email: credentials.email,
      uid: data.localId,
      timestamp: Date.now()
    };

    // Store master password for CryptoJS decryption (same as web app)
    sessionKey = credentials.password;
    
    // Fetch passwords from Firestore
    await syncPasswords();
    
    return authenticatedUser;
  } catch (error) {
    console.error('Authentication failed:', error);
    throw new Error('Authentication failed: ' + error.message);
  }
}

// Get passwords from storage
async function getPasswords() {
  if (!authenticatedUser) {
    throw new Error('Not authenticated');
  }
  
  // Try to get from cache first
  if (cachedPasswords.length > 0) {
    return cachedPasswords;
  }
  
  // Sync from Firestore
  await syncPasswords();
  return cachedPasswords;
}

// Sync passwords from Firestore using REST API
async function syncPasswords() {
  try {
    if (!authenticatedUser || !authenticatedUser.uid) {
      console.error('No authenticated user');
      return;
    }
    
    if (!authToken) {
      // Try to get token from storage
      const stored = await chrome.storage.local.get('cloudlock_token');
      if (stored.cloudlock_token) {
        authToken = stored.cloudlock_token;
      } else {
        throw new Error('No auth token available');
      }
    }
    
    // Use structured query to filter by userId
    const queryBody = {
      structuredQuery: {
        from: [{ collectionId: 'passwords' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'userId' },
            op: 'EQUAL',
            value: { stringValue: authenticatedUser.uid }
          }
        }
      }
    };
    
    // Query Firestore using REST API with structured query
    const response = await fetch(
      `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents:runQuery`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(queryBody)
      }
    );

    if (response.ok) {
      const results = await response.json();
      cachedPasswords = [];
      
      if (results && Array.isArray(results)) {
        for (const result of results) {
          if (!result.document) continue;
          
          const doc = result.document;
          const fields = doc.fields;
          
          const passwordData = {
            id: doc.name.split('/').pop(),
            siteName: fields.siteName?.stringValue || '',
            url: fields.url?.stringValue || '',
            username: fields.username?.stringValue || '',
            password: fields.password?.stringValue || '',
            notes: fields.notes?.stringValue || '',
            createdAt: fields.createdAt?.timestampValue || Date.now(),
            updatedAt: fields.updatedAt?.timestampValue || Date.now()
          };
          
          // Decrypt password using CryptoJS AES (same as web app)
          if (passwordData.password && sessionKey) {
            try {
              const bytes = CryptoJS.AES.decrypt(passwordData.password, sessionKey);
              const decrypted = bytes.toString(CryptoJS.enc.Utf8);
              if (decrypted) {
                passwordData.password = decrypted;
              }
            } catch (e) {
              console.error('Error decrypting password:', e);
            }
          }
          
          // Decrypt notes using CryptoJS AES
          if (passwordData.notes && sessionKey) {
            try {
              const bytes = CryptoJS.AES.decrypt(passwordData.notes, sessionKey);
              const decrypted = bytes.toString(CryptoJS.enc.Utf8);
              if (decrypted) {
                passwordData.notes = decrypted;
              }
            } catch (e) {
              console.error('Error decrypting notes:', e);
            }
          }
          
          cachedPasswords.push(passwordData);
        }
      }
      
      // Cache in local storage
      await chrome.storage.local.set({ 
        cloudlock_passwords: cachedPasswords 
      });
      
      console.log(`✅ Synced ${cachedPasswords.length} passwords from Firestore`);
    } else {
      const errorText = await response.text();
      console.error('Firestore fetch error:', errorText);
      throw new Error('Failed to fetch passwords');
    }
  } catch (error) {
    console.error('Error syncing passwords:', error);
    
    // Fallback to local storage if Firestore fails
    try {
      const stored = await chrome.storage.local.get('cloudlock_passwords');
      if (stored.cloudlock_passwords) {
        cachedPasswords = stored.cloudlock_passwords;
      }
    } catch (storageError) {
      console.error('Error loading from storage:', storageError);
    }
  }
}

// Save password to Firestore using REST API
async function savePassword(data) {
  if (!authenticatedUser) {
    throw new Error('Not authenticated');
  }
  
  try {
    // Encrypt password using CryptoJS AES (same as web app)
    const encryptedPassword = sessionKey ? CryptoJS.AES.encrypt(data.password, sessionKey).toString() : data.password;
    const encryptedNotes = (data.notes && sessionKey) ? CryptoJS.AES.encrypt(data.notes, sessionKey).toString() : '';
    
    const passwordData = {
      fields: {
        userId: { stringValue: authenticatedUser.uid },
        siteName: { stringValue: data.siteName },
        url: { stringValue: data.url || '' },
        username: { stringValue: data.username },
        password: { stringValue: encryptedPassword },
        notes: { stringValue: encryptedNotes },
        createdAt: { timestampValue: new Date().toISOString() },
        updatedAt: { timestampValue: new Date().toISOString() }
      }
    };
    
    // Save to Firestore using REST API
    const response = await fetch(
      `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents/passwords`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(passwordData)
      }
    );

    if (!response.ok) {
      throw new Error('Failed to save password to Firestore');
    }

    const result = await response.json();
    
    const savedPassword = {
      id: result.name.split('/').pop(),
      siteName: data.siteName,
      url: data.url,
      username: data.username,
      password: data.password, // Store decrypted in cache
      notes: data.notes || '',
      createdAt: Date.now()
    };
    
    cachedPasswords.push(savedPassword);
    
    // Update local cache
    await chrome.storage.local.set({ 
      cloudlock_passwords: cachedPasswords 
    });
    
    console.log('✅ Password saved to Firestore');
    return savedPassword;
  } catch (error) {
    console.error('Error saving password:', error);
    throw new Error('Failed to save password: ' + error.message);
  }
}

// Logout
async function logout() {
  authenticatedUser = null;
  cachedPasswords = [];
  sessionKey = null;
  authToken = null;

  await chrome.storage.local.remove([
    'cloudlock_user',
    'cloudlock_uid',
    'cloudlock_token',
    'cloudlock_session_key',
    'cloudlock_passwords'
  ]);
}

// Generate secure password
function generateSecurePassword(options = {}) {
  const length = options.length || 16;
  const uppercase = options.uppercase !== false;
  const lowercase = options.lowercase !== false;
  const numbers = options.numbers !== false;
  const symbols = options.symbols !== false;
  
  let charset = '';
  if (uppercase) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (lowercase) charset += 'abcdefghijklmnopqrstuvwxyz';
  if (numbers) charset += '0123456789';
  if (symbols) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';
  
  if (charset.length === 0) {
    charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  }
  
  let password = '';
  const array = new Uint32Array(length);
  crypto.getRandomValues(array);
  
  for (let i = 0; i < length; i++) {
    password += charset[array[i] % charset.length];
  }
  
  return password;
}

// ============================================
// ANALYTICS & STATS TRACKING
// ============================================

// Track extension usage stats
async function trackStat(statType) {
  try {
    const stored = await chrome.storage.local.get('cloudlock_stats');
    const stats = stored.cloudlock_stats || {
      autofills: 0,
      generated: 0,
      breachChecks: 0,
      passwordsSaved: 0,
      lastReset: Date.now()
    };

    // Reset daily
    const daysSinceReset = (Date.now() - stats.lastReset) / (24 * 60 * 60 * 1000);
    if (daysSinceReset >= 1) {
      stats.autofills = 0;
      stats.lastReset = Date.now();
    }

    switch (statType) {
      case 'autofill':
        stats.autofills = (stats.autofills || 0) + 1;
        break;
      case 'generated':
        stats.generated = (stats.generated || 0) + 1;
        break;
      case 'breachCheck':
        stats.breachChecks = (stats.breachChecks || 0) + 1;
        break;
      case 'passwordSaved':
        stats.passwordsSaved = (stats.passwordsSaved || 0) + 1;
        break;
    }

    await chrome.storage.local.set({ cloudlock_stats: stats });
  } catch (error) {
    console.error('Failed to track stat:', error);
  }
}

// Update savePassword to track stats
const originalSavePassword = savePassword;
async function savePasswordWithStats(data) {
  const result = await originalSavePassword(data);
  await trackStat('passwordSaved');
  return result;
}

// Update generateSecurePassword to track stats
const originalGeneratePassword = generateSecurePassword;
function generateSecurePasswordWithStats(options = {}) {
  const password = originalGeneratePassword(options);
  trackStat('generated');
  return password;
}

// Auto-lock with configurable timeout
setInterval(async () => {
  if (authenticatedUser) {
    const settings = await chrome.storage.local.get('cloudlock_settings');
    const autoLockMinutes = settings.cloudlock_settings?.autoLockMinutes || 30;

    if (autoLockMinutes === -1) return; // Never lock

    const elapsed = Date.now() - authenticatedUser.timestamp;
    if (elapsed > autoLockMinutes * 60 * 1000) {
      logout();
      chrome.runtime.sendMessage({ action: 'sessionExpired' }).catch(() => {});
    }
  }
}, 60000);

// ============================================
// ENHANCED COMMANDS HANDLING
// ============================================

// Listen for keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (command === 'fill-password') {
    chrome.tabs.sendMessage(tab.id, { action: 'showPasswordList' });
  } else if (command === 'generate-password') {
    const password = generateSecurePasswordWithStats();
    chrome.tabs.sendMessage(tab.id, {
      action: 'fillPassword',
      password: password
    });
  }
});

// ============================================
// PASSWORD HEALTH ANALYSIS
// ============================================

// Analyze password vault health
async function analyzePasswordHealth() {
  if (cachedPasswords.length === 0) {
    return {
      score: 100,
      issues: [],
      recommendations: []
    };
  }

  const issues = [];
  const recommendations = [];
  let score = 100;

  // Check for duplicate passwords
  const passwordMap = new Map();
  cachedPasswords.forEach(p => {
    if (!passwordMap.has(p.password)) {
      passwordMap.set(p.password, []);
    }
    passwordMap.get(p.password).push(p.siteName);
  });

  const duplicates = Array.from(passwordMap.entries())
    .filter(([_, sites]) => sites.length > 1);

  if (duplicates.length > 0) {
    score -= duplicates.length * 10;
    issues.push(`${duplicates.length} duplicate password(s) found`);
    recommendations.push('Use unique passwords for each site');
  }

  // Check for weak passwords
  const weakPasswords = cachedPasswords.filter(p => {
    return p.password.length < 8 ||
           !/[A-Z]/.test(p.password) ||
           !/[a-z]/.test(p.password) ||
           !/[0-9]/.test(p.password);
  });

  if (weakPasswords.length > 0) {
    score -= weakPasswords.length * 5;
    issues.push(`${weakPasswords.length} weak password(s) detected`);
    recommendations.push('Update weak passwords to strong ones');
  }

  // Check for old passwords (not updated in 6 months)
  const sixMonthsAgo = Date.now() - (180 * 24 * 60 * 60 * 1000);
  const oldPasswords = cachedPasswords.filter(p => {
    const updatedAt = p.updatedAt ? new Date(p.updatedAt).getTime() : 0;
    return updatedAt < sixMonthsAgo;
  });

  if (oldPasswords.length > 3) {
    score -= 10;
    issues.push(`${oldPasswords.length} passwords not updated in 6+ months`);
    recommendations.push('Regularly update your passwords');
  }

  score = Math.max(0, score);

  return {
    score,
    issues,
    recommendations,
    stats: {
      total: cachedPasswords.length,
      weak: weakPasswords.length,
      duplicates: duplicates.length,
      old: oldPasswords.length
    }
  };
}

// Add health check to message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyzeHealth') {
    analyzePasswordHealth()
      .then(health => sendResponse({ success: true, health }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

console.log('CloudLock background script initialized with advanced features');