import { createClientSupabase } from '@/lib/supabase'
import { Chapter, ChapterProgress, ProjectPromptState } from '@saga/shared'

export class ChapterService {
  private supabase = createClientSupabase()

  // 统一带鉴权的 fetch：附带 Supabase access token 与 cookies
  private async authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
    const { data: { session } } = await this.supabase.auth.getSession()
    const headers = new Headers(init.headers || {})
    if (!headers.has('Content-Type') && init.body) {
      headers.set('Content-Type', 'application/json')
    }
    if (session?.access_token) {
      headers.set('Authorization', `Bearer ${session.access_token}`)
    }
    return fetch(input, { ...init, headers, credentials: 'include' })
  }

  /**
   * 获取所有活跃章节
   */
  async getActiveChapters(): Promise<Chapter[]> {
    try {
      const { data, error } = await this.supabase
        .from('chapters')
        .select('*')
        .eq('is_active', true)
        .order('order_index', { ascending: true })

      if (error) {
        console.error('Error fetching chapters:', error)
        return []
      }

      return data.map(chapter => ({
        id: chapter.id,
        name: chapter.name,
        description: chapter.description,
        order_index: chapter.order_index,
        is_active: chapter.is_active,
        created_at: new Date(chapter.created_at)
      }))
    } catch (error) {
      console.error('Error fetching chapters:', error)
      return []
    }
  }

  /**
   * 获取项目的章节进度
   */
  async getProjectChapterProgress(projectId: string): Promise<ChapterProgress[]> {
    try {
      const response = await this.authFetch(`/api/projects/${projectId}/chapters`)
      if (!response.ok) {
        throw new Error('Failed to fetch chapter progress')
      }
      const data = await response.json()
      return data.progress || []
    } catch (error) {
      console.error('Error fetching chapter progress:', error)
      return []
    }
  }

  /**
   * 获取项目的当前提示状态
   */
  async getProjectPromptState(projectId: string): Promise<ProjectPromptState | null> {
    try {
      const { data, error } = await this.supabase
        .from('project_prompt_state')
        .select('*')
        .eq('project_id', projectId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // 记录不存在，创建初始状态
          return await this.initializeProjectPromptState(projectId)
        }
        console.error('Error fetching project prompt state:', error)
        return null
      }

      return {
        project_id: data.project_id,
        current_chapter_id: data.current_chapter_id,
        current_prompt_index: data.current_prompt_index,
        last_prompt_delivered_at: data.last_prompt_delivered_at ? new Date(data.last_prompt_delivered_at) : undefined,
        updated_at: new Date(data.updated_at)
      }
    } catch (error) {
      console.error('Error fetching project prompt state:', error)
      return null
    }
  }

  /**
   * 初始化项目提示状态
   */
  async initializeProjectPromptState(projectId: string): Promise<ProjectPromptState | null> {
    try {
      // 获取第一个章节
      const chapters = await this.getActiveChapters()
      if (chapters.length === 0) {
        console.error('No active chapters found')
        return null
      }

      const firstChapter = chapters[0]

      const { data, error } = await this.supabase
        .from('project_prompt_state')
        .insert({
          project_id: projectId,
          current_chapter_id: firstChapter.id,
          current_prompt_index: 0
        })
        .select()
        .single()

      if (error) {
        console.error('Error initializing project prompt state:', error)
        return null
      }

      return {
        project_id: data.project_id,
        current_chapter_id: data.current_chapter_id,
        current_prompt_index: data.current_prompt_index,
        last_prompt_delivered_at: data.last_prompt_delivered_at ? new Date(data.last_prompt_delivered_at) : undefined,
        updated_at: new Date(data.updated_at)
      }
    } catch (error) {
      console.error('Error initializing project prompt state:', error)
      return null
    }
  }

  /**
   * 获取下一个提示
   */
  async getNextPrompt(projectId: string): Promise<{ prompt: any; isUserPrompt: boolean } | null> {
    try {
      const response = await this.authFetch(`/api/projects/${projectId}/prompts/next`)
      if (!response.ok) {
        throw new Error('Failed to fetch next prompt')
      }
      const data = await response.json()

      if (!data.prompt) {
        return null
      }

      return {
        prompt: data.prompt,
        isUserPrompt: data.is_user_prompt
      }
    } catch (error) {
      console.error('Error getting next prompt:', error)
      return null
    }
  }

  /**
   * 标记提示为已交付
   */
  async markPromptAsDelivered(projectId: string, promptId: string, isUserPrompt: boolean): Promise<boolean> {
    try {
      const response = await this.authFetch(`/api/projects/${projectId}/prompts/next`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt_id: promptId,
          is_user_prompt: isUserPrompt
        })
      })

      if (!response.ok) {
        throw new Error('Failed to mark prompt as delivered')
      }

      return true
    } catch (error) {
      console.error('Error marking prompt as delivered:', error)
      return false
    }
  }

  /**
   * 移动到下一章节
   */
  async moveToNextChapter(projectId: string): Promise<boolean> {
    try {
      const promptState = await this.getProjectPromptState(projectId)
      if (!promptState) {
        return false
      }

      const chapters = await this.getActiveChapters()
      const currentChapterIndex = chapters.findIndex(c => c.id === promptState.current_chapter_id)
      
      if (currentChapterIndex === -1 || currentChapterIndex >= chapters.length - 1) {
        // 已经是最后一个章节
        return false
      }

      const nextChapter = chapters[currentChapterIndex + 1]

      const { error } = await this.supabase
        .from('project_prompt_state')
        .update({
          current_chapter_id: nextChapter.id,
          current_prompt_index: 0,
          updated_at: new Date().toISOString()
        })
        .eq('project_id', projectId)

      if (error) {
        console.error('Error moving to next chapter:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error moving to next chapter:', error)
      return false
    }
  }

  /**
   * 检查章节是否完成
   */
  async isChapterCompleted(projectId: string, chapterId: string): Promise<boolean> {
    try {
      // 获取章节的所有提示
      const { data: prompts } = await this.supabase
        .from('prompts')
        .select('id')
        .eq('chapter_id', chapterId)
        .eq('is_active', true)

      if (!prompts || prompts.length === 0) {
        return true // 没有提示的章节视为已完成
      }

      // 检查是否所有提示都有对应的故事
      const promptIds = prompts.map(p => p.id)
      const { data: stories } = await this.supabase
        .from('stories')
        .select('prompt_id')
        .eq('project_id', projectId)
        .in('prompt_id', promptIds)

      const completedPromptIds = stories?.map(s => s.prompt_id) || []
      
      return promptIds.every(id => completedPromptIds.includes(id))
    } catch (error) {
      console.error('Error checking chapter completion:', error)
      return false
    }
  }
}

// Export singleton instance
export const chapterService = new ChapterService()
