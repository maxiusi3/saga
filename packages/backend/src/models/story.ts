import { BaseModel } from './base'
import { Story, CreateStoryInput, UpdateStoryInput, PaginatedStories } from '@saga/shared'

export class StoryModel extends BaseModel {
  protected static tableName = 'stories'

  static async findByProject(
    projectId: string,
    options: {
      page?: number
      limit?: number
      status?: 'processing' | 'ready' | 'failed'
    } = {}
  ): Promise<PaginatedStories> {
    const { page = 1, limit = 20, status } = options
    const offset = (page - 1) * limit

    let query = this.query()
      .where('project_id', projectId)
      .orderBy('created_at', 'desc')

    if (status) {
      query = query.where('status', status)
    }

    // Get total count
    const totalQuery = this.query()
      .where('project_id', projectId)
      .count('* as count')

    if (status) {
      totalQuery.where('status', status)
    }

    const [stories, totalResult] = await Promise.all([
      query.limit(limit).offset(offset),
      totalQuery.first(),
    ])

    const total = parseInt(totalResult?.count as string) || 0

    return {
      stories,
      total,
      page,
      limit,
      hasMore: offset + stories.length < total,
    }
  }

  static async createStory(storyData: CreateStoryInput & {
    audioUrl: string
    photoUrl?: string
  }): Promise<Story> {
    return this.create({
      project_id: storyData.projectId,
      title: storyData.title,
      audio_url: storyData.audioUrl,
      photo_url: storyData.photoUrl,
      ai_prompt: storyData.aiPrompt,
      status: 'processing',
    })
  }

  static async updateStory(id: string, storyData: UpdateStoryInput): Promise<Story> {
    const updateData: any = {}

    if (storyData.title !== undefined) updateData.title = storyData.title
    if (storyData.transcript !== undefined) updateData.transcript = storyData.transcript
    if (storyData.status !== undefined) updateData.status = storyData.status

    return this.update(id, updateData)
  }

  static async getStoryWithInteractions(id: string) {
    const story = await this.findById(id)
    if (!story) return null

    const interactions = await this.db('interactions')
      .where('story_id', id)
      .leftJoin('users', 'interactions.facilitator_id', 'users.id')
      .select(
        'interactions.*',
        'users.name as facilitator_name'
      )
      .orderBy('interactions.created_at', 'asc')

    const interactionCount = await this.db('interactions')
      .where('story_id', id)
      .count('* as count')
      .first()

    return {
      ...story,
      interactions,
      _count: {
        interactions: parseInt(interactionCount?.count as string) || 0,
      },
    }
  }

  static async updateTranscript(id: string, transcript: string, isOriginal = false): Promise<Story> {
    const updateData: any = { transcript }
    
    if (isOriginal) {
      updateData.original_transcript = transcript
    }

    return this.update(id, updateData)
  }

  static async updateTranscriptWithMetadata(
    id: string, 
    transcript: string, 
    metadata: {
      confidence?: number
      language?: string
      provider?: string
      hasSpeakerDiarization?: boolean
      wordCount?: number
      sttMetadata?: any
    }
  ): Promise<Story> {
    const updateData: any = {
      transcript,
      original_transcript: transcript,
      transcript_generated_at: new Date(),
    }

    if (metadata.confidence !== undefined) {
      updateData.transcript_confidence = metadata.confidence
    }
    if (metadata.language) {
      updateData.transcript_language = metadata.language
    }
    if (metadata.provider) {
      updateData.stt_provider = metadata.provider
    }
    if (metadata.hasSpeakerDiarization !== undefined) {
      updateData.has_speaker_diarization = metadata.hasSpeakerDiarization
    }
    if (metadata.wordCount !== undefined) {
      updateData.word_count = metadata.wordCount
    }
    if (metadata.sttMetadata) {
      updateData.stt_metadata = JSON.stringify(metadata.sttMetadata)
    }

    return this.update(id, updateData)
  }

  static async updateProcessingStatus(
    id: string,
    status: 'processing' | 'ready' | 'failed',
    transcript?: string,
    audioDuration?: number
  ): Promise<Story> {
    const updateData: any = { status }

    if (transcript) {
      updateData.transcript = transcript
      updateData.original_transcript = transcript
    }

    if (audioDuration) {
      updateData.audio_duration = audioDuration
    }

    return this.update(id, updateData)
  }

  static async getStoriesByStatus(status: 'processing' | 'ready' | 'failed'): Promise<Story[]> {
    return this.query().where('status', status)
  }

  static async searchStories(projectId: string, query: string, limit = 10): Promise<Story[]> {
    // Use the new SearchService for better full-text search
    // This method is kept for backward compatibility
    return this.query()
      .where('project_id', projectId)
      .where(function() {
        this.where('title', 'ilike', `%${query}%`)
          .orWhere('transcript', 'ilike', `%${query}%`)
      })
      .where('status', 'ready')
      .limit(limit)
      .orderBy('created_at', 'desc')
  }

  static async updateSearchIndex(id: string): Promise<void> {
    // Trigger search vector update for a specific story
    await this.db.raw(`
      UPDATE stories 
      SET search_vector = 
        setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(transcript, '')), 'B')
      WHERE id = ?
    `, [id])
  }

  static async getRecentStories(projectId: string, days = 7): Promise<Story[]> {
    const sinceDate = new Date()
    sinceDate.setDate(sinceDate.getDate() - days)

    return this.query()
      .where('project_id', projectId)
      .where('created_at', '>=', sinceDate)
      .where('status', 'ready')
      .orderBy('created_at', 'desc')
  }
}