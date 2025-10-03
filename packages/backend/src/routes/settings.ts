import { Router } from 'express';
import { SettingsController } from '@/controllers/settings-controller';

const router = Router();
const settingsController = new SettingsController();

// Profile routes
router.get('/profile', settingsController.getProfile.bind(settingsController));
router.put('/profile', settingsController.updateProfile.bind(settingsController));

// Notification settings
router.get('/notifications', settingsController.getNotificationSettings.bind(settingsController));
router.put('/notifications', settingsController.updateNotificationSettings.bind(settingsController));

// Accessibility settings
router.get('/accessibility', settingsController.getAccessibilitySettings.bind(settingsController));
router.put('/accessibility', settingsController.updateAccessibilitySettings.bind(settingsController));

// Audio settings
router.get('/audio', settingsController.getAudioSettings.bind(settingsController));
router.put('/audio', settingsController.updateAudioSettings.bind(settingsController));

// Privacy settings
router.get('/privacy', settingsController.getPrivacySettings.bind(settingsController));
router.put('/privacy', settingsController.updatePrivacySettings.bind(settingsController));

// Language settings
router.get('/language', settingsController.getLanguageSettings.bind(settingsController));
router.put('/language', settingsController.updateLanguageSettings.bind(settingsController));

// Resource wallet
router.get('/wallet', settingsController.getResourceWallet.bind(settingsController));

export default router;