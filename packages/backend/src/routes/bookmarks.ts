import { Router } from 'express';
import { StoryBookmarkController } from '../controllers/story-bookmark-controller';
import { authenticateToken } from '../middleware/auth';
import { generalRateLimit } from '../middleware/rate-limiting';

const router = Router();
const bookmarkController = new StoryBookmarkController();

// Apply authentication to all bookmark routes
router.use(authenticateToken);

// Apply rate limiting
router.use(generalRateLimit);

/**
 * @route POST /api/bookmarks
 * @desc Create a new bookmark
 * @access Private
 * @body {
 *   storyId: string,
 *   collectionId?: string,
 *   notes?: string
 * }
 */
router.post('/', bookmarkController.createBookmark.bind(bookmarkController));

/**
 * @route GET /api/bookmarks
 * @desc Get user bookmarks
 * @access Private
 * @query {
 *   collectionId?: string,
 *   limit?: number,
 *   offset?: number
 * }
 */
router.get('/', bookmarkController.getUserBookmarks.bind(bookmarkController));

/**
 * @route DELETE /api/bookmarks/story/:storyId
 * @desc Remove a bookmark by story ID
 * @access Private
 */
router.delete('/story/:storyId', bookmarkController.removeBookmark.bind(bookmarkController));

/**
 * @route POST /api/bookmarks/collections
 * @desc Create a new bookmark collection
 * @access Private
 * @body {
 *   name: string,
 *   description?: string,
 *   isPublic?: boolean,
 *   color?: string
 * }
 */
router.post('/collections', bookmarkController.createCollection.bind(bookmarkController));

/**
 * @route GET /api/bookmarks/collections
 * @desc Get user bookmark collections
 * @access Private
 */
router.get('/collections', bookmarkController.getUserCollections.bind(bookmarkController));

/**
 * @route PUT /api/bookmarks/collections/:collectionId
 * @desc Update a bookmark collection
 * @access Private
 * @body {
 *   name?: string,
 *   description?: string,
 *   isPublic?: boolean,
 *   color?: string
 * }
 */
router.put('/collections/:collectionId', bookmarkController.updateCollection.bind(bookmarkController));

/**
 * @route DELETE /api/bookmarks/collections/:collectionId
 * @desc Delete a bookmark collection
 * @access Private
 */
router.delete('/collections/:collectionId', bookmarkController.deleteCollection.bind(bookmarkController));

/**
 * @route PUT /api/bookmarks/:bookmarkId/collection
 * @desc Move bookmark to a different collection
 * @access Private
 * @body {
 *   collectionId?: string
 * }
 */
router.put('/:bookmarkId/collection', bookmarkController.moveBookmarkToCollection.bind(bookmarkController));

export default router;