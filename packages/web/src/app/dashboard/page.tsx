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
