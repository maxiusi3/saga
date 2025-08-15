'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface Project {
  id: string
  name: string
  description?: string
  status: 'active' | 'archived'
  created_at: string
}

export default function ProjectDetailPage() {
  const params = useParams()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (params.id) {
      loadProject(params.id as string);
    }
  }, [params.id]);

  const loadProject = async (projectId: string) => {
    try {
      setLoading(true);
      const response = await api.projects.get(projectId);
      setProject(response.data);
    } catch (error) {
      console.error('Failed to load project:', error);
      // Handle error - maybe redirect to projects list or show error message
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">加载中...</div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">项目未找到</div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <Link
          href="/dashboard/projects"
          className="text-blue-600 hover:text-blue-800"
        >
          ← 返回项目列表
        </Link>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          {project.name}
        </h1>
        
        {project.description && (
          <p className="text-gray-600 mb-6">{project.description}</p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link
            href={`/dashboard/projects/${project.id}/stories`}
            className="block p-4 border rounded-lg hover:bg-gray-50"
          >
            <h3 className="font-semibold text-gray-900">故事</h3>
            <p className="text-gray-600 text-sm">查看和管理故事</p>
          </Link>

          <Link
            href={`/dashboard/projects/${project.id}/invite`}
            className="block p-4 border rounded-lg hover:bg-gray-50"
          >
            <h3 className="font-semibold text-gray-900">邀请</h3>
            <p className="text-gray-600 text-sm">邀请家庭成员</p>
          </Link>

          <Link
            href={`/dashboard/projects/${project.id}/settings`}
            className="block p-4 border rounded-lg hover:bg-gray-50"
          >
            <h3 className="font-semibold text-gray-900">设置</h3>
            <p className="text-gray-600 text-sm">项目设置</p>
          </Link>
        </div>
      </div>
    </div>
  )
}
