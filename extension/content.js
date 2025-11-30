// Content Script - Runs on all pages
let passwordFields = [];
let usernameFields = [];
let currentField = null;

// Initialize on page load
window.addEventListener('load', () => {
  detectPasswordFields();
  addCloudLockIcons();
  observeDOMChanges();
});

// Detect password and username fields
function detectPasswordFields() {
  // Find all password fields
  const allPasswordFields = Array.from(document.querySelectorAll('input[type="password"]:not([style*="display: none"]):not([style*="visibility: hidden"])'));

  // Filter to only login forms (avoid registration and password change forms)
  passwordFields = allPasswordFields.filter(field => {
    const form = field.closest('form') || field.parentElement;

    // Count password fields in this form
    const passwordFieldsInForm = form.querySelectorAll('input[type="password"]').length;

    // Skip if multiple password fields (likely registration or password change)
    if (passwordFieldsInForm > 1) {
      return false;
    }

    // Check for registration/signup indicators
    const formText = form.textContent.toLowerCase();
    const isRegistration = /sign\s*up|register|create\s*account|join|new\s*account/i.test(formText);
    if (isRegistration) {
      return false;
    }

    // Check field attributes for "new" or "confirm" indicators
    const fieldName = (field.name || '').toLowerCase();
    const fieldId = (field.id || '').toLowerCase();
    const fieldPlaceholder = (field.placeholder || '').toLowerCase();

    if (fieldName.includes('new') || fieldName.includes('confirm') ||
        fieldId.includes('new') || fieldId.includes('confirm') ||
        fieldPlaceholder.includes('new') || fieldPlaceholder.includes('confirm')) {
      return false;
    }

    return true;
  });

  // Expanded username field detection with better selectors
  const usernameSelectors = [
    'input[type="email"]',
    'input[type="text"][name*="user" i]',
    'input[type="text"][name*="email" i]',
    'input[type="text"][name*="login" i]',
    'input[type="text"][id*="user" i]',
    'input[type="text"][id*="email" i]',
    'input[type="text"][id*="login" i]',
    'input[type="text"][autocomplete="username"]',
    'input[type="text"][autocomplete="email"]',
    'input[type="text"][placeholder*="email" i]',
    'input[type="text"][placeholder*="username" i]',
    'input[type="text"][placeholder*="user" i]',
    'input[type="text"][aria-label*="email" i]',
    'input[type="text"][aria-label*="username" i]',
    'input[type="tel"]' // Sometimes used for username
  ];

  const foundFields = new Set();
  usernameSelectors.forEach(selector => {
    try {
      const fields = document.querySelectorAll(selector);
      fields.forEach(field => {
        // Check if field is visible
        const style = window.getComputedStyle(field);
        if (style.display !== 'none' && style.visibility !== 'hidden' && field.offsetParent !== null) {
          // Only add if it's in a form with a valid password field
          const form = field.closest('form') || field.parentElement;
          const hasValidPasswordField = passwordFields.some(pwField =>
            pwField.closest('form') === form || pwField.parentElement === form
          );

          if (hasValidPasswordField) {
            foundFields.add(field);
          }
        }
      });
    } catch (e) {
      // Selector might fail on some sites, continue
    }
  });

  usernameFields = Array.from(foundFields);

  // If we have password fields but no username fields, look for text inputs near password fields
  if (passwordFields.length > 0 && usernameFields.length === 0) {
    passwordFields.forEach(pwField => {
      const form = pwField.closest('form');
      if (form) {
        const textInputs = form.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"]');
        textInputs.forEach(input => {
          const style = window.getComputedStyle(input);
          if (style.display !== 'none' && style.visibility !== 'hidden' && input.offsetParent !== null) {
            foundFields.add(input);
          }
        });
      }
    });
    usernameFields = Array.from(foundFields);
  }

  console.log(`CloudLock: Found ${passwordFields.length} password fields, ${usernameFields.length} username fields (login forms only)`);
}

