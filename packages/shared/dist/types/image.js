"use strict";
/**
 * Image types for story and interaction images
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.IMAGE_VALIDATION = void 0;
// Validation constants
exports.IMAGE_VALIDATION = {
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB in bytes
    MAX_IMAGES_PER_TRANSCRIPT: 6,
    MAX_IMAGES_PER_INTERACTION: 6,
    SUPPORTED_FORMATS: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
    SUPPORTED_EXTENSIONS: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    COMPRESSION_THRESHOLD: 2 * 1024 * 1024, // 2MB - compress images larger than this
    COMPRESSION_QUALITY: 0.8, // JPEG compression quality
};
//# sourceMappingURL=image.js.map