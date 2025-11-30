// ============================================
// CLOUDLOCK EXTENSION - ADVANCED ENHANCEMENTS
// Comprehensive features for modern password management
// ============================================

// ============================================
// CONFIGURATION & STATE
// ============================================

const CloudLockAdvanced = {
  settings: {},
  formTracking: new Map(),
  passwordFieldTracker: new WeakMap(),
  twoFACodeDetector: null,
  formSubmissionObserver: null,
  lastPasswordSaved: null,
  sessionStats: {
    autofills: 0,
    passwordsGenerated: 0,
    breachesDetected: 0,
    twoFACopied: 0
  }
};

// ============================================
// 1. ADVANCED FORM DETECTION
// ============================================

// Enhanced form detection for SPAs, multi-step forms, and dynamic content
function enhancedFormDetection() {
  const forms = document.querySelectorAll('form');

  forms.forEach(form => {
    if (form.cloudlockTracked) return;

    const formData = analyzeForm(form);
    CloudLockAdvanced.formTracking.set(form, formData);
    form.cloudlockTracked = true;

    // Track form submission
    form.addEventListener('submit', handleFormSubmission);

    // Track button clicks for SPA forms without submit events
    const buttons = form.querySelectorAll('button[type="submit"], button:not([type])');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        setTimeout(() => checkForSuccessfulLogin(form, formData), 500);
      });
    });
  });
}

// Analyze form type and fields
function analyzeForm(form) {
  const fields = {
    username: null,
    password: null,
    confirmPassword: null,
    email: null
  };

  // Find password fields
  const passwordFields = form.querySelectorAll('input[type="password"]');
  if (passwordFields.length > 0) {
    fields.password = passwordFields[0];
    if (passwordFields.length > 1) {
      fields.confirmPassword = passwordFields[1];
    }
  }

  // Find username/email fields
  const usernameSelectors = [
    'input[type="email"]',
    'input[name*="user"]',
    'input[name*="email"]',
    'input[id*="user"]',
    'input[id*="email"]',
    'input[autocomplete="username"]',
    'input[autocomplete="email"]'
  ];

  for (const selector of usernameSelectors) {
    const field = form.querySelector(selector);
    if (field) {
      if (field.type === 'email') {
        fields.email = field;
      }
      fields.username = field;
      break;
    }
  }

  // Determine form type
  let formType = 'unknown';
  const formText = form.textContent.toLowerCase();

  if (fields.confirmPassword) {
    formType = 'registration';
  } else if (/sign\s*up|register|create|join/i.test(formText)) {
    formType = 'registration';
  } else if (/log\s*in|sign\s*in|login/i.test(formText)) {
    formType = 'login';
  } else if (/reset|forgot|recover/i.test(formText)) {
    formType = 'reset';
  } else if (/change.*password/i.test(formText)) {
    formType = 'change-password';
  }

  return {
    fields,
    type: formType,
    url: window.location.href,
    domain: window.location.hostname,
    lastInteraction: Date.now()
  };
}

// Handle form submission
async function handleFormSubmission(e) {
  const form = e.target;
  const formData = CloudLockAdvanced.formTracking.get(form);

  if (!formData || !formData.fields.password) return;

  const username = formData.fields.username?.value || formData.fields.email?.value || '';
  const password = formData.fields.password?.value || '';

  if (!password) return;

  // Store for potential auto-save after successful login
  CloudLockAdvanced.pendingSave = {
    username,
    password,
    form,
    formData,
    timestamp: Date.now()
  };

  // Wait for navigation/success indication
  setTimeout(() => checkForSuccessfulLogin(form, formData), 1000);
  setTimeout(() => checkForSuccessfulLogin(form, formData), 2500);
}

// Check if login was successful
async function checkForSuccessfulLogin(form, formData) {
  if (!CloudLockAdvanced.pendingSave) return;

  const now = Date.now();
  if (now - CloudLockAdvanced.pendingSave.timestamp > 5000) {
    CloudLockAdvanced.pendingSave = null;
    return;
  }

  // Check for success indicators
  const successIndicators = [
    () => !document.contains(form), // Form removed from DOM
    () => window.location.href !== formData.url, // Navigation occurred
    () => document.querySelector('[class*="success"], [class*="welcome"]'), // Success message
    () => !form.querySelector('.error, [class*="error"]') && formData.fields.password.value === '' // Field cleared without error
  ];

  const isSuccess = successIndicators.some(check => check());

  if (isSuccess && formData.type === 'login') {
    showAutoSavePrompt(CloudLockAdvanced.pendingSave);
  }
}

