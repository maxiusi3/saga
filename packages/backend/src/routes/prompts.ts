import { Router } from 'express';
import { PromptController } from '../controllers/prompt-controller';
import { authMiddleware } from '../middleware/auth';
import { archivalMiddleware } from '../middleware/archival';

const router = Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Get daily prompt
router.get('/daily', PromptController.getDailyPrompt);

// Get personalized prompt
router.post('/personalized', PromptController.getPersonalizedPrompt);

// Get prompt by category
router.get('/category/:category', PromptController.getPromptByCategory);

// Get follow-up prompt for a story
router.get('/follow-up/:storyId/:questionId', archivalMiddleware, PromptController.getFollowUpPrompt);

// Get related prompts based on a story
router.get('/related/:storyId', archivalMiddleware, PromptController.getRelatedPrompts);

// Mark prompt as used
router.post('/:promptId/used', PromptController.markPromptUsed);

// Skip a prompt
router.post('/:promptId/skip', PromptController.skipPrompt);

// Get prompt library categories
router.get('/categories', PromptController.getCategories);

// Get user's prompt history
router.get('/history', PromptController.getPromptHistory);

// Generate follow-up questions for a story
router.post('/follow-up-questions', PromptController.generateFollowUpQuestions);

// Customize a prompt for user preferences
router.post('/:promptId/customize', PromptController.customizePrompt);

// Get user's customization preferences
router.get('/preferences/customization', PromptController.getCustomizationPreferences);

// Save user's customization preferences
router.post('/preferences/customization', PromptController.saveCustomizationPreferences);

export { router as promptRoutes };