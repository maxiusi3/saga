// Supabase-integrated API客户端
import { createClientSupabase } from './supabase'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

class ApiClient {
  private baseURL: string
  private _supabase: ReturnType<typeof createClientSupabase> | null = null

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL
  }

  private get supabase() {
    if (!this._supabase) {
      this._supabase = createClientSupabase()
    }
    return this._supabase
  }

  private async getAuthHeaders() {
    const { data: { session } } = await this.supabase.auth.getSession()
    return session?.access_token ? {
      'Authorization': `Bearer ${session.access_token}`
    } : {}
  }

  async request(endpoint: string, options: RequestInit = {}) {
    const authHeaders = await this.getAuthHeaders()
    const url = `${this.baseURL}${endpoint}`
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
        ...options.headers,
      },
      ...options,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `API Error: ${response.status}`)
    }

    return response.json()
  }

  // 认证相关 - 使用Supabase
  auth = {
    signin: async (email: string, password: string) => {
      return this.supabase.auth.signInWithPassword({ email, password })
    },
    signup: async (data: { name: string; email: string; password: string }) => {
      return this.supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: { data: { name: data.name } }
      })
    },
    signout: async () => {
      return this.supabase.auth.signOut()
    },
    profile: async () => {
      const { data: { user } } = await this.supabase.auth.getUser()
      return { data: { data: user } }
    }
  }

  // 项目相关
  projects = {
    list: async () => {
      return this.request('/api/projects')
    },
    get: async (id: string) => {
      return this.request(`/api/projects/${id}`)
    },
    create: async (data: any) => {
      return this.request('/api/projects', {
        method: 'POST',
        body: JSON.stringify(data),
      })
    },
    update: async (id: string, data: any) => {
      return this.request(`/api/projects/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      })
    },
    delete: async (id: string) => {
      return this.request(`/api/projects/${id}`, {
        method: 'DELETE',
      })
    },
    stats: async (id: string) => {
      return this.request(`/api/projects/${id}/stats`)
    },
    generateInvitation: async (projectId: string, data: any) => {
      return this.request(`/api/projects/${projectId}/invitations`, {
        method: 'POST',
        body: JSON.stringify(data),
      })
    }
  }

  // 故事相关
  stories = {
    list: async (projectId: string, params?: any) => {
      const queryString = params ? `?${new URLSearchParams(params).toString()}` : ''
      return this.request(`/api/projects/${projectId}/stories${queryString}`)
    },
    get: async (id: string) => {
      return this.request(`/api/stories/${id}`)
    },
    create: async (projectId: string, formData: FormData) => {
      const authHeaders = await this.getAuthHeaders()
      const response = await fetch(`${this.baseURL}/api/projects/${projectId}/stories`, {
        method: 'POST',
        headers: authHeaders,
        body: formData,
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `API Error: ${response.status}`)
      }
      
      return response.json()
    },
    update: async (id: string, data: any) => {
      return this.request(`/api/stories/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      })
    },
    delete: async (id: string) => {
      return this.request(`/api/stories/${id}`, {
        method: 'DELETE',
      })
    },
    search: async (projectId: string, query: string) => {
      return this.request(`/api/projects/${projectId}/stories/search?q=${encodeURIComponent(query)}`)
    }
  }

  // 用户相关
  users = {
    get: async (id: string) => {
      return this.request(`/api/users/${id}`)
    },
    update: async (id: string, data: any) => {
      return this.request(`/api/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      })
    }
  }
}

export const api = new ApiClient()
export const apiClient = api
export default api