// ============================================
// 2. AUTO-SAVE PASSWORD PROMPT
// ============================================

async function showAutoSavePrompt(saveData) {
  // Check if we already have this password saved
  chrome.runtime.sendMessage({ action: 'getPasswords' }, async (response) => {
    if (response.success && response.passwords) {
      const existing = response.passwords.find(p =>
        p.username === saveData.username &&
        p.url && window.location.hostname.includes(extractDomain(p.url))
      );

      if (existing) {
        // Check if password changed
        if (existing.password !== saveData.password) {
          showUpdatePasswordPrompt(existing, saveData);
        }
        return;
      }
    }

    // Show save prompt for new password
    displaySavePrompt(saveData);
  });
}

function displaySavePrompt(saveData) {
  const existing = document.querySelector('.cloudlock-autosave-prompt');
  if (existing) existing.remove();

  const prompt = document.createElement('div');
  prompt.className = 'cloudlock-autosave-prompt';
  prompt.innerHTML = `
    <div class="cloudlock-autosave-content">
      <div class="cloudlock-autosave-header">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
          <polyline points="17 21 17 13 7 13 7 21"></polyline>
          <polyline points="7 3 7 8 15 8"></polyline>
        </svg>
        <span>Save password to CloudLock?</span>
        <button class="cloudlock-autosave-close">×</button>
      </div>
      <div class="cloudlock-autosave-info">
        <input type="text" class="cloudlock-autosave-input" placeholder="Site name" value="${window.location.hostname}" />
        <input type="text" class="cloudlock-autosave-input" placeholder="Username" value="${escapeHtml(saveData.username)}" />
      </div>
      <div class="cloudlock-autosave-actions">
        <button class="cloudlock-autosave-btn cloudlock-autosave-never">Never</button>
        <button class="cloudlock-autosave-btn cloudlock-autosave-not-now">Not Now</button>
        <button class="cloudlock-autosave-btn cloudlock-autosave-save">Save</button>
      </div>
    </div>
  `;

  document.body.appendChild(prompt);

  // Event listeners
  prompt.querySelector('.cloudlock-autosave-close').addEventListener('click', () => prompt.remove());
  prompt.querySelector('.cloudlock-autosave-not-now').addEventListener('click', () => prompt.remove());
  prompt.querySelector('.cloudlock-autosave-never').addEventListener('click', async () => {
    await addToNeverSaveList(window.location.hostname);
    prompt.remove();
  });
  prompt.querySelector('.cloudlock-autosave-save').addEventListener('click', async () => {
    const inputs = prompt.querySelectorAll('.cloudlock-autosave-input');
    const siteName = inputs[0].value;
    const username = inputs[1].value;

    await savePasswordToVault({
      siteName,
      url: window.location.href,
      username,
      password: saveData.password
    });

    prompt.remove();
    showSuccessNotification('Password saved successfully!');
  });

  setTimeout(() => {
    if (document.body.contains(prompt)) prompt.remove();
  }, 15000);
}

async function savePasswordToVault(data) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({
      action: 'savePassword',
      data: data
    }, (response) => {
      resolve(response);
    });
  });
}

// ============================================
// 3. PASSWORD HEALTH MONITORING
// ============================================

async function checkPasswordHealth() {
  const settings = await loadSettings();
  if (!settings.breachCheck) return;

  // Monitor when user types password
  passwordFields.forEach(field => {
    if (field.cloudlockHealthCheck) return;

    let checkTimeout;
    field.addEventListener('blur', async function() {
      const password = this.value;
      if (!password || password.length < 6) return;

      clearTimeout(checkTimeout);
      checkTimeout = setTimeout(async () => {
        const breachCount = await checkPasswordBreach(password);

        if (breachCount > 0) {
          showBreachWarning(breachCount, this);
          CloudLockAdvanced.sessionStats.breachesDetected++;
        }
      }, 500);
    });

    field.cloudlockHealthCheck = true;
  });
}

