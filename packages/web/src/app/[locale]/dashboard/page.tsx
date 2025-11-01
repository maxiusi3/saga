'use client'

import { useState, useEffect } from 'react'
import { EnhancedButton } from "@/components/ui/enhanced-button"
import { StatsCard } from "@/components/ui/stats-card"
import { ProjectCard } from "@/components/ui/project-card"
import { EnhancedCard, EnhancedCardContent, EnhancedCardHeader, EnhancedCardTitle } from "@/components/ui/enhanced-card"
import { Users, BookOpen, Plus, Star, Lightbulb } from "lucide-react"
import { settingsService, ResourceWallet } from '@/services/settings-service'
import { projectService, ProjectWithMembers } from '@/lib/projects'
import { useAuthStore } from '@/stores/auth-store'
import { Skeleton } from '@/components/ui/skeleton'
import { useLocale, useTranslations } from 'next-intl'

export default function DashboardPage() {
  const { user } = useAuthStore()
  const locale = useLocale()
  const tDashboard = useTranslations('dashboard')
  const tCommon = useTranslations('common.actions')
  const withLocale = (path: string) => {
    if (!path.startsWith('/')) return path
    if (path === `/${locale}` || path.startsWith(`/${locale}/`)) return path
    return `/${locale}${path}`
  }
  const [projects, setProjects] = useState<ProjectWithMembers[]>([])
  const [resourceWallet, setResourceWallet] = useState<ResourceWallet | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadDashboardData = async () => {
      if (!user?.id) {
        console.log('Dashboard: No user ID, cannot load data')
        setProjects([])
        setResourceWallet(null)
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        console.log('Dashboard: Loading data for user:', user.id)
        
        // Load resource wallet with timeout
        console.log('Dashboard: Fetching wallet...')
        try {
          const walletPromise = settingsService.getResourceWallet()
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Wallet fetch timeout')), 5000)
          )
          const wallet = await Promise.race([walletPromise, timeoutPromise]) as any
          console.log('Dashboard: Wallet loaded:', wallet)
          setResourceWallet(wallet)
        } catch (walletError) {
          console.error('Dashboard: Wallet fetch failed:', walletError)
          // Set to null to show error state instead of fake data
          setResourceWallet(null)
        }

        // Try to load projects with timeout
        console.log('Dashboard: Fetching projects...')
        try {
          const projectsPromise = projectService.getUserProjects(user.id)
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Projects fetch timeout')), 5000)
          )
          const userProjects = await Promise.race([projectsPromise, timeoutPromise]) as any
          console.log('Dashboard: Projects loaded:', userProjects?.length || 0)
          setProjects(userProjects || [])
        } catch (projectError) {
          console.warn('Dashboard: Projects fetch failed:', projectError)
          setProjects([])
        }
      } catch (error) {
        console.error('Dashboard: Error loading data:', error)
        // Don't use fallback data - let it fail properly
        setProjects([])
        setResourceWallet(null)
      } finally {
        console.log('Dashboard: Setting loading to false')
        setLoading(false)
      }
    }

    loadDashboardData()
  }, [user?.id])

  const ownedProjects = projects.filter(p => p.is_owner)
  const participatingProjects = projects.filter(p => !p.is_owner)

  console.log('Dashboard: Render state:', {
    loading,
    hasUser: !!user,
    hasWallet: !!resourceWallet,
    projectsCount: projects.length,
    ownedCount: ownedProjects.length,
    participatingCount: participatingProjects.length
  })

  // Emergency fallback - if data loaded but still showing loading, force it off
  useEffect(() => {
    if (resourceWallet && projects.length >= 0 && loading) {
      console.log('Dashboard: Force setting loading to false')
      setLoading(false)
    }
  }, [resourceWallet, projects, loading])

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
    <div className="min-h-screen bg-background" style={{ minHeight: '100vh', backgroundColor: 'var(--background, #ffffff)' }}>
      {/* Header */}
      <div className="border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center">
                <BookOpen className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  {tDashboard('page.welcome', { name: user?.user_metadata?.name || user?.email?.split('@')[0] || 'User' })}
                </h1>
                <p className="text-muted-foreground">
                  {projects.length} {tDashboard('welcomeHeader.metrics.projects')} • {resourceWallet?.facilitator_seats || 0} {tDashboard('welcomeHeader.metrics.facilitatorSeats')} • {resourceWallet?.storyteller_seats || 0} {tDashboard('welcomeHeader.metrics.storytellerSeats')}
                </p>
              </div>
            </div>
            <EnhancedButton 
              size="lg"
              rightIcon={<Plus className="h-5 w-5" />}
              className="bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90"
              onClick={() => window.location.href = withLocale('/dashboard/projects/create')}
            >
              {tDashboard('actions.createNewSaga')}
            </EnhancedButton>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        <div className="space-y-8">
            {/* Resource Overview */}
            <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-foreground">{tDashboard('sections.yourResources')}</h2>
                <EnhancedButton 
                  variant="outline" 
                  size="sm"
                  onClick={() => window.location.href = withLocale('/dashboard/purchase')}
                >
                  {tCommon('purchaseMore')}
                </EnhancedButton>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatsCard
                  title={tDashboard('welcomeHeader.metrics.projectVouchers')}
                  value={`${resourceWallet?.project_vouchers || 0}/1`}
                  description={tDashboard('resources.availableProjectVouchers')}
                  icon={<BookOpen className="w-5 h-5" />}
                  variant="info"
                  className="bg-gradient-to-br from-info/5 to-info/10"
                />
                <StatsCard
                  title={tDashboard('welcomeHeader.metrics.facilitatorSeats')}
                  value={`${resourceWallet?.facilitator_seats || 0}/2`}
                  description={tDashboard('resources.availableFacilitatorSeats')}
                  icon={<Users className="w-5 h-5" />}
                  variant="success"
                  className="bg-gradient-to-br from-success/5 to-success/10"
                />
                <StatsCard
                  title={tDashboard('welcomeHeader.metrics.storytellerSeats')}
                  value={`${resourceWallet?.storyteller_seats || 0}/2`}
                  description={tDashboard('resources.availableStorytellerSeats')}
                  icon={<Star className="w-5 h-5" />}
                  variant="warning"
                  className="bg-gradient-to-br from-warning/5 to-warning/10"
                />
              </div>
            </section>

            {/* My Projects */}
            <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-foreground">{tDashboard('sections.myProjects')}</h2>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{tDashboard('page.ownedCount', { count: ownedProjects.length })}</span>
                </div>
              </div>
              
              {ownedProjects.length === 0 ? (
                <EnhancedCard className="p-8 text-center bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                  <div className="space-y-4">
                    <div className="text-4xl mb-4">{tDashboard('page.empty.owned.emoji')}</div>
                    <h3 className="text-lg font-semibold text-foreground">{tDashboard('page.empty.owned.title')}</h3>
                    <p className="text-muted-foreground">{tDashboard('page.empty.owned.subtitle')}</p>
                    <EnhancedButton 
                      onClick={() => window.location.href = withLocale('/dashboard/projects/create')}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      {tDashboard('actions.createNewSaga')}
                    </EnhancedButton>
                  </div>
                </EnhancedCard>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {ownedProjects.map((project) => (
                    <ProjectCard
                      key={project.id}
                      id={project.id}
                      title={project.name}
                      description={project.description || ''}
                      createdAt={new Date(project.created_at).toLocaleDateString(locale, { month: 'long', year: 'numeric' })}
                      storyCount={project.story_count}
                      status={project.status as 'active' | 'archived'}
                      members={project.members.map(m => ({
                        id: m.id,
                        name: `User ${m.user_id.slice(0, 8)}`,
                        role: m.role as 'owner' | 'facilitator' | 'storyteller',
                        status: m.status as 'active' | 'pending'
                      }))}
                      isOwner={project.is_owner}
                      onEnter={() => window.location.href = withLocale(`/dashboard/projects/${project.id}`)}
                      onManage={() => window.location.href = withLocale(`/dashboard/projects/${project.id}/settings`)}
                      onMore={() => console.log('More options:', project.id)}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Participating Projects */}
            <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-foreground">{tDashboard('sections.projectsImIn')}</h2>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{tDashboard('page.participatingCount', { count: participatingProjects.length })}</span>
                </div>
              </div>
              
              {participatingProjects.length === 0 ? (
                <EnhancedCard className="p-8 text-center">
                  <div className="space-y-4">
                    <div className="text-4xl mb-4">{tDashboard('page.empty.participating.emoji')}</div>
                    <h3 className="text-lg font-semibold text-foreground">{tDashboard('page.empty.participating.title')}</h3>
                    <p className="text-muted-foreground">{tDashboard('page.empty.participating.subtitle')}</p>
                  </div>
                </EnhancedCard>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {participatingProjects.map((project) => (
                    <ProjectCard
                      key={project.id}
                      id={project.id}
                      title={project.name}
                      description={project.description || ''}
                      createdAt={new Date(project.created_at).toLocaleDateString(locale, { month: 'long', year: 'numeric' })}
                      storyCount={project.story_count}
                      status={project.status as 'active' | 'archived'}
                      members={project.members.map(m => ({
                        id: m.id,
                        name: `User ${m.user_id.slice(0, 8)}`,
                        role: m.role as 'owner' | 'facilitator' | 'storyteller',
                        status: m.status as 'active' | 'pending'
                      }))}
                      isOwner={project.is_owner}
                      onEnter={() => window.location.href = withLocale(`/dashboard/projects/${project.id}`)}
                      onMore={() => console.log('More options:', project.id)}
                    />
                  ))}
                </div>
              )}
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
                      <EnhancedCardTitle>{tDashboard('page.quickActions.title')}</EnhancedCardTitle>
                      <p className="text-sm text-muted-foreground">{tDashboard('page.quickActions.subtitle')}</p>
                    </div>
                  </div>
                </EnhancedCardHeader>
                <EnhancedCardContent>
                  <div className="flex flex-wrap gap-3">
                    <EnhancedButton variant="default" size="sm">
                      {tDashboard('page.quickActions.recordStory')}
                    </EnhancedButton>
                    <EnhancedButton variant="outline" size="sm">
                      {tDashboard('page.quickActions.reviewPending')}
                    </EnhancedButton>
                  </div>
                </EnhancedCardContent>
              </EnhancedCard>
            </section>
        </div>
      </div>
    </div>
  )
}