// Add CloudLock icons to input fields
function addCloudLockIcons() {
  passwordFields.forEach(field => {
    if (field.cloudlockIconAdded) return;

    // Don't wrap - instead ensure parent can contain absolute positioned icon
    const parent = field.parentElement;
    const computedStyle = window.getComputedStyle(parent);

    // Store original parent position
    const originalPosition = computedStyle.position;
    if (originalPosition === 'static') {
      parent.style.position = 'relative';
      parent.dataset.cloudlockPositioned = 'true';
    }

    const icon = document.createElement('div');
    icon.className = 'cloudlock-icon';
    icon.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
      </svg>
    `;
    icon.title = 'Fill with CloudLock';

    // Position icon relative to the input field with fixed positioning
    icon.style.position = 'absolute';
    icon.style.pointerEvents = 'auto'; // Ensure icon is clickable
    const rect = field.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();
    icon.style.top = (rect.top - parentRect.top + (rect.height / 2)) + 'px';
    icon.style.right = (parentRect.right - rect.right + 5) + 'px';
    icon.style.transform = 'translateY(-50%)';

    icon.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      currentField = field;
      showPasswordMenu(field);
    });

    parent.appendChild(icon);
    field.cloudlockIconAdded = true;
    field.cloudlockIcon = icon;

    // Store field reference for icon repositioning
    icon.dataset.fieldId = Math.random().toString(36);
    field.dataset.cloudlockFieldId = icon.dataset.fieldId;
  });

  usernameFields.forEach(field => {
    if (field.cloudlockIconAdded) return;

    // Don't wrap - instead ensure parent can contain absolute positioned icon
    const parent = field.parentElement;
    const computedStyle = window.getComputedStyle(parent);

    // Store original parent position
    const originalPosition = computedStyle.position;
    if (originalPosition === 'static') {
      parent.style.position = 'relative';
      parent.dataset.cloudlockPositioned = 'true';
    }

    const icon = document.createElement('div');
    icon.className = 'cloudlock-icon cloudlock-username-icon';
    icon.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
        <circle cx="12" cy="7" r="4"></circle>
      </svg>
    `;
    icon.title = 'Fill username with CloudLock';

    // Position icon relative to the input field with fixed positioning
    icon.style.position = 'absolute';
    icon.style.pointerEvents = 'auto'; // Ensure icon is clickable
    const rect = field.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();
    icon.style.top = (rect.top - parentRect.top + (rect.height / 2)) + 'px';
    icon.style.right = (parentRect.right - rect.right + 5) + 'px';
    icon.style.transform = 'translateY(-50%)';

    icon.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      currentField = field;
      showPasswordMenu(field, 'username');
    });

    parent.appendChild(icon);
    field.cloudlockIconAdded = true;
    field.cloudlockIcon = icon;

    // Store field reference for icon repositioning
    icon.dataset.fieldId = Math.random().toString(36);
    field.dataset.cloudlockFieldId = icon.dataset.fieldId;
  });
}

// Show password selection menu
function showPasswordMenu(field, type = 'password') {
  // Remove existing menu
  const existingMenu = document.querySelector('.cloudlock-menu');
  if (existingMenu) {
    existingMenu.remove();
  }
  
  // Create menu
  const menu = document.createElement('div');
  menu.className = 'cloudlock-menu';
  
  // Get field position
  const rect = field.getBoundingClientRect();
  menu.style.top = (rect.bottom + window.scrollY + 5) + 'px';
  menu.style.left = (rect.left + window.scrollX) + 'px';
  menu.style.width = rect.width + 'px';
  
  menu.innerHTML = '<div class="cloudlock-menu-loading">Loading passwords...</div>';
  
  document.body.appendChild(menu);
  
  // Request passwords from background
  chrome.runtime.sendMessage({ action: 'getPasswords' }, (response) => {
    if (response.success) {
      displayPasswordOptions(menu, response.passwords, field, type);
    } else {
      menu.innerHTML = `
        <div class="cloudlock-menu-error">
          <p>Not authenticated</p>
          <button class="cloudlock-menu-btn cloudlock-login-btn">Login to CloudLock</button>
        </div>
      `;

      // Add event listener for login button
      const loginBtn = menu.querySelector('.cloudlock-login-btn');
      if (loginBtn) {
        loginBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          openPopup();
        });
      }
    }
  });
  
  // Close menu on outside click
  setTimeout(() => {
    document.addEventListener('click', closeMenuHandler);
  }, 100);
}

