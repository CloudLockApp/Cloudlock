// Configuration File
// Firebase and OpenAI credentials

const CONFIG = {
    // Firebase Configuration - UPDATED WITH YOUR CREDENTIALS
    firebase: {
        apiKey: "AIzaSyDJseo2G6RWZFq3_KkqZOFJEvfFqeBuUlM",
        authDomain: "cloudlock-5cdae.firebaseapp.com",
        projectId: "cloudlock-5cdae",
        storageBucket: "cloudlock-5cdae.firebasestorage.app",
        messagingSenderId: "80184504165",
        appId: "1:80184504165:web:e3be85a4b6c8d83a8ffb8c",
        measurementId: "G-W55PZP390T"
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