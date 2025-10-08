// Advanced Password Generator with Multiple Options

// Password generator settings
let generatorSettings = {
    length: 16,
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: true,
    excludeSimilar: false,
    excludeAmbiguous: false,
    pinLength: 6,
    passphraseWords: 4,
    passphraseSeparator: '-',
    passphraseNumber: true
};

// Open advanced password generator modal
function openPasswordGeneratorModal() {
    openModal('password-generator-modal');
    updateGeneratorPreview();
}

// Generate password based on type
function generatePasswordByType(type) {
    let password = '';
    
    switch(type) {
        case 'strong':
            password = generateStrongPassword();
            break;
        case 'memorable':
            password = generateMemorablePassword();
            break;
        case 'pin':
            password = generatePIN();
            break;
        case 'passphrase':
            password = generatePassphrase();
            break;
        case 'custom':
            password = generateCustomPassword();
            break;
        default:
            password = generateStrongPassword();
    }
    
    return password;
}

// Generate strong random password
function generateStrongPassword() {
    const settings = generatorSettings;
    const length = settings.length;
    
    let charset = '';
    let password = '';
    
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const nums = '0123456789';
    const syms = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    // Characters to exclude if similar/ambiguous
    const similar = 'il1Lo0O';
    const ambiguous = '{}[]()/\\\'"`~,;:.<>';
    
    // Build charset based on settings
    if (settings.uppercase) {
        let upperChars = upper;
        if (settings.excludeSimilar) upperChars = upperChars.split('').filter(c => !similar.includes(c)).join('');
        charset += upperChars;
    }
    
    if (settings.lowercase) {
        let lowerChars = lower;
        if (settings.excludeSimilar) lowerChars = lowerChars.split('').filter(c => !similar.includes(c)).join('');
        charset += lowerChars;
    }
    
    if (settings.numbers) {
        let numChars = nums;
        if (settings.excludeSimilar) numChars = numChars.split('').filter(c => !similar.includes(c)).join('');
        charset += numChars;
    }
    
    if (settings.symbols) {
        let symChars = syms;
        if (settings.excludeAmbiguous) symChars = symChars.split('').filter(c => !ambiguous.includes(c)).join('');
        charset += symChars;
    }
    
    if (charset.length === 0) {
        charset = upper + lower + nums; // Fallback
    }
    
    // Ensure at least one character from each enabled type
    if (settings.uppercase && upper.length > 0) password += upper.charAt(Math.floor(Math.random() * upper.length));
    if (settings.lowercase && lower.length > 0) password += lower.charAt(Math.floor(Math.random() * lower.length));
    if (settings.numbers && nums.length > 0) password += nums.charAt(Math.floor(Math.random() * nums.length));
    if (settings.symbols && syms.length > 0) password += syms.charAt(Math.floor(Math.random() * syms.length));
    
    // Fill the rest randomly
    for (let i = password.length; i < length; i++) {
        password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    
    // Shuffle the password
    password = password.split('').sort(() => Math.random() - 0.5).join('');
    
    return password;
}

// Generate memorable password (word-based)
function generateMemorablePassword() {
    const words = [
        'Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel',
        'India', 'Juliet', 'Kilo', 'Lima', 'Mike', 'November', 'Oscar', 'Papa',
        'Quebec', 'Romeo', 'Sierra', 'Tango', 'Uniform', 'Victor', 'Whiskey', 'Xray',
        'Yankee', 'Zulu', 'Phoenix', 'Dragon', 'Tiger', 'Eagle', 'Falcon', 'Hawk',
        'Wolf', 'Bear', 'Lion', 'Panther', 'Cobra', 'Viper', 'Thunder', 'Storm'
    ];
    
    const symbols = '!@#$%^&*';
    const numbers = '0123456789';
    
    // Pick 3 random words
    const word1 = words[Math.floor(Math.random() * words.length)];
    const word2 = words[Math.floor(Math.random() * words.length)];
    const word3 = words[Math.floor(Math.random() * words.length)];
    
    // Add random number and symbol
    const num = numbers.charAt(Math.floor(Math.random() * numbers.length));
    const sym = symbols.charAt(Math.floor(Math.random() * symbols.length));
    
    return `${word1}${num}${word2}${sym}${word3}`;
}

// Generate PIN code
function generatePIN() {
    const length = generatorSettings.pinLength || 6;
    let pin = '';
    
    for (let i = 0; i < length; i++) {
        pin += Math.floor(Math.random() * 10);
    }
    
    return pin;
}

// Generate passphrase (word-based, easy to remember)
function generatePassphrase() {
    const wordList = [
        'correct', 'horse', 'battery', 'staple', 'mountain', 'river', 'ocean', 'forest',
        'thunder', 'lightning', 'crystal', 'diamond', 'ruby', 'emerald', 'sapphire',
        'golden', 'silver', 'bronze', 'platinum', 'titanium', 'quantum', 'cosmic',
        'stellar', 'lunar', 'solar', 'galaxy', 'nebula', 'meteor', 'comet', 'asteroid',
        'phoenix', 'dragon', 'griffin', 'unicorn', 'pegasus', 'hydra', 'kraken',
        'velocity', 'momentum', 'kinetic', 'dynamic', 'static', 'electric', 'magnetic'
    ];
    
    const numWords = generatorSettings.passphraseWords || 4;
    const separator = generatorSettings.passphraseSeparator || '-';
    
    let words = [];
    for (let i = 0; i < numWords; i++) {
        words.push(wordList[Math.floor(Math.random() * wordList.length)]);
    }
    
    // Optionally add number at the end
    if (generatorSettings.passphraseNumber) {
        words.push(Math.floor(Math.random() * 100));
    }
    
    return words.join(separator);
}

// Generate custom password based on current settings
function generateCustomPassword() {
    return generateStrongPassword();
}

// Update generator preview in real-time
function updateGeneratorPreview() {
    const previewElement = document.getElementById('generator-preview');
    if (!previewElement) return;
    
    const type = document.querySelector('input[name="password-type"]:checked')?.value || 'strong';
    const password = generatePasswordByType(type);
    
    previewElement.textContent = password;
    
    // Update strength indicator
    const strength = calculatePasswordStrength(password);
    updatePasswordStrengthIndicator(strength);
}

// Update password strength indicator in generator
function updatePasswordStrengthIndicator(strength) {
    const indicator = document.getElementById('generator-strength');
    if (!indicator) return;
    
    let strengthText, strengthColor;
    
    if (strength <= 2) {
        strengthText = 'Weak';
        strengthColor = '#ef4444';
    } else if (strength === 3) {
        strengthText = 'Fair';
        strengthColor = '#f59e0b';
    } else if (strength === 4) {
        strengthText = 'Good';
        strengthColor = '#a78bfa';
    } else {
        strengthText = 'Strong';
        strengthColor = '#10b981';
    }
    
    indicator.innerHTML = `
        <span style="color: ${strengthColor};">
            <i class="fas fa-shield-alt"></i> ${strengthText}
        </span>
    `;
}

// Copy generated password
function copyGeneratedPassword() {
    const preview = document.getElementById('generator-preview');
    if (!preview) return;
    
    const password = preview.textContent;
    
    navigator.clipboard.writeText(password).then(() => {
        showToast('Password copied to clipboard!', 'success');
    });
}

// Use generated password in the current password form
function useGeneratedPassword() {
    const preview = document.getElementById('generator-preview');
    if (!preview) return;
    
    const password = preview.textContent;
    
    // If password modal is open, fill it there
    const passwordInput = document.getElementById('site-password');
    if (passwordInput) {
        passwordInput.value = password;
    }
    
    copyGeneratedPassword();
    closeModal('password-generator-modal');
}

// Update setting and regenerate
function updateGeneratorSetting(setting, value) {
    generatorSettings[setting] = value;
    updateGeneratorPreview();
}