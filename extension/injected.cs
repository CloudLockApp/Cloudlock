// Injected Script - Runs in page context for advanced DOM manipulation
(function() {
  'use strict';

  // Create CloudLock namespace
  window.CloudLock = window.CloudLock || {};

  // Password field detector
  window.CloudLock.detectFields = function() {
    const passwordFields = document.querySelectorAll('input[type="password"]');
    const usernameFields = document.querySelectorAll(
      'input[type="email"], input[type="text"][name*="user"], input[type="text"][name*="email"]'
    );

    return {
      passwordFields: Array.from(passwordFields),
      usernameFields: Array.from(usernameFields)
    };
  };

  // Auto-fill credentials
  window.CloudLock.fillCredentials = function(username, password) {
    const fields = window.CloudLock.detectFields();

    // Fill username
    if (fields.usernameFields.length > 0 && username) {
      fields.usernameFields[0].value = username;
      fields.usernameFields[0].dispatchEvent(new Event('input', { bubbles: true }));
      fields.usernameFields[0].dispatchEvent(new Event('change', { bubbles: true }));
    }

    // Fill password
    if (fields.passwordFields.length > 0 && password) {
      fields.passwordFields[0].value = password;
      fields.passwordFields[0].dispatchEvent(new Event('input', { bubbles: true }));
      fields.passwordFields[0].dispatchEvent(new Event('change', { bubbles: true }));
    }

    // Trigger any frameworks (React, Angular, Vue)
    triggerFrameworkEvents();
  };

  // Trigger framework-specific events
  function triggerFrameworkEvents() {
    // React
    const inputs = document.querySelectorAll('input');
    inputs.forEach(input => {
      const reactHandler = Object.keys(input).find(key => key.startsWith('__react'));
      if (reactHandler) {
        const event = new Event('input', { bubbles: true });
        Object.defineProperty(event, 'target', { writable: false, value: input });
        input.dispatchEvent(event);
      }
    });

    // Vue
    if (window.Vue) {
      inputs.forEach(input => {
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
    }

    // Angular
    if (window.angular) {
      inputs.forEach(input => {
        const scope = angular.element(input).scope();
        if (scope) {
          scope.$apply();
        }
      });
    }
  }

  // Get current form data
  window.CloudLock.getCurrentFormData = function() {
    const fields = window.CloudLock.detectFields();
    
    return {
      siteName: document.title || window.location.hostname,
      url: window.location.href,
      username: fields.usernameFields[0]?.value || '',
      password: fields.passwordFields[0]?.value || ''
    };
  };

  // Listen for form submissions to prompt save
  document.addEventListener('submit', function(e) {
    const form = e.target;
    if (form.tagName === 'FORM') {
      const fields = window.CloudLock.detectFields();
      
      if (fields.passwordFields.length > 0) {
        const data = window.CloudLock.getCurrentFormData();
        
        // Send message to content script
        window.postMessage({
          type: 'CLOUDLOCK_FORM_SUBMIT',
          data: data
        }, '*');
      }
    }
  });

  // Monitor password field changes
  document.addEventListener('input', function(e) {
    if (e.target.type === 'password') {
      const hasValue = e.target.value.length > 0;
      
      // Notify content script
      window.postMessage({
        type: 'CLOUDLOCK_PASSWORD_CHANGED',
        hasValue: hasValue
      }, '*');
    }
  });

  console.log('CloudLock injected script loaded');
})();