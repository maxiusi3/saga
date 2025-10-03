'use client'

import { useState, useEffect } from 'react'
import { EnhancedButton } from "@/components/ui/enhanced-button"
import { StatsCard } from "@/components/ui/stats-card"
import { ProjectCard } from "@/components/ui/project-card"
import { EnhancedCard, EnhancedCardContent, EnhancedCardHeader, EnhancedCardTitle } from "@/components/ui/enhanced-card"
import { Users, BookOpen, Plus, TrendingUp, Clock, Star, Lightbulb } from "lucide-react"
import { settingsService, ResourceWallet } from '@/services/settings-service'
import { projectService, ProjectWithMembers } from '@/lib/projects'
import { useAuthStore } from '@/stores/auth-store'
import { Skeleton } from '@/components/ui/skeleton'

export default function DashboardPage() {
  const { user } = useAuthStore()
  const [projects, setProjects] = useState<ProjectWithMembers[]>([])
  const [resourceWallet, setResourceWallet] = useState<ResourceWallet | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadDashboardData = async () => {
      if (!user?.id) return

      try {
        setLoading(true)
        
        // Load projects and resource wallet in parallel
        const [userProjects, wallet] = await Promise.all([
          projectService.getUserProjects(user.id),
          settingsService.getResourceWallet()
        ])

        setProjects(userProjects || [])
        setResourceWallet(wallet)
      } catch (error) {
        console.error('Error loading dashboard data:', error)
        // Use mock data as fallback
        setProjects(mockProjects)
        setResourceWallet({
          user_id: user.id,
          project_vouchers: 2,
          facilitator_seats: 3,
          storyteller_seats: 7
        })
      } finally {
        setLoading(false)
      }
    }

    loadDashboardData()
  }, [user?.id])
  // Mock data based on prototype
  const mockProjects = [
    {
      id: '1',
      title: "Grandma's Memoir",
      description: 'Recording grandma\'s life stories and family traditions',
      createdAt: 'December 2023',
      storyCount: 37,
      status: 'active' as const,
      members: [
        { id: '1', name: 'John', role: 'owner' as const, status: 'active' as const },
        { id: '2', name: 'Mike', role: 'facilitator' as const, status: 'active' as const },
        { id: '3', name: 'Grandma Rose', role: 'storyteller' as const, status: 'active' as const }
      ],
      isOwner: true
    },
    {
      id: '2', 
      title: 'Family Legend Stories',
      description: 'Collecting and organizing family stories and legends',
      createdAt: 'November 2023',
      storyCount: 17,
      status: 'active' as const,
      members: [
        { id: '4', name: 'Sarah', role: 'owner' as const, status: 'active' as const },
        { id: '5', name: 'John', role: 'facilitator' as const, status: 'active' as const }
      ],
      isOwner: false
    },
    {
      id: '3',
      title: 'Childhood Summers',
      description: 'Memories of childhood and growing up experiences',
      createdAt: 'October 2023',
      storyCount: 27,
      status: 'active' as const,
      members: [
        { id: '6', name: 'Lisa', role: 'owner' as const, status: 'active' as const },
        { id: '7', name: 'John', role: 'facilitator' as const, status: 'active' as const }
      ],
      isOwner: false
    },
    {
      id: '4',
      title: "Mom's Story Collection",
      description: 'Recording mom\'s life experiences and wisdom sharing',
      createdAt: 'September 2023',
      storyCount: 17,
      status: 'completed' as const,
      members: [
        { id: '8', name: 'Mary', role: 'owner' as const, status: 'active' as const },
        { id: '9', name: 'John', role: 'facilitator' as const, status: 'active' as const }
      ],
      isOwner: false
    }
  ]

  const ownedProjects = projects.filter(p => p.is_owner)
  const participatingProjects = projects.filter(p => !p.is_owner)

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b border-border bg-background/95 backdrop-blur-sm">
          <div className="container mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Skeleton className="w-10 h-10 rounded-xl" />
                <div>
                  <Skeleton className="h-8 w-48 mb-2" />
                  <Skeleton className="h-4 w-64" />
                </div>
              </div>
              <Skeleton className="h-10 w-40" />
            </div>
          </div>
        </div>
        <div className="container mx-auto px-6 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        </div>
      </div>
    )
  }

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
                <h1 className="text-2xl font-bold text-foreground">Welcome back, John</h1>
                <p className="text-muted-foreground">2 projects • 1 facilitator • 3 storytellers available</p>
              </div>
            </div>
            <EnhancedButton 
              size="lg"
              rightIcon={<Plus className="h-5 w-5" />}
              className="bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90"
            >
              Create New Saga
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
                <h2 className="text-xl font-semibold text-foreground">Your Resources</h2>
                <EnhancedButton variant="outline" size="sm">
                  Purchase More
                </EnhancedButton>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatsCard
                  title="Available Projects"
                  value={`${projects.length}/${(resourceWallet?.project_vouchers || 0) + projects.length}`}
                  description="Remaining project quota"
                  icon={<BookOpen className="w-5 h-5" />}
                  variant="info"
                  className="bg-gradient-to-br from-info/5 to-info/10"
                />
                <StatsCard
                  title="Facilitator Seats"
                  value={`${Math.max(0, 4 - (resourceWallet?.facilitator_seats || 0))}/${4}`}
                  description="Can invite facilitators"
                  icon={<Users className="w-5 h-5" />}
                  variant="success"
                  className="bg-gradient-to-br from-success/5 to-success/10"
                />
                <StatsCard
                  title="Storyteller Seats"
                  value={`${Math.max(0, 10 - (resourceWallet?.storyteller_seats || 0))}/${10}`}
                  description="Can invite storytellers"
                  icon={<Star className="w-5 h-5" />}
                  variant="warning"
                  className="bg-gradient-to-br from-warning/5 to-warning/10"
                />
              </div>
            </section>

            {/* My Projects */}
            <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-foreground">My Projects</h2>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{ownedProjects.length} projects</span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {ownedProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    id={project.id}
                    title={project.name}
                    description={project.description || 'No description'}
                    createdAt={new Date(project.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    storyCount={project.story_count}
                    status={project.status as 'active' | 'completed'}
                    members={project.members.map(m => ({
                      id: m.id,
                      name: `User ${m.user_id.slice(0, 8)}`,
                      role: m.role as 'owner' | 'facilitator' | 'storyteller',
                      status: m.status as 'active' | 'pending'
                    }))}
                    isOwner={project.is_owner}
                    onEnter={() => window.location.href = `/dashboard/projects/${project.id}`}
                    onManage={() => window.location.href = `/dashboard/projects/${project.id}/settings`}
                    onMore={() => console.log('More options:', project.id)}
                  />
                ))}
              </div>
            </section>

            {/* Participating Projects */}
            <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-foreground">Projects I'm In</h2>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{participatingProjects.length} projects</span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {participatingProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    id={project.id}
                    title={project.name}
                    description={project.description || 'No description'}
                    createdAt={new Date(project.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    storyCount={project.story_count}
                    status={project.status as 'active' | 'completed'}
                    members={project.members.map(m => ({
                      id: m.id,
                      name: `User ${m.user_id.slice(0, 8)}`,
                      role: m.role as 'owner' | 'facilitator' | 'storyteller',
                      status: m.status as 'active' | 'pending'
                    }))}
                    isOwner={project.is_owner}
                    onEnter={() => window.location.href = `/dashboard/projects/${project.id}`}
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
                      <EnhancedCardTitle>Quick Actions</EnhancedCardTitle>
                      <p className="text-sm text-muted-foreground">Based on your role, these are actions you can perform.</p>
                    </div>
                  </div>
                </EnhancedCardHeader>
                <EnhancedCardContent>
                  <div className="flex flex-wrap gap-3">
                    <EnhancedButton variant="default" size="sm">
                      Record Story
                    </EnhancedButton>
                    <EnhancedButton variant="outline" size="sm">
                      Review Pending Stories
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
                  Resource Details
                </EnhancedCardTitle>
              </EnhancedCardHeader>
              <EnhancedCardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total Projects</span>
                    <span className="font-medium">{projects.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Used {projects.length}/{(resourceWallet?.project_vouchers || 0) + projects.length}</span>
                    <span className="text-sm text-success">{resourceWallet?.project_vouchers || 0} remaining</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="bg-gradient-to-r from-primary to-secondary h-2 rounded-full" style={{ width: `${Math.min(100, (projects.length / ((resourceWallet?.project_vouchers || 0) + projects.length)) * 100)}%` }}></div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Facilitator Seats</span>
                    <span className="font-medium">{Math.max(0, 4 - (resourceWallet?.facilitator_seats || 0))}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Used {Math.max(0, 4 - (resourceWallet?.facilitator_seats || 0))}/4</span>
                    <span className="text-sm text-success">{resourceWallet?.facilitator_seats || 0} remaining</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="bg-gradient-to-r from-secondary to-primary h-2 rounded-full" style={{ width: `${Math.min(100, ((4 - (resourceWallet?.facilitator_seats || 0)) / 4) * 100)}%` }}></div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Storyteller Seats</span>
                    <span className="font-medium">{Math.max(0, 10 - (resourceWallet?.storyteller_seats || 0))}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Used {Math.max(0, 10 - (resourceWallet?.storyteller_seats || 0))}/10</span>
                    <span className="text-sm text-success">{resourceWallet?.storyteller_seats || 0} remaining</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="bg-gradient-to-r from-warning to-success h-2 rounded-full" style={{ width: `${Math.min(100, ((10 - (resourceWallet?.storyteller_seats || 0)) / 10) * 100)}%` }}></div>
                  </div>
                </div>
              </EnhancedCardContent>
            </EnhancedCard>

            {/* Usage History */}
            <EnhancedCard>
              <EnhancedCardHeader>
                <EnhancedCardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-secondary" />
                  Usage History
                </EnhancedCardTitle>
              </EnhancedCardHeader>
              <EnhancedCardContent className="space-y-3">
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">This month</span>
                    <span className="font-medium">6 seats</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Last month</span>
                    <span className="font-medium">4 seats</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Average</span>
                    <span className="font-medium">5 seats</span>
                  </div>
                </div>
                
                <EnhancedButton variant="outline" size="sm" className="w-full">
                  Purchase Resources
                </EnhancedButton>
              </EnhancedCardContent>
            </EnhancedCard>
          </div>
        </div>
      </div>
    </div>
  )
}