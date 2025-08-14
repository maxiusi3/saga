import { AIPromptServiceClass } from '../services/ai-prompt-service'
import { UserModel } from '../models/user'
import { ProjectModel } from '../models/project'
import { StoryModel } from '../models/story'

// Mock OpenAI with more realistic responses
jest.mock('openai', () => {
  const mockCreate = jest.fn().mockImplementation(({ messages }) => {
    const userMessage = messages.find((m: any) => m.role === 'user')?.content || '';
    
    // Return different responses based on request type
    if (userMessage.includes('follow-up')) {
      return Promise.resolve({
        choices: [{
          message: {
            content: 'What was your favorite room in that house?\nWho else lived there with you?\nWhat memories stand out most?'
          }
        }]
      });
    }
    
    if (userMessage.includes('personalized')) {
      return Promise.resolve({
        choices: [{
          message: {
            content: 'Tell me about a special tradition your family had when you were growing up.'
          }
        }]
      });
    }
    
    // Default response
    return Promise.resolve({
      choices: [{
        message: {
          content: 'Tell me about your childhood home.'
        }
      }]
    });
  });

  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate
        }
      }
    }))
  }
})

// Mock database operations
jest.mock('../models/user', () => ({
  UserModel: {
    findById: jest.fn(),
    create: jest.fn()
  }
}))

jest.mock('../models/project', () => ({
  ProjectModel: {
    findById: jest.fn(),
    create: jest.fn()
  }
}))

jest.mock('../models/story', () => ({
  StoryModel: {
    findById: jest.fn(),
    create: jest.fn()
  }
}))

// Mock BaseModel database connection
jest.mock('../models/base', () => ({
  BaseModel: {
    db: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(null),
      insert: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue(1),
      delete: jest.fn().mockResolvedValue(1),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis()
    })
  }
}))

describe('AIPromptService', () => {
  let promptService: AIPromptServiceClass
  let mockUser: any
  let mockProject: any

  beforeAll(() => {
    promptService = new AIPromptServiceClass()
  })

  beforeEach(() => {
    // Setup mock data
    mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      preferences: {
        language: 'en',
        culturalBackground: 'western'
      }
    }

    mockProject = {
      id: 'project-123',
      name: 'Test Project',
      description: 'Test project for AI prompts',
      createdBy: mockUser.id
    }

    // Setup mock implementations
    ;(UserModel.findById as jest.Mock).mockResolvedValue(mockUser)
    ;(ProjectModel.findById as jest.Mock).mockResolvedValue(mockProject)
    
    // Clear caches before each test
    promptService.clearCaches()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('generatePersonalizedPrompt', () => {
    it('should generate a personalized prompt based on user context', async () => {
      const request = {
        userId: mockUser.id,
        category: 'childhood' as const,
        context: {
          previousStories: ['story about school'],
          userPreferences: { topics: ['family', 'traditions'] }
        }
      }

      const prompt = await promptService.generatePersonalizedPrompt(request)

      expect(prompt).toBeDefined()
      expect(prompt.text).toBeTruthy()
      expect(prompt.category).toBe('childhood')
      expect(prompt.personalizedFor).toBe(mockUser.id)
      expect(prompt.text.length).toBeGreaterThan(10)
    })

    it('should return fallback prompt when AI generation fails', async () => {
      // Mock OpenAI to throw error
      const mockOpenAI = require('openai').OpenAI
      const mockCreate = jest.fn().mockRejectedValue(new Error('API Error'))
      mockOpenAI.mockImplementationOnce(() => ({
        chat: {
          completions: {
            create: mockCreate
          }
        }
      }))

      const request = {
        userId: mockUser.id,
        category: 'general' as const
      }

      const prompt = await promptService.generatePersonalizedPrompt(request)

      expect(prompt).toBeDefined()
      expect(prompt.tags).toContain('fallback')
      expect(prompt.tags).toContain('ai-error')
    })

    it('should validate input and reject invalid requests', async () => {
      const request = {
        userId: '', // Invalid empty userId
        category: 'general' as const
      }

      await expect(promptService.generatePersonalizedPrompt(request))
        .rejects.toThrow('User ID is required')
    })

    it('should use caching to avoid redundant API calls', async () => {
      const request = {
        userId: mockUser.id,
        category: 'general' as const
      }

      // First call
      const prompt1 = await promptService.generatePersonalizedPrompt(request)
      // Second call should use cache
      const prompt2 = await promptService.generatePersonalizedPrompt(request)

      expect(prompt1).toEqual(prompt2)
      
      // Verify OpenAI was only called once
      const mockOpenAI = require('openai').OpenAI
      const mockInstance = mockOpenAI.mock.results[0].value
      expect(mockInstance.chat.completions.create).toHaveBeenCalledTimes(1)
    })
  })

  describe('generateFollowUpQuestions', () => {
    it('should generate follow-up questions based on story content', async () => {
      const storyContent = 'I grew up in a small house with my parents and two siblings. We had a big garden where we grew vegetables.'
      const originalPrompt = 'Tell me about your childhood home.'

      const questions = await promptService.generateFollowUpQuestions(storyContent, originalPrompt)

      expect(questions).toBeDefined()
      expect(Array.isArray(questions)).toBe(true)
      expect(questions.length).toBeGreaterThan(0)
      expect(questions.length).toBeLessThanOrEqual(3)
      
      // Check that questions are relevant and well-formed
      questions.forEach(question => {
        expect(typeof question).toBe('string')
        expect(question.length).toBeGreaterThan(10)
        expect(question.length).toBeLessThan(200)
        expect(question.trim()).toBe(question) // No leading/trailing whitespace
      })
    })

    it('should return empty array when story content is too short', async () => {
      const questions = await promptService.generateFollowUpQuestions('Short')
      expect(questions).toEqual([])
    })

    it('should return empty array when AI generation fails', async () => {
      // Mock OpenAI to throw error
      const mockOpenAI = require('openai').OpenAI
      const mockCreate = jest.fn().mockRejectedValue(new Error('API Error'))
      mockOpenAI.mockImplementationOnce(() => ({
        chat: {
          completions: {
            create: mockCreate
          }
        }
      }))

      const questions = await promptService.generateFollowUpQuestions('Some longer story content that should be valid')
      expect(questions).toEqual([])
    })

    it('should limit to 3 questions maximum', async () => {
      const questions = await promptService.generateFollowUpQuestions('I grew up in a wonderful family home with many memories')
      expect(questions.length).toBeLessThanOrEqual(3)
    })

    it('should handle rate limiting', async () => {
      const storyContent = 'A story about childhood memories and family traditions.'
      
      // Make multiple rapid requests to trigger rate limiting
      const promises = Array(15).fill(null).map(() => 
        promptService.generateFollowUpQuestions(storyContent)
      )
      
      const results = await Promise.all(promises)
      
      // Some requests should return empty arrays due to rate limiting
      const emptyResults = results.filter(r => r.length === 0)
      expect(emptyResults.length).toBeGreaterThan(0)
    })
  })

  describe('getNextPrompt', () => {
    it('should return next prompt for a project', async () => {
      const prompt = await promptService.getNextPrompt(mockProject.id, mockUser.id)
      
      expect(prompt).toBeDefined()
      if (prompt) {
        expect(prompt.text).toBeTruthy()
        expect(prompt.category).toBeDefined()
      }
    })

    it('should handle rate limiting for getNextPrompt', async () => {
      // Make multiple rapid requests
      const promises = Array(15).fill(null).map(() => 
        promptService.getNextPrompt(mockProject.id, mockUser.id)
      )
      
      const results = await Promise.all(promises)
      
      // All should return some result (either real prompt or fallback)
      results.forEach(result => {
        expect(result).toBeDefined()
      })
    })
  })

  describe('performance and caching', () => {
    it('should track performance metrics', async () => {
      const request = {
        userId: mockUser.id,
        category: 'general' as const
      }

      await promptService.generatePersonalizedPrompt(request)
      
      const metrics = promptService.getPerformanceMetrics()
      expect(metrics).toBeDefined()
      expect(typeof metrics).toBe('object')
    })

    it('should clear caches when requested', () => {
      // Add some data to cache first
      promptService.generatePersonalizedPrompt({
        userId: mockUser.id,
        category: 'general' as const
      })

      // Clear caches
      promptService.clearCaches()
      
      // Verify caches are cleared by checking metrics
      const metrics = promptService.getPerformanceMetrics()
      expect(Object.keys(metrics).length).toBe(0)
    })

    it('should handle concurrent requests efficiently', async () => {
      const requests = Array(5).fill(null).map((_, i) => ({
        userId: `user-${i}`,
        category: 'general' as const
      }))

      const startTime = Date.now()
      const promises = requests.map(req => 
        promptService.generatePersonalizedPrompt(req)
      )
      
      const results = await Promise.all(promises)
      const duration = Date.now() - startTime

      expect(results).toHaveLength(5)
      expect(duration).toBeLessThan(10000) // Should complete within 10 seconds
      
      results.forEach(result => {
        expect(result).toBeDefined()
        expect(result.text).toBeTruthy()
      })
    })
  })

  describe('error handling and resilience', () => {
    it('should handle malformed AI responses gracefully', async () => {
      // Mock OpenAI to return malformed response
      const mockOpenAI = require('openai').OpenAI
      mockOpenAI.mockImplementationOnce(() => ({
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{
                message: {
                  content: '' // Empty response
                }
              }]
            })
          }
        }
      }))

      const request = {
        userId: mockUser.id,
        category: 'general' as const
      }

      const prompt = await promptService.generatePersonalizedPrompt(request)
      
      expect(prompt).toBeDefined()
      expect(prompt.tags).toContain('fallback')
    })

    it('should handle network timeouts', async () => {
      // Mock OpenAI to timeout
      const mockOpenAI = require('openai').OpenAI
      mockOpenAI.mockImplementationOnce(() => ({
        chat: {
          completions: {
            create: jest.fn().mockImplementation(() => 
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), 100)
              )
            )
          }
        }
      }))

      const request = {
        userId: mockUser.id,
        category: 'general' as const
      }

      const prompt = await promptService.generatePersonalizedPrompt(request)
      
      expect(prompt).toBeDefined()
      expect(prompt.tags).toContain('fallback')
    })
  })
})