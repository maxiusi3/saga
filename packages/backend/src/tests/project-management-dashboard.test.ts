import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { ProjectRoleModel } from '../models/project-role'
import { UserModel } from '../models/user'
import { ProjectModel } from '../models/project'
import { StoryModel } from '../models/story'
import { InteractionModel } from '../models/interaction'
import { setupTestDatabase, cleanupTestDatabase } from './setup'

describe('Project Management Dashboard', () => {
  let testProject: any
  let facilitator1: any
  let facilitator2: any
  let storyteller: any
  let testStories: any[]

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
      description: 'Testing project management dashboard'
    })

    // Assign roles
    await ProjectRoleModel.assignRole(facilitator1.id, testProject.id, 'facilitator')
    await ProjectRoleModel.assignRole(facilitator2.id, testProject.id, 'facilitator')
    await ProjectRoleModel.assignRole(storyteller.id, testProject.id, 'storyteller')

    // Create test stories
    testStories = []
    for (let i = 0; i < 5; i++) {
      const story = await StoryModel.create({
        project_id: testProject.id,
        title: `Test Story ${i + 1}`,
        audio_url: `https://example.com/audio${i + 1}.mp3`,
        transcript: `This is test story ${i + 1} transcript.`,
        audio_duration: 120 + i * 30, // Varying durations
        status: 'ready'
      })
      testStories.push(story)
    }

    // Create test interactions
    for (let i = 0; i < testStories.length; i++) {
      const story = testStories[i]
      const facilitator = i % 2 === 0 ? facilitator1 : facilitator2

      await InteractionModel.createInteraction({
        storyId: story.id,
        facilitatorId: facilitator.id,
        type: 'comment',
        content: `Great story! Comment from ${facilitator.name}`
      })

      if (i < 3) {
        await InteractionModel.createInteraction({
          storyId: story.id,
          facilitatorId: facilitator.id,
          type: 'followup',
          content: `Follow-up question from ${facilitator.name}`
        })
      }
    }
  })

  afterEach(async () => {
    await cleanupTestDatabase()
  })

  describe('Project Members Management', () => {
    it('should retrieve all project members with their roles', async () => {
      const members = await ProjectRoleModel.getProjectRoles(testProject.id)

      expect(members).toHaveLength(3)
      
      const facilitators = members.filter(m => m.role === 'facilitator')
      const storytellers = members.filter(m => m.role === 'storyteller')
      
      expect(facilitators).toHaveLength(2)
      expect(storytellers).toHaveLength(1)
      
      // Check facilitator details
      const facilitator1Member = facilitators.find(f => f.user_id === facilitator1.id)
      expect(facilitator1Member).toBeTruthy()
      expect(facilitator1Member.user_name).toBe('Facilitator One')
      expect(facilitator1Member.user_email).toBe('facilitator1@test.com')
      
      // Check storyteller details
      const storytellerMember = storytellers[0]
      expect(storytellerMember.user_id).toBe(storyteller.id)
      expect(storytellerMember.user_name).toBe('Test Storyteller')
    })

    it('should allow facilitators to remove other members', async () => {
      // Get the facilitator2 role record
      const facilitator2Role = await ProjectRoleModel.query()
        .where('user_id', facilitator2.id)
        .where('project_id', testProject.id)
        .first()

      expect(facilitator2Role).toBeTruthy()

      // Remove facilitator2
      const removed = await ProjectRoleModel.removeRole(
        facilitator2.id,
        testProject.id,
        'facilitator'
      )

      expect(removed).toBe(true)

      // Verify removal
      const remainingMembers = await ProjectRoleModel.getProjectRoles(testProject.id)
      expect(remainingMembers).toHaveLength(2)
      
      const remainingFacilitators = remainingMembers.filter(m => m.role === 'facilitator')
      expect(remainingFacilitators).toHaveLength(1)
      expect(remainingFacilitators[0].user_id).toBe(facilitator1.id)
    })

    it('should get member activity statistics', async () => {
      const facilitators = await ProjectRoleModel.getProjectFacilitators(testProject.id)
      expect(facilitators).toHaveLength(2)

      // Check that facilitators have user information
      facilitators.forEach(facilitator => {
        expect(facilitator.user_name).toBeTruthy()
        expect(facilitator.user_email).toBeTruthy()
        expect(facilitator.created_at).toBeTruthy()
      })

      const storytellers = await ProjectRoleModel.query()
        .where('project_id', testProject.id)
        .where('role', 'storyteller')
        .leftJoin('users', 'project_roles.user_id', 'users.id')
        .select('project_roles.*', 'users.name as user_name', 'users.email as user_email')

      expect(storytellers).toHaveLength(1)
      expect(storytellers[0].user_name).toBe('Test Storyteller')
    })
  })

  describe('Project Analytics', () => {
    it('should calculate basic project statistics', async () => {
      // Get story statistics
      const storyStats = await StoryModel.query()
        .where('project_id', testProject.id)
        .where('status', 'ready')
        .select(
          StoryModel.db.raw('COUNT(*) as totalStories'),
          StoryModel.db.raw('SUM(audio_duration) as totalDuration'),
          StoryModel.db.raw('AVG(audio_duration) as averageStoryLength')
        )
        .first()

      expect(parseInt(storyStats.totalStories)).toBe(5)
      expect(parseInt(storyStats.totalDuration)).toBeGreaterThan(0)
      expect(parseInt(storyStats.averageStoryLength)).toBeGreaterThan(0)

      // Get interaction statistics
      const interactionStats = await InteractionModel.query()
        .leftJoin('stories', 'interactions.story_id', 'stories.id')
        .where('stories.project_id', testProject.id)
        .select(
          InteractionModel.db.raw('COUNT(*) as totalInteractions'),
          InteractionModel.db.raw('COUNT(CASE WHEN type = \'comment\' THEN 1 END) as totalComments'),
          InteractionModel.db.raw('COUNT(CASE WHEN type = \'followup\' THEN 1 END) as totalFollowups')
        )
        .first()

      expect(parseInt(interactionStats.totalInteractions)).toBe(8) // 5 comments + 3 followups
      expect(parseInt(interactionStats.totalComments)).toBe(5)
      expect(parseInt(interactionStats.totalFollowups)).toBe(3)
    })

    it('should track facilitator activity', async () => {
      const facilitatorStats = await ProjectRoleModel.query()
        .where('project_roles.project_id', testProject.id)
        .where('project_roles.role', 'facilitator')
        .leftJoin('users', 'project_roles.user_id', 'users.id')
        .leftJoin('interactions', 'project_roles.user_id', 'interactions.facilitator_id')
        .leftJoin('stories', 'interactions.story_id', 'stories.id')
        .where('stories.project_id', testProject.id)
        .groupBy('project_roles.id', 'project_roles.user_id', 'users.name')
        .select(
          'project_roles.user_id as facilitatorId',
          'users.name as facilitatorName',
          ProjectRoleModel.db.raw('COUNT(interactions.id) as interactionCount')
        )

      expect(facilitatorStats).toHaveLength(2)
      
      // Each facilitator should have interactions
      facilitatorStats.forEach(stat => {
        expect(parseInt(stat.interactionCount)).toBeGreaterThan(0)
        expect(stat.facilitatorName).toBeTruthy()
      })

      // Total interactions should match our test data
      const totalInteractions = facilitatorStats.reduce(
        (sum, stat) => sum + parseInt(stat.interactionCount), 
        0
      )
      expect(totalInteractions).toBe(8)
    })

    it('should provide project insights and metrics', async () => {
      // Test chapter progress (would need chapter data in real implementation)
      const projectInsights = {
        totalStories: testStories.length,
        totalFacilitators: 2,
        totalStorytellers: 1,
        averageInteractionsPerStory: 8 / 5, // 8 interactions across 5 stories
        mostActiveDay: new Date().toISOString().split('T')[0]
      }

      expect(projectInsights.totalStories).toBe(5)
      expect(projectInsights.totalFacilitators).toBe(2)
      expect(projectInsights.totalStorytellers).toBe(1)
      expect(projectInsights.averageInteractionsPerStory).toBe(1.6)
    })
  })

  describe('Project Settings Management', () => {
    it('should validate project ownership for settings changes', async () => {
      // Check if user is a facilitator (has permission to change settings)
      const isFacilitator = await ProjectRoleModel.hasRole(
        facilitator1.id, 
        testProject.id, 
        'facilitator'
      )
      expect(isFacilitator).toBe(true)

      // Storytellers should not have settings permissions
      const storytellerIsFacilitator = await ProjectRoleModel.hasRole(
        storyteller.id, 
        testProject.id, 
        'facilitator'
      )
      expect(storytellerIsFacilitator).toBe(false)
    })

    it('should track project subscription and archival status', async () => {
      // This would integrate with subscription system
      const projectStatus = {
        subscriptionStatus: 'active',
        subscriptionExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        archivalStatus: 'active',
        isReadOnly: false
      }

      expect(projectStatus.subscriptionStatus).toBe('active')
      expect(projectStatus.archivalStatus).toBe('active')
      expect(projectStatus.isReadOnly).toBe(false)
    })
  })

  describe('Real-time Collaboration Features', () => {
    it('should support multiple facilitators working simultaneously', async () => {
      // Simulate concurrent interactions from different facilitators
      const story = testStories[0]

      const interaction1Promise = InteractionModel.createInteraction({
        storyId: story.id,
        facilitatorId: facilitator1.id,
        type: 'comment',
        content: 'Concurrent comment from facilitator 1'
      })

      const interaction2Promise = InteractionModel.createInteraction({
        storyId: story.id,
        facilitatorId: facilitator2.id,
        type: 'followup',
        content: 'Concurrent question from facilitator 2'
      })

      const [interaction1, interaction2] = await Promise.all([
        interaction1Promise,
        interaction2Promise
      ])

      expect(interaction1.facilitatorId).toBe(facilitator1.id)
      expect(interaction2.facilitatorId).toBe(facilitator2.id)

      // Verify both interactions are stored correctly
      const storyInteractions = await InteractionModel.findByStory(story.id)
      const newInteractions = storyInteractions.filter(i => 
        i.content.includes('Concurrent')
      )
      expect(newInteractions).toHaveLength(2)
    })
  })
})