async function checkPasswordBreach(password) {
  try {
    const hash = await sha1(password);
    const prefix = hash.substring(0, 5);
    const suffix = hash.substring(5).toUpperCase();

    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
    if (!response.ok) return -1;

    const text = await response.text();
    const hashes = text.split('\n');

    for (const line of hashes) {
      const [hashSuffix, count] = line.split(':');
      if (hashSuffix.trim() === suffix) {
        return parseInt(count, 10);
      }
    }

    return 0;
  } catch (error) {
    console.error('Breach check failed:', error);
    return -1;
  }
}

async function sha1(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-1', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function showBreachWarning(count, field) {
  const warning = document.createElement('div');
  warning.className = 'cloudlock-breach-warning-inline';
  warning.innerHTML = `
    <div class="cloudlock-breach-content">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
        <line x1="12" y1="9" x2="12" y2="13"></line>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
      </svg>
      <span>This password has been exposed in ${count.toLocaleString()} data breaches!</span>
      <button class="cloudlock-breach-dismiss">×</button>
    </div>
  `;

  // Insert after field
  field.parentNode.insertBefore(warning, field.nextSibling);

  warning.querySelector('.cloudlock-breach-dismiss').addEventListener('click', () => {
    warning.remove();
  });

  setTimeout(() => {
    if (document.body.contains(warning)) warning.remove();
  }, 10000);
}

// ============================================
// 4. 2FA CODE DETECTION & AUTO-COPY
// ============================================

function init2FADetection() {
  // Watch for 2FA codes in SMS/Email patterns
  const codePatterns = [
    /\b(\d{6})\b/g,  // 6-digit codes
    /\b(\d{4})\b/g,  // 4-digit codes
    /\b([A-Z0-9]{6})\b/g,  // 6-char alphanumeric
  ];

  // Detect 2FA input fields
  const twoFASelectors = [
    'input[name*="code"]',
    'input[name*="token"]',
    'input[name*="otp"]',
    'input[name*="2fa"]',
    'input[name*="mfa"]',
    'input[name*="verification"]',
    'input[id*="code"]',
    'input[id*="token"]',
    'input[id*="otp"]',
    'input[placeholder*="code"]',
    'input[placeholder*="verification"]'
  ];

  const twoFAFields = document.querySelectorAll(twoFASelectors.join(', '));

  if (twoFAFields.length > 0) {
    show2FAHelper(twoFAFields[0]);
  }
}

function show2FAHelper(field) {
  const helper = document.createElement('div');
  helper.className = 'cloudlock-2fa-helper';
  helper.innerHTML = `
    <div class="cloudlock-2fa-content">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
        <line x1="12" y1="18" x2="12.01" y2="18"></line>
      </svg>
      <span>Paste 2FA code from clipboard</span>
      <button class="cloudlock-2fa-paste">Paste</button>
    </div>
  `;

  field.parentNode.insertBefore(helper, field.nextSibling);

  helper.querySelector('.cloudlock-2fa-paste').addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      const codeMatch = text.match(/\b(\d{4,8})\b/);

      if (codeMatch) {
        field.value = codeMatch[1];
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));

        helper.remove();
        showSuccessNotification('2FA code pasted!');
        CloudLockAdvanced.sessionStats.twoFACopied++;
      } else {
        showErrorNotification('No 2FA code found in clipboard');
      }
    } catch (error) {
      showErrorNotification('Failed to read clipboard');
    }
  });

  // Auto-detect clipboard changes
  window.addEventListener('focus', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (/^\d{4,8}$/.test(text.trim())) {
        field.value = text.trim();
        field.dispatchEvent(new Event('input', { bubbles: true }));
        helper.remove();
      }
    } catch (e) {
      // Clipboard access denied
    }
  });
}

// ============================================
// 5. SMART CREDENTIAL MATCHING
// ============================================

