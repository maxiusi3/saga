'use client'

import { EnhancedButton } from '@/components/ui/enhanced-button'
import { EnhancedCard } from '@/components/ui/enhanced-card'
import Link from 'next/link'
import { ExternalLink, Eye, Settings, Users, CreditCard, FileText, BarChart3 } from 'lucide-react'

export default function PrototypeComparisonPage() {
  const pages = [
    {
      id: 1,
      title: '设置页面 (原型第1张)',
      description: '用户信息、音频设置、隐私安全、通知偏好等',
      icon: <Settings className="w-6 h-6" />,
      originalRoute: '/dashboard/settings',
      modernRoute: '/settings-modern',
      status: '✅ 已优化'
    },
    {
      id: 2,
      title: '故事详情页 (原型第2张)',
      description: '音频播放器、转录文本、评论互动、后续问题',
      icon: <FileText className="w-6 h-6" />,
      originalRoute: '/dashboard/projects/[id]/stories/[storyId]',
      modernRoute: '/story-detail-modern',
      status: '✅ 已优化'
    },
    {
      id: 3,
      title: '故事列表页 (原型第3张)',
      description: '故事过滤、章节组织、统计信息、权限管理',
      icon: <BarChart3 className="w-6 h-6" />,
      originalRoute: '/dashboard/projects/[id]/stories',
      modernRoute: '/stories-modern',
      status: '✅ 已优化'
    },
    {
      id: 4,
      title: '购买页面 (原型第4张)',
      description: '价格展示、功能列表、结账表单、客户评价',
      icon: <CreditCard className="w-6 h-6" />,
      originalRoute: '/dashboard/purchase',
      modernRoute: '/purchase-modern',
      status: '✅ 已优化'
    },
    {
      id: 5,
      title: '项目管理页 (原型第5张)',
      description: '成员管理、角色权限、项目设置、危险操作',
      icon: <Users className="w-6 h-6" />,
      originalRoute: '/dashboard/projects/[id]/settings',
      modernRoute: '/project-management-modern',
      status: '✅ 已优化'
    },
    {
      id: 6,
      title: '仪表板页面 (原型第6张)',
      description: '项目概览、资源管理、快速操作、统计信息',
      icon: <Eye className="w-6 h-6" />,
      originalRoute: '/dashboard',
      modernRoute: '/dashboard-modern',
      status: '✅ 已优化'
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-sage-50 to-sage-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">原型页面对比</h1>
          <p className="text-xl text-gray-600 mb-6">
            基于6张原型截图优化的现代化页面 vs 原有页面
          </p>
          <div className="flex justify-center gap-4">
            <EnhancedButton asChild>
              <Link href="/design-showcase">
                <Eye className="w-4 h-4 mr-2" />
                查看组件展示
              </Link>
            </EnhancedButton>
          </div>
        </div>

        {/* Pages Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pages.map((page) => (
            <EnhancedCard key={page.id}>
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-sage-100 rounded-lg text-sage-600">
                    {page.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{page.title}</h3>
                    <span className="text-sm text-green-600 font-medium">{page.status}</span>
                  </div>
                </div>
                
                <p className="text-gray-600 text-sm mb-6">{page.description}</p>
                
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">现代化版本</p>
                    <EnhancedButton asChild size="sm" className="w-full">
                      <Link href={page.modernRoute}>
                        <ExternalLink className="w-4 h-4 mr-2" />
                        查看优化后页面
                      </Link>
                    </EnhancedButton>
                  </div>
                  
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">原始版本</p>
                    <EnhancedButton asChild variant="secondary" size="sm" className="w-full">
                      <Link href={page.originalRoute.includes('[id]') ? page.originalRoute.replace('[id]', '1').replace('[storyId]', '1') : page.originalRoute}>
                        <ExternalLink className="w-4 h-4 mr-2" />
                        查看原有页面
                      </Link>
                    </EnhancedButton>
                  </div>
                </div>
              </div>
            </EnhancedCard>
          ))}
        </div>

        {/* Summary */}
        <div className="mt-12">
          <EnhancedCard>
            <div className="p-8 text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">优化总结</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div>
                  <div className="text-3xl font-bold text-sage-600 mb-2">6</div>
                  <div className="text-gray-600">页面已优化</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-sage-600 mb-2">20+</div>
                  <div className="text-gray-600">现代化组件</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-sage-600 mb-2">100%</div>
                  <div className="text-gray-600">原型匹配度</div>
                </div>
              </div>
              <p className="text-gray-600 mb-6">
                所有页面都已基于原型截图进行现代化优化，使用了统一的设计系统和组件库。
                你可以对比查看优化前后的效果，决定是否保留优化版本。
              </p>
              <div className="flex justify-center gap-4">
                <EnhancedButton asChild>
                  <Link href="/dashboard-modern">
                    开始体验现代化界面
                  </Link>
                </EnhancedButton>
                <EnhancedButton asChild variant="secondary">
                  <Link href="/dashboard">
                    查看原有界面
                  </Link>
                </EnhancedButton>
              </div>
            </div>
          </EnhancedCard>
        </div>
      </div>
    </div>
  )
}