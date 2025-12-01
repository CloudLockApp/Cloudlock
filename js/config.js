// Configuration File
// Firebase, OpenRouter, and HaveIBeenPwned credentials

const CONFIG = {
    // Firebase Configuration
    firebase: {
        apiKey: "AIzaSyDyHH0DXSEaxb_Ft-cmuGpaCQP8xSx105U",
        authDomain: "cloudlock-8a59b.firebaseapp.com",
        projectId: "cloudlock-8a59b",
        storageBucket: "cloudlock-8a59b.appspot.com",
        messagingSenderId: "723019842397",
        appId: "1:723019842397:web:886db24af7ed5587351eb4"
    },
    
    // OpenRouter API Key saved in Netlify
    
    // HaveIBeenPwned Configuration
    // Get your free API key at: https://haveibeenpwned.com/API/Key
    hibp: {
        apiKey: null, // Add your HIBP API key here (optional - only needed for email breach checking)
        // Note: Password checking works without an API key using k-anonymity
    }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}