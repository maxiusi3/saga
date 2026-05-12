// 统一的Supabase API客户端 - 完全替换混合模式
import { supabaseApi } from './api-supabase'
import { httpApi, type ApiRequestOptions, type ApiResponse } from './api-http'

// 为了向后兼容，保持原有的API接口结构
// 所有调用都委托给统一的Supabase API客户端

class ApiClient {
  get<T = any>(path: string, options?: ApiRequestOptions): Promise<ApiResponse<T>> {
    return httpApi.get<T>(path, options)
  }

  post<T = any>(path: string, body?: unknown, options?: ApiRequestOptions): Promise<ApiResponse<T>> {
    return httpApi.post<T>(path, body, options)
  }

  put<T = any>(path: string, body?: unknown, options?: ApiRequestOptions): Promise<ApiResponse<T>> {
    return httpApi.put<T>(path, body, options)
  }

  patch<T = any>(path: string, body?: unknown, options?: ApiRequestOptions): Promise<ApiResponse<T>> {
    return httpApi.patch<T>(path, body, options)
  }

  delete<T = any>(path: string, options?: ApiRequestOptions): Promise<ApiResponse<T>> {
    return httpApi.delete<T>(path, options)
  }

  // 认证相关 - 完全使用Supabase Auth
  auth = {
    signin: async (email: string, password: string) => {
      const result = await supabaseApi.auth.signIn(email, password)
      return { data: result }
    },

    signup: async (userData: { name: string; email: string; password: string }) => {
      const result = await supabaseApi.auth.signUp(userData)
      return { data: result }
    },

    signout: async () => {
      await supabaseApi.auth.signOut()
      return { success: true }
    },

    profile: async () => {
      const user = await supabaseApi.auth.getCurrentUser()
      return { data: { data: user } }
    }
  }

  // 项目管理 - 使用Supabase
  projects = {
    list: async () => {
      const projects = await supabaseApi.projects.list()
      return { data: projects }
    },

    get: async (projectId: string) => {
      const project = await supabaseApi.projects.get(projectId)
      return { data: project }
    },

    create: async (projectData: { title: string; description?: string }) => {
      const project = await supabaseApi.projects.create({
        name: projectData.title,
        description: projectData.description || ''
      })
      return { data: project }
    },

    update: async (projectId: string, updates: { name?: string; description?: string }) => {
      const project = await supabaseApi.projects.update(projectId, updates)
      return { data: project }
    },

    delete: async (projectId: string) => {
      return httpApi.delete(`/projects/${projectId}`)
    },

    stats: async (projectId: string) => {
      return httpApi.get(`/projects/${projectId}/stats`)
    },

    generateInvitation: async (
      projectId: string,
      data: { email: string; role: 'facilitator' | 'storyteller'; message?: string },
    ) => {
      return httpApi.post(`/projects/${projectId}/invitations`, data)
    },

    getMembers: async (projectId: string) => {
      const response = await httpApi.get(`/projects/${projectId}/members`)
      return response.data?.data ?? response.data
    },

    removeMember: async (projectId: string, userId: string) => {
      return httpApi.delete(`/projects/${projectId}/members/${userId}`)
    }
  }

  // 资源钱包管理 - 使用Supabase
  wallets = {
    me: async () => {
      const wallet = await supabaseApi.wallet.get()
      return { data: wallet }
    },

    transactions: async (limit = 20, offset = 0) => {
      const transactions = await supabaseApi.wallet.getTransactions(limit, offset)
      return { data: transactions }
    }
  }

  // 邀请管理 - 使用Supabase
  invitations = {
    send: async (projectId: string, email: string, role: 'facilitator' | 'storyteller') => {
      const invitation = await supabaseApi.invitations.send(projectId, email, role)
      return { data: invitation }
    },

    accept: async (token: string) => {
      const result = await supabaseApi.invitations.accept(token)
      return { data: result }
    },

    list: async (projectId?: string) => {
      const invitations = await supabaseApi.invitations.list(projectId)
      return { data: invitations }
    }
  }

  // 故事管理 - 使用Supabase
  stories = {
    list: async (projectId: string, params?: { page?: number; limit?: number }) => {
      const stories = await supabaseApi.stories.list(projectId)
      return { data: stories }
    },

    get: async (storyId: string) => {
      return httpApi.get(`/stories/${storyId}`)
    },

    create: async (projectOrStoryData: string | {
      project_id: string
      title: string
      content?: string
      audio_url?: string
      audio_duration?: number
    }, formData?: FormData) => {
      if (typeof projectOrStoryData === 'string') {
        return httpApi.post(`/projects/${projectOrStoryData}/stories`, formData)
      }

      const story = await supabaseApi.stories.create(projectOrStoryData)
      return { data: story }
    },

    update: async (storyId: string, updates: {
      title?: string
      content?: string
      transcript?: string
      status?: string
    }) => {
      const story = await supabaseApi.stories.update(storyId, updates)
      return { data: story }
    },

    delete: async (storyId: string) => {
      return httpApi.delete(`/stories/${storyId}`)
    },

    search: async (projectId: string, query: string) => {
      return httpApi.get(`/projects/${projectId}/stories/search`, {
        params: { q: query },
      })
    }
  }

  // 支付处理 - 保持Stripe集成，但使用Supabase存储
  payments = {
    purchasePackage: async (packageId: string, paymentIntentId: string) => {
      const result = await supabaseApi.payments.purchasePackage(packageId, paymentIntentId)
      return { data: result }
    }
  }

  // 数据导出 - 使用Supabase
  exports = {
    request: async (projectId: string, options: {
      includeAudio: boolean
      includePhotos: boolean
      includeTranscripts: boolean
      includeInteractions: boolean
    }) => {
      const exportId = await supabaseApi.exports.request(projectId, options)
      return { data: { exportId } }
    },

    status: async (exportId: string) => {
      const status = await supabaseApi.exports.getStatus(exportId)
      return { data: status }
    },

    list: async () => {
      return httpApi.get('/exports')
    },

    create: async (projectId: string, format = 'zip') => {
      return httpApi.post('/exports', { projectId, format })
    },

    download: async (exportId: string) => {
      return httpApi.get(`/exports/${exportId}/download`, { responseType: 'blob' })
    },

    get: async (exportId: string) => {
      return httpApi.get(`/exports/${exportId}`)
    }
  }

}

export const api = new ApiClient()
export const apiClient = api
export default api
