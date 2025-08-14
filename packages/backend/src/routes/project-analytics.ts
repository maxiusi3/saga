import { Router } from 'express'
import { param, query, validationResult } from 'express-validator'
import { ProjectRoleModel } from '../models/project-role'
import { StoryModel } from '../models/story'
import { InteractionModel } from '../models/interaction'
import { createError, asyncHandler } from '../middleware/error-handler'
import { AuthenticatedRequest, authenticateToken } from '../middleware/auth'
import { ApiResponse } from '@saga/shared'

const router = Router()

/**
 * GET /api/projects/:projectId/analytics
 * Get comprehensive project analytics
 */
router.get(
  '/:projectId/analytics',
  authenticateToken,
  [
    param('projectId').isUUID().withMessage('Invalid project ID format'),
    query('timeRange').optional().isIn(['week', 'month', 'all']).withMessage('Invalid time range')
  ],
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array())
    }

    const { projectId } = req.params
    const { timeRange = 'month' } = req.query

    // Verify user has access to this project
    const userHasAccess = await ProjectRoleModel.getUserRolesInProject(req.user!.id, projectId)
    if (userHasAccess.length === 0) {
      throw createError('Access denied to project', 403, 'PROJECT_ACCESS_DENIED')
    }

    // Calculate date range
    let dateFilter = ''
    const now = new Date()
    if (timeRange === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      dateFilter = `AND created_at >= '${weekAgo.toISOString()}'`
    } else if (timeRange === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      dateFilter = `AND created_at >= '${monthAgo.toISOString()}'`
    }

    // Get basic story statistics
    const storyStats = await StoryModel.query()
      .where('project_id', projectId)
      .whereRaw(`status = 'ready' ${dateFilter}`)
      .select(
        StoryModel.db.raw('COUNT(*) as totalStories'),
        StoryModel.db.raw('SUM(audio_duration) as totalDuration'),
        StoryModel.db.raw('AVG(audio_duration) as averageStoryLength')
      )
      .first()

    // Get interaction statistics
    const interactionStats = await InteractionModel.query()
      .leftJoin('stories', 'interactions.story_id', 'stories.id')
      .where('stories.project_id', projectId)
      .whereRaw(`interactions.created_at IS NOT NULL ${dateFilter.replace('created_at', 'interactions.created_at')}`)
      .select(
        InteractionModel.db.raw('COUNT(*) as totalInteractions')
      )
      .first()

    // Get chapter progress
    const chapterProgress = await StoryModel.db('chapters')
      .leftJoin('stories', function() {
        this.on('chapters.id', '=', 'stories.chapter_id')
          .andOn('stories.project_id', '=', StoryModel.db.raw('?', [projectId]))
      })
      .select(
        'chapters.id as chapterId',
        'chapters.name as chapterName',
        StoryModel.db.raw('COUNT(stories.id) as storyCount'),
        StoryModel.db.raw('CASE WHEN COUNT(stories.id) >= 3 THEN true ELSE false END as isCompleted')
      )
      .groupBy('chapters.id', 'chapters.name')
      .orderBy('chapters.order_index')

    // Get facilitator activity stats
    const facilitatorStats = await ProjectRoleModel.query()
      .where('project_roles.project_id', projectId)
      .where('project_roles.role', 'facilitator')
      .leftJoin('users', 'project_roles.user_id', 'users.id')
      .leftJoin('interactions', function() {
        this.on('project_roles.user_id', '=', 'interactions.facilitator_id')
        if (dateFilter) {
          this.andOnRaw(`interactions.created_at >= ?`, [
            timeRange === 'week' 
              ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
              : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
          ])
        }
      })
      .leftJoin('stories', 'interactions.story_id', 'stories.id')
      .where('stories.project_id', projectId)
      .groupBy('project_roles.id', 'project_roles.user_id', 'users.name')
      .select(
        'project_roles.user_id as facilitatorId',
        'users.name as facilitatorName',
        StoryModel.db.raw('COUNT(interactions.id) as interactionCount'),
        StoryModel.db.raw('MAX(interactions.created_at) as lastActive')
      )

    // Get storyteller activity stats
    const storytellerStats = await ProjectRoleModel.query()
      .where('project_roles.project_id', projectId)
      .where('project_roles.role', 'storyteller')
      .leftJoin('users', 'project_roles.user_id', 'users.id')
      .leftJoin('stories', function() {
        this.on('project_roles.user_id', '=', 'stories.created_by')
          .andOn('stories.project_id', '=', StoryModel.db.raw('?', [projectId]))
        if (dateFilter) {
          this.andOnRaw(`stories.created_at >= ?`, [
            timeRange === 'week' 
              ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
              : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
          ])
        }
      })
      .groupBy('project_roles.id', 'project_roles.user_id', 'users.name')
      .select(
        'project_roles.user_id as storytellerId',
        'users.name as storytellerName',
        StoryModel.db.raw('COUNT(stories.id) as storyCount'),
        StoryModel.db.raw('SUM(stories.audio_duration) as totalDuration'),
        StoryModel.db.raw('MAX(stories.created_at) as lastStory')
      )

    // Get weekly activity (last 7 days)
    const weeklyActivity = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)

      const dayStats = await StoryModel.query()
        .where('project_id', projectId)
        .whereBetween('created_at', [startOfDay.toISOString(), endOfDay.toISOString()])
        .select(
          StoryModel.db.raw('COUNT(*) as stories')
        )
        .first()

      const dayInteractions = await InteractionModel.query()
        .leftJoin('stories', 'interactions.story_id', 'stories.id')
        .where('stories.project_id', projectId)
        .whereBetween('interactions.created_at', [startOfDay.toISOString(), endOfDay.toISOString()])
        .select(
          InteractionModel.db.raw('COUNT(*) as interactions')
        )
        .first()

      weeklyActivity.push({
        date: startOfDay.toISOString().split('T')[0],
        stories: parseInt(dayStats?.stories) || 0,
        interactions: parseInt(dayInteractions?.interactions) || 0
      })
    }

    // Calculate time-specific metrics
    const storiesThisWeek = timeRange === 'all' ? 0 : await StoryModel.query()
      .where('project_id', projectId)
      .where('created_at', '>=', new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .count('* as count')
      .first()

    const storiesThisMonth = timeRange === 'all' ? 0 : await StoryModel.query()
      .where('project_id', projectId)
      .where('created_at', '>=', new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .count('* as count')
      .first()

    const response: ApiResponse = {
      data: {
        totalStories: parseInt(storyStats?.totalStories) || 0,
        totalDuration: parseInt(storyStats?.totalDuration) || 0,
        totalInteractions: parseInt(interactionStats?.totalInteractions) || 0,
        completedChapters: chapterProgress.filter(ch => ch.isCompleted).length,
        totalChapters: chapterProgress.length,
        averageStoryLength: parseInt(storyStats?.averageStoryLength) || 0,
        storiesThisWeek: parseInt(storiesThisWeek?.count) || 0,
        storiesThisMonth: parseInt(storiesThisMonth?.count) || 0,
        facilitatorStats: facilitatorStats.map(stat => ({
          facilitatorId: stat.facilitatorId,
          facilitatorName: stat.facilitatorName,
          interactionCount: parseInt(stat.interactionCount) || 0,
          lastActive: stat.lastActive || new Date().toISOString()
        })),
        storytellerStats: storytellerStats.map(stat => ({
          storytellerId: stat.storytellerId,
          storytellerName: stat.storytellerName,
          storyCount: parseInt(stat.storyCount) || 0,
          totalDuration: parseInt(stat.totalDuration) || 0,
          lastStory: stat.lastStory || new Date().toISOString()
        })),
        weeklyActivity,
        chapterProgress: chapterProgress.map(chapter => ({
          chapterId: chapter.chapterId,
          chapterName: chapter.chapterName,
          storyCount: parseInt(chapter.storyCount) || 0,
          isCompleted: chapter.isCompleted
        }))
      },
      message: 'Project analytics retrieved successfully',
      timestamp: new Date().toISOString(),
    }

    res.json(response)
  })
)

export default router