'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ArrowLeft, BookOpen, Users, Sparkles, Crown, Mic } from 'lucide-react'
import Link from 'next/link'
import { useAuthStore } from '@/stores/auth-store'
import { projectService } from '@/lib/projects'
import { useResourceWallet } from '@/hooks/use-resource-wallet'
import { toast } from 'react-hot-toast'

export default function CreateProjectPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const { wallet, loading: walletLoading, hasResources } = useResourceWallet()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    theme: 'family-memories',
    role: 'storyteller' // 默认选择 storyteller
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user?.id) {
      console.error('User not authenticated')
      return
    }

    // 检查资源余额
    if (!wallet) {
      toast.error('无法获取资源余额信息')
      return
    }

    // 检查项目券
    if (!hasResources('project_vouchers', 1)) {
      // 资源不足时引导到购买页面
      toast.error('项目额度不足，前往购买更多资源')
      router.push('/dashboard/purchase')
      return
    }

    // 检查角色席位
    const seatType = formData.role === 'facilitator' ? 'facilitator_seats' : 'storyteller_seats'
    if (!hasResources(seatType, 1)) {
      toast.error(`${formData.role === 'facilitator' ? 'Facilitator' : 'Storyteller'}席位不足，前往购买更多资源`)
      router.push('/dashboard/purchase')
      return
    }

    setLoading(true)

    try {
      console.log('Creating project:', formData)

      // 使用数据库函数创建项目并消耗资源
      const project = await projectService.createProjectWithRole({
        name: formData.name,
        description: formData.description,
        facilitator_id: user.id,
        role: formData.role as 'facilitator' | 'storyteller'
      })

      if (project) {
        console.log('Project created successfully:', project)
        toast.success('项目创建成功！')
        // 重定向到新创建的项目页面
        router.push(`/dashboard/projects/${project.id}`)
      } else {
        throw new Error('Failed to create project')
      }
    } catch (error: any) {
      console.error('Error creating project:', error)

      // 处理特定的错误消息
      if (error.message?.includes('Insufficient project vouchers')) {
        toast.error('项目额度不足，无法创建新项目')
      } else if (error.message?.includes('Insufficient')) {
        toast.error('席位不足，无法创建项目')
      } else {
        toast.error('创建项目失败，请重试')
      }
      setLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const themes = [
    {
      id: 'family-memories',
      name: 'Family Memories',
      description: 'Capture stories from different generations',
      icon: '👨‍👩‍👧‍👦'
    },
    {
      id: 'life-journey',
      name: 'Life Journey',
      description: 'Document personal milestones and experiences',
      icon: '🛤️'
    },
    {
      id: 'cultural-heritage',
      name: 'Cultural Heritage',
      description: 'Preserve traditions and cultural stories',
      icon: '🏛️'
    },
    {
      id: 'professional-legacy',
      name: 'Professional Legacy',
      description: 'Share career experiences and wisdom',
      icon: '💼'
    }
  ]

  return (
    <div className="container max-w-2xl py-8">
      {/* Header */}
      <div className="flex items-center space-x-4 mb-8">
        <Link href="/dashboard/projects">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Projects
          </Button>
        </Link>
      </div>

      <div className="space-y-8">
        <div className="text-center space-y-4">
          <div className="text-6xl mb-4">🎭</div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-foreground">
              创建新的家族传记
            </h1>
            <p className="text-lg text-muted-foreground">
              开始记录您家族的珍贵故事
            </p>
          </div>
        </div>

        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center text-xl">
              <BookOpen className="w-5 h-5 mr-2 text-primary" />
              项目详情
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Project Name */}
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium">项目名称 *</Label>
                <Input
                  id="name"
                  placeholder="例如：张家族故事、爷爷的回忆录"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  required
                  className="focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              {/* Project Description */}
              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-medium">项目描述</Label>
                <Textarea
                  id="description"
                  placeholder="您想要记录什么样的故事？谁会参与其中？"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows={3}
                  className="focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                />
              </div>

              {/* Theme Selection */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">项目主题</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {themes.map((theme) => (
                    <div
                      key={theme.id}
                      className={`group p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                        formData.theme === theme.id
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-border hover:border-primary/50 hover:bg-muted/30'
                      }`}
                      onClick={() => handleInputChange('theme', theme.id)}
                    >
                      <div className="flex items-start space-x-3">
                        <div className="text-2xl group-hover:scale-110 transition-transform">{theme.icon}</div>
                        <div className="flex-1">
                          <h3 className="font-medium text-foreground group-hover:text-primary transition-colors">{theme.name}</h3>
                          <p className="text-sm text-muted-foreground mt-1">{theme.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Role Selection */}
              <div className="space-y-3">
                <Label>Your Role in This Project</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div
                    className={`p-4 border rounded-lg cursor-pointer transition-all ${
                      formData.role === 'storyteller'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => handleInputChange('role', 'storyteller')}
                  >
                    <div className="flex items-start space-x-3">
                      <Mic className="w-6 h-6 text-primary mt-1" />
                      <div>
                        <h3 className="font-medium text-foreground">Storyteller</h3>
                        <p className="text-sm text-muted-foreground">Record and share your stories</p>
                        <div className="mt-2 text-xs text-muted-foreground">
                          消耗: 1个Storyteller席位
                        </div>
                      </div>
                    </div>
                  </div>

                  <div
                    className={`p-4 border rounded-lg cursor-pointer transition-all ${
                      formData.role === 'facilitator'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => handleInputChange('role', 'facilitator')}
                  >
                    <div className="flex items-start space-x-3">
                      <Crown className="w-6 h-6 text-primary mt-1" />
                      <div>
                        <h3 className="font-medium text-foreground">Facilitator</h3>
                        <p className="text-sm text-muted-foreground">Manage project and invite others</p>
                        <div className="mt-2 text-xs text-muted-foreground">
                          消耗: 1个Facilitator席位
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Resource Status */}
              {wallet && (
                <div className="bg-muted/30 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-foreground mb-2">当前余额</h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="text-center">
                      <div className="font-medium text-foreground">{wallet.project_vouchers}</div>
                      <div className="text-muted-foreground">项目额度</div>
                    </div>
                    <div className="text-center">
                      <div className="font-medium text-foreground">{wallet.facilitator_seats}</div>
                      <div className="text-muted-foreground">Facilitator席位</div>
                    </div>
                    <div className="text-center">
                      <div className="font-medium text-foreground">{wallet.storyteller_seats}</div>
                      <div className="text-muted-foreground">Storyteller席位</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <div className="flex justify-end space-x-3 pt-6">
                <Link href="/dashboard/projects">
                  <Button variant="outline" type="button">
                    Cancel
                  </Button>
                </Link>
                <Button 
                  type="submit" 
                  disabled={!formData.name || loading}
                  className="min-w-[120px]"
                >
                  {loading ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Creating...
                    </div>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Create Project
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="bg-muted/50">
          <CardContent className="p-6">
            <div className="flex items-start space-x-3">
              <Users className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <h3 className="font-medium text-foreground mb-2">What happens next?</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• You'll be the project facilitator with full access</li>
                  <li>• Invite family members as storytellers</li>
                  <li>• Start recording and organizing stories</li>
                  <li>• Use AI to generate prompts and summaries</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
