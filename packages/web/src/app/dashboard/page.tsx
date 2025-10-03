'use client'

import { EnhancedButton } from "@/components/ui/enhanced-button"
import { StatsCard } from "@/components/ui/stats-card"
import { ProjectCard } from "@/components/ui/project-card"
import { EnhancedCard, EnhancedCardContent, EnhancedCardHeader, EnhancedCardTitle } from "@/components/ui/enhanced-card"
import { Users, BookOpen, Plus, TrendingUp, Clock, Star, Lightbulb } from "lucide-react"

export default function DashboardPage() {
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
                  value="2/5"
                  description="Remaining project quota"
                  icon={<BookOpen className="w-5 h-5" />}
                  variant="info"
                  className="bg-gradient-to-br from-info/5 to-info/10"
                />
                <StatsCard
                  title="Facilitator Seats"
                  value="1/4"
                  description="Can invite facilitators"
                  icon={<Users className="w-5 h-5" />}
                  variant="success"
                  className="bg-gradient-to-br from-success/5 to-success/10"
                />
                <StatsCard
                  title="Storyteller Seats"
                  value="3/10"
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
                <h2 className="text-xl font-semibold text-foreground">Projects I'm In</h2>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{participatingProjects.length} projects</span>
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
                    <span className="font-medium">2</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Used 2/5</span>
                    <span className="text-sm text-success">3 remaining</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="bg-gradient-to-r from-primary to-secondary h-2 rounded-full w-2/5"></div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Facilitator Seats</span>
                    <span className="font-medium">1</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Used 1/4</span>
                    <span className="text-sm text-success">3 remaining</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="bg-gradient-to-r from-secondary to-primary h-2 rounded-full w-1/4"></div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Storyteller Seats</span>
                    <span className="font-medium">3</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Used 3/10</span>
                    <span className="text-sm text-success">7 remaining</span>
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