// Display password options
function displayPasswordOptions(menu, passwords, field, type) {
  if (passwords.length === 0) {
    menu.innerHTML = `
      <div class="cloudlock-menu-empty">
        <p>No saved passwords</p>
        <button class="cloudlock-menu-btn cloudlock-save-current-btn">Save Current Password</button>
      </div>
    `;

    // Add event listener for save current button
    const saveCurrentBtn = menu.querySelector('.cloudlock-save-current-btn');
    if (saveCurrentBtn) {
      saveCurrentBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        saveCurrentPassword();
      });
    }
    return;
  }
  
  const currentDomain = window.location.hostname;
  const matchingPasswords = passwords.filter(p => 
    p.url && p.url.includes(currentDomain)
  );
  
  const otherPasswords = passwords.filter(p => 
    !p.url || !p.url.includes(currentDomain)
  );
  
  let html = '<div class="cloudlock-menu-header">Fill with CloudLock</div>';
  
  if (matchingPasswords.length > 0) {
    html += '<div class="cloudlock-menu-section">Matching passwords</div>';
    matchingPasswords.forEach(password => {
      html += createPasswordMenuItem(password, field, type);
    });
  }
  
  if (otherPasswords.length > 0) {
    html += '<div class="cloudlock-menu-section">Other passwords</div>';
    otherPasswords.slice(0, 5).forEach(password => {
      html += createPasswordMenuItem(password, field, type);
    });
  }
  
  html += `
    <div class="cloudlock-menu-actions">
      <button class="cloudlock-menu-btn-small cloudlock-generate-btn">Generate New</button>
      <button class="cloudlock-menu-btn-small cloudlock-open-vault-btn">Open Vault</button>
    </div>
  `;

  menu.innerHTML = html;

  // Add event listeners for password items
  menu.querySelectorAll('.cloudlock-menu-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const passwordId = item.dataset.passwordId;
      const fillType = item.dataset.fillType;
      fillPasswordById(passwordId, fillType);
    });
  });

  // Add event listener for generate button
  const generateBtn = menu.querySelector('.cloudlock-generate-btn');
  if (generateBtn) {
    generateBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      generatePassword();
    });
  }

  // Add event listener for open vault button
  const openVaultBtn = menu.querySelector('.cloudlock-open-vault-btn');
  if (openVaultBtn) {
    openVaultBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openPopup();
    });
  }
}

// Create menu item for password
function createPasswordMenuItem(password, field, type) {
  return `
    <div class="cloudlock-menu-item" data-password-id="${password.id}" data-fill-type="${type}">
      <div class="cloudlock-menu-item-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M12 6v6l4 2"></path>
        </svg>
      </div>
      <div class="cloudlock-menu-item-content">
        <div class="cloudlock-menu-item-title">${escapeHtml(password.siteName)}</div>
        <div class="cloudlock-menu-item-subtitle">${escapeHtml(password.username)}</div>
      </div>
    </div>
  `;
}

// Fill password by ID
function fillPasswordById(passwordId, type) {
  chrome.runtime.sendMessage({ action: 'getPasswords' }, (response) => {
    if (response.success) {
      const password = response.passwords.find(p => p.id === passwordId);
      if (password && currentField) {
        const value = type === 'password' ? password.password : password.username;

        // Use multiple methods to ensure the value is set and detected
        fillFieldWithValue(currentField, value);

        closeMenu();

        // Flash field to show it was filled
        currentField.style.background = '#7c3aed22';
        setTimeout(() => {
          currentField.style.background = '';
        }, 500);
      }
    } else {
      // Show error if not authenticated
      closeMenu();
      showAuthError();
    }
  });
}

// Show authentication error
function showAuthError() {
  const errorMsg = document.createElement('div');
  errorMsg.className = 'cloudlock-save-prompt';
  errorMsg.innerHTML = `
    <div class="cloudlock-save-prompt-header">
      <span>Not authenticated</span>
      <button class="cloudlock-save-prompt-close">×</button>
    </div>
    <div style="padding: 20px; text-align: center; color: rgba(255,255,255,0.7);">
      <p>Please log in to CloudLock first</p>
    </div>
  `;

  // Add close button listener
  errorMsg.querySelector('.cloudlock-save-prompt-close').addEventListener('click', () => {
    errorMsg.remove();
  });

  document.body.appendChild(errorMsg);
  setTimeout(() => errorMsg.remove(), 3000);
}

// Improved field filling that works with React, Vue, Angular, etc.
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

// Generate new password
function generatePassword() {
  chrome.runtime.sendMessage({
    action: 'generatePassword',
    options: { length: 16 }
  }, (response) => {
    if (response.success && currentField) {
      fillFieldWithValue(currentField, response.password);

      closeMenu();

      // Show save prompt
      showSavePrompt(response.password);
    }
  });
}

