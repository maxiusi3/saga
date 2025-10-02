'use client'

import { useState } from 'react'
import { EnhancedButton } from '@/components/ui/enhanced-button'
import { EnhancedCard } from '@/components/ui/enhanced-card'
import { ModernSwitch } from '@/components/ui/modern-switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { ArrowLeft, UserPlus, Trash2, Download, Share, RefreshCw, Settings, Users, Crown, Shield, Eye, Calendar, BarChart3, FileText, AlertTriangle, Copy, ExternalLink } from 'lucide-react'
import Link from 'next/link'

// Mock data for the project management page
const mockProject = {
  id: '1',
  title: '奶奶的回忆录',
  description: '记录奶奶一生的珍贵回忆和家族故事',
  created_at: '2024-01-15T10:00:00Z',
  is_owner: true,
  members: [
    {
      id: '1',
      user_id: 'user1',
      role: 'facilitator' as const,
      status: 'active',
      name: '张小明',
      email: 'xiaoming@example.com'
    },
    {
      id: '2', 
      user_id: 'user2',
      role: 'storyteller' as const,
      status: 'active',
      name: '李阿姨',
      email: 'liayi@example.com'
    },
    {
      id: '3',
      user_id: 'user3', 
      role: 'co_facilitator' as const,
      status: 'pending',
      name: '王叔叔',
      email: 'wangshu@example.com'
    }
  ]
}

const mockUser = {
  id: 'current-user',
  email: 'current@example.com'
}

