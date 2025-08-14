#!/bin/bash

# 创建Saga MVP简化部署版本
# 专注于核心功能，快速上线

set -e

echo "🚀 创建Saga MVP简化部署版本"
echo "================================"

# 创建简化的Web应用
echo "📦 创建简化的Web应用..."

# 修复API导出
cat > packages/web/src/lib/api.ts << 'EOF'
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
export default api
EOF

# 创建简化的主页
cat > packages/web/src/app/page.tsx << 'EOF'
import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            Saga Family Biography
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            用AI技术记录和传承家庭故事，让每一个珍贵的回忆都得到完美保存。
          </p>
          
          <div className="space-x-4">
            <Link
              href="/auth/signin"
              className="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              开始使用
            </Link>
            <Link
              href="/auth/signup"
              className="inline-block border border-blue-600 text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
            >
              注册账户
            </Link>
          </div>
        </div>

        <div className="mt-16 grid md:grid-cols-3 gap-8">
          <div className="text-center p-6 bg-white rounded-lg shadow-sm">
            <div className="w-12 h-12 bg-blue-100 rounded-lg mx-auto mb-4 flex items-center justify-center">
              <span className="text-blue-600 text-xl">🎙️</span>
            </div>
            <h3 className="text-lg font-semibold mb-2">语音录制</h3>
            <p className="text-gray-600">简单录制家庭故事，AI自动转换为文字</p>
          </div>

          <div className="text-center p-6 bg-white rounded-lg shadow-sm">
            <div className="w-12 h-12 bg-green-100 rounded-lg mx-auto mb-4 flex items-center justify-center">
              <span className="text-green-600 text-xl">👨‍👩‍👧‍👦</span>
            </div>
            <h3 className="text-lg font-semibold mb-2">家庭协作</h3>
            <p className="text-gray-600">邀请家庭成员共同参与故事记录</p>
          </div>

          <div className="text-center p-6 bg-white rounded-lg shadow-sm">
            <div className="w-12 h-12 bg-purple-100 rounded-lg mx-auto mb-4 flex items-center justify-center">
              <span className="text-purple-600 text-xl">📚</span>
            </div>
            <h3 className="text-lg font-semibold mb-2">永久保存</h3>
            <p className="text-gray-600">安全存储，支持多种格式导出</p>
          </div>
        </div>
      </div>
    </div>
  )
}
EOF

# 创建简化的登录页面
cat > packages/web/src/app/auth/signin/page.tsx << 'EOF'
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function SignInPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    // 模拟登录
    setTimeout(() => {
      setLoading(false)
      router.push('/dashboard')
    }, 1000)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">登录账户</h2>
          <p className="mt-2 text-gray-600">继续您的家庭故事记录之旅</p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              邮箱地址
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              密码
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading ? '登录中...' : '登录'}
          </button>

          <div className="text-center">
            <Link href="/auth/signup" className="text-blue-600 hover:text-blue-500">
              还没有账户？立即注册
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
EOF

# 创建简化的注册页面
cat > packages/web/src/app/auth/signup/page.tsx << 'EOF'
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function SignUpPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  })
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (formData.password !== formData.confirmPassword) {
      alert('密码不匹配')
      return
    }

    setLoading(true)
    
    // 模拟注册
    setTimeout(() => {
      setLoading(false)
      router.push('/dashboard')
    }, 1000)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">创建账户</h2>
          <p className="mt-2 text-gray-600">开始记录您的家庭故事</p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              姓名
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              value={formData.name}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              邮箱地址
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              value={formData.email}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              密码
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              value={formData.password}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
              确认密码
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              value={formData.confirmPassword}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading ? '注册中...' : '注册'}
          </button>

          <div className="text-center">
            <Link href="/auth/signin" className="text-blue-600 hover:text-blue-500">
              已有账户？立即登录
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
EOF

# 创建简化的仪表板
cat > packages/web/src/app/dashboard/page.tsx << 'EOF'
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Project {
  id: string
  name: string
  description?: string
  storyCount: number
  lastActivity: string
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 模拟加载数据
    setTimeout(() => {
      setProjects([
        {
          id: '1',
          name: '我的家庭故事',
          description: '记录我们家庭的珍贵回忆',
          storyCount: 5,
          lastActivity: '2天前'
        },
        {
          id: '2',
          name: '爷爷的回忆录',
          description: '爷爷的人生故事',
          storyCount: 12,
          lastActivity: '1周前'
        }
      ])
      setLoading(false)
    }, 1000)
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">加载中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <h1 className="text-2xl font-bold text-gray-900">我的项目</h1>
            <Link
              href="/dashboard/projects/new"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              创建新项目
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {projects.length === 0 ? (
          <div className="text-center py-12">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              还没有项目
            </h3>
            <p className="text-gray-600 mb-6">
              创建您的第一个家庭故事项目
            </p>
            <Link
              href="/dashboard/projects/new"
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
            >
              创建项目
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/dashboard/projects/${project.id}`}
                className="block bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6"
              >
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {project.name}
                </h3>
                {project.description && (
                  <p className="text-gray-600 mb-4">{project.description}</p>
                )}
                <div className="flex justify-between text-sm text-gray-500">
                  <span>{project.storyCount} 个故事</span>
                  <span>最后活动: {project.lastActivity}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
EOF

echo "✅ 简化Web应用创建完成"

# 构建项目
echo "🔨 构建简化版本..."
npm run build --workspace=packages/web

echo "✅ MVP简化版本构建完成！"
echo ""
echo "📋 下一步操作:"
echo "1. 推送到GitHub"
echo "2. 在Vercel上部署"
echo "3. 配置环境变量"
echo ""
echo "🎉 简化MVP版本准备就绪！"