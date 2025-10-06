// Configuration File
// Firebase and OpenAI credentials

const CONFIG = {
    // Firebase Configuration - UPDATED WITH NEW CREDENTIALS
    firebase: {
        apiKey: "AIzaSyDyHH0DXSEaxb_Ft-cmuGpaCQP8xSx105U",
        authDomain: "cloudlock-8a59b.firebaseapp.com",
        projectId: "cloudlock-8a59b",
        storageBucket: "cloudlock-8a59b.firebasestorage.app",
        messagingSenderId: "723019842397",
        appId: "1:723019842397:web:886db24af7ed5587351eb4"
    },
    
    // OpenAI Configuration
    // Get your API key from https://platform.openai.com/api-keys
    openai: {
        apiKey: 'YOUR_OPENAI_API_KEY'  // Replace with your OpenAI API key (starts with sk-proj- or sk-)
    }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}