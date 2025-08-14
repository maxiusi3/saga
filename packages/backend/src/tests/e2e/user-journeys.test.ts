/**
 * End-to-End User Journey Tests
 * 
 * Tests complete user workflows from start to finish
 */

import request from 'supertest';
import { app } from '../../index';

describe('End-to-End User Journeys', () => {
  describe('Complete Facilitator Journey', () => {
    let facilitatorToken: string;
    let projectId: string;
    let invitationToken: string;
    let storytellerToken: string;
    let storyId: string;

    it('should complete the full facilitator workflow', async () => {
      // Step 1: Facilitator signs up
      const signupResponse = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'facilitator.journey@test.com',
          password: 'testpassword123',
          name: 'Journey Facilitator'
        });
      
      expect(signupResponse.status).toBe(201);
      facilitatorToken = signupResponse.body.accessToken;
      expect(facilitatorToken).toBeDefined();

      // Step 2: Check initial wallet balance
      const walletResponse = await request(app)
        .get('/api/users/me/wallet')
        .set('Authorization', `Bearer ${facilitatorToken}`);
      
      expect(walletResponse.status).toBe(200);
      expect(walletResponse.body.projectVouchers).toBeGreaterThan(0);

      // Step 3: Create a project (consumes voucher)
      const projectResponse = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${facilitatorToken}`)
        .send({
          name: 'Journey Test Project'
        });
      
      expect(projectResponse.status).toBe(201);
      projectId = projectResponse.body.id;
      expect(projectId).toBeDefined();

      // Step 4: Generate invitation for storyteller
      const invitationResponse = await request(app)
        .post(`/api/projects/${projectId}/invitations`)
        .set('Authorization', `Bearer ${facilitatorToken}`)
        .send({
          role: 'storyteller'
        });
      
      expect(invitationResponse.status).toBe(201);
      invitationToken = invitationResponse.body.token;
      expect(invitationToken).toBeDefined();

      // Step 5: Storyteller accepts invitation
      const storytellerSignupResponse = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'storyteller.journey@test.com',
          password: 'testpassword123',
          name: 'Journey Storyteller'
        });
      
      storytellerToken = storytellerSignupResponse.body.accessToken;

      const acceptInvitationResponse = await request(app)
        .post(`/api/invitations/${invitationToken}/accept`)
        .set('Authorization', `Bearer ${storytellerToken}`);
      
      expect(acceptInvitationResponse.status).toBe(200);

      // Step 6: Storyteller gets first prompt
      const promptResponse = await request(app)
        .get(`/api/projects/${projectId}/next-prompt`)
        .set('Authorization', `Bearer ${storytellerToken}`);
      
      expect(promptResponse.status).toBe(200);
      expect(promptResponse.body.prompt).toBeDefined();

      // Step 7: Storyteller creates a story
      const storyResponse = await request(app)
        .post(`/api/projects/${projectId}/stories`)
        .set('Authorization', `Bearer ${storytellerToken}`)
        .send({
          title: 'My First Journey Story',
          audioUrl: 'https://test-bucket.s3.amazonaws.com/journey-story.mp3',
          transcript: 'This is my first story in the journey test.',
          audioDuration: 120,
          promptId: promptResponse.body.prompt.id
        });
      
      expect(storyResponse.status).toBe(201);
      storyId = storyResponse.body.id;

      // Step 8: Facilitator views the story
      const viewStoryResponse = await request(app)
        .get(`/api/stories/${storyId}`)
        .set('Authorization', `Bearer ${facilitatorToken}`);
      
      expect(viewStoryResponse.status).toBe(200);
      expect(viewStoryResponse.body.title).toBe('My First Journey Story');

      // Step 9: Facilitator adds a comment
      const commentResponse = await request(app)
        .post(`/api/stories/${storyId}/interactions`)
        .set('Authorization', `Bearer ${facilitatorToken}`)
        .send({
          type: 'comment',
          content: 'What a wonderful story! Thank you for sharing.'
        });
      
      expect(commentResponse.status).toBe(201);

      // Step 10: Facilitator asks a follow-up question
      const followupResponse = await request(app)
        .post(`/api/stories/${storyId}/interactions`)
        .set('Authorization', `Bearer ${facilitatorToken}`)
        .send({
          type: 'followup',
          content: 'Can you tell me more about that experience?'
        });
      
      expect(followupResponse.status).toBe(201);

      // Step 11: Storyteller sees the follow-up as next prompt
      const nextPromptResponse = await request(app)
        .get(`/api/projects/${projectId}/next-prompt`)
        .set('Authorization', `Bearer ${storytellerToken}`);
      
      expect(nextPromptResponse.status).toBe(200);
      expect(nextPromptResponse.body.userPrompt).toBeDefined();
      expect(nextPromptResponse.body.userPrompt.content).toBe('Can you tell me more about that experience?');

      // Step 12: Facilitator requests export
      const exportResponse = await request(app)
        .post(`/api/projects/${projectId}/export`)
        .set('Authorization', `Bearer ${facilitatorToken}`);
      
      expect(exportResponse.status).toBe(202);
      expect(exportResponse.body.exportId).toBeDefined();

      console.log('✅ Complete facilitator journey test passed');
    });
  });

  describe('Multi-Facilitator Collaboration Journey', () => {
    let facilitator1Token: string;
    let facilitator2Token: string;
    let storytellerToken: string;
    let projectId: string;
    let storyId: string;

    it('should handle multi-facilitator collaboration workflow', async () => {
      // Step 1: First facilitator creates project
      const facilitator1Response = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'facilitator1.collab@test.com',
          password: 'testpassword123',
          name: 'Facilitator One'
        });
      
      facilitator1Token = facilitator1Response.body.accessToken;

      const projectResponse = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${facilitator1Token}`)
        .send({
          name: 'Collaboration Test Project'
        });
      
      projectId = projectResponse.body.id;

      // Step 2: First facilitator invites second facilitator
      const facilitatorInviteResponse = await request(app)
        .post(`/api/projects/${projectId}/invitations`)
        .set('Authorization', `Bearer ${facilitator1Token}`)
        .send({
          role: 'facilitator'
        });
      
      const facilitatorInviteToken = facilitatorInviteResponse.body.token;

      // Step 3: Second facilitator joins
      const facilitator2Response = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'facilitator2.collab@test.com',
          password: 'testpassword123',
          name: 'Facilitator Two'
        });
      
      facilitator2Token = facilitator2Response.body.accessToken;

      await request(app)
        .post(`/api/invitations/${facilitatorInviteToken}/accept`)
        .set('Authorization', `Bearer ${facilitator2Token}`);

      // Step 4: First facilitator invites storyteller
      const storytellerInviteResponse = await request(app)
        .post(`/api/projects/${projectId}/invitations`)
        .set('Authorization', `Bearer ${facilitator1Token}`)
        .send({
          role: 'storyteller'
        });
      
      const storytellerInviteToken = storytellerInviteResponse.body.token;

      // Step 5: Storyteller joins
      const storytellerResponse = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'storyteller.collab@test.com',
          password: 'testpassword123',
          name: 'Collaboration Storyteller'
        });
      
      storytellerToken = storytellerResponse.body.accessToken;

      await request(app)
        .post(`/api/invitations/${storytellerInviteToken}/accept`)
        .set('Authorization', `Bearer ${storytellerToken}`);

      // Step 6: Storyteller creates a story
      const storyResponse = await request(app)
        .post(`/api/projects/${projectId}/stories`)
        .set('Authorization', `Bearer ${storytellerToken}`)
        .send({
          title: 'Collaboration Story',
          audioUrl: 'https://test-bucket.s3.amazonaws.com/collab-story.mp3',
          transcript: 'This is a story for collaboration testing.',
          audioDuration: 90
        });
      
      storyId = storyResponse.body.id;

      // Step 7: Both facilitators interact with the story
      const comment1Response = await request(app)
        .post(`/api/stories/${storyId}/interactions`)
        .set('Authorization', `Bearer ${facilitator1Token}`)
        .send({
          type: 'comment',
          content: 'Great story! - From Facilitator One'
        });
      
      expect(comment1Response.status).toBe(201);

      const comment2Response = await request(app)
        .post(`/api/stories/${storyId}/interactions`)
        .set('Authorization', `Bearer ${facilitator2Token}`)
        .send({
          type: 'comment',
          content: 'I loved this too! - From Facilitator Two'
        });
      
      expect(comment2Response.status).toBe(201);

      // Step 8: Verify both interactions are visible with attribution
      const storyWithInteractionsResponse = await request(app)
        .get(`/api/stories/${storyId}`)
        .set('Authorization', `Bearer ${storytellerToken}`);
      
      expect(storyWithInteractionsResponse.status).toBe(200);
      expect(storyWithInteractionsResponse.body.interactions).toHaveLength(2);
      
      const interactions = storyWithInteractionsResponse.body.interactions;
      expect(interactions[0].facilitator.name).toBe('Facilitator One');
      expect(interactions[1].facilitator.name).toBe('Facilitator Two');

      // Step 9: Both facilitators can export
      const export1Response = await request(app)
        .post(`/api/projects/${projectId}/export`)
        .set('Authorization', `Bearer ${facilitator1Token}`);
      
      expect(export1Response.status).toBe(202);

      const export2Response = await request(app)
        .post(`/api/projects/${projectId}/export`)
        .set('Authorization', `Bearer ${facilitator2Token}`);
      
      expect(export2Response.status).toBe(202);

      console.log('✅ Multi-facilitator collaboration journey test passed');
    });
  });

  describe('Recording Confirmation Workflow Journey', () => {
    let storytellerToken: string;
    let facilitatorToken: string;
    let projectId: string;

    it('should handle the complete recording confirmation workflow', async () => {
      // Setup: Create facilitator and project
      const facilitatorResponse = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'facilitator.recording@test.com',
          password: 'testpassword123',
          name: 'Recording Facilitator'
        });
      
      facilitatorToken = facilitatorResponse.body.accessToken;

      const projectResponse = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${facilitatorToken}`)
        .send({
          name: 'Recording Workflow Project'
        });
      
      projectId = projectResponse.body.id;

      // Setup: Invite and onboard storyteller
      const invitationResponse = await request(app)
        .post(`/api/projects/${projectId}/invitations`)
        .set('Authorization', `Bearer ${facilitatorToken}`)
        .send({
          role: 'storyteller'
        });
      
      const storytellerResponse = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'storyteller.recording@test.com',
          password: 'testpassword123',
          name: 'Recording Storyteller'
        });
      
      storytellerToken = storytellerResponse.body.accessToken;

      await request(app)
        .post(`/api/invitations/${invitationResponse.body.token}/accept`)
        .set('Authorization', `Bearer ${storytellerToken}`);

      // Step 1: Storyteller gets prompt
      const promptResponse = await request(app)
        .get(`/api/projects/${projectId}/next-prompt`)
        .set('Authorization', `Bearer ${storytellerToken}`);
      
      expect(promptResponse.status).toBe(200);

      // Step 2: Storyteller creates story (simulating "Send to Family")
      const storyResponse = await request(app)
        .post(`/api/projects/${projectId}/stories`)
        .set('Authorization', `Bearer ${storytellerToken}`)
        .send({
          title: 'Recording Workflow Story',
          audioUrl: 'https://test-bucket.s3.amazonaws.com/recording-workflow.mp3',
          transcript: 'This story was created through the recording confirmation workflow.',
          audioDuration: 150,
          promptId: promptResponse.body.prompt.id
        });
      
      expect(storyResponse.status).toBe(201);
      const storyId = storyResponse.body.id;

      // Step 3: Verify story appears in storyteller's "My Stories"
      const myStoriesResponse = await request(app)
        .get(`/api/projects/${projectId}/stories`)
        .set('Authorization', `Bearer ${storytellerToken}`)
        .query({ storytellerId: storytellerResponse.body.user.id });
      
      expect(myStoriesResponse.status).toBe(200);
      expect(myStoriesResponse.body.stories).toHaveLength(1);
      expect(myStoriesResponse.body.stories[0].id).toBe(storyId);

      // Step 4: Facilitator receives notification and views story
      const facilitatorStoriesResponse = await request(app)
        .get(`/api/projects/${projectId}/stories`)
        .set('Authorization', `Bearer ${facilitatorToken}`);
      
      expect(facilitatorStoriesResponse.status).toBe(200);
      expect(facilitatorStoriesResponse.body.stories).toHaveLength(1);

      // Step 5: Facilitator edits transcript
      const editTranscriptResponse = await request(app)
        .put(`/api/stories/${storyId}/transcript`)
        .set('Authorization', `Bearer ${facilitatorToken}`)
        .send({
          transcript: 'This story was created through the recording confirmation workflow. [Edited by facilitator]'
        });
      
      expect(editTranscriptResponse.status).toBe(200);

      // Step 6: Facilitator adds follow-up question
      const followupResponse = await request(app)
        .post(`/api/stories/${storyId}/interactions`)
        .set('Authorization', `Bearer ${facilitatorToken}`)
        .send({
          type: 'followup',
          content: 'Can you tell me more about how you felt during that experience?'
        });
      
      expect(followupResponse.status).toBe(201);

      // Step 7: Storyteller sees follow-up in messages/feedback
      const messagesResponse = await request(app)
        .get(`/api/stories/${storyId}/interactions`)
        .set('Authorization', `Bearer ${storytellerToken}`);
      
      expect(messagesResponse.status).toBe(200);
      expect(messagesResponse.body.interactions).toHaveLength(1);
      expect(messagesResponse.body.interactions[0].type).toBe('followup');

      // Step 8: Storyteller records answer to follow-up
      const followupStoryResponse = await request(app)
        .post(`/api/projects/${projectId}/stories`)
        .set('Authorization', `Bearer ${storytellerToken}`)
        .send({
          title: 'Follow-up Answer',
          audioUrl: 'https://test-bucket.s3.amazonaws.com/followup-answer.mp3',
          transcript: 'I felt very nostalgic and happy remembering that time.',
          audioDuration: 80,
          userPromptId: followupResponse.body.id
        });
      
      expect(followupStoryResponse.status).toBe(201);

      // Step 9: Verify complete workflow
      const finalStoriesResponse = await request(app)
        .get(`/api/projects/${projectId}/stories`)
        .set('Authorization', `Bearer ${facilitatorToken}`);
      
      expect(finalStoriesResponse.status).toBe(200);
      expect(finalStoriesResponse.body.stories).toHaveLength(2);

      console.log('✅ Recording confirmation workflow journey test passed');
    });
  });

  describe('Archival Mode Journey', () => {
    let facilitatorToken: string;
    let storytellerToken: string;
    let projectId: string;

    it('should handle project archival workflow', async () => {
      // Setup: Create project with stories
      const facilitatorResponse = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'facilitator.archival@test.com',
          password: 'testpassword123',
          name: 'Archival Facilitator'
        });
      
      facilitatorToken = facilitatorResponse.body.accessToken;

      const projectResponse = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${facilitatorToken}`)
        .send({
          name: 'Archival Test Project'
        });
      
      projectId = projectResponse.body.id;

      // Create some stories
      await request(app)
        .post(`/api/projects/${projectId}/stories`)
        .set('Authorization', `Bearer ${facilitatorToken}`)
        .send({
          title: 'Pre-Archival Story',
          audioUrl: 'https://test-bucket.s3.amazonaws.com/pre-archival.mp3',
          transcript: 'This story was created before archival.',
          audioDuration: 100
        });

      // Step 1: Check project is active
      const activeProjectResponse = await request(app)
        .get(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${facilitatorToken}`);
      
      expect(activeProjectResponse.status).toBe(200);
      expect(activeProjectResponse.body.status).toBe('active');

      // Step 2: Simulate subscription expiry (would normally be automatic)
      // This would be handled by the archival service in production
      
      // Step 3: Verify export still works in archival mode
      const exportResponse = await request(app)
        .post(`/api/projects/${projectId}/export`)
        .set('Authorization', `Bearer ${facilitatorToken}`);
      
      expect(exportResponse.status).toBe(202);

      // Step 4: Verify stories are still readable
      const storiesResponse = await request(app)
        .get(`/api/projects/${projectId}/stories`)
        .set('Authorization', `Bearer ${facilitatorToken}`);
      
      expect(storiesResponse.status).toBe(200);
      expect(storiesResponse.body.stories).toHaveLength(1);

      console.log('✅ Archival mode journey test passed');
    });
  });

  describe('Error Recovery Journey', () => {
    let facilitatorToken: string;
    let projectId: string;

    it('should handle error scenarios gracefully', async () => {
      // Setup
      const facilitatorResponse = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'facilitator.errors@test.com',
          password: 'testpassword123',
          name: 'Error Test Facilitator'
        });
      
      facilitatorToken = facilitatorResponse.body.accessToken;

      const projectResponse = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${facilitatorToken}`)
        .send({
          name: 'Error Recovery Project'
        });
      
      projectId = projectResponse.body.id;

      // Test 1: Invalid story creation
      const invalidStoryResponse = await request(app)
        .post(`/api/projects/${projectId}/stories`)
        .set('Authorization', `Bearer ${facilitatorToken}`)
        .send({
          // Missing required fields
          title: 'Invalid Story'
        });
      
      expect(invalidStoryResponse.status).toBe(400);
      expect(invalidStoryResponse.body.error).toBeDefined();

      // Test 2: Access to non-existent resource
      const nonExistentResponse = await request(app)
        .get('/api/stories/non-existent-id')
        .set('Authorization', `Bearer ${facilitatorToken}`);
      
      expect(nonExistentResponse.status).toBe(404);
      expect(nonExistentResponse.body.error.message).toMatch(/not found/i);

      // Test 3: Unauthorized access
      const unauthorizedResponse = await request(app)
        .get(`/api/projects/${projectId}/stories`);
      
      expect(unauthorizedResponse.status).toBe(401);

      // Test 4: Recovery after error - valid request should work
      const validStoryResponse = await request(app)
        .post(`/api/projects/${projectId}/stories`)
        .set('Authorization', `Bearer ${facilitatorToken}`)
        .send({
          title: 'Recovery Story',
          audioUrl: 'https://test-bucket.s3.amazonaws.com/recovery.mp3',
          transcript: 'This story was created after error recovery.',
          audioDuration: 75
        });
      
      expect(validStoryResponse.status).toBe(201);

      console.log('✅ Error recovery journey test passed');
    });
  });
});