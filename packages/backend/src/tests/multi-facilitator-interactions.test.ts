import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { StoryModel } from '../models/story'
import { InteractionModel } from '../models/interaction'
import { ProjectRoleModel } from '../models/project-role'
import { UserModel } from '../models/user'
import { ProjectModel } from '../models/project'
import { setupTestDatabase, cleanupTestDatabase } from './setup'

describe('Multi-Facilitator Interactions', () => {
  let testProject: any
  let facilitator1: any
  let facilitator2: any
  let storyteller: any
  let testStory: any

  beforeEach(async () => {
    await setupTestDatabase()

    // Create test users
    facilitator1 = await UserModel.create({
      email: 'facilitator1@test.com',
      name: 'Facilitator One',
      password: 'password123'
    })

    facilitator2 = await UserModel.create({
      email: 'facilitator2@test.com',
      name: 'Facilitator Two',
      password: 'password123'
    })

    storyteller = await UserModel.create({
      email: 'storyteller@test.com',
      name: 'Test Storyteller',
      password: 'password123'
    })

    // Create test project
    testProject = await ProjectModel.create({
      name: 'Test Multi-Facilitator Project',
      description: 'Testing multi-facilitator interactions'
    })

    // Assign roles
    await ProjectRoleModel.assignRole(facilitator1.id, testProject.id, 'facilitator')
    await ProjectRoleModel.assignRole(facilitator2.id, testProject.id, 'facilitator')
    await ProjectRoleModel.assignRole(storyteller.id, testProject.id, 'storyteller')

    // Create test story
    testStory = await StoryModel.create({
      project_id: testProject.id,
      title: 'Test Story',
      audio_url: 'https://example.com/audio.mp3',
      transcript: 'This is a test story transcript.',
      status: 'ready'
    })
  })

  afterEach(async () => {
    await cleanupTestDatabase()
  })

  describe('Facilitator Attribution', () => {
    it('should create interactions with correct facilitator attribution', async () => {
      // Facilitator 1 creates a comment
      const comment1 = await InteractionModel.createInteraction({
        storyId: testStory.id,
        facilitatorId: facilitator1.id,
        type: 'comment',
        content: 'Great story! This reminds me of my childhood.'
      })

      // Facilitator 2 creates a follow-up question
      const followup1 = await InteractionModel.createInteraction({
        storyId: testStory.id,
        facilitatorId: facilitator2.id,
        type: 'followup',
        content: 'Can you tell us more about what happened next?'
      })

      expect(comment1.facilitatorId).toBe(facilitator1.id)
      expect(followup1.facilitatorId).toBe(facilitator2.id)
    })

    it('should retrieve interactions with facilitator information', async () => {
      // Create interactions from both facilitators
      await InteractionModel.createInteraction({
        storyId: testStory.id,
        facilitatorId: facilitator1.id,
        type: 'comment',
        content: 'Comment from facilitator 1'
      })

      await InteractionModel.createInteraction({
        storyId: testStory.id,
        facilitatorId: facilitator2.id,
        type: 'followup',
        content: 'Question from facilitator 2'
      })

      // Get story with interactions
      const storyWithInteractions = await StoryModel.getStoryWithInteractions(testStory.id)

      expect(storyWithInteractions.interactions).toHaveLength(2)
      
      const interaction1 = storyWithInteractions.interactions.find(i => i.facilitator_id === facilitator1.id)
      const interaction2 = storyWithInteractions.interactions.find(i => i.facilitator_id === facilitator2.id)

      expect(interaction1.facilitator_name).toBe('Facilitator One')
      expect(interaction2.facilitator_name).toBe('Facilitator Two')
    })

    it('should maintain chronological order of interactions from multiple facilitators', async () => {
      // Create interactions in specific order
      const interaction1 = await InteractionModel.createInteraction({
        storyId: testStory.id,
        facilitatorId: facilitator1.id,
        type: 'comment',
        content: 'First interaction'
      })

      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10))

      const interaction2 = await InteractionModel.createInteraction({
        storyId: testStory.id,
        facilitatorId: facilitator2.id,
        type: 'comment',
        content: 'Second interaction'
      })

      await new Promise(resolve => setTimeout(resolve, 10))

      const interaction3 = await InteractionModel.createInteraction({
        storyId: testStory.id,
        facilitatorId: facilitator1.id,
        type: 'followup',
        content: 'Third interaction'
      })

      const interactions = await InteractionModel.findByStory(testStory.id)

      expect(interactions).toHaveLength(3)
      expect(interactions[0].id).toBe(interaction1.id)
      expect(interactions[1].id).toBe(interaction2.id)
      expect(interactions[2].id).toBe(interaction3.id)
    })
  })

  describe('Multi-Facilitator Statistics', () => {
    it('should track interaction statistics across multiple facilitators', async () => {
      // Create various interactions from both facilitators
      await InteractionModel.createInteraction({
        storyId: testStory.id,
        facilitatorId: facilitator1.id,
        type: 'comment',
        content: 'Comment 1'
      })

      await InteractionModel.createInteraction({
        storyId: testStory.id,
        facilitatorId: facilitator1.id,
        type: 'followup',
        content: 'Question 1'
      })

      await InteractionModel.createInteraction({
        storyId: testStory.id,
        facilitatorId: facilitator2.id,
        type: 'comment',
        content: 'Comment 2'
      })

      const followup = await InteractionModel.createInteraction({
        storyId: testStory.id,
        facilitatorId: facilitator2.id,
        type: 'followup',
        content: 'Question 2'
      })

      // Mark one followup as answered
      await InteractionModel.markAsAnswered(followup.id)

      const stats = await InteractionModel.getInteractionStats(testProject.id)

      expect(stats.totalInteractions).toBe(4)
      expect(stats.totalComments).toBe(2)
      expect(stats.totalFollowups).toBe(2)
      expect(stats.answeredFollowups).toBe(1)
    })

    it('should get interactions by specific facilitator', async () => {
      // Create interactions from both facilitators
      await InteractionModel.createInteraction({
        storyId: testStory.id,
        facilitatorId: facilitator1.id,
        type: 'comment',
        content: 'From facilitator 1'
      })

      await InteractionModel.createInteraction({
        storyId: testStory.id,
        facilitatorId: facilitator2.id,
        type: 'comment',
        content: 'From facilitator 2'
      })

      await InteractionModel.createInteraction({
        storyId: testStory.id,
        facilitatorId: facilitator1.id,
        type: 'followup',
        content: 'Another from facilitator 1'
      })

      const facilitator1Interactions = await InteractionModel.findByFacilitator(facilitator1.id)
      const facilitator2Interactions = await InteractionModel.findByFacilitator(facilitator2.id)

      expect(facilitator1Interactions).toHaveLength(2)
      expect(facilitator2Interactions).toHaveLength(1)

      facilitator1Interactions.forEach(interaction => {
        expect(interaction.facilitatorId).toBe(facilitator1.id)
      })

      facilitator2Interactions.forEach(interaction => {
        expect(interaction.facilitatorId).toBe(facilitator2.id)
      })
    })
  })

  describe('Project Role Validation', () => {
    it('should verify project access for facilitators', async () => {
      const hasAccess1 = await ProjectRoleModel.hasRole(facilitator1.id, testProject.id, 'facilitator')
      const hasAccess2 = await ProjectRoleModel.hasRole(facilitator2.id, testProject.id, 'facilitator')
      const hasStorytellerAccess = await ProjectRoleModel.hasRole(storyteller.id, testProject.id, 'storyteller')

      expect(hasAccess1).toBe(true)
      expect(hasAccess2).toBe(true)
      expect(hasStorytellerAccess).toBe(true)
    })

    it('should get all project facilitators', async () => {
      const facilitators = await ProjectRoleModel.getProjectFacilitators(testProject.id)

      expect(facilitators).toHaveLength(2)
      
      const facilitatorIds = facilitators.map(f => f.user_id)
      expect(facilitatorIds).toContain(facilitator1.id)
      expect(facilitatorIds).toContain(facilitator2.id)
    })

    it('should get project storyteller', async () => {
      const projectStoryteller = await ProjectRoleModel.getProjectStoryteller(testProject.id)

      expect(projectStoryteller).toBeTruthy()
      expect(projectStoryteller.user_id).toBe(storyteller.id)
      expect(projectStoryteller.user_name).toBe('Test Storyteller')
    })
  })

  describe('Interaction Context', () => {
    it('should get interaction with full context including facilitator info', async () => {
      const interaction = await InteractionModel.createInteraction({
        storyId: testStory.id,
        facilitatorId: facilitator1.id,
        type: 'comment',
        content: 'Test interaction with context'
      })

      const interactionWithContext = await InteractionModel.getInteractionWithContext(interaction.id)

      expect(interactionWithContext).toBeTruthy()
      expect(interactionWithContext.facilitator_name).toBe('Facilitator One')
      expect(interactionWithContext.story_title).toBe('Test Story')
      expect(interactionWithContext.project_name).toBe('Test Multi-Facilitator Project')
    })
  })
})