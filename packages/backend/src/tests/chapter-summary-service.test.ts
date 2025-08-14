import { ChapterSummaryService } from '../services/chapter-summary-service';
import { ChapterSummaryModel } from '../models/chapter-summary';
import { StoryModel } from '../models/story';

// Mock the models
jest.mock('../models/chapter-summary');
jest.mock('../models/story');

// Mock OpenAI
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
  }));
});

const mockChapterSummaryModel = ChapterSummaryModel as jest.Mocked<typeof ChapterSummaryModel>;
const mockStoryModel = StoryModel as jest.Mocked<typeof StoryModel>;

describe('ChapterSummaryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('analyzeStoriesForChapters', () => {
    it('should return empty result when insufficient stories', async () => {
      // Mock insufficient stories
      mockStoryModel.query = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        whereNotNull: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockResolvedValue([
          { id: '1', transcript: 'Story 1', created_at: new Date() },
          { id: '2', transcript: 'Story 2', created_at: new Date() },
        ]),
      });

      const result = await ChapterSummaryService.analyzeStoriesForChapters('project-1');

      expect(result.groups).toEqual([]);
      expect(result.suggestedChapters).toEqual([]);
    });

    it('should analyze stories and return thematic groups', async () => {
      // Mock sufficient stories
      const mockStories = [
        { id: '1', transcript: 'Childhood memory about playing', created_at: new Date(), title: 'Playing' },
        { id: '2', transcript: 'Another childhood story about school', created_at: new Date(), title: 'School' },
        { id: '3', transcript: 'Career story about first job', created_at: new Date(), title: 'First Job' },
        { id: '4', transcript: 'Family story about parents', created_at: new Date(), title: 'Parents' },
      ];

      mockStoryModel.query = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        whereNotNull: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockResolvedValue(mockStories),
      });

      // Mock OpenAI response
      const mockOpenAI = require('openai');
      const mockInstance = new mockOpenAI();
      mockInstance.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              groups: [
                {
                  theme: 'Childhood Memories',
                  storyIds: ['1', '2'],
                  confidence: 0.8,
                  keywords: ['childhood', 'school', 'playing'],
                },
                {
                  theme: 'Career Journey',
                  storyIds: ['3'],
                  confidence: 0.7,
                  keywords: ['work', 'job', 'career'],
                },
              ],
            }),
          },
        }],
      });

      const result = await ChapterSummaryService.analyzeStoriesForChapters('project-1');

      expect(result.groups).toHaveLength(2);
      expect(result.groups[0].theme).toBe('Childhood Memories');
      expect(result.groups[0].stories).toHaveLength(2);
      expect(result.suggestedChapters).toHaveLength(1); // Only groups with 3+ stories
    });
  });

  describe('generateChapterSummary', () => {
    it('should generate chapter summary using AI', async () => {
      const mockRequest = {
        projectId: 'project-1',
        stories: [
          {
            id: '1',
            transcript: 'A story about childhood',
            createdAt: new Date(),
            title: 'Childhood Memory',
          },
          {
            id: '2',
            transcript: 'Another childhood story',
            createdAt: new Date(),
            title: 'School Days',
          },
        ],
        theme: 'childhood',
      };

      // Mock OpenAI response
      const mockOpenAI = require('openai');
      const mockInstance = new mockOpenAI();
      mockInstance.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              title: 'Early Years',
              description: 'A collection of childhood memories that shaped our storyteller.',
              theme: 'childhood',
              keyHighlights: [
                'Playful moments',
                'School experiences',
                'Family interactions',
              ],
              timeframe: {
                start: '1950s',
                end: '1960s',
              },
              emotionalTone: 'positive',
            }),
          },
        }],
      });

      const result = await ChapterSummaryService.generateChapterSummary(mockRequest);

      expect(result.title).toBe('Early Years');
      expect(result.theme).toBe('childhood');
      expect(result.keyHighlights).toHaveLength(3);
      expect(result.emotionalTone).toBe('positive');
    });

    it('should return fallback summary when AI fails', async () => {
      const mockRequest = {
        projectId: 'project-1',
        stories: [
          {
            id: '1',
            transcript: 'A story',
            createdAt: new Date(),
            title: 'Story',
          },
        ],
        theme: 'memories',
      };

      // Mock OpenAI failure
      const mockOpenAI = require('openai');
      const mockInstance = new mockOpenAI();
      mockInstance.chat.completions.create.mockRejectedValue(new Error('API Error'));

      const result = await ChapterSummaryService.generateChapterSummary(mockRequest);

      expect(result.title).toBe('Memories Stories');
      expect(result.theme).toBe('memories');
      expect(result.emotionalTone).toBe('reflective');
    });
  });

  describe('createChapterSummary', () => {
    it('should create chapter summary successfully', async () => {
      const mockInput = {
        projectId: 'project-1',
        storyIds: ['story-1', 'story-2'],
        theme: 'childhood',
        title: 'Early Years',
      };

      const mockStories = [
        {
          id: 'story-1',
          transcript: 'Childhood story 1',
          createdAt: new Date(),
          title: 'Story 1',
        },
        {
          id: 'story-2',
          transcript: 'Childhood story 2',
          createdAt: new Date(),
          title: 'Story 2',
        },
      ];

      // Mock story retrieval
      mockStoryModel.query = jest.fn().mockReturnValue({
        whereIn: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockResolvedValue(mockStories),
      });

      // Mock OpenAI response
      const mockOpenAI = require('openai');
      const mockInstance = new mockOpenAI();
      mockInstance.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              title: 'Early Years',
              description: 'Childhood memories',
              theme: 'childhood',
              keyHighlights: ['Playing', 'Learning', 'Growing'],
              emotionalTone: 'positive',
            }),
          },
        }],
      });

      // Mock chapter creation
      const mockChapter = {
        id: 'chapter-1',
        projectId: 'project-1',
        title: 'Early Years',
        description: 'Childhood memories',
        theme: 'childhood',
        storyIds: ['story-1', 'story-2'],
        keyHighlights: ['Playing', 'Learning', 'Growing'],
        emotionalTone: 'positive',
        status: 'ready',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockChapterSummaryModel.create.mockResolvedValue(mockChapter);

      const result = await ChapterSummaryService.createChapterSummary(mockInput);

      expect(result).toEqual(mockChapter);
      expect(mockChapterSummaryModel.create).toHaveBeenCalledWith({
        project_id: 'project-1',
        title: 'Early Years',
        description: 'Childhood memories',
        theme: 'childhood',
        story_ids: ['story-1', 'story-2'],
        key_highlights: ['Playing', 'Learning', 'Growing'],
        timeframe: undefined,
        emotional_tone: 'positive',
        status: 'ready',
      });
    });

    it('should throw error when no stories found', async () => {
      const mockInput = {
        projectId: 'project-1',
        storyIds: ['nonexistent-story'],
      };

      // Mock empty story retrieval
      mockStoryModel.query = jest.fn().mockReturnValue({
        whereIn: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockResolvedValue([]),
      });

      await expect(ChapterSummaryService.createChapterSummary(mockInput))
        .rejects.toThrow('No valid stories found for chapter creation');
    });
  });

  describe('getChapterSummariesByProject', () => {
    it('should return chapter summaries for project', async () => {
      const mockChapters = [
        {
          id: 'chapter-1',
          projectId: 'project-1',
          title: 'Chapter 1',
          theme: 'childhood',
          status: 'ready',
        },
        {
          id: 'chapter-2',
          projectId: 'project-1',
          title: 'Chapter 2',
          theme: 'career',
          status: 'ready',
        },
      ];

      mockChapterSummaryModel.findByProject.mockResolvedValue(mockChapters);

      const result = await ChapterSummaryService.getChapterSummariesByProject('project-1');

      expect(result).toEqual(mockChapters);
      expect(mockChapterSummaryModel.findByProject).toHaveBeenCalledWith('project-1');
    });
  });

  describe('getChapterSummaryWithStories', () => {
    it('should return chapter with stories', async () => {
      const mockChapter = {
        id: 'chapter-1',
        projectId: 'project-1',
        title: 'Chapter 1',
        storyIds: ['story-1', 'story-2'],
        theme: 'childhood',
        status: 'ready',
      };

      const mockStories = [
        { id: 'story-1', title: 'Story 1' },
        { id: 'story-2', title: 'Story 2' },
      ];

      mockChapterSummaryModel.findById.mockResolvedValue(mockChapter);
      mockStoryModel.query = jest.fn().mockReturnValue({
        whereIn: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockResolvedValue(mockStories),
      });

      const result = await ChapterSummaryService.getChapterSummaryWithStories('chapter-1');

      expect(result).toEqual({
        ...mockChapter,
        stories: mockStories,
      });
    });

    it('should return null when chapter not found', async () => {
      mockChapterSummaryModel.findById.mockResolvedValue(null);

      const result = await ChapterSummaryService.getChapterSummaryWithStories('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('autoGenerateChapters', () => {
    it('should auto-generate chapters for project', async () => {
      // Mock story analysis
      const mockStories = [
        { id: '1', transcript: 'Story 1', created_at: new Date() },
        { id: '2', transcript: 'Story 2', created_at: new Date() },
        { id: '3', transcript: 'Story 3', created_at: new Date() },
        { id: '4', transcript: 'Story 4', created_at: new Date() },
      ];

      mockStoryModel.query = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        whereNotNull: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockResolvedValue(mockStories),
      });

      // Mock OpenAI grouping response
      const mockOpenAI = require('openai');
      const mockInstance = new mockOpenAI();
      mockInstance.chat.completions.create
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify({
                groups: [
                  {
                    theme: 'Childhood',
                    storyIds: ['1', '2', '3'],
                    confidence: 0.8,
                    keywords: ['childhood'],
                  },
                ],
              }),
            },
          }],
        })
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify({
                title: 'Childhood Memories',
                description: 'Early life stories',
                theme: 'childhood',
                keyHighlights: ['Playing', 'Learning'],
                emotionalTone: 'positive',
              }),
            },
          }],
        });

      // Mock chapter creation
      mockChapterSummaryModel.areStoriesInChapter.mockResolvedValue(false);
      mockChapterSummaryModel.create.mockResolvedValue({
        id: 'chapter-1',
        projectId: 'project-1',
        title: 'Childhood Memories',
        theme: 'childhood',
        status: 'ready',
      });

      const result = await ChapterSummaryService.autoGenerateChapters('project-1');

      expect(result).toHaveLength(1);
      expect(result[0].theme).toBe('childhood');
    });
  });
});