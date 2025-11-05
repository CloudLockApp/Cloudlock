// Background Service Worker
let authenticatedUser = null;
let cachedPasswords = [];
let sessionKey = null;

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

// Authentication handler
async function handleAuthentication(credentials) {
  try {
    // Store credentials in Chrome storage (encrypted)
    const encrypted = await encryptData(credentials);
    await chrome.storage.local.set({ 
      cloudlock_session: encrypted,
      cloudlock_user: credentials.email 
    });
    
    authenticatedUser = {
      email: credentials.email,
      timestamp: Date.now()
    };
    
    sessionKey = credentials.password;
    
    // Fetch passwords
    await syncPasswords();
    
    return authenticatedUser;
  } catch (error) {
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
  
  // Sync from storage
  await syncPasswords();
  return cachedPasswords;
}

// Sync passwords from CloudLock web app
async function syncPasswords() {
  try {
    const stored = await chrome.storage.local.get('cloudlock_passwords');
    if (stored.cloudlock_passwords) {
      cachedPasswords = stored.cloudlock_passwords;
    }
  } catch (error) {
    console.error('Error syncing passwords:', error);
  }
}

// Save password
async function savePassword(data) {
  if (!authenticatedUser) {
    throw new Error('Not authenticated');
  }
  
  const password = {
    id: generateId(),
    siteName: data.siteName,
    url: data.url,
    username: data.username,
    password: await encryptData(data.password),
    createdAt: Date.now()
  };
  
  cachedPasswords.push(password);
  
  await chrome.storage.local.set({ 
    cloudlock_passwords: cachedPasswords 
  });
  
  return password;
}

// Logout
async function logout() {
  authenticatedUser = null;
  cachedPasswords = [];
  sessionKey = null;
  
  await chrome.storage.local.remove([
    'cloudlock_session',
    'cloudlock_user',
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

// Simple encryption (in production, use Web Crypto API properly)
async function encryptData(data) {
  if (!sessionKey) return data;
  
  // Simple XOR encryption for demo (use proper encryption in production)
  const text = typeof data === 'string' ? data : JSON.stringify(data);
  let encrypted = '';
  
  for (let i = 0; i < text.length; i++) {
    encrypted += String.fromCharCode(
      text.charCodeAt(i) ^ sessionKey.charCodeAt(i % sessionKey.length)
    );
  }
  
  return btoa(encrypted);
}

// Simple decryption
async function decryptData(encrypted) {
  if (!sessionKey) return encrypted;
  
  const text = atob(encrypted);
  let decrypted = '';
  
  for (let i = 0; i < text.length; i++) {
    decrypted += String.fromCharCode(
      text.charCodeAt(i) ^ sessionKey.charCodeAt(i % sessionKey.length)
    );
  }
  
  return decrypted;
}

// Generate unique ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Auto-lock after 30 minutes
setInterval(() => {
  if (authenticatedUser) {
    const elapsed = Date.now() - authenticatedUser.timestamp;
    if (elapsed > 30 * 60 * 1000) {
      logout();
      chrome.runtime.sendMessage({ action: 'sessionExpired' });
    }
  }
}, 60000);