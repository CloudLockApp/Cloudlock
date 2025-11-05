// Popup JavaScript
let currentPasswords = [];
let generatedPassword = '';

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  // Check authentication status
  chrome.runtime.sendMessage({ action: 'checkAuth' }, (response) => {
    if (response.success && response.authenticated) {
      showVault(response.user);
    } else {
      showLogin();
    }
  });

  // Setup event listeners
  setupEventListeners();
});

// Setup all event listeners
function setupEventListeners() {
  // Login form
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }

  // Logout button
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }

  // Search input
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', handleSearch);
  }

  // Add password button
  const addBtn = document.getElementById('add-password-btn');
  if (addBtn) {
    addBtn.addEventListener('click', () => openModal('add-modal'));
  }

  // Generate button
  const generateBtn = document.getElementById('generate-btn');
  if (generateBtn) {
    generateBtn.addEventListener('click', () => {
      openModal('generate-modal');
      generateNewPassword();
    });
  }

  // Open vault button
  const openVaultBtn = document.getElementById('open-vault-btn');
  if (openVaultBtn) {
    openVaultBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://cloudlock.online/dashboard.html' });
    });
  }

  // Add password form
  const addForm = document.getElementById('add-form');
  if (addForm) {
    addForm.addEventListener('submit', handleAddPassword);
  }

  // Modal close buttons
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', (e) => {
      closeModal(e.target.closest('.modal').id);
    });
  });

  // Generator options
  const lengthInput = document.getElementById('length');
  if (lengthInput) {
    lengthInput.addEventListener('input', (e) => {
      document.getElementById('length-value').textContent = e.target.value;
      generateNewPassword();
    });
  }

  ['uppercase', 'lowercase', 'numbers', 'symbols'].forEach(id => {
    const checkbox = document.getElementById(id);
    if (checkbox) {
      checkbox.addEventListener('change', generateNewPassword);
    }
  });

  // Regenerate button
  const regenerateBtn = document.getElementById('regenerate-btn');
  if (regenerateBtn) {
    regenerateBtn.addEventListener('click', generateNewPassword);
  }

  // Copy password button
  const copyBtn = document.getElementById('copy-password-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', copyGeneratedPassword);
  }
}

// Handle login
async function handleLogin(e) {
  e.preventDefault();

  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'authenticate',
      data: { email, password }
    });

    if (response.success) {
      showVault(response.data);
    } else {
      alert('Login failed: ' + response.error);
    }
  } catch (error) {
    alert('Login error: ' + error.message);
  }
}

// Handle logout
async function handleLogout() {
  if (confirm('Are you sure you want to logout?')) {
    await chrome.runtime.sendMessage({ action: 'logout' });
    showLogin();
  }
}

// Show login view
function showLogin() {
  document.getElementById('login-view').classList.add('active');
  document.getElementById('vault-view').classList.remove('active');
}

// Show vault view
function showVault(user) {
  document.getElementById('login-view').classList.remove('active');
  document.getElementById('vault-view').classList.add('active');
  
  if (user && user.email) {
    document.getElementById('user-email').textContent = user.email;
  }

  loadPasswords();
}

// Load passwords
async function loadPasswords() {
  const passwordList = document.getElementById('password-list');
  passwordList.innerHTML = '<div class="loading">Loading passwords...</div>';

  try {
    const response = await chrome.runtime.sendMessage({ action: 'getPasswords' });

    if (response.success) {
      currentPasswords = response.passwords;
      displayPasswords(currentPasswords);
    } else {
      passwordList.innerHTML = `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <p>${response.error}</p>
        </div>
      `;
    }
  } catch (error) {
    passwordList.innerHTML = `
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
        <p>Error loading passwords</p>
      </div>
    `;
  }
}

// Display passwords
function displayPasswords(passwords) {
  const passwordList = document.getElementById('password-list');

  if (passwords.length === 0) {
    passwordList.innerHTML = `
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
        <p>No passwords saved yet</p>
        <button class="btn btn-sm btn-success" onclick="document.getElementById('add-password-btn').click()">Add Your First Password</button>
      </div>
    `;
    return;
  }

  let html = '';
  passwords.forEach(password => {
    html += `
      <div class="password-item" data-id="${password.id}">
        <div class="password-item-header">
          <div class="password-item-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M12 6v6l4 2"></path>
            </svg>
          </div>
          <div class="password-item-title">${escapeHtml(password.siteName)}</div>
        </div>
        <div class="password-item-username">${escapeHtml(password.username)}</div>
      </div>
    `;
  });

  passwordList.innerHTML = html;

  // Add click handlers
  document.querySelectorAll('.password-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = item.dataset.id;
      copyPasswordById(id);
    });
  });
}

// Copy password by ID
async function copyPasswordById(id) {
  const password = currentPasswords.find(p => p.id === id);
  if (password) {
    try {
      await navigator.clipboard.writeText(password.password);
      showNotification('Password copied to clipboard!');
    } catch (error) {
      alert('Failed to copy password');
    }
  }
}

// Handle search
function handleSearch(e) {
  const query = e.target.value.toLowerCase();

  if (!query) {
    displayPasswords(currentPasswords);
    return;
  }

  const filtered = currentPasswords.filter(p =>
    p.siteName.toLowerCase().includes(query) ||
    p.username.toLowerCase().includes(query) ||
    (p.url && p.url.toLowerCase().includes(query))
  );

  displayPasswords(filtered);
}

// Handle add password
async function handleAddPassword(e) {
  e.preventDefault();

  const siteName = document.getElementById('site-name').value;
  const url = document.getElementById('site-url').value;
  const username = document.getElementById('username').value;
  const password = document.getElementById('new-password').value;

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'savePassword',
      data: { siteName, url, username, password }
    });

    if (response.success) {
      closeModal('add-modal');
      showNotification('Password saved successfully!');
      loadPasswords();
      
      // Clear form
      document.getElementById('add-form').reset();
    } else {
      alert('Failed to save password: ' + response.error);
    }
  } catch (error) {
    alert('Error: ' + error.message);
  }
}

// Generate new password
function generateNewPassword() {
  const options = {
    length: parseInt(document.getElementById('length').value),
    uppercase: document.getElementById('uppercase').checked,
    lowercase: document.getElementById('lowercase').checked,
    numbers: document.getElementById('numbers').checked,
    symbols: document.getElementById('symbols').checked
  };

  chrome.runtime.sendMessage({
    action: 'generatePassword',
    options: options
  }, (response) => {
    if (response.success) {
      generatedPassword = response.password;
      document.getElementById('generated-password').textContent = generatedPassword;
    }
  });
}

// Copy generated password
async function copyGeneratedPassword() {
  try {
    await navigator.clipboard.writeText(generatedPassword);
    showNotification('Password copied to clipboard!');
  } catch (error) {
    alert('Failed to copy password');
  }
}

// Modal functions
function openModal(modalId) {
  document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
}

// Show notification
function showNotification(message) {
  // Create temporary notification element
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(135deg, #10b981, #059669);
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 0.9rem;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
    z-index: 10000;
    animation: slideDown 0.3s ease;
  `;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideUp 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 2000);
}

// Utility function
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideDown {
    from {
      transform: translateX(-50%) translateY(-100%);
      opacity: 0;
    }
    to {
      transform: translateX(-50%) translateY(0);
      opacity: 1;
    }
  }
  
  @keyframes slideUp {
    from {
      transform: translateX(-50%) translateY(0);
      opacity: 1;
    }
    to {
      transform: translateX(-50%) translateY(-100%);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);