function extractDomain(url) {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function fuzzyDomainMatch(savedDomain, currentDomain) {
  savedDomain = extractDomain(savedDomain).toLowerCase();
  currentDomain = extractDomain(currentDomain).toLowerCase();

  // Exact match
  if (savedDomain === currentDomain) return 100;

  // Subdomain match
  if (currentDomain.endsWith(savedDomain) || savedDomain.endsWith(currentDomain)) return 90;

  // Contains match
  if (savedDomain.includes(currentDomain) || currentDomain.includes(savedDomain)) return 70;

  // Similar services (e.g., github.com vs gist.github.com)
  const savedParts = savedDomain.split('.');
  const currentParts = currentDomain.split('.');

  const commonParts = savedParts.filter(part => currentParts.includes(part));
  if (commonParts.length >= 2) return 60;

  return 0;
}

async function getSmartMatches() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'getPasswords' }, (response) => {
      if (!response.success || !response.passwords) {
        resolve([]);
        return;
      }

      const currentDomain = window.location.hostname;
      const matches = response.passwords.map(password => ({
        ...password,
        matchScore: password.url ? fuzzyDomainMatch(password.url, currentDomain) : 0
      }))
      .filter(p => p.matchScore > 0)
      .sort((a, b) => b.matchScore - a.matchScore);

      resolve(matches);
    });
  });
}

// ============================================
// 6. PASSWORD STRENGTH INDICATOR
// ============================================

function addPasswordStrengthIndicator() {
  passwordFields.forEach(field => {
    if (field.cloudlockStrengthAdded) return;

    const indicator = document.createElement('div');
    indicator.className = 'cloudlock-strength-indicator';
    indicator.innerHTML = `
      <div class="cloudlock-strength-bar">
        <div class="cloudlock-strength-fill"></div>
      </div>
      <div class="cloudlock-strength-details">
        <span class="cloudlock-strength-text"></span>
        <span class="cloudlock-strength-tips"></span>
      </div>
    `;

    field.parentNode.insertBefore(indicator, field.nextSibling);
    field.cloudlockStrengthAdded = true;

    field.addEventListener('input', function() {
      updateStrengthIndicator(this, indicator);
    });

    field.addEventListener('focus', function() {
      indicator.style.display = 'block';
    });
  });
}

function updateStrengthIndicator(field, indicator) {
  const password = field.value;
  if (!password) {
    indicator.style.display = 'none';
    return;
  }

  indicator.style.display = 'block';

  const analysis = analyzePasswordStrength(password);
  const fill = indicator.querySelector('.cloudlock-strength-fill');
  const text = indicator.querySelector('.cloudlock-strength-text');
  const tips = indicator.querySelector('.cloudlock-strength-tips');

  fill.style.width = analysis.score + '%';
  fill.className = 'cloudlock-strength-fill ' + analysis.class;
  text.textContent = analysis.label;
  text.className = 'cloudlock-strength-text ' + analysis.class;

  if (analysis.tips.length > 0) {
    tips.textContent = '💡 ' + analysis.tips[0];
    tips.style.display = 'block';
  } else {
    tips.style.display = 'none';
  }
}

function analyzePasswordStrength(password) {
  let score = 0;
  const tips = [];

  // Length scoring
  if (password.length >= 8) score += 20;
  else tips.push('Use at least 8 characters');

  if (password.length >= 12) score += 15;
  else if (password.length >= 8) tips.push('Longer is better - try 12+');

  if (password.length >= 16) score += 10;

  // Character variety
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);

  if (hasLower) score += 15;
  else tips.push('Add lowercase letters');

  if (hasUpper) score += 15;
  else tips.push('Add uppercase letters');

  if (hasNumber) score += 15;
  else tips.push('Add numbers');

  if (hasSymbol) score += 15;
  else tips.push('Add symbols (!@#$%...)');

  // Deductions for common patterns
  if (/(.)\1{2,}/.test(password)) {
    score -= 10;
    tips.push('Avoid repeating characters');
  }

  if (/^[0-9]+$/.test(password)) {
    score -= 20;
    tips.push('Don\'t use only numbers');
  }

  if (/password|123456|qwerty/i.test(password)) {
    score -= 30;
    tips.push('Avoid common words');
  }

  // Sequential characters
  if (/abc|bcd|cde|xyz|012|123|234|345|678|789/i.test(password)) {
    score -= 15;
    tips.push('Avoid sequential characters');
  }

  score = Math.max(0, Math.min(100, score));

  let label, cssClass;
  if (score < 40) {
    label = 'Weak';
    cssClass = 'weak';
  } else if (score < 60) {
    label = 'Fair';
    cssClass = 'fair';
  } else if (score < 80) {
    label = 'Good';
    cssClass = 'good';
  } else {
    label = 'Strong';
    cssClass = 'strong';
  }

  return { score, label, class: cssClass, tips };
}

