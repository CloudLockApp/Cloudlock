// Configuration File
// Firebase and Gemini credentials

const CONFIG = {
    // Firebase Configuration - UPDATED WITH NEW CREDENTIALS
    firebase: {
        apiKey: "AIzaSyDyHH0DXSEaxb_Ft-cmuGpaCQP8xSx105U",
        authDomain: "cloudlock-8a59b.firebaseapp.com",
        projectId: "cloudlock-8a59b",
        storageBucket: "cloudlock-8a59b.appspot.com",
        messagingSenderId: "723019842397",
        appId: "1:723019842397:web:886db24af7ed5587351eb4"
    },
    
    openrouter: {
        apiKey:  "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"
    }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
