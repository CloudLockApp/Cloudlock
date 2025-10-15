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
    
    gemini: {
        apiKey: 'AIzaSyDIXgGuWs6vB-zw7BCGlLn3pNcEZie3-MQ'
    }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}