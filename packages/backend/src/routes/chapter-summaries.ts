import { Router } from 'express';
import { ChapterSummaryController } from '../controllers/chapter-summary-controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Get all chapter summaries for a project
router.get('/projects/:projectId/chapters', ChapterSummaryController.getChapterSummaries);

// Analyze stories for potential chapter groupings
router.get('/projects/:projectId/chapters/analyze', ChapterSummaryController.analyzeStoriesForChapters);

// Auto-generate chapter summaries for a project
router.post('/projects/:projectId/chapters/auto-generate', ChapterSummaryController.autoGenerateChapters);

// Create a new chapter summary
router.post('/projects/:projectId/chapters', ChapterSummaryController.createChapterSummary);

// Get a specific chapter summary with stories
router.get('/chapters/:chapterId', ChapterSummaryController.getChapterSummary);

// Update a chapter summary
router.put('/chapters/:chapterId', ChapterSummaryController.updateChapterSummary);

// Delete a chapter summary
router.delete('/chapters/:chapterId', ChapterSummaryController.deleteChapterSummary);

export default router;