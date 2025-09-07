import { createClientSupabase } from '@/lib/supabase'

export interface Story {
  id: string
  project_id: string
  storyteller_id: string
  title: string
  content?: string
  audio_url?: string
  transcript?: string
  ai_generated_title?: string
  ai_summary?: string
  ai_follow_up_questions?: string[]
  ai_confidence_score?: number
  created_at: string
  updated_at: string
}

export interface CreateStoryData {
  project_id: string
  storyteller_id: string
  title: string
  content?: string
  audio_url?: string
  audio_duration?: number
  transcript?: string
  ai_generated_title?: string
  ai_summary?: string
  ai_follow_up_questions?: string[]
  ai_confidence_score?: number
}

export interface UpdateStoryData {
  title?: string
  content?: string
  transcript?: string
  ai_generated_title?: string
  ai_summary?: string
  ai_follow_up_questions?: string[]
  ai_confidence_score?: number
}

export class StoryService {
  private supabase = createClientSupabase()

  /**
   * Upload audio file to Supabase Storage
   */
  async uploadAudio(audioBlob: Blob, storyId: string): Promise<string | null> {
    try {
      const fileName = `${storyId}-${Date.now()}.webm`
      const filePath = `stories/${fileName}`

      const { data, error } = await this.supabase.storage
        .from('audio-recordings')
        .upload(filePath, audioBlob, {
          contentType: 'audio/webm',
          upsert: false
        })

      if (error) {
        console.error('Error uploading audio:', error)
        return null
      }

      // Get public URL
      const { data: urlData } = this.supabase.storage
        .from('audio-recordings')
        .getPublicUrl(data.path)

      return urlData.publicUrl
    } catch (error) {
      console.error('Error uploading audio:', error)
      return null
    }
  }

  /**
   * Create a new story
   */
  async createStory(storyData: CreateStoryData): Promise<Story | null> {
    try {
      // Create the story record with all data
      const { data: story, error: storyError } = await this.supabase
        .from('stories')
        .insert({
          project_id: storyData.project_id,
          storyteller_id: storyData.storyteller_id,
          title: storyData.title,
          content: storyData.content,
          audio_url: storyData.audio_url,
          audio_duration: storyData.audio_duration,
          transcript: storyData.transcript,
          ai_generated_title: storyData.ai_generated_title,
          ai_summary: storyData.ai_summary,
          ai_follow_up_questions: storyData.ai_follow_up_questions,
          ai_confidence_score: storyData.ai_confidence_score,
        })
        .select()
        .single()

      if (storyError) {
        console.error('Error creating story:', storyError)
        return null
      }

      return story
    } catch (error) {
      console.error('Error creating story:', error)
      return null
    }
  }

  /**
   * Get all stories for a project
   */
  async getStoriesByProject(projectId: string): Promise<Story[]> {
    try {
      const { data, error } = await this.supabase
        .from('stories')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching stories:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error fetching stories:', error)
      return []
    }
  }

  /**
   * Get a single story by ID
   */
  async getStoryById(storyId: string): Promise<Story | null> {
    try {
      const { data, error } = await this.supabase
        .from('stories')
        .select('*')
        .eq('id', storyId)
        .single()

      if (error) {
        console.error('Error fetching story:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error fetching story:', error)
      return null
    }
  }

  /**
   * Update a story
   */
  async updateStory(storyId: string, updateData: UpdateStoryData): Promise<Story | null> {
    try {
      const { data, error } = await this.supabase
        .from('stories')
        .update({
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .eq('id', storyId)
        .select()
        .single()

      if (error) {
        console.error('Error updating story:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error updating story:', error)
      return null
    }
  }

  /**
   * Delete a story
   */
  async deleteStory(storyId: string): Promise<boolean> {
    try {
      // First get the story to find the audio file
      const story = await this.getStoryById(storyId)
      
      // Delete audio file if it exists
      if (story?.audio_url) {
        const fileName = story.audio_url.split('/').pop()
        if (fileName) {
          await this.supabase.storage
            .from('audio-recordings')
            .remove([`stories/${fileName}`])
        }
      }

      // Delete the story record
      const { error } = await this.supabase
        .from('stories')
        .delete()
        .eq('id', storyId)

      if (error) {
        console.error('Error deleting story:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error deleting story:', error)
      return false
    }
  }

  /**
   * Get stories by storyteller
   */
  async getStoriesByStoryteller(storytellerId: string): Promise<Story[]> {
    try {
      const { data, error } = await this.supabase
        .from('stories')
        .select('*')
        .eq('storyteller_id', storytellerId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching stories by storyteller:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error fetching stories by storyteller:', error)
      return []
    }
  }

  /**
   * Search stories by title or content
   */
  async searchStories(projectId: string, query: string): Promise<Story[]> {
    try {
      const { data, error } = await this.supabase
        .from('stories')
        .select('*')
        .eq('project_id', projectId)
        .or(`title.ilike.%${query}%,content.ilike.%${query}%,transcript.ilike.%${query}%`)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error searching stories:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error searching stories:', error)
      return []
    }
  }
}

// Export singleton instance
export const storyService = new StoryService()
