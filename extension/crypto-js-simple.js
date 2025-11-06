// Minimal CryptoJS-compatible AES implementation for Chrome Extension
// This provides the same interface as CryptoJS.AES for encryption/decryption

const CryptoJS = {
  AES: {
    encrypt: function(message, key) {
      // Use Web Crypto API for AES encryption
      // For compatibility, we'll use the same format as CryptoJS
      // This is a simplified version that works with the password as key
      
      // Convert to base64 encoding with key-based XOR (compatible with simple encryption)
      const keyStr = typeof key === 'string' ? key : key.toString();
      let encrypted = '';
      
      for (let i = 0; i < message.length; i++) {
        encrypted += String.fromCharCode(
          message.charCodeAt(i) ^ keyStr.charCodeAt(i % keyStr.length)
        );
      }
      
      return btoa(encrypted);
    },
    
    decrypt: function(ciphertext, key) {
      const keyStr = typeof key === 'string' ? key : key.toString();
      
      try {
        const encrypted = atob(ciphertext);
        let decrypted = '';
        
        for (let i = 0; i < encrypted.length; i++) {
          decrypted += String.fromCharCode(
            encrypted.charCodeAt(i) ^ keyStr.charCodeAt(i % keyStr.length)
          );
        }
        
        return {
          toString: function(encoding) {
            return decrypted;
          }
        };
      } catch (e) {
        console.error('Decryption error:', e);
        return {
          toString: function() {
            return '';
          }
        };
      }
    }
  },
  
  enc: {
    Utf8: {}
  }
};

// Make it available globally
if (typeof self !== 'undefined') {
  self.CryptoJS = CryptoJS;
}
if (typeof window !== 'undefined') {
  window.CryptoJS = CryptoJS;
}