// Open popup
function openPopup() {
  chrome.runtime.sendMessage({ action: 'openPopup' });
  closeMenu();
}

// Save current password
function saveCurrentPassword() {
  const passwordField = passwordFields[0];
  const usernameField = usernameFields[0];

  if (passwordField && passwordField.value) {
    showSavePrompt(passwordField.value, usernameField ? usernameField.value : '');
  }

  closeMenu();
}

// Show save prompt
function showSavePrompt(password, username = '') {
  const existingPrompt = document.querySelector('.cloudlock-save-prompt');
  if (existingPrompt) existingPrompt.remove();
  
  const prompt = document.createElement('div');
  prompt.className = 'cloudlock-save-prompt';
  prompt.innerHTML = `
    <div class="cloudlock-save-prompt-header">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
      </svg>
      <span>Save to CloudLock?</span>
      <button class="cloudlock-save-prompt-close" onclick="this.closest('.cloudlock-save-prompt').remove()">×</button>
    </div>
    <input type="text" class="cloudlock-save-input" placeholder="Website name" value="${window.location.hostname}" />
    <input type="text" class="cloudlock-save-input" placeholder="Username" value="${username}" />
    <div class="cloudlock-save-prompt-actions">
      <button class="cloudlock-save-prompt-btn cloudlock-save-cancel" onclick="this.closest('.cloudlock-save-prompt').remove()">Cancel</button>
      <button class="cloudlock-save-prompt-btn cloudlock-save-confirm" onclick="window.cloudlockConfirmSave('${btoa(password)}')">Save</button>
    </div>
  `;
  
  document.body.appendChild(prompt);
  
  // Auto-remove after 30 seconds
  setTimeout(() => {
    if (document.body.contains(prompt)) {
      prompt.remove();
    }
  }, 30000);
}

// Confirm save (keep as window function for inline handler compatibility)
window.cloudlockConfirmSave = function(encodedPassword) {
  const prompt = document.querySelector('.cloudlock-save-prompt');
  const inputs = prompt.querySelectorAll('.cloudlock-save-input');
  const siteName = inputs[0].value;
  const username = inputs[1].value;
  const password = atob(encodedPassword);

  chrome.runtime.sendMessage({
    action: 'savePassword',
    data: {
      siteName: siteName,
      url: window.location.href,
      username: username,
      password: password
    }
  }, (response) => {
    if (response.success) {
      prompt.innerHTML = `
        <div class="cloudlock-save-prompt-success">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          <span>Saved to CloudLock!</span>
        </div>
      `;

      setTimeout(() => prompt.remove(), 2000);
    } else {
      alert('Failed to save password: ' + response.error);
    }
  });
};

// Close menu
function closeMenu() {
  const menu = document.querySelector('.cloudlock-menu');
  if (menu) menu.remove();
  document.removeEventListener('click', closeMenuHandler);
}

function closeMenuHandler(e) {
  if (!e.target.closest('.cloudlock-menu') && !e.target.closest('.cloudlock-icon')) {
    closeMenu();
  }
}

// Observe DOM changes for dynamically added fields
function observeDOMChanges() {
  let debounceTimer;
  const observer = new MutationObserver(() => {
    // Debounce to avoid performance issues on rapidly changing pages
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      detectPasswordFields();
      addCloudLockIcons();
    }, 300);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Also reposition icons on window resize or scroll
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      repositionIcons();
    }, 200);
  });
}

// Reposition icons when layout changes
function repositionIcons() {
  [...passwordFields, ...usernameFields].forEach(field => {
    if (field.cloudlockIcon && field.parentElement) {
      const parent = field.parentElement;
      const rect = field.getBoundingClientRect();
      const parentRect = parent.getBoundingClientRect();
      field.cloudlockIcon.style.top = (rect.top - parentRect.top + (rect.height / 2)) + 'px';
      field.cloudlockIcon.style.right = (parentRect.right - rect.right + 5) + 'px';
    }
  });
}

// Listen for messages from background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fillPassword') {
    if (currentField) {
      currentField.value = request.password;
      currentField.dispatchEvent(new Event('input', { bubbles: true }));
      currentField.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
  
  if (request.action === 'showPasswordList') {
    if (passwordFields.length > 0) {
      currentField = passwordFields[0];
      showPasswordMenu(passwordFields[0]);
    }
  }
  
  if (request.action === 'saveCurrentPassword') {
    saveCurrentPassword();
  }
  
  sendResponse({ success: true });
});

// Utility function
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}