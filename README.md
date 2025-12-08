<div align="center">
  
# 🔒 **CloudLock**
### AI-Secured Password Manager
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-green.svg)](https://github.com/spill/cloudlock)
[![Status](https://img.shields.io/badge/status-in%20development-yellow.svg)](https://github.com/spill/cloudlock)

**Your Digital Identity, Secured with AI**

[Video Demo](#-video-demo) • [Documentation](#-getting-started) • [Features](#-current-features) • [Team](#-team)

</div>

---

## 📋 Overview 

CloudLock is a modern, AI-powered password manager built with security and usability in mind. Featuring end-to-end encryption, real-time password strength validation, dark web monitoring, and an AI security assistant, CloudLock helps you manage your digital credentials safely and efficiently.

Built as a CPSC 491 Senior Capstone project at California State University, Fullerton.

<div align="center">

![CloudLock Screenshot](https://via.placeholder.com/800x400/1a1a2e/a78bfa?text=CloudLock+Dashboard)

  <p><em>CloudLock Dashboard - Clean, Secure, Intuitive</em></p>
</div>

---

## ✨ Current Features

### 🔐 Core Security
- ✅ **AES-256 Encryption**: All passwords encrypted client-side before storage
- ✅ **Firebase Authentication**: Secure user registration and login
- ✅ **Zero-Trust Architecture**: Your master password never leaves your device
- ✅ **Password Strength Validator**: Real-time validation with visual feedback
- ✅ **Secure Password Generator**: Create strong, unique passwords instantly

### 🎨 User Experience
- ✅ **Beautiful Dark Theme**: Sleek purple/dark aesthetic with glassmorphism
- ✅ **Animated Background**: Matrix-style code rain effect with floating orbs
- ✅ **Interactive Password Requirements**: Live checkmarks as you type
- ✅ **Responsive Design**: Works on desktop, tablet, and mobile
- ✅ **Toast Notifications**: Clear feedback for all actions

### 💾 Password Management
- ✅ **Full CRUD Operations**: Create, Read, Update, Delete passwords
- ✅ **Search & Filter**: Quickly find passwords in your vault
- ✅ **Show/Hide Passwords**: Toggle visibility with eye icon
- ✅ **Copy to Clipboard**: One-click password copying
- ✅ **Encrypted Notes**: Store additional secure information

### 🤖 AI Integration 
- ✅ **AI Security Assistant**: Chat with AI about password security
- ✅ **Password Strength Analysis**: AI-powered password evaluation
- ✅ **Security Recommendations**: Personalized security tips

### 🛡️ Security Features
- ✅ **Dark Web Monitoring**: Simulated breach detection
- ✅ **Password Health Dashboard**: Track weak and reused passwords
- ✅ **Auto-Logout**: Session timeout after 30 minutes of inactivity
- ✅ **Self-Destruct Mode**: Emergency credential deletion
- ✅ **2FA Support**: Two-factor authentication 

---

## 🚀 Getting Started

### Prerequisites
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Node.js 16+ (for development)
- Firebase account (for deployment)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/spill/cloudlock.git
   cd cloudlock
   ```

2. **Configure Firebase**
   - Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
   - Enable Authentication (Email/Password)
   - Enable Firestore Database
   - Copy your Firebase config to `js/config.js`

3. **Set up Firestore Rules**
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {

       // ===========================
       // USERS COLLECTION
       // ===========================
       match /users/{userId} {
         // Authenticated user can manage their own document
         allow create: if request.auth != null && request.auth.uid == userId;
         allow read, update, delete: if request.auth != null && request.auth.uid == userId;

         // Allow UNAUTHENTICATED read for password reset flow
         // Allow listing by email to find user document
         allow list: if request.auth == null && 
                     request.query.limit == 1;
  
         // Allow getting specific document for reset flow
         allow get: if request.auth == null;
       }

       // ===========================
       // PASSWORDS COLLECTION
       // ===========================
       match /passwords/{passwordId} {
         allow read: if request.auth != null &&
                        resource.data.userId == request.auth.uid;
         allow create: if request.auth != null &&
                          request.resource.data.userId == request.auth.uid;
         allow update, delete: if request.auth != null &&
                                  resource.data.userId == request.auth.uid;

         // History subcollection
         match /history/{historyId} {
           allow read, write: if request.auth != null &&
             get(/databases/$(database)/documents/passwords/$(passwordId))
               .data.userId == request.auth.uid;
         }
       }

       // ===========================
       // SHARED PASSWORDS
       // ===========================
       match /shared-passwords/{shareToken} {
         // Anyone with token can read
         allow read: if true;

         // Only owner can create or delete
         allow create: if request.auth != null &&
                          request.resource.data.ownerId == request.auth.uid;
         allow delete: if request.auth != null &&
                          resource.data.ownerId == request.auth.uid;

         // Allow anonymous updates for tracking views
         allow update: if true;
       }

     }
   }

   ```

4. **Create Firestore Index**
   - Go to Firestore → Indexes
   - Create composite index:
     - Collection: `passwords`
     - Fields: `userId` (Ascending), `createdAt` (Descending)

5. **Add AI Provider**
   - Get API key from [OpenRouter](https://openrouter.ai) (free models available). Make sure not to reveal the key to the public.
   - Add to `js/config.js`:
   ```javascript
   openrouter: {
       apiKey: "YOUR_OPENROUTER_API_KEY"
   },
   ```

6. **Deploy**
   - Push to GitHub
   - Enable GitHub Pages in repository settings
   - Your site will be live at: `https://yourusername.github.io/cloudlock`

---

## 🔧 Tech Stack

**Frontend:**
- HTML5, CSS3, JavaScript (ES6+)
- Font Awesome Icons
- CryptoJS for encryption

**Backend & Services:**
- Firebase Authentication
- Cloud Firestore (NoSQL database)
- Firebase Hosting

**AI Integration:**
- OpenRouter API (free tier)
- Alternative: Gemini, Claude AI, Groq, Hugging Face

**Tools:**
- Git & GitHub
- GitHub Pages for deployment
- Netlify
- VS Code

---

## 📁 Project Structure

```
cloudlock/
├── extension/                 # CloudLock browser extension folder
├── js/
|   ├── advanced-generator.js  # Password generator
|   ├── ai-assistant.js        # AI integration
|   ├── app.js                 # Main app logic
|   ├── audit-log.js     
|   ├── auth.js                # Authentication logic  
│   ├── config.js              # Firebase & API configuration
|   ├── encryption.js          # AES encryption functions
|   |── enhanced-auth.js    
│   ├── firebase-init.js       # Firebase initialization
│   ├── hibp-integration.js    # HaveIBeenPwned integration
|   ├── interactive-background.js   # Animated background
|   ├── nav-ticker.js          # Security articles integration
│   ├── password-manager.js    # Password CRUD operations
|   ├── password-sharing.js    # Password sharing
|   ├── reset-password.js      # Password reset
|   ├── reset.js               # Password reset
|   ├── security-insights.js   # Password security tips
│   ├── security-monitor.js    # Security features
│   └── ui-utils.js            # UI helper functions
│   
├── netlify/functions/
|   └── openrouter-proxy.js    # OpenRouter API key in Netlify
|   
├── styles/
|   ├── animations.css        # Animation styles
|   ├── audit-log.css         # Audit log styles
|   ├── circular-score.css    # Circular score styles
|   ├── components.css        # Component styles
|   ├── enhanced-auth.css     # Enhanced auth styles
|   ├── landing.css           # Landing page style
│   ├── main.css              # Core styles
│   ├── nav-ticker.css        # News articles styles
|   ├── password-sharing.css  # Password sharing styles
│   └── security-insights.css # Security insights styles
|
├── .gitignore                # Git ignored files
├── CNAME                     # Canonical name
├── README.md                 # This file
├── dashboard.html            # Dashboard page UI
├── index.html                # Main application page
├── login.html                # Login page UI
├── reset-password.html       # Reset page UI in email link
├── reset.html                # Main reset page UI
└── shared.html               # Shared password page UI
```

---

## 🎯 Usage

### Creating Your First Password

1. **Sign Up / Login**
   - Create an account with your email
   - Set a strong master password (8+ chars, mixed case, number, special char)

2. **Add a Password**
   - Click "Add Password" button
   - Fill in website name, URL, username, and password
   - Click "Save Encrypted"

3. **Manage Passwords**
   - **View**: Click the eye icon to show/hide password
   - **Copy**: Click the copy icon to copy to clipboard
   - **Edit**: Click the edit icon to modify
   - **Delete**: Click the trash icon to remove

4. **Generate Strong Password**
   - Click "Generate Password" button
   - 16-character password automatically copied to clipboard
   - Use it when creating new accounts

---

## 🛡️ Security

### How Your Data is Protected

1. **Client-Side Encryption**
   - Passwords encrypted using AES-256 before sending to server
   - Encryption key is your master password (never stored)

2. **Zero-Knowledge Architecture**
   - We cannot access your passwords
   - Only you have the decryption key

3. **Secure Storage**
   - Encrypted data stored in Firebase Firestore
   - Industry-standard security rules
   - Regular security audits

4. **Best Practices**
   - Use a unique, strong master password
   - Enable 2FA (when available)
   - Regularly review password health
   - Update passwords periodically

---

## 🚦 Roadmap

### Phase 1: Core Features (✅ Complete)
- [x] User authentication
- [x] Password CRUD operations
- [x] Encryption/decryption
- [x] Password generator
- [x] Search functionality
- [x] Password strength validation

### Phase 2: Enhanced Security (✅ Complete)
- [x] Dark web monitoring
- [x] Security dashboard
- [x] Auto-logout
- [x] 2FA implementation
- [x] Password rotation alerts
- [x] Breach notifications

### Phase 3: Advanced Features (✅ Complete)
- [x] Browser extension
- [ ] Mobile apps (iOS/Android)
- [x] Password sharing
- [x] Security score analytics
- [ ] Family vault
- [ ] Import/export functionality
- [ ] Biometric authentication

### Phase 4: AI & Intelligence (✅ Complete)
- [x] Full AI security assistant chatbot
- [x] Smart password suggestions

---

## 🎥 Video Demo

This is our video demo of CloudLock: https://www.youtube.com/watch?v=beK9R5daipw

---

## 👥 Team 

<div align="center">

| Name | Role | GitHub | Contributions |
|------|------|--------|---------------|
| **Ryan Trinh** | Lead Developer | [@spill](https://github.com/spill) | Core architecture, Firebase integration, UI/UX |
| **Brian Wei** | Developer | [@brianwei23](https://github.com/brianwei23) | AI integration, security score, password recovery, documentation |
| **Christian Ward** | Developer | [@chrisward62](https://github.com/chrisward62) | Documentation, security features |

**Course:** CPSC 491 - Senior Capstone Project in Computer Science  
**Institution:** California State University, Fullerton  
**Semester:** Fall 2025

</div>

---

## 🤝 Contributing

This is a student project for CPSC 491. While we're not accepting external contributions, feel free to:

- ⭐ Star the repository
- 🐛 Report bugs via Issues
- 💡 Suggest features via Issues
- 🍴 Fork for your own projects

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Professor:** Rong Jin - CPSC 491 instructor
- **Inspiration:** 1Password, LastPass, Bitwarden
- **Technologies:** Firebase, OpenRouter API, Netlify, Font Awesome
- **Community:** Stack Overflow, GitHub, MDN Web Docs

---

## 📧 Contact

**Project Repository:** [github.com/spill/cloudlock](https://github.com/spill/cloudlock)  
**Team Email:** [rtrinh.02@gmail.com](mailto:rtrinh.02@gmail.com)  
**Report Issues:** [GitHub Issues](https://github.com/spill/cloudlock/issues)

---

<div align="center">

### 🔒 Built with Security in Mind

**CloudLock** © 2025 - CSUF CPSC 491 Project

*"Your passwords, secured. Your privacy, protected."*

</div>
