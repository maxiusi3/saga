'use client'

import { useState, useEffect } from 'react'
import { FurbridgeButton } from '@/components/ui/furbridge-button'
import { FurbridgeCard } from '@/components/ui/furbridge-card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Mic, Clock, CheckCircle } from 'lucide-react'
import Link from 'next/link'

interface Project {
  id: string
  title: string
  facilitator_name: string
  progress: number
  total_prompts: number
  completed_prompts: number
  last_activity: string
  status: 'active' | 'completed' | 'paused'
}

interface RecentPrompt {
  id: string
  text: string
  category: string
  estimated_time: number
}

export default function StorytellerHomePage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [recentPrompts, setRecentPrompts] = useState<RecentPrompt[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      // Mock data - replace with actual Supabase queries
      const mockProjects: Project[] = [
        {
          id: '1',
          title: "Dad's Life Story",
          facilitator_name: 'Alex Smith',
          progress: 65,
          total_prompts: 20,
          completed_prompts: 13,
          last_activity: '2024-01-20T10:30:00Z',
          status: 'active'
        }
      ]

      const mockPrompts: RecentPrompt[] = [
        {
          id: '1',
          text: 'Tell me about your first job. What was it like walking in on your first day?',
          category: 'Career',
          estimated_time: 5
        },
        {
          id: '2',
          text: 'What was your neighborhood like when you were growing up?',
          category: 'Childhood',
          estimated_time: 7
        },
        {
          id: '3',
          text: 'Describe a holiday tradition that was special to your family.',
          category: 'Family',
          estimated_time: 4
        }
      ]

      setTimeout(() => {
        setProjects(mockProjects)
        setRecentPrompts(mockPrompts)
        setLoading(false)
      }, 1000)
    }

    loadData()
  }, [])

  const formatLastActivity = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    
    if (diffInHours < 24) {
      return `${diffInHours} hours ago`
    } else {
      const diffInDays = Math.floor(diffInHours / 24)
      return `${diffInDays} days ago`
    }
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-100 rounded w-64"></div>
          <div className="h-4 bg-gray-100 rounded w-96"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <div key={i} className="h-48 bg-gray-100 rounded-lg animate-pulse"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, Storyteller!
        </h1>
        <p className="text-lg text-gray-600">
          Ready to share more of your story?
        </p>
      </div>

      {/* Active Projects */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold text-gray-900">Your Projects</h2>
        
        {projects.length === 0 ? (
          <FurbridgeCard className="p-8 text-center">
            <div className="space-y-4">
              <div className="text-6xl">📖</div>
              <h3 className="text-xl font-semibold text-gray-900">
                No Active Projects
              </h3>
              <p className="text-gray-600">
                You'll see your story projects here once a facilitator invites you.
              </p>
            </div>
          </FurbridgeCard>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {projects.map((project) => (
              <FurbridgeCard key={project.id} className="p-6">
                <div className="space-y-4">
                  {/* Project Header */}
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {project.title}
                      </h3>
                      <p className="text-sm text-gray-600">
                        with {project.facilitator_name}
                      </p>
                    </div>
                    <Badge 
                      variant={project.status === 'active' ? 'default' : 'secondary'}
                      className={project.status === 'active' ? 'bg-furbridge-teal text-white' : ''}
                    >
                      {project.status === 'active' ? 'Active' : 'Completed'}
                    </Badge>
                  </div>

                  {/* Progress */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Progress</span>
                      <span className="text-gray-900">
                        {project.completed_prompts} of {project.total_prompts} prompts
                      </span>
                    </div>
                    <Progress value={project.progress} className="h-2" />
                  </div>

                  {/* Last Activity */}
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <div className="flex items-center space-x-1">
                      <Clock className="h-4 w-4" />
                      <span>Last activity {formatLastActivity(project.last_activity)}</span>
                    </div>
                  </div>

                  {/* Action Button */}
                  <Link href="/storyteller/record">
                    <FurbridgeButton variant="orange" className="w-full">
                      <Mic className="h-4 w-4 mr-2" />
                      Continue Recording
                    </FurbridgeButton>
                  </Link>
                </div>
              </FurbridgeCard>
            ))}
          </div>
        )}
      </section>

      {/* Recent Prompts */}
      {recentPrompts.length > 0 && (
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-gray-900">Recent Prompts</h2>
          
          <div className="space-y-4">
            {recentPrompts.map((prompt) => (
              <FurbridgeCard key={prompt.id} className="p-6">
                <div className="flex justify-between items-start space-x-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <Badge variant="outline" className="text-xs">
                        {prompt.category}
                      </Badge>
                      <span className="text-xs text-gray-600">
                        ~{prompt.estimated_time} min
                      </span>
                    </div>
                    <p className="text-gray-900">{prompt.text}</p>
                  </div>
                  <Link href="/storyteller/record">
                    <FurbridgeButton variant="outline" size="sm">
                      <Mic className="h-4 w-4 mr-2" />
                      Record
                    </FurbridgeButton>
                  </Link>
                </div>
              </FurbridgeCard>
            ))}
          </div>
        </section>
      )}

      {/* Quick Actions */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold text-gray-900">Quick Actions</h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link href="/storyteller/record">
            <FurbridgeCard className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-furbridge-orange/10 rounded-lg">
                  <Mic className="h-6 w-6 text-furbridge-orange" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Start Recording</h3>
                  <p className="text-sm text-gray-600">
                    Begin a new story session
                  </p>
                </div>
              </div>
            </FurbridgeCard>
          </Link>

          <Link href="/storyteller/help">
            <FurbridgeCard className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-furbridge-teal/10 rounded-lg">
                  <CheckCircle className="h-6 w-6 text-furbridge-teal" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Get Help</h3>
                  <p className="text-sm text-gray-600">
                    Tips and guidance
                  </p>
                </div>
              </div>
            </FurbridgeCard>
          </Link>
        </div>
      </section>
    </div>
  )
}
