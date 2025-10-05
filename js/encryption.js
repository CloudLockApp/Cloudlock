// Encryption Module

// Encrypt text using AES
function encrypt(text) {
    if (!encryptionKey) return text;
    return CryptoJS.AES.encrypt(text, encryptionKey).toString();
}

// Decrypt text using AES
function decrypt(ciphertext) {
    if (!encryptionKey) return ciphertext;
    try {
        const bytes = CryptoJS.AES.decrypt(ciphertext, encryptionKey);
        return bytes.toString(CryptoJS.enc.Utf8);
    } catch (e) {
        return ciphertext;
    }
}