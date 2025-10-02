'use client'

import { EnhancedButton } from "@/components/ui/enhanced-button"
import { StatsCard } from "@/components/ui/stats-card"
import { ProjectCard } from "@/components/ui/project-card"
import { EnhancedCard, EnhancedCardContent, EnhancedCardHeader, EnhancedCardTitle } from "@/components/ui/enhanced-card"
import { Users, BookOpen, Settings, Plus, TrendingUp, Clock, Star, Lightbulb } from "lucide-react"

export default function ModernDashboardPage() {
  // Mock data based on prototype
  const mockProjects = [
    {
      id: '1',
      title: '奶奶的回忆录',
      description: '记录奶奶的人生故事和家族传统',
      createdAt: '2023年12月',
      storyCount: 37,
      status: 'active' as const,
      members: [
        { id: '1', name: '张伟', role: 'owner' as const, status: 'active' as const },
        { id: '2', name: '李明', role: 'facilitator' as const, status: 'active' as const },
        { id: '3', name: '王奶奶', role: 'storyteller' as const, status: 'active' as const }
      ],
      isOwner: true
    },
    {
      id: '2', 
      title: '家族传说故事',
      description: '收集和整理家族中流传的故事和传说',
      createdAt: '2023年11月',
      storyCount: 17,
      status: 'active' as const,
      members: [
        { id: '4', name: '陈红', role: 'owner' as const, status: 'active' as const },
        { id: '5', name: '张伟', role: 'facilitator' as const, status: 'active' as const }
      ],
      isOwner: false
    },
    {
      id: '3',
      title: '童年的夏天',
      description: '回忆童年时光和成长经历',
      createdAt: '2023年10月',
      storyCount: 27,
      status: 'active' as const,
      members: [
        { id: '6', name: '李华', role: 'owner' as const, status: 'active' as const },
        { id: '7', name: '张伟', role: 'facilitator' as const, status: 'active' as const }
      ],
      isOwner: false
    },
    {
      id: '4',
      title: '妈妈的故事集',
      description: '记录妈妈的人生经历和智慧分享',
      createdAt: '2023年9月',
      storyCount: 17,
      status: 'completed' as const,
      members: [
        { id: '8', name: '王红', role: 'owner' as const, status: 'active' as const },
        { id: '9', name: '张伟', role: 'facilitator' as const, status: 'active' as const }
      ],
      isOwner: false
    }
  ]

  const ownedProjects = mockProjects.filter(p => p.isOwner)
  const participatingProjects = mockProjects.filter(p => !p.isOwner)

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center">
                <BookOpen className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">欢迎回来，张伟</h1>
                <p className="text-muted-foreground">2个项目 • 1个协助者 • 3个故事讲述者 可用</p>
              </div>
            </div>
            <EnhancedButton 
              size="lg"
              rightIcon={<Plus className="h-5 w-5" />}
              className="bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90"
            >
              创建新Saga
            </EnhancedButton>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-3 space-y-8">
            {/* Resource Overview */}
            <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-foreground">您的资源</h2>
                <EnhancedButton variant="outline" size="sm">
                  购买更多
                </EnhancedButton>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatsCard
                  title="可用项目数量"
                  value="2/5"
                  description="剩余项目配额"
                  icon={<BookOpen className="w-5 h-5" />}
                  variant="info"
                  className="bg-gradient-to-br from-info/5 to-info/10"
                />
                <StatsCard
                  title="协助者席位"
                  value="1/4"
                  description="可邀请协助者"
                  icon={<Users className="w-5 h-5" />}
                  variant="success"
                  className="bg-gradient-to-br from-success/5 to-success/10"
                />
                <StatsCard
                  title="讲述者席位"
                  value="3/10"
                  description="可邀请讲述者"
                  icon={<Star className="w-5 h-5" />}
                  variant="warning"
                  className="bg-gradient-to-br from-warning/5 to-warning/10"
                />
              </div>
            </section>

            {/* My Projects */}
            <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-foreground">我拥有的项目</h2>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{ownedProjects.length} 个项目</span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {ownedProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    {...project}
                    onEnter={() => console.log('Enter project:', project.id)}
                    onManage={() => console.log('Manage project:', project.id)}
                    onMore={() => console.log('More options:', project.id)}
                  />
                ))}
              </div>
            </section>

            {/* Participating Projects */}
            <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-foreground">我参与的项目</h2>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{participatingProjects.length} 个项目</span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {participatingProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    {...project}
                    onEnter={() => console.log('Enter project:', project.id)}
                    onMore={() => console.log('More options:', project.id)}
                  />
                ))}
              </div>
            </section>

            {/* Quick Actions */}
            <section>
              <EnhancedCard className="bg-gradient-to-br from-primary/5 to-secondary/5 border-primary/20">
                <EnhancedCardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-lg flex items-center justify-center">
                      <Lightbulb className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <EnhancedCardTitle>快速操作</EnhancedCardTitle>
                      <p className="text-sm text-muted-foreground">基于您的角色，这些是您可以执行的操作。</p>
                    </div>
                  </div>
                </EnhancedCardHeader>
                <EnhancedCardContent>
                  <div className="flex flex-wrap gap-3">
                    <EnhancedButton variant="default" size="sm">
                      快速录制故事
                    </EnhancedButton>
                    <EnhancedButton variant="outline" size="sm">
                      查看待审核故事
                    </EnhancedButton>
                  </div>
                </EnhancedCardContent>
              </EnhancedCard>
            </section>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Resource Management */}
            <EnhancedCard>
              <EnhancedCardHeader>
                <EnhancedCardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  资源管理详情
                </EnhancedCardTitle>
              </EnhancedCardHeader>
              <EnhancedCardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">项目总数</span>
                    <span className="font-medium">2</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">已使用 2/5</span>
                    <span className="text-sm text-success">剩余 3</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="bg-gradient-to-r from-primary to-secondary h-2 rounded-full w-2/5"></div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">协助者席位</span>
                    <span className="font-medium">1</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">已使用 1/4</span>
                    <span className="text-sm text-success">剩余 3</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="bg-gradient-to-r from-secondary to-primary h-2 rounded-full w-1/4"></div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">讲述者席位</span>
                    <span className="font-medium">3</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">已使用 3/10</span>
                    <span className="text-sm text-success">剩余 7</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="bg-gradient-to-r from-warning to-success h-2 rounded-full w-3/10"></div>
                  </div>
                </div>
              </EnhancedCardContent>
            </EnhancedCard>

            {/* Usage History */}
            <EnhancedCard>
              <EnhancedCardHeader>
                <EnhancedCardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-secondary" />
                  使用历史
                </EnhancedCardTitle>
              </EnhancedCardHeader>
              <EnhancedCardContent className="space-y-3">
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">本月</span>
                    <span className="font-medium">6 个席位</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">上月</span>
                    <span className="font-medium">4 个席位</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">平均</span>
                    <span className="font-medium">5 个席位</span>
                  </div>
                </div>
                
                <EnhancedButton variant="outline" size="sm" className="w-full">
                  购买资源
                </EnhancedButton>
              </EnhancedCardContent>
            </EnhancedCard>
          </div>
        </div>
      </div>
    </div>
  )
}