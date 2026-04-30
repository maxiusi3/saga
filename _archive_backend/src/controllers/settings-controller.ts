import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '@/middleware/auth';
import { SettingsService } from '@/services/settings-service';
import { createError } from '@/middleware/error-handler';
import Joi from 'joi';

const settingsService = new SettingsService();

// Validation schemas
const notificationSettingsSchema = Joi.object({
  emailNotifications: Joi.boolean(),
  pushNotifications: Joi.boolean(),
  storyUpdates: Joi.boolean(),
  followUpQuestions: Joi.boolean(),
  weeklyDigest: Joi.boolean(),
  marketingEmails: Joi.boolean()
});

const accessibilitySettingsSchema = Joi.object({
  fontSize: Joi.string().valid('standard', 'large', 'extra-large'),
  highContrast: Joi.boolean(),
  reducedMotion: Joi.boolean(),
  screenReader: Joi.boolean()
});

const audioSettingsSchema = Joi.object({
  volume: Joi.number().min(0).max(100),
  quality: Joi.string().valid('low', 'medium', 'high')
});

const privacySettingsSchema = Joi.object({
  profileVisible: Joi.boolean(),
  storySharing: Joi.boolean(),
  dataAnalytics: Joi.boolean(),
  twoFactorAuth: Joi.boolean()
});

const languageSettingsSchema = Joi.object({
  language: Joi.string().min(2).max(10),
  timezone: Joi.string().max(50)
});

const profileSchema = Joi.object({
  name: Joi.string().min(1).max(100),
  email: Joi.string().email(),
  phone: Joi.string().max(20),
  bio: Joi.string().max(500)
});

export class SettingsController {
  // Profile endpoints
  async getProfile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const profile = await settingsService.getUserProfile(userId);
      res.json(profile);
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { error, value } = profileSchema.validate(req.body);
      
      if (error) {
        throw createError(error.details[0].message, 400, 'VALIDATION_ERROR');
      }

      const updatedProfile = await settingsService.updateUserProfile(userId, value);
      res.json(updatedProfile);
    } catch (error) {
      next(error);
    }
  }

  // Notification settings
  async getNotificationSettings(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const settings = await settingsService.getNotificationSettings(userId);
      res.json(settings);
    } catch (error) {
      next(error);
    }
  }

  async updateNotificationSettings(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { error, value } = notificationSettingsSchema.validate(req.body);
      
      if (error) {
        throw createError(error.details[0].message, 400, 'VALIDATION_ERROR');
      }

      const updatedSettings = await settingsService.updateNotificationSettings(userId, value);
      res.json(updatedSettings);
    } catch (error) {
      next(error);
    }
  }

  // Accessibility settings
  async getAccessibilitySettings(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const settings = await settingsService.getAccessibilitySettings(userId);
      res.json(settings);
    } catch (error) {
      next(error);
    }
  }

  async updateAccessibilitySettings(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { error, value } = accessibilitySettingsSchema.validate(req.body);
      
      if (error) {
        throw createError(error.details[0].message, 400, 'VALIDATION_ERROR');
      }

      const updatedSettings = await settingsService.updateAccessibilitySettings(userId, value);
      res.json(updatedSettings);
    } catch (error) {
      next(error);
    }
  }

  // Audio settings
  async getAudioSettings(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const settings = await settingsService.getAudioSettings(userId);
      res.json(settings);
    } catch (error) {
      next(error);
    }
  }

  async updateAudioSettings(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { error, value } = audioSettingsSchema.validate(req.body);
      
      if (error) {
        throw createError(error.details[0].message, 400, 'VALIDATION_ERROR');
      }

      const updatedSettings = await settingsService.updateAudioSettings(userId, value);
      res.json(updatedSettings);
    } catch (error) {
      next(error);
    }
  }

  // Privacy settings
  async getPrivacySettings(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const settings = await settingsService.getPrivacySettings(userId);
      res.json(settings);
    } catch (error) {
      next(error);
    }
  }

  async updatePrivacySettings(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { error, value } = privacySettingsSchema.validate(req.body);
      
      if (error) {
        throw createError(error.details[0].message, 400, 'VALIDATION_ERROR');
      }

      const updatedSettings = await settingsService.updatePrivacySettings(userId, value);
      res.json(updatedSettings);
    } catch (error) {
      next(error);
    }
  }

  // Language settings
  async getLanguageSettings(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const settings = await settingsService.getLanguageSettings(userId);
      res.json(settings);
    } catch (error) {
      next(error);
    }
  }

  async updateLanguageSettings(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { error, value } = languageSettingsSchema.validate(req.body);
      
      if (error) {
        throw createError(error.details[0].message, 400, 'VALIDATION_ERROR');
      }

      const updatedSettings = await settingsService.updateLanguageSettings(userId, value);
      res.json(updatedSettings);
    } catch (error) {
      next(error);
    }
  }

  // Resource wallet
  async getResourceWallet(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const wallet = await settingsService.getResourceWallet(userId);
      res.json(wallet);
    } catch (error) {
      next(error);
    }
  }
}