// ============================================
// 7. AUTO-FILL ON PAGE LOAD
// ============================================

async function checkForAutoFill() {
  const settings = await loadSettings();
  if (!settings.autoFill) return;

  const matches = await getSmartMatches();

  if (matches.length === 1 && passwordFields.length > 0 && usernameFields.length > 0) {
    setTimeout(() => showAutoFillPrompt(matches[0]), 1000);
  } else if (matches.length > 1) {
    setTimeout(() => showMultipleMatchPrompt(matches), 1000);
  }
}

function showAutoFillPrompt(password) {
  const existing = document.querySelector('.cloudlock-autofill-prompt');
  if (existing) return;

  const prompt = document.createElement('div');
  prompt.className = 'cloudlock-autofill-prompt';
  prompt.innerHTML = `
    <div class="cloudlock-autofill-content">
      <div class="cloudlock-autofill-header">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
        <span>Auto-fill saved credentials?</span>
        <button class="cloudlock-autofill-close">×</button>
      </div>
      <div class="cloudlock-autofill-info">
        <strong>${escapeHtml(password.siteName)}</strong>
        <span>${escapeHtml(password.username)}</span>
      </div>
      <div class="cloudlock-autofill-actions">
        <button class="cloudlock-autofill-btn cloudlock-autofill-cancel">Not Now</button>
        <button class="cloudlock-autofill-btn cloudlock-autofill-fill" data-password-id="${password.id}">Auto-Fill</button>
      </div>
    </div>
  `;

  document.body.appendChild(prompt);

  prompt.querySelector('.cloudlock-autofill-close').addEventListener('click', () => prompt.remove());
  prompt.querySelector('.cloudlock-autofill-cancel').addEventListener('click', () => prompt.remove());
  prompt.querySelector('.cloudlock-autofill-fill').addEventListener('click', async function() {
    await autoFillCredentials(password);
    prompt.remove();
    CloudLockAdvanced.sessionStats.autofills++;
  });

  setTimeout(() => {
    if (document.body.contains(prompt)) prompt.remove();
  }, 10000);
}

async function autoFillCredentials(password) {
  if (usernameFields.length > 0) {
    fillFieldWithValue(usernameFields[0], password.username);
  }

  if (passwordFields.length > 0) {
    fillFieldWithValue(passwordFields[0], password.password);
  }

  // Visual feedback
  [...usernameFields, ...passwordFields].forEach(field => {
    field.style.transition = 'background 0.5s';
    field.style.background = 'linear-gradient(90deg, rgba(124, 58, 237, 0.1), rgba(167, 139, 250, 0.1))';
    setTimeout(() => {
      field.style.background = '';
    }, 1000);
  });
}

// Improved field filling that works with React, Vue, Angular, etc.
// This is duplicated from content.js since extension-enhancements.js is loaded separately
function fillFieldWithValue(field, value) {
  // Method 1: Direct value assignment
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value'
  ).set;
  nativeInputValueSetter.call(field, value);

  // Method 2: Standard value assignment
  field.value = value;

  // Method 3: Dispatch multiple events that frameworks listen to
  const events = [
    new Event('input', { bubbles: true, cancelable: true }),
    new Event('change', { bubbles: true, cancelable: true }),
    new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: value }),
    new Event('blur', { bubbles: true, cancelable: true }),
    new KeyboardEvent('keydown', { bubbles: true, cancelable: true }),
    new KeyboardEvent('keyup', { bubbles: true, cancelable: true })
  ];

  events.forEach(event => {
    try {
      field.dispatchEvent(event);
    } catch (e) {
      // Some events might fail, continue anyway
    }
  });

  // Method 4: Trigger React's internal event system
  try {
    const tracker = field._valueTracker;
    if (tracker) {
      tracker.setValue('');
    }
  } catch (e) {
    // Not a React field, ignore
  }

  // Focus the field briefly to ensure frameworks detect the change
  const originalFocus = document.activeElement;
  field.focus();
  setTimeout(() => {
    if (originalFocus && originalFocus !== field) {
      originalFocus.focus();
    }
  }, 50);
}

