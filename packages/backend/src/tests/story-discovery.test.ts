import request from 'supertest';
import { app } from '../index';
import { setupTestDatabase, cleanupTestDatabase } from './setup';

describe('Story Discovery & Navigation', () => {
  let authToken: string;
  let userId: string;
  let projectId: string;
  let storyId: string;

  beforeAll(async () => {
    await setupTestDatabase();
    
    // Create test user and get auth token
    const authResponse = await request(app)
      .post('/api/auth/signup')
      .send({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      });
    
    authToken = authResponse.body.accessToken;
    userId = authResponse.body.user.id;

    // Create test project
    const projectResponse = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Test Project'
      });
    
    projectId = projectResponse.body.project.id;

    // Create test story
    const storyResponse = await request(app)
      .post(`/api/projects/${projectId}/stories`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Test Story',
        audioUrl: 'https://example.com/audio.mp3',
        transcript: 'This is a test story transcript with meaningful content.',
        audioDuration: 120
      });
    
    storyId = storyResponse.body.story.id;
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe('Story Sharing', () => {
    it('should share story with project members', async () => {
      // Create another user to share with
      const user2Response = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'user2@example.com',
          password: 'password123',
          name: 'User Two'
        });

      const user2Id = user2Response.body.user.id;

      // Add user2 to project
      await request(app)
        .post(`/api/projects/${projectId}/facilitators`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ userId: user2Id });

      // Share story
      const response = await request(app)
        .post(`/api/stories/${storyId}/share`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          memberIds: [user2Id],
          message: 'Check out this story!'
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Story shared successfully');
      expect(response.body.shares).toBe(1);
    });

    it('should get story shares', async () => {
      const response = await request(app)
        .get(`/api/stories/${storyId}/shares`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.shares).toHaveLength(1);
      expect(response.body.shares[0]).toHaveProperty('sharedBy');
      expect(response.body.shares[0]).toHaveProperty('sharedWith');
    });

    it('should prevent sharing with non-project members', async () => {
      // Create user not in project
      const user3Response = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'user3@example.com',
          password: 'password123',
          name: 'User Three'
        });

      const user3Id = user3Response.body.user.id;

      const response = await request(app)
        .post(`/api/stories/${storyId}/share`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          memberIds: [user3Id],
          message: 'This should fail'
        });

      expect(response.status).toBe(500);
    });
  });

  describe('Story Statistics', () => {
    it('should get project statistics', async () => {
      const response = await request(app)
        .get(`/api/projects/${projectId}/statistics`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.statistics).toHaveProperty('totalStories');
      expect(response.body.statistics).toHaveProperty('totalDuration');
      expect(response.body.statistics).toHaveProperty('averageDuration');
      expect(response.body.statistics).toHaveProperty('interactionCount');
      expect(response.body.statistics).toHaveProperty('completionRate');
      expect(response.body.statistics).toHaveProperty('engagementScore');
      expect(response.body.statistics).toHaveProperty('topChapters');
      expect(response.body.statistics).toHaveProperty('recentActivity');
    });

    it('should calculate story quality', async () => {
      const response = await request(app)
        .get(`/api/stories/${storyId}/quality`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.quality).toHaveProperty('qualityScore');
      expect(response.body.quality).toHaveProperty('durationScore');
      expect(response.body.quality).toHaveProperty('engagementScore');
      expect(response.body.quality).toHaveProperty('transcriptQuality');
      expect(response.body.quality).toHaveProperty('factors');
      
      expect(response.body.quality.factors).toHaveProperty('hasTranscript');
      expect(response.body.quality.factors).toHaveProperty('hasPhoto');
      expect(response.body.quality.factors).toHaveProperty('hasInteractions');
      expect(response.body.quality.factors).toHaveProperty('optimalDuration');
      expect(response.body.quality.factors).toHaveProperty('recentActivity');
    });

    it('should get completion tracking', async () => {
      const response = await request(app)
        .get(`/api/projects/${projectId}/completion`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.completion).toHaveProperty('totalPrompts');
      expect(response.body.completion).toHaveProperty('answeredPrompts');
      expect(response.body.completion).toHaveProperty('completionRate');
      expect(response.body.completion).toHaveProperty('chapterProgress');
      expect(Array.isArray(response.body.completion.chapterProgress)).toBe(true);
    });

    it('should calculate batch story quality', async () => {
      const response = await request(app)
        .post('/api/stories/quality/batch')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          storyIds: [storyId]
        });

      expect(response.status).toBe(200);
      expect(response.body.qualityMetrics).toHaveLength(1);
      expect(response.body.qualityMetrics[0]).toHaveProperty('storyId', storyId);
      expect(response.body.qualityMetrics[0]).toHaveProperty('qualityScore');
    });
  });

  describe('Story Discovery Features', () => {
    it('should get story recommendations', async () => {
      const response = await request(app)
        .get(`/api/projects/${projectId}/recommendations`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('recommendations');
      expect(Array.isArray(response.body.recommendations)).toBe(true);
    });

    it('should get story timeline', async () => {
      const response = await request(app)
        .get(`/api/projects/${projectId}/timeline`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('timeline');
      expect(Array.isArray(response.body.timeline)).toBe(true);
    });

    it('should bookmark stories', async () => {
      const response = await request(app)
        .post(`/api/stories/${storyId}/bookmark`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Story bookmarked successfully');
    });

    it('should get bookmarked stories', async () => {
      const response = await request(app)
        .get(`/api/users/${userId}/bookmarks`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.bookmarks).toHaveLength(1);
      expect(response.body.bookmarks[0]).toHaveProperty('story');
    });

    it('should remove bookmark', async () => {
      const response = await request(app)
        .delete(`/api/stories/${storyId}/bookmark`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Bookmark removed successfully');
    });
  });

  describe('Access Control', () => {
    it('should deny access to statistics for non-project members', async () => {
      // Create user not in project
      const outsiderResponse = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'outsider@example.com',
          password: 'password123',
          name: 'Outsider'
        });

      const outsiderToken = outsiderResponse.body.accessToken;

      const response = await request(app)
        .get(`/api/projects/${projectId}/statistics`)
        .set('Authorization', `Bearer ${outsiderToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('ACCESS_DENIED');
    });

    it('should deny access to story quality for non-project members', async () => {
      const outsiderResponse = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'outsider2@example.com',
          password: 'password123',
          name: 'Outsider Two'
        });

      const outsiderToken = outsiderResponse.body.accessToken;

      const response = await request(app)
        .get(`/api/stories/${storyId}/quality`)
        .set('Authorization', `Bearer ${outsiderToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('ACCESS_DENIED');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid story ID for quality calculation', async () => {
      const response = await request(app)
        .get('/api/stories/invalid-id/quality')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(500);
    });

    it('should handle invalid project ID for statistics', async () => {
      const response = await request(app)
        .get('/api/projects/invalid-id/statistics')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(403);
    });

    it('should handle empty story IDs array for batch quality', async () => {
      const response = await request(app)
        .post('/api/stories/quality/batch')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          storyIds: []
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_INPUT');
    });
  });
});