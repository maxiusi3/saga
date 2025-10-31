import { createClientSupabase } from '@/lib/supabase'

export interface Interaction {
  id: string
  story_id: string
  // 服务端统一返回字段名 facilitator_id，但真实表结构为 interactions.user_id
  facilitator_id: string
  type: 'comment' | 'followup'
  content: string
  answered_at?: string
  created_at: string
  // 关联数据
  facilitator_name?: string
  facilitator_avatar?: string
}

export interface CreateInteractionData {
  story_id: string
  type: 'comment' | 'followup'
  content: string
}

class InteractionService {
  private supabase = createClientSupabase()

  /**
   * 获取故事的所有交互记录
   */
  async getStoryInteractions(storyId: string): Promise<Interaction[]> {
    try {
      // 带上凭证，以便服务器路由读取 cookies；同时尽量在 headers 中附带 Bearer（在浏览器环境存在会话时）
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      try {
        const supa = createClientSupabase()
        const { data: { session } } = await supa.auth.getSession()
        if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`
      } catch {}
      const response = await fetch(`/api/stories/${storyId}/interactions`, { credentials: 'include', headers })
      if (!response.ok) {
        throw new Error('Failed to fetch interactions')
      }
      return await response.json()
    } catch (error) {
      console.error('Error fetching interactions:', error)
      return []
    }
  }

  /**
   * 创建新的交互记录（评论或跟进问题）
   */
  async createInteraction(data: CreateInteractionData): Promise<Interaction | null> {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      try {
        const supa = createClientSupabase()
        const { data: { session } } = await supa.auth.getSession()
        if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`
      } catch {}

      const response = await fetch(`/api/stories/${data.story_id}/interactions`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({
          type: data.type,
          content: data.content
        })
      })

      if (!response.ok) {
        throw new Error('Failed to create interaction')
      }

      return await response.json()
    } catch (error) {
      console.error('Error creating interaction:', error)
      return null
    }
  }



  /**
   * 获取项目的交互统计
   */
  async getProjectInteractionStats(projectId: string): Promise<{
    totalComments: number
    totalFollowups: number
    recentInteractions: Interaction[]
  }> {
    try {
      // 获取项目的所有故事ID
      const { data: stories, error: storiesError } = await this.supabase
        .from('stories')
        .select('id')
        .eq('project_id', projectId)

      if (storiesError || !stories) {
        return { totalComments: 0, totalFollowups: 0, recentInteractions: [] }
      }

      const storyIds: string[] = stories.map((s: { id: string }) => s.id)

      // 获取交互统计
      const { data: interactions, error } = await this.supabase
        .from('interactions')
        .select(`*`)
        .in('story_id', storyIds)
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) {
        console.error('Error fetching interaction stats:', error)
        return { totalComments: 0, totalFollowups: 0, recentInteractions: [] }
      }

      const totalComments = interactions.filter((i: { type: 'comment' | 'followup' }) => i.type === 'comment').length
      const totalFollowups = interactions.filter((i: { type: 'comment' | 'followup' }) => i.type === 'followup').length

      const recentInteractions = interactions.map((interaction: any) => ({
        id: interaction.id,
        story_id: interaction.story_id,
        facilitator_id: interaction.user_id,
        type: interaction.type,
        content: interaction.content,
        answered_at: interaction.answered_at,
        created_at: interaction.created_at,
        facilitator_name: undefined,
        facilitator_avatar: undefined,
      }))

      return {
        totalComments,
        totalFollowups,
        recentInteractions
      }
    } catch (error) {
      console.error('Error fetching interaction stats:', error)
      return { totalComments: 0, totalFollowups: 0, recentInteractions: [] }
    }
  }

  /**
   * 标记跟进问题为已回答
   */
  async markFollowupAnswered(interactionId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('interactions')
        .update({ answered_at: new Date().toISOString() })
        .eq('id', interactionId)
        .eq('type', 'followup')

      if (error) {
        console.error('Error marking followup as answered:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error marking followup as answered:', error)
      return false
    }
  }
}

export const interactionService = new InteractionService()