// ============================================
// 8. KEYBOARD SHORTCUTS
// ============================================

document.addEventListener('keydown', async (e) => {
  const settings = await loadSettings();
  if (!settings.shortcuts) return;

  // Ctrl/Cmd + Shift + L - Open password list
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'L') {
    e.preventDefault();
    if (passwordFields.length > 0) {
      currentField = passwordFields[0];
      showPasswordMenu(passwordFields[0]);
    }
  }

  // Ctrl/Cmd + Shift + G - Generate password
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'G') {
    e.preventDefault();
    if (passwordFields.length > 0) {
      currentField = passwordFields[0];
      await generateAndFillPassword();
    }
  }

  // Escape - Close menu
  if (e.key === 'Escape') {
    closeAllMenus();
  }
});

async function generateAndFillPassword() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({
      action: 'generatePassword',
      options: { length: 16 }
    }, (response) => {
      if (response.success && currentField) {
        currentField.value = response.password;
        currentField.dispatchEvent(new Event('input', { bubbles: true }));
        currentField.dispatchEvent(new Event('change', { bubbles: true }));
        CloudLockAdvanced.sessionStats.passwordsGenerated++;
        showSuccessNotification('Password generated! Remember to save it.');
      }
      resolve(response);
    });
  });
}

function closeAllMenus() {
  document.querySelectorAll('.cloudlock-menu, .cloudlock-autofill-prompt, .cloudlock-autosave-prompt').forEach(el => el.remove());
}

// ============================================
// 9. HELPER FUNCTIONS
// ============================================

async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get('cloudlock_settings', (result) => {
      const defaultSettings = {
        autoFill: true,
        autoFillOnLoad: true,
        breachCheck: true,
        strengthIndicator: true,
        shortcuts: true,
        passwordlessRecommendations: true,
        showIcons: true,
        autoLockMinutes: 30
      };
      resolve({ ...defaultSettings, ...result.cloudlock_settings });
    });
  });
}

async function addToNeverSaveList(domain) {
  return new Promise((resolve) => {
    chrome.storage.local.get('cloudlock_never_save', (result) => {
      const neverSave = result.cloudlock_never_save || [];
      if (!neverSave.includes(domain)) {
        neverSave.push(domain);
        chrome.storage.local.set({ cloudlock_never_save: neverSave }, resolve);
      } else {
        resolve();
      }
    });
  });
}

function showSuccessNotification(message) {
  showNotification(message, 'success');
}

function showErrorNotification(message) {
  showNotification(message, 'error');
}

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `cloudlock-notification cloudlock-notification-${type}`;
  notification.innerHTML = `
    <div class="cloudlock-notification-content">
      ${type === 'success' ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>' : ''}
      ${type === 'error' ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>' : ''}
      <span>${message}</span>
    </div>
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// ============================================
// 10. ENHANCED STYLES
// ============================================

const enhancedStyles = `
/* Notification System */
.cloudlock-notification {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 999999;
  animation: slideInRight 0.3s ease;
  opacity: 1;
  transition: opacity 0.3s ease;
}

.cloudlock-notification-content {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #1a1a2e;
  border: 1px solid rgba(124, 58, 237, 0.3);
  border-radius: 8px;
  padding: 12px 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  color: #fff;
  font-size: 0.9rem;
  font-weight: 500;
}

.cloudlock-notification-success .cloudlock-notification-content {
  border-color: rgba(16, 185, 129, 0.5);
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(5, 150, 105, 0.1));
}

.cloudlock-notification-success svg {
  color: #10b981;
}

