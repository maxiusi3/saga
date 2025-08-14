// 简化的API客户端
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

class ApiClient {
  private baseURL: string

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL
  }

  async request(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseURL}${endpoint}`
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    })

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`)
    }

    return response.json()
  }

  // 用户相关
  async getUser(id: string) {
    return this.request(`/api/users/${id}`)
  }

  async updateUser(id: string, data: any) {
    return this.request(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  // 项目相关
  async getProjects() {
    return this.request('/api/projects')
  }

  async createProject(data: any) {
    return this.request('/api/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async getProject(id: string) {
    return this.request(`/api/projects/${id}`)
  }

  // 故事相关
  async getStories(projectId: string) {
    return this.request(`/api/projects/${projectId}/stories`)
  }

  async createStory(projectId: string, data: any) {
    return this.request(`/api/projects/${projectId}/stories`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }
}

export const api = new ApiClient()
export const apiClient = api
export default api
