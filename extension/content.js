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
  passwordFields = Array.from(document.querySelectorAll('input[type="password"]'));
  
  usernameFields = Array.from(document.querySelectorAll(
    'input[type="email"], input[type="text"][name*="user"], input[type="text"][name*="email"], input[type="text"][id*="user"], input[type="text"][id*="email"]'
  ));
  
  console.log(`CloudLock: Found ${passwordFields.length} password fields, ${usernameFields.length} username fields`);
}

// Add CloudLock icons to input fields
function addCloudLockIcons() {
  passwordFields.forEach(field => {
    if (field.cloudlockIconAdded) return;
    
    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.style.display = 'inline-block';
    wrapper.style.width = '100%';
    
    field.parentNode.insertBefore(wrapper, field);
    wrapper.appendChild(field);
    
    const icon = document.createElement('div');
    icon.className = 'cloudlock-icon';
    icon.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
      </svg>
    `;
    icon.title = 'Fill with CloudLock';
    
    icon.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      currentField = field;
      showPasswordMenu(field);
    });
    
    wrapper.appendChild(icon);
    field.cloudlockIconAdded = true;
  });
  
  usernameFields.forEach(field => {
    if (field.cloudlockIconAdded) return;
    
    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.style.display = 'inline-block';
    wrapper.style.width = '100%';
    
    field.parentNode.insertBefore(wrapper, field);
    wrapper.appendChild(field);
    
    const icon = document.createElement('div');
    icon.className = 'cloudlock-icon cloudlock-username-icon';
    icon.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
        <circle cx="12" cy="7" r="4"></circle>
      </svg>
    `;
    icon.title = 'Fill username with CloudLock';
    
    icon.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      currentField = field;
      showPasswordMenu(field, 'username');
    });
    
    wrapper.appendChild(icon);
    field.cloudlockIconAdded = true;
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
          <button class="cloudlock-menu-btn" onclick="window.cloudlockOpenPopup()">Login to CloudLock</button>
        </div>
      `;
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
        <button class="cloudlock-menu-btn" onclick="window.cloudlockSaveCurrent()">Save Current Password</button>
      </div>
    `;
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
      <button class="cloudlock-menu-btn-small" onclick="window.cloudlockGenerate()">Generate New</button>
      <button class="cloudlock-menu-btn-small" onclick="window.cloudlockOpenPopup()">Open Vault</button>
    </div>
  `;
  
  menu.innerHTML = html;
}

// Create menu item for password
function createPasswordMenuItem(password, field, type) {
  return `
    <div class="cloudlock-menu-item" data-password-id="${password.id}" onclick="window.cloudlockFillPassword('${password.id}', '${type}')">
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

// Fill password
window.cloudlockFillPassword = function(passwordId, type) {
  chrome.runtime.sendMessage({ action: 'getPasswords' }, (response) => {
    if (response.success) {
      const password = response.passwords.find(p => p.id === passwordId);
      if (password && currentField) {
        if (type === 'password') {
          currentField.value = password.password;
          currentField.dispatchEvent(new Event('input', { bubbles: true }));
          currentField.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          currentField.value = password.username;
          currentField.dispatchEvent(new Event('input', { bubbles: true }));
          currentField.dispatchEvent(new Event('change', { bubbles: true }));
        }
        
        closeMenu();
        
        // Flash field to show it was filled
        currentField.style.background = '#7c3aed22';
        setTimeout(() => {
          currentField.style.background = '';
        }, 500);
      }
    }
  });
};

// Generate new password
window.cloudlockGenerate = function() {
  chrome.runtime.sendMessage({ 
    action: 'generatePassword',
    options: { length: 16 }
  }, (response) => {
    if (response.success && currentField) {
      currentField.value = response.password;
      currentField.dispatchEvent(new Event('input', { bubbles: true }));
      currentField.dispatchEvent(new Event('change', { bubbles: true }));
      
      closeMenu();
      
      // Show save prompt
      showSavePrompt(response.password);
    }
  });
};

// Open popup
window.cloudlockOpenPopup = function() {
  chrome.runtime.sendMessage({ action: 'openPopup' });
  closeMenu();
};

// Save current password
window.cloudlockSaveCurrent = function() {
  const passwordField = passwordFields[0];
  const usernameField = usernameFields[0];
  
  if (passwordField && passwordField.value) {
    showSavePrompt(passwordField.value, usernameField ? usernameField.value : '');
  }
  
  closeMenu();
};

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

// Confirm save
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
  const observer = new MutationObserver(() => {
    detectPasswordFields();
    addCloudLockIcons();
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
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
    window.cloudlockSaveCurrent();
  }
  
  sendResponse({ success: true });
});

// Utility function
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}