.cloudlock-notification-error .cloudlock-notification-content {
  border-color: rgba(239, 68, 68, 0.5);
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(220, 38, 38, 0.1));
}

.cloudlock-notification-error svg {
  color: #ef4444;
}

/* Auto-save Prompt */
.cloudlock-autosave-prompt {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 999998;
  animation: slideInRight 0.3s ease;
}

.cloudlock-autosave-content {
  background: linear-gradient(135deg, #1a1a2e, #16213e);
  border: 1px solid rgba(124, 58, 237, 0.4);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  width: 340px;
  overflow: hidden;
}

.cloudlock-autosave-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 15px;
  background: rgba(124, 58, 237, 0.15);
  border-bottom: 1px solid rgba(124, 58, 237, 0.2);
  color: #fff;
  font-weight: 600;
  font-size: 0.9rem;
}

.cloudlock-autosave-header svg {
  color: #a78bfa;
  flex-shrink: 0;
}

.cloudlock-autosave-close {
  margin-left: auto;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.cloudlock-autosave-close:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.cloudlock-autosave-info {
  padding: 15px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.cloudlock-autosave-input {
  width: 100%;
  padding: 10px 12px;
  background: rgba(15, 15, 35, 0.6);
  border: 1px solid rgba(124, 58, 237, 0.3);
  border-radius: 6px;
  color: #fff;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.cloudlock-autosave-input:focus {
  outline: none;
  border-color: #7c3aed;
  background: rgba(15, 15, 35, 0.8);
}

.cloudlock-autosave-input::placeholder {
  color: rgba(255, 255, 255, 0.4);
}

.cloudlock-autosave-actions {
  display: flex;
  gap: 8px;
  padding: 15px;
  background: rgba(15, 15, 35, 0.6);
}

.cloudlock-autosave-btn {
  flex: 1;
  padding: 10px;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.85rem;
}

.cloudlock-autosave-never {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.cloudlock-autosave-never:hover {
  background: rgba(239, 68, 68, 0.3);
}

.cloudlock-autosave-not-now {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
}

.cloudlock-autosave-not-now:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}

.cloudlock-autosave-save {
  background: linear-gradient(135deg, #7c3aed, #a78bfa);
  color: #fff;
}

.cloudlock-autosave-save:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(124, 58, 237, 0.4);
}

/* Auto-fill Prompt */
.cloudlock-autofill-prompt {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 999998;
  animation: slideInRight 0.3s ease;
}

.cloudlock-autofill-content {
  background: linear-gradient(135deg, #1a1a2e, #16213e);
  border: 1px solid rgba(124, 58, 237, 0.4);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  width: 320px;
  overflow: hidden;
}

.cloudlock-autofill-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 15px;
  background: rgba(124, 58, 237, 0.15);
  border-bottom: 1px solid rgba(124, 58, 237, 0.2);
  color: #fff;
  font-weight: 600;
  font-size: 0.9rem;
}

.cloudlock-autofill-header svg {
  color: #a78bfa;
  flex-shrink: 0;
}

.cloudlock-autofill-close {
  margin-left: auto;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.cloudlock-autofill-close:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.cloudlock-autofill-info {
  padding: 15px;
}

.cloudlock-autofill-info strong {
  display: block;
  color: #fff;
  font-size: 1rem;
  margin-bottom: 5px;
}

.cloudlock-autofill-info span {
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.85rem;
}

.cloudlock-autofill-actions {
  display: flex;
  gap: 10px;
  padding: 15px;
  background: rgba(15, 15, 35, 0.6);
}

.cloudlock-autofill-btn {
  flex: 1;
  padding: 10px;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.9rem;
}

.cloudlock-autofill-cancel {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
}

.cloudlock-autofill-cancel:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}

.cloudlock-autofill-fill {
  background: linear-gradient(135deg, #7c3aed, #a78bfa);
  color: #fff;
}

.cloudlock-autofill-fill:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(124, 58, 237, 0.4);
}

/* Strength Indicator */
.cloudlock-strength-indicator {
  margin-top: 8px;
  display: none;
  animation: fadeIn 0.3s ease;
}

.cloudlock-strength-bar {
  height: 5px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 8px;
}

.cloudlock-strength-fill {
  height: 100%;
  transition: all 0.3s ease;
  border-radius: 3px;
}

.cloudlock-strength-fill.weak {
  background: linear-gradient(90deg, #ef4444, #dc2626);
}

.cloudlock-strength-fill.fair {
  background: linear-gradient(90deg, #f59e0b, #d97706);
}

.cloudlock-strength-fill.good {
  background: linear-gradient(90deg, #a78bfa, #8b5cf6);
}

.cloudlock-strength-fill.strong {
  background: linear-gradient(90deg, #10b981, #059669);
}

.cloudlock-strength-details {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.cloudlock-strength-text {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.cloudlock-strength-text.weak { color: #ef4444; }
.cloudlock-strength-text.fair { color: #f59e0b; }
.cloudlock-strength-text.good { color: #a78bfa; }
.cloudlock-strength-text.strong { color: #10b981; }

.cloudlock-strength-tips {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.6);
  text-align: right;
  flex: 1;
}

/* Breach Warning */
.cloudlock-breach-warning-inline {
  margin-top: 8px;
  animation: fadeIn 0.3s ease;
}

.cloudlock-breach-content {
  display: flex;
  align-items: center;
  gap: 8px;
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(220, 38, 38, 0.1));
  border: 1px solid rgba(239, 68, 68, 0.4);
  border-radius: 6px;
  padding: 10px 12px;
  font-size: 0.8rem;
  color: #ef4444;
}

.cloudlock-breach-content svg {
  flex-shrink: 0;
  color: #ef4444;
}

.cloudlock-breach-dismiss {
  margin-left: auto;
  background: none;
  border: none;
  color: #ef4444;
  font-size: 1.2rem;
  cursor: pointer;
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  transition: all 0.2s;
}

.cloudlock-breach-dismiss:hover {
  background: rgba(239, 68, 68, 0.2);
}

/* 2FA Helper */
.cloudlock-2fa-helper {
  margin-top: 8px;
  animation: fadeIn 0.3s ease;
}

.cloudlock-2fa-content {
  display: flex;
  align-items: center;
  gap: 8px;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(5, 150, 105, 0.1));
  border: 1px solid rgba(16, 185, 129, 0.4);
  border-radius: 6px;
  padding: 10px 12px;
  font-size: 0.8rem;
  color: #10b981;
}

.cloudlock-2fa-content svg {
  flex-shrink: 0;
  color: #10b981;
}

.cloudlock-2fa-paste {
  margin-left: auto;
  background: rgba(16, 185, 129, 0.2);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: #10b981;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.cloudlock-2fa-paste:hover {
  background: rgba(16, 185, 129, 0.3);
  transform: translateY(-1px);
}

/* Animations */
@keyframes slideInRight {
  from {
    transform: translateX(100px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
`;

// Inject styles
const styleSheet = document.createElement('style');
styleSheet.textContent = enhancedStyles;
document.head.appendChild(styleSheet);

// ============================================
// INITIALIZE ALL ENHANCEMENTS
// ============================================

async function initializeEnhancements() {
  const settings = await loadSettings();
  CloudLockAdvanced.settings = settings;

  // Enhanced form detection for SPAs
  enhancedFormDetection();

  // Auto-fill on page load
  if (settings.autoFill && settings.autoFillOnLoad) {
    setTimeout(checkForAutoFill, 1500);
  }

  // Password strength indicator
  if (settings.strengthIndicator) {
    addPasswordStrengthIndicator();
  }

  // Password health monitoring
  if (settings.breachCheck) {
    checkPasswordHealth();
  }

  // 2FA detection
  setTimeout(init2FADetection, 2000);

  // Re-check periodically for dynamic content
  setInterval(() => {
    enhancedFormDetection();
    if (settings.strengthIndicator) {
      addPasswordStrengthIndicator();
    }
  }, 3000);
}

// Run enhancements
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeEnhancements);
} else {
  initializeEnhancements();
}

// Listen for settings changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.cloudlock_settings) {
    CloudLockAdvanced.settings = changes.cloudlock_settings.newValue;
  }
});