export default function ProjectManagementModernPage() {
  const [projectTitle, setProjectTitle] = useState(mockProject.title)
  const [projectDescription, setProjectDescription] = useState(mockProject.description)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'storyteller' | 'co_facilitator' | 'facilitator'>('storyteller')
  const [saving, setSaving] = useState(false)
  const [inviting, setInviting] = useState(false)

  const handleSaveProjectDetails = async () => {
    setSaving(true)
    // Mock API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    setSaving(false)
    console.log('Project updated:', { title: projectTitle, description: projectDescription })
  }

  const handleInviteMember = async () => {
    if (!inviteEmail.trim()) return
    
    setInviting(true)
    // Mock API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    setInviting(false)
    setInviteEmail('')
    console.log('Member invited:', { email: inviteEmail, role: inviteRole })
  }

  const handleRemoveMember = async (memberId: string) => {
    console.log('Removing member:', memberId)
    // Mock API call
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  const handleUpdateRole = async (memberId: string, newRole: string) => {
    console.log('Updating role:', { memberId, newRole })
    // Mock API call
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  const handleExportArchive = async () => {
    setSaving(true)
    // Mock API call
    await new Promise(resolve => setTimeout(resolve, 2000))
    setSaving(false)
    console.log('Archive exported')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sage-50 to-sage-100">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/dashboard-modern">
            <EnhancedButton variant="secondary" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回项目
            </EnhancedButton>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">项目管理</h1>
            <p className="text-gray-600 mt-1">{mockProject.title}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <EnhancedCard>
              <div className="p-6">
                <h2 className="font-semibold text-gray-900 mb-4">快速操作</h2>
                <div className="space-y-3">
                  <EnhancedButton variant="secondary" size="sm" className="w-full justify-start">
                    <Users className="w-4 h-4 mr-2" />
                    邀请成员
                  </EnhancedButton>
                  <EnhancedButton variant="secondary" size="sm" className="w-full justify-start">
                    <Download className="w-4 h-4 mr-2" />
                    导出数据
                  </EnhancedButton>
                  <EnhancedButton variant="secondary" size="sm" className="w-full justify-start">
                    <Share className="w-4 h-4 mr-2" />
                    分享项目
                  </EnhancedButton>
                </div>

                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h3 className="font-medium text-gray-900 mb-3">项目统计</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">创建时间</span>
                      <span className="text-gray-900">{new Date(mockProject.created_at).toLocaleDateString('zh-CN')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">故事数量</span>
                      <span className="text-gray-900">12</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">成员数量</span>
                      <span className="text-gray-900">{mockProject.members.length + 1}</span>
                    </div>
                  </div>
                </div>
              </div>
            </EnhancedCard>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Project Overview */}
            <EnhancedCard>
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">项目概览</h2>
                  <Badge className="bg-green-100 text-green-800">活跃</Badge>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  <div className="text-center p-4 bg-sage-50 rounded-lg">
                    <Calendar className="w-8 h-8 text-sage-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-gray-900">{new Date(mockProject.created_at).toLocaleDateString('zh-CN')}</div>
                    <div className="text-sm text-gray-600">创建时间</div>
                  </div>
                  <div className="text-center p-4 bg-sage-50 rounded-lg">
                    <FileText className="w-8 h-8 text-sage-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-gray-900">12</div>
                    <div className="text-sm text-gray-600">故事数量</div>
                  </div>
                  <div className="text-center p-4 bg-sage-50 rounded-lg">
                    <Users className="w-8 h-8 text-sage-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-gray-900">{mockProject.members.length + 1}</div>
                    <div className="text-sm text-gray-600">成员数量</div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="project-title" className="text-sm font-medium text-gray-700">项目名称</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        id="project-title"
                        value={projectTitle}
                        onChange={(e) => setProjectTitle(e.target.value)}
                        className="flex-1"
                      />
                      <EnhancedButton
                        onClick={handleSaveProjectDetails}
                        disabled={saving || (projectTitle.trim() === mockProject.title && projectDescription.trim() === mockProject.description)}
                        size="sm"
                      >
                        {saving ? '保存中...' : '保存'}
                      </EnhancedButton>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="description" className="text-sm font-medium text-gray-700">项目描述</Label>
                    <Textarea
                      id="description"
                      value={projectDescription}
                      onChange={(e) => setProjectDescription(e.target.value)}
                      placeholder="为您的项目添加描述..."
                      className="mt-1"
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            </EnhancedCard>

            {/* Member Management */}
            <EnhancedCard>
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">成员管理</h2>
                  <EnhancedButton size="sm">
                    <UserPlus className="w-4 h-4 mr-2" />
                    邀请成员
                  </EnhancedButton>
                </div>

                {/* Invite Form */}
                <div className="bg-sage-50 rounded-lg p-4 mb-6">
                  <h3 className="font-medium text-gray-900 mb-3">邀请新成员</h3>
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="输入邮箱地址"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="flex-1"
                    />
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as any)}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sage-500"
                    >
                      <option value="storyteller">讲述者</option>
                      <option value="co_facilitator">协助者</option>
                      <option value="facilitator">管理者</option>
                    </select>
                    <EnhancedButton
                      onClick={handleInviteMember}
                      disabled={inviting || !inviteEmail.trim()}
                      size="sm"
                    >
                      {inviting ? '邀请中...' : '发送邀请'}
                    </EnhancedButton>
                  </div>
                </div>

                {/* Members List */}
                <div className="space-y-4">
                  {/* Project Owner */}
                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-lg">
                    <div className="flex items-center gap-4">
                      <Avatar className="w-12 h-12">
                        <AvatarFallback className="bg-amber-100 text-amber-700">
                          您
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium text-gray-900 flex items-center gap-2">
                          您 (所有者)
                          <Crown className="w-4 h-4 text-amber-500" />
                        </div>
                        <div className="text-sm text-gray-600">{mockUser.email}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-amber-100 text-amber-800">所有者</Badge>
                      <Badge className="bg-green-100 text-green-800">活跃</Badge>
                    </div>
                  </div>

                  {/* Project Members */}
                  {mockProject.members.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-4">
                        <Avatar className="w-12 h-12">
                          <AvatarFallback className="bg-sage-100 text-sage-700">
                            {member.name?.charAt(0) || 'M'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium text-gray-900 flex items-center gap-2">
                            {member.name}
                            {member.role === 'facilitator' && <Shield className="w-4 h-4 text-blue-500" />}
                            {member.role === 'storyteller' && <Users className="w-4 h-4 text-green-500" />}
                          </div>
                          <div className="text-sm text-gray-600">角色: {
                            member.role === 'facilitator' ? '管理者' :
                            member.role === 'co_facilitator' ? '协助者' :
                            member.role === 'storyteller' ? '讲述者' : member.role
                          }</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <Badge className={
                          member.role === 'facilitator' ? 'bg-blue-100 text-blue-800' :
                          member.role === 'co_facilitator' ? 'bg-purple-100 text-purple-800' :
                          'bg-green-100 text-green-800'
                        }>
                          {member.role === 'facilitator' ? '管理者' :
                           member.role === 'co_facilitator' ? '协助者' :
                           '讲述者'}
                        </Badge>
                        <Badge className={
                          member.status === 'active' ? 'bg-green-100 text-green-800' :
                          member.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }>
                          {member.status === 'active' ? '活跃' :
                           member.status === 'pending' ? '待接受' :
                           member.status}
                        </Badge>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          {member.status === 'active' && (
                            <select
                              value={member.role}
                              onChange={(e) => handleUpdateRole(member.id, e.target.value)}
                              className="text-xs px-2 py-1 border border-gray-300 rounded"
                            >
                              <option value="storyteller">讲述者</option>
                              <option value="co_facilitator">协助者</option>
                              <option value="facilitator">管理者</option>
                            </select>
                          )}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <EnhancedButton variant="destructive" size="sm">
                                <Trash2 className="h-4 w-4" />
                              </EnhancedButton>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>移除成员</AlertDialogTitle>
                                <AlertDialogDescription>
                                  确定要从项目中移除此成员吗？此操作无法撤销。
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>取消</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleRemoveMember(member.id)}
                                  className="bg-red-600 text-white hover:bg-red-700"
                                >
                                  移除
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </EnhancedCard>

            {/* Project Settings */}
            <EnhancedCard>
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">项目设置</h2>
                
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">项目可见性</p>
                      <p className="text-sm text-gray-600">控制谁可以查看此项目</p>
                    </div>
                    <ModernSwitch defaultChecked />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">允许评论</p>
                      <p className="text-sm text-gray-600">成员可以对故事进行评论</p>
                    </div>
                    <ModernSwitch defaultChecked />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">自动转录</p>
                      <p className="text-sm text-gray-600">自动将音频转换为文字</p>
                    </div>
                    <ModernSwitch defaultChecked />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">邮件通知</p>
                      <p className="text-sm text-gray-600">新故事时发送邮件通知</p>
                    </div>
                    <ModernSwitch />
                  </div>
                </div>
              </div>
            </EnhancedCard>

            {/* Data Management */}
            <EnhancedCard>
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">数据管理</h2>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-sage-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">导出完整档案</p>
                      <p className="text-sm text-gray-600">下载所有故事、转录和媒体文件</p>
                    </div>
                    <EnhancedButton
                      variant="secondary"
                      onClick={handleExportArchive}
                      disabled={saving}
                    >
                      {saving ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          导出中...
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4 mr-2" />
                          导出
                        </>
                      )}
                    </EnhancedButton>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">分享项目</p>
                      <p className="text-sm text-gray-600">生成分享链接给家庭成员</p>
                    </div>
                    <EnhancedButton variant="secondary">
                      <Share className="h-4 w-4 mr-2" />
                      分享
                    </EnhancedButton>
                  </div>
                </div>
              </div>
            </EnhancedCard>

            {/* Danger Zone */}
            <EnhancedCard>
              <div className="p-6">
                <h2 className="text-xl font-semibold text-red-600 mb-6 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  危险操作
                </h2>
                
                <div className="space-y-4">
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-red-900">转移项目所有权</p>
                        <p className="text-sm text-red-700">将项目所有权转移给其他成员</p>
                      </div>
                      <EnhancedButton variant="destructive" size="sm">
                        转移所有权
                      </EnhancedButton>
                    </div>
                  </div>

                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-red-900">删除项目</p>
                        <p className="text-sm text-red-700">永久删除此项目及所有相关数据</p>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <EnhancedButton variant="destructive" size="sm">
                            <Trash2 className="w-4 h-4 mr-2" />
                            删除项目
                          </EnhancedButton>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>删除项目</AlertDialogTitle>
                            <AlertDialogDescription>
                              此操作将永久删除项目及所有相关数据，包括故事、评论和媒体文件。此操作无法撤销。
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>取消</AlertDialogCancel>
                            <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700">
                              确认删除
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </div>
              </div>
            </EnhancedCard>
          </div>
        </div>
      </div>
    </div>
  )
}