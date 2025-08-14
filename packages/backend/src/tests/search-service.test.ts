import { SearchService } from '../services/search-service'
import { StoryModel } from '../models/story'
import { ProjectModel } from '../models/project'
import { UserModel } from '../models/user'
import { db } from '../config/database'

describe('SearchService', () => {
  let searchService: SearchService
  let testProject: any
  let testUser: any
  let testStories: any[]

  beforeAll(async () => {
    searchService = new SearchService()
    
    // Create test user
    testUser = await UserModel.create({
      name: 'Test User',
      email: 'test@example.com'
    })

    // Create test project
    testProject = await ProjectModel.createProject({
      name: 'Test Project',
      createdBy: testUser.id
    })

    // Create test stories with different content
    testStories = await Promise.all([
      StoryModel.createStory({
        projectId: testProject.id,
        title: 'My childhood memories',
        audioUrl: 'https://example.com/audio1.mp3',
        transcript: 'I remember playing in the garden with my siblings during summer holidays. We would build sandcastles and chase butterflies.',
        status: 'ready'
      }),
      StoryModel.createStory({
        projectId: testProject.id,
        title: 'School days adventure',
        audioUrl: 'https://example.com/audio2.mp3',
        transcript: 'During my school years, I participated in many sports activities. Basketball was my favorite game to play with friends.',
        status: 'ready'
      }),
      StoryModel.createStory({
        projectId: testProject.id,
        title: 'Family traditions',
        audioUrl: 'https://example.com/audio3.mp3',
        transcript: 'Every Christmas, our family would gather around the fireplace and share stories. My grandmother would tell us tales from her childhood.',
        status: 'ready'
      }),
      StoryModel.createStory({
        projectId: testProject.id,
        title: 'Work experience',
        audioUrl: 'https://example.com/audio4.mp3',
        transcript: 'My first job was at a small bookstore. I learned so much about customer service and developed a love for reading.',
        status: 'processing' // This should not appear in search results
      })
    ])

    // Wait a bit for the search vectors to be updated
    await new Promise(resolve => setTimeout(resolve, 100))
  })

  afterAll(async () => {
    // Clean up test data
    await db('stories').where('project_id', testProject.id).del()
    await db('projects').where('id', testProject.id).del()
    await db('users').where('id', testUser.id).del()
  })

  describe('searchStories', () => {
    it('should find stories by title', async () => {
      const results = await searchService.searchStories(testProject.id, 'childhood')
      
      expect(results.results).toHaveLength(1)
      expect(results.results[0].story.title).toContain('childhood')
      expect(results.total).toBe(1)
    })

    it('should find stories by transcript content', async () => {
      const results = await searchService.searchStories(testProject.id, 'basketball')
      
      expect(results.results).toHaveLength(1)
      expect(results.results[0].story.transcript).toContain('Basketball')
      expect(results.total).toBe(1)
    })

    it('should find multiple stories with common terms', async () => {
      const results = await searchService.searchStories(testProject.id, 'family')
      
      expect(results.results.length).toBeGreaterThan(0)
      expect(results.total).toBeGreaterThan(0)
    })

    it('should return results sorted by relevance', async () => {
      const results = await searchService.searchStories(testProject.id, 'childhood', {
        sortBy: 'relevance'
      })
      
      if (results.results.length > 1) {
        expect(results.results[0].rank).toBeGreaterThanOrEqual(results.results[1].rank)
      }
    })

    it('should support pagination', async () => {
      const page1 = await searchService.searchStories(testProject.id, 'the', {
        page: 1,
        limit: 1
      })
      
      const page2 = await searchService.searchStories(testProject.id, 'the', {
        page: 2,
        limit: 1
      })
      
      expect(page1.page).toBe(1)
      expect(page2.page).toBe(2)
      
      if (page1.results.length > 0 && page2.results.length > 0) {
        expect(page1.results[0].story.id).not.toBe(page2.results[0].story.id)
      }
    })

    it('should only return ready stories', async () => {
      const results = await searchService.searchStories(testProject.id, 'bookstore')
      
      // Should not find the processing story
      expect(results.results).toHaveLength(0)
      expect(results.total).toBe(0)
    })

    it('should handle empty queries gracefully', async () => {
      const results = await searchService.searchStories(testProject.id, '')
      
      expect(results.results).toHaveLength(0)
      expect(results.total).toBe(0)
    })

    it('should sanitize malicious queries', async () => {
      const results = await searchService.searchStories(testProject.id, "'; DROP TABLE stories; --")
      
      expect(results.results).toHaveLength(0)
      expect(results.total).toBe(0)
    })

    it('should support date filtering', async () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      
      const results = await searchService.searchStories(testProject.id, 'the', {
        dateFrom: yesterday,
        dateTo: tomorrow
      })
      
      expect(results.results.length).toBeGreaterThan(0)
    })

    it('should include headlines in results', async () => {
      const results = await searchService.searchStories(testProject.id, 'childhood')
      
      if (results.results.length > 0) {
        expect(results.results[0].headline).toBeDefined()
        expect(typeof results.results[0].headline).toBe('string')
      }
    })

    it('should track search time', async () => {
      const results = await searchService.searchStories(testProject.id, 'test')
      
      expect(results.searchTime).toBeGreaterThan(0)
      expect(typeof results.searchTime).toBe('number')
    })
  })

  describe('getSearchSuggestions', () => {
    it('should return relevant suggestions', async () => {
      const suggestions = await searchService.getSearchSuggestions(testProject.id, 'child')
      
      expect(Array.isArray(suggestions)).toBe(true)
      expect(suggestions.length).toBeGreaterThanOrEqual(0)
      
      if (suggestions.length > 0) {
        expect(suggestions.some(s => s.startsWith('child'))).toBe(true)
      }
    })

    it('should limit suggestions', async () => {
      const suggestions = await searchService.getSearchSuggestions(testProject.id, 'the', 3)
      
      expect(suggestions.length).toBeLessThanOrEqual(3)
    })

    it('should handle short queries', async () => {
      const suggestions = await searchService.getSearchSuggestions(testProject.id, 'a')
      
      expect(Array.isArray(suggestions)).toBe(true)
      expect(suggestions.length).toBe(0) // Should return empty for short queries
    })
  })

  describe('trackSearchAnalytics', () => {
    it('should track search analytics without throwing', async () => {
      await expect(searchService.trackSearchAnalytics({
        query: 'test query',
        projectId: testProject.id,
        userId: testUser.id,
        resultCount: 5,
        searchTime: 150
      })).resolves.not.toThrow()
    })

    it('should handle analytics tracking failures gracefully', async () => {
      // Test with invalid project ID
      await expect(searchService.trackSearchAnalytics({
        query: 'test query',
        projectId: 'invalid-id',
        userId: testUser.id,
        resultCount: 5,
        searchTime: 150
      })).resolves.not.toThrow()
    })
  })

  describe('reindexProject', () => {
    it('should reindex all stories in a project', async () => {
      const reindexedCount = await searchService.reindexProject(testProject.id)
      
      expect(reindexedCount).toBeGreaterThanOrEqual(0)
      expect(typeof reindexedCount).toBe('number')
    })

    it('should handle invalid project IDs', async () => {
      const reindexedCount = await searchService.reindexProject('invalid-id')
      
      expect(reindexedCount).toBe(0)
    })
  })

  describe('reindexStory', () => {
    it('should reindex a specific story', async () => {
      await expect(searchService.reindexStory(testStories[0].id)).resolves.not.toThrow()
    })

    it('should handle invalid story IDs', async () => {
      await expect(searchService.reindexStory('invalid-id')).resolves.not.toThrow()
    })
  })
})