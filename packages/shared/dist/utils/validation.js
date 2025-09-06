"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateImageFile = exports.validateAudioFile = exports.validatePassword = exports.validatePhone = exports.validateEmail = void 0;
const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};
exports.validateEmail = validateEmail;
const validatePhone = (phone) => {
    const phoneRegex = /^\+?[\d\s-()]+$/;
    return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
};
exports.validatePhone = validatePhone;
const validatePassword = (password) => {
    return password.length >= 8 &&
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password);
};
exports.validatePassword = validatePassword;
const validateAudioFile = (file) => {
    const maxSize = 50 * 1024 * 1024; // 50MB
    const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/aac'];
    if (file.size > maxSize) {
        return { valid: false, error: 'File size must be less than 50MB' };
    }
    if (!allowedTypes.includes(file.type)) {
        return { valid: false, error: 'Invalid audio format. Supported formats: MP3, WAV, MP4, AAC' };
    }
    return { valid: true };
};
exports.validateAudioFile = validateAudioFile;
const validateImageFile = (file) => {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (file.size > maxSize) {
        return { valid: false, error: 'Image size must be less than 10MB' };
    }
    if (!allowedTypes.includes(file.type)) {
        return { valid: false, error: 'Invalid image format. Supported formats: JPEG, PNG, WebP' };
    }
    return { valid: true };
};
exports.validateImageFile = validateImageFile;
//# sourceMappingURL=validation.js.map