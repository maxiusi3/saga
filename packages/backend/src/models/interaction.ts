import { BaseModel } from './base'
import { Interaction, CreateInteractionInput, UpdateInteractionInput } from '@saga/shared'

export class InteractionModel extends BaseModel {
  protected static tableName = 'interactions'

  static async findByStory(storyId: string): Promise<Interaction[]> {
    return this.query()
      .where('story_id', storyId)
      .orderBy('created_at', 'asc')
  }

  static async findByFacilitator(facilitatorId: string): Promise<Interaction[]> {
    return this.query()
      .where('facilitator_id', facilitatorId)
      .orderBy('created_at', 'desc')
  }

  static async createInteraction(interactionData: CreateInteractionInput): Promise<Interaction> {
    return this.create({
      story_id: interactionData.storyId,
      facilitator_id: interactionData.facilitatorId,
      type: interactionData.type,
      content: interactionData.content,
    })
  }

  static async updateInteraction(id: string, interactionData: UpdateInteractionInput): Promise<Interaction> {
    return this.update(id, interactionData)
  }

  static async markAsAnswered(id: string): Promise<Interaction> {
    return this.update(id, { answered_at: new Date() })
  }

  static async getUnansweredFollowups(storytellerId: string): Promise<Interaction[]> {
    return this.query()
      .leftJoin('stories', 'interactions.story_id', 'stories.id')
      .leftJoin('projects', 'stories.project_id', 'projects.id')
      .where('projects.storyteller_id', storytellerId)
      .where('interactions.type', 'followup')
      .whereNull('interactions.answered_at')
      .select('interactions.*')
      .orderBy('interactions.created_at', 'desc')
  }

  static async getInteractionWithContext(id: string) {
    return this.query()
      .where('interactions.id', id)
      .leftJoin('stories', 'interactions.story_id', 'stories.id')
      .leftJoin('projects', 'stories.project_id', 'projects.id')
      .leftJoin('users as facilitator', 'interactions.facilitator_id', 'facilitator.id')
      .select(
        'interactions.*',
        'stories.title as story_title',
        'stories.audio_url as story_audio_url',
        'projects.name as project_name',
        'facilitator.name as facilitator_name'
      )
      .first()
  }

  static async getInteractionStats(projectId: string) {
    const stats = await this.query()
      .leftJoin('stories', 'interactions.story_id', 'stories.id')
      .where('stories.project_id', projectId)
      .select(
        this.db.raw('COUNT(*) as total_interactions'),
        this.db.raw('COUNT(CASE WHEN type = \'comment\' THEN 1 END) as total_comments'),
        this.db.raw('COUNT(CASE WHEN type = \'followup\' THEN 1 END) as total_followups'),
        this.db.raw('COUNT(CASE WHEN type = \'followup\' AND answered_at IS NOT NULL THEN 1 END) as answered_followups')
      )
      .first()

    return {
      totalInteractions: parseInt(stats?.total_interactions) || 0,
      totalComments: parseInt(stats?.total_comments) || 0,
      totalFollowups: parseInt(stats?.total_followups) || 0,
      answeredFollowups: parseInt(stats?.answered_followups) || 0,
    }
  }

  static async getRecentInteractions(projectId: string, days = 7): Promise<Interaction[]> {
    const sinceDate = new Date()
    sinceDate.setDate(sinceDate.getDate() - days)

    return this.query()
      .leftJoin('stories', 'interactions.story_id', 'stories.id')
      .where('stories.project_id', projectId)
      .where('interactions.created_at', '>=', sinceDate)
      .select('interactions.*')
      .orderBy('interactions.created_at', 'desc')
  }
}