/**
 * Story Workflow Integration Tests
 * 
 * Tests the complete story creation, processing, and interaction workflow
 */

import request from 'supertest';
import { app } from '../../index';
import { knex } from '../../config/database';

describe('Story Workflow Integration', () => {
  let facilitatorToken: string;
  let storytellerToken: string;
  let projectId: string;
  let facilitatorUserId: string;
  let storytellerUserId: string;

  beforeAll(async () => {
    // Clean up test data
    await knex('interactions').del();
    await knex('stories').del();
    await knex('project_roles').del();
    await knex('projects').del();
    await knex('users').del();

    // Create test users
    const facilitatorResponse = await request(app)
      .post('/api/auth/signup')
      .send({
        email: 'facilitator.workflow@test.com',
        password: 'testpassword123',
        name: 'Workflow Facilitator'
      });

    facilitatorToken = facilitatorResponse.body.accessToken;
    facilitatorUserId = facilitatorResponse.body.user.id;

    const storytellerResponse = await request(app)
      .post('/api/auth/signup')
      .send({
        email: 'storyteller.workflow@test.com',
        password: 'testpassword123',
        name: 'Workflow Storyteller'
      });

    storytellerToken = storytellerResponse.body.accessToken;
    storytellerUserId = storytellerResponse.body.user.id;

    // Create project
    const projectResponse = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${facilitatorToken}`)
      .send({
        name: 'Story Workflow Test Project'
      });

    projectId = projectResponse.body.id;

    // Add storyteller to project
    const invitationResponse = await request(app)
      .post(`/api/projects/${projectId}/invitations`)
      .set('Authorization', `Bearer ${facilitatorToken}`)
      .send({
        role: 'storyteller'
      });

    await request(app)
      .post(`/api/invitations/${invitationResponse.body.token}/accept`)
      .set('Authorization', `Bearer ${storytellerToken}`);
  });

  afterAll(async () => {
    // Clean up test data
    await knex('interactions').del();
    await knex('stories').del();
    await knex('project_roles').del();
    await knex('projects').del();
    await knex('users').del();
  });

  describe('Complete Story Creation Workflow', () => {
    let storyId: string;
    let promptId: string;

    it('should handle the complete story creation workflow', async () => {
      // Step 1: Storyteller gets a prompt
      const promptResponse = await request(app)
        .get(`/api/projects/${projectId}/next-prompt`)
        .set('Authorization', `Bearer ${storytellerToken}`);

      expect(promptResponse.status).toBe(200);
      expect(promptResponse.body.prompt).toBeDefined();
      promptId = promptResponse.body.prompt.id;

      // Step 2: Storyteller creates a story
      const storyResponse = await request(app)
        .post(`/api/projects/${projectId}/stories`)
        .set('Authorization', `Bearer ${storytellerToken}`)
        .send({
          title: 'Integration Test Story',
          audioUrl: 'https://test-bucket.s3.amazonaws.com/integration-story.mp3',
          transcript: 'This is an integration test story about my childhood.',
          audioDuration: 180,
          promptId: promptId
        });

      expect(storyResponse.status).toBe(201);
      expect(storyResponse.body.id).toBeDefined();
      expect(storyResponse.body.title).toBe('Integration Test Story');
      expect(storyResponse.body.storytellerId).toBe(storytellerUserId);
      expect(storyResponse.body.projectId).toBe(projectId);
      storyId = storyResponse.body.id;

      // Step 3: Verify story appears in project stories
      const projectStoriesResponse = await request(app)
        .get(`/api/projects/${projectId}/stories`)
        .set('Authorization', `Bearer ${facilitatorToken}`);

      expect(projectStoriesResponse.status).toBe(200);
      expect(projectStoriesResponse.body.stories).toHaveLength(1);
      expect(projectStoriesResponse.body.stories[0].id).toBe(storyId);

      // Step 4: Facilitator views the story
      const storyDetailResponse = await request(app)
        .get(`/api/stories/${storyId}`)
        .set('Authorization', `Bearer ${facilitatorToken}`);

      expect(storyDetailResponse.status).toBe(200);
      expect(storyDetailResponse.body.title).toBe('Integration Test Story');
      expect(storyDetailResponse.body.transcript).toBe('This is an integration test story about my childhood.');

      // Step 5: Facilitator edits the transcript
      const editTranscriptResponse = await request(app)
        .put(`/api/stories/${storyId}/transcript`)
        .set('Authorization', `Bearer ${facilitatorToken}`)
        .send({
          transcript: 'This is an integration test story about my childhood. [Edited for clarity]'
        });

      expect(editTranscriptResponse.status).toBe(200);
      expect(editTranscriptResponse.body.transcript).toBe('This is an integration test story about my childhood. [Edited for clarity]');

      // Step 6: Facilitator adds a comment
      const commentResponse = await request(app)
        .post(`/api/stories/${storyId}/interactions`)
        .set('Authorization', `Bearer ${facilitatorToken}`)
        .send({
          type: 'comment',
          content: 'What a wonderful memory! Thank you for sharing this with us.'
        });

      expect(commentResponse.status).toBe(201);
      expect(commentResponse.body.type).toBe('comment');
      expect(commentResponse.body.facilitatorId).toBe(facilitatorUserId);

      // Step 7: Facilitator asks a follow-up question
      const followupResponse = await request(app)
        .post(`/api/stories/${storyId}/interactions`)
        .set('Authorization', `Bearer ${facilitatorToken}`)
        .send({
          type: 'followup',
          content: 'Can you tell me more about the people who were there with you?'
        });

      expect(followupResponse.status).toBe(201);
      expect(followupResponse.body.type).toBe('followup');

      // Step 8: Verify interactions are visible to storyteller
      const interactionsResponse = await request(app)
        .get(`/api/stories/${storyId}/interactions`)
        .set('Authorization', `Bearer ${storytellerToken}`);

      expect(interactionsResponse.status).toBe(200);
      expect(interactionsResponse.body.interactions).toHaveLength(2);
      
      const interactions = interactionsResponse.body.interactions;
      expect(interactions[0].type).toBe('comment');
      expect(interactions[1].type).toBe('followup');
      expect(interactions[0].facilitator.id).toBe(facilitatorUserId);
      expect(interactions[1].facilitator.id).toBe(facilitatorUserId);

      // Step 9: Storyteller gets follow-up as next prompt
      const nextPromptResponse = await request(app)
        .get(`/api/projects/${projectId}/next-prompt`)
        .set('Authorization', `Bearer ${storytellerToken}`);

      expect(nextPromptResponse.status).toBe(200);
      expect(nextPromptResponse.body.userPrompt).toBeDefined();
      expect(nextPromptResponse.body.userPrompt.content).toBe('Can you tell me more about the people who were there with you?');

      // Step 10: Storyteller responds to follow-up
      const followupStoryResponse = await request(app)
        .post(`/api/projects/${projectId}/stories`)
        .set('Authorization', `Bearer ${storytellerToken}`)
        .send({
          title: 'Follow-up Response',
          audioUrl: 'https://test-bucket.s3.amazonaws.com/followup-response.mp3',
          transcript: 'My sister was there, and my best friend from school. We were all laughing together.',
          audioDuration: 90,
          userPromptId: followupResponse.body.id
        });

      expect(followupStoryResponse.status).toBe(201);
      expect(followupStoryResponse.body.userPromptId).toBe(followupResponse.body.id);

      // Step 11: Verify complete workflow by checking final state
      const finalProjectStoriesResponse = await request(app)
        .get(`/api/projects/${projectId}/stories`)
        .set('Authorization', `Bearer ${facilitatorToken}`);

      expect(finalProjectStoriesResponse.status).toBe(200);
      expect(finalProjectStoriesResponse.body.stories).toHaveLength(2);
      
      // Verify both stories are linked correctly
      const stories = finalProjectStoriesResponse.body.stories;
      const originalStory = stories.find(s => s.id === storyId);
      const followupStory = stories.find(s => s.userPromptId === followupResponse.body.id);
      
      expect(originalStory).toBeDefined();
      expect(followupStory).toBeDefined();
      expect(originalStory.interactions).toHaveLength(2);
    });
  });

  describe('Multi-User Story Interaction Workflow', () => {
    let secondFacilitatorToken: string;
    let secondFacilitatorUserId: string;
    let storyId: string;

    beforeAll(async () => {
      // Create second facilitator
      const facilitator2Response = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'facilitator2.workflow@test.com',
          password: 'testpassword123',
          name: 'Second Facilitator'
        });

      secondFacilitatorToken = facilitator2Response.body.accessToken;
      secondFacilitatorUserId = facilitator2Response.body.user.id;

      // Add second facilitator to project
      const invitationResponse = await request(app)
        .post(`/api/projects/${projectId}/invitations`)
        .set('Authorization', `Bearer ${facilitatorToken}`)
        .send({
          role: 'facilitator'
        });

      await request(app)
        .post(`/api/invitations/${invitationResponse.body.token}/accept`)
        .set('Authorization', `Bearer ${secondFacilitatorToken}`);

      // Create a story for testing
      const storyResponse = await request(app)
        .post(`/api/projects/${projectId}/stories`)
        .set('Authorization', `Bearer ${storytellerToken}`)
        .send({
          title: 'Multi-Facilitator Test Story',
          audioUrl: 'https://test-bucket.s3.amazonaws.com/multi-facilitator.mp3',
          transcript: 'This story will have interactions from multiple facilitators.',
          audioDuration: 120
        });

      storyId = storyResponse.body.id;
    });

    it('should handle interactions from multiple facilitators', async () => {
      // First facilitator adds comment
      const comment1Response = await request(app)
        .post(`/api/stories/${storyId}/interactions`)
        .set('Authorization', `Bearer ${facilitatorToken}`)
        .send({
          type: 'comment',
          content: 'Great story! - From first facilitator'
        });

      expect(comment1Response.status).toBe(201);

      // Second facilitator adds comment
      const comment2Response = await request(app)
        .post(`/api/stories/${storyId}/interactions`)
        .set('Authorization', `Bearer ${secondFacilitatorToken}`)
        .send({
          type: 'comment',
          content: 'I loved this too! - From second facilitator'
        });

      expect(comment2Response.status).toBe(201);

      // First facilitator asks follow-up
      const followup1Response = await request(app)
        .post(`/api/stories/${storyId}/interactions`)
        .set('Authorization', `Bearer ${facilitatorToken}`)
        .send({
          type: 'followup',
          content: 'What happened next? - From first facilitator'
        });

      expect(followup1Response.status).toBe(201);

      // Second facilitator asks different follow-up
      const followup2Response = await request(app)
        .post(`/api/stories/${storyId}/interactions`)
        .set('Authorization', `Bearer ${secondFacilitatorToken}`)
        .send({
          type: 'followup',
          content: 'How did you feel about that? - From second facilitator'
        });

      expect(followup2Response.status).toBe(201);

      // Verify all interactions are properly attributed
      const interactionsResponse = await request(app)
        .get(`/api/stories/${storyId}/interactions`)
        .set('Authorization', `Bearer ${storytellerToken}`);

      expect(interactionsResponse.status).toBe(200);
      expect(interactionsResponse.body.interactions).toHaveLength(4);

      const interactions = interactionsResponse.body.interactions;
      
      // Check attribution
      const facilitator1Interactions = interactions.filter(i => i.facilitator.id === facilitatorUserId);
      const facilitator2Interactions = interactions.filter(i => i.facilitator.id === secondFacilitatorUserId);
      
      expect(facilitator1Interactions).toHaveLength(2);
      expect(facilitator2Interactions).toHaveLength(2);

      // Verify content and attribution
      expect(facilitator1Interactions[0].content).toContain('first facilitator');
      expect(facilitator2Interactions[0].content).toContain('second facilitator');
    });

    it('should prioritize user prompts correctly', async () => {
      // Get next prompt - should be one of the follow-ups
      const nextPromptResponse = await request(app)
        .get(`/api/projects/${projectId}/next-prompt`)
        .set('Authorization', `Bearer ${storytellerToken}`);

      expect(nextPromptResponse.status).toBe(200);
      expect(nextPromptResponse.body.userPrompt).toBeDefined();
      
      // Should be one of the follow-up questions
      const promptContent = nextPromptResponse.body.userPrompt.content;
      expect(
        promptContent.includes('What happened next?') || 
        promptContent.includes('How did you feel about that?')
      ).toBe(true);
    });
  });

  describe('Story Search and Discovery Workflow', () => {
    beforeAll(async () => {
      // Create multiple stories with searchable content
      const stories = [
        {
          title: 'Childhood Adventure',
          transcript: 'When I was young, I went on an amazing adventure to the mountains with my family.',
          audioDuration: 150
        },
        {
          title: 'School Days Memory',
          transcript: 'I remember my first day at school. I was nervous but excited to meet new friends.',
          audioDuration: 120
        },
        {
          title: 'Family Vacation',
          transcript: 'Our family vacation to the beach was unforgettable. We built sandcastles and swam in the ocean.',
          audioDuration: 200
        }
      ];

      for (const story of stories) {
        await request(app)
          .post(`/api/projects/${projectId}/stories`)
          .set('Authorization', `Bearer ${storytellerToken}`)
          .send({
            title: story.title,
            audioUrl: `https://test-bucket.s3.amazonaws.com/${story.title.toLowerCase().replace(/\s+/g, '-')}.mp3`,
            transcript: story.transcript,
            audioDuration: story.audioDuration
          });
      }
    });

    it('should search stories by title', async () => {
      const searchResponse = await request(app)
        .get(`/api/projects/${projectId}/search`)
        .set('Authorization', `Bearer ${facilitatorToken}`)
        .query({ q: 'childhood' });

      expect(searchResponse.status).toBe(200);
      expect(searchResponse.body.stories).toHaveLength(1);
      expect(searchResponse.body.stories[0].title).toBe('Childhood Adventure');
    });

    it('should search stories by transcript content', async () => {
      const searchResponse = await request(app)
        .get(`/api/projects/${projectId}/search`)
        .set('Authorization', `Bearer ${facilitatorToken}`)
        .query({ q: 'school friends' });

      expect(searchResponse.status).toBe(200);
      expect(searchResponse.body.stories).toHaveLength(1);
      expect(searchResponse.body.stories[0].title).toBe('School Days Memory');
    });

    it('should return multiple results for broad search terms', async () => {
      const searchResponse = await request(app)
        .get(`/api/projects/${projectId}/search`)
        .set('Authorization', `Bearer ${facilitatorToken}`)
        .query({ q: 'family' });

      expect(searchResponse.status).toBe(200);
      expect(searchResponse.body.stories.length).toBeGreaterThan(1);
      
      const titles = searchResponse.body.stories.map(s => s.title);
      expect(titles).toContain('Childhood Adventure');
      expect(titles).toContain('Family Vacation');
    });

    it('should handle empty search results gracefully', async () => {
      const searchResponse = await request(app)
        .get(`/api/projects/${projectId}/search`)
        .set('Authorization', `Bearer ${facilitatorToken}`)
        .query({ q: 'nonexistent term' });

      expect(searchResponse.status).toBe(200);
      expect(searchResponse.body.stories).toHaveLength(0);
    });
  });

  describe('Story Export Workflow', () => {
    it('should handle complete export workflow', async () => {
      // Request export
      const exportResponse = await request(app)
        .post(`/api/projects/${projectId}/export`)
        .set('Authorization', `Bearer ${facilitatorToken}`);

      expect(exportResponse.status).toBe(202);
      expect(exportResponse.body.exportId).toBeDefined();

      const exportId = exportResponse.body.exportId;

      // Check export status
      const statusResponse = await request(app)
        .get(`/api/exports/${exportId}/status`)
        .set('Authorization', `Bearer ${facilitatorToken}`);

      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body.status).toBeDefined();
      expect(['pending', 'processing', 'ready', 'failed']).toContain(statusResponse.body.status);

      // If export is ready, verify download link
      if (statusResponse.body.status === 'ready') {
        expect(statusResponse.body.downloadUrl).toBeDefined();
        expect(statusResponse.body.expiresAt).toBeDefined();
      }
    });

    it('should handle export access control', async () => {
      // Create export as facilitator
      const exportResponse = await request(app)
        .post(`/api/projects/${projectId}/export`)
        .set('Authorization', `Bearer ${facilitatorToken}`);

      const exportId = exportResponse.body.exportId;

      // Try to access export status as storyteller (should be allowed)
      const storytellerStatusResponse = await request(app)
        .get(`/api/exports/${exportId}/status`)
        .set('Authorization', `Bearer ${storytellerToken}`);

      expect(storytellerStatusResponse.status).toBe(200);

      // Try to access export status without authentication (should fail)
      const unauthenticatedResponse = await request(app)
        .get(`/api/exports/${exportId}/status`);

      expect(unauthenticatedResponse.status).toBe(401);
    });
  });
});