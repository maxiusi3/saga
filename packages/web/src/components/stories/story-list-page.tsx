'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  MessageCircle, 
  Play,
  Clock,
  User,
  Filter,
  Search,
  Download,
  Settings,
  Plus,
  BookOpen,
  Users,
  Calendar,
  TrendingUp,
  Activity
} from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

interface Story {
  id: string
  title: string
  storyteller: {
    id: string
    name: string
    avatar?: string
  }
  duration: number // in seconds
  createdAt: string
  chapter?: {
    id: string
    name: string
    color?: string
  }
  theme?: string
  thumbnail?: string
  commentsCount: number
  followUpCount: number
  status: 'new' | 'reviewed' | 'pending'
  engagementScore?: number
}

interface Chapter {
  id: string
  name: string
  description?: string
  storyCount: number
  completionRate: number
  color?: string
}

interface StoryListPageProps {
  stories: Story[]
  chapters: Chapter[]
  projectId: string
  userRole: 'facilitator' | 'storyteller' | 'admin'
  onExportStories?: () => void
  onManageProject?: () => void
  onRecordStory?: () => void
}

export function StoryListPage({
  stories,
  chapters,
  projectId,
  userRole,
  onExportStories,
  onManageProject,
  onRecordStory
}: StoryListPageProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedChapter, setSelectedChapter] = useState<string>('all')
  const [selectedStoryteller, setSelectedStoryteller] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'date' | 'engagement' | 'duration'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // locale-aware 链接助手
  const params = useParams()
  const locale = (params?.locale as string) || ''
  const withLocale = (path: string) => {
    const sanitized = path.startsWith('/') ? path : `/${path}`
    const hasLocale = /^\/(en|zh|fr|es)(\/|$)/.test(sanitized)
    if (!locale || hasLocale) return sanitized
    return `/${locale}${sanitized}`
  }

  // Get unique storytellers
  const storytellers = Array.from(
    new Set(stories.map(story => story.storyteller.id))
  ).map(id => stories.find(story => story.storyteller.id === id)?.storyteller).filter(Boolean)

  // Filter and sort stories
  const filteredStories = stories
    .filter(story => {
      const matchesSearch = story.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           story.storyteller.name.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesChapter = selectedChapter === 'all' || story.chapter?.id === selectedChapter
      const matchesStoryteller = selectedStoryteller === 'all' || story.storyteller.id === selectedStoryteller
      
      return matchesSearch && matchesChapter && matchesStoryteller
    })
    .sort((a, b) => {
      let comparison = 0
      
      switch (sortBy) {
        case 'date':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          break
        case 'engagement':
          comparison = (a.engagementScore || 0) - (b.engagementScore || 0)
          break
        case 'duration':
          comparison = a.duration - b.duration
          break
      }
      
      return sortOrder === 'desc' ? -comparison : comparison
    })

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  // Calculate statistics
  const totalStories = stories.length
  const monthlyStories = stories.filter(story => 
    new Date(story.createdAt).getMonth() === new Date().getMonth()
  ).length
  const totalComments = stories.reduce((sum, story) => sum + story.commentsCount, 0)
  const activeStorytellers = storytellers.length

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-display text-foreground">Stories</h1>
          <p className="text-muted-foreground mt-2">
            Family memories organized by chapters and themes
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {userRole === 'storyteller' && (
            <Button variant="primary" onClick={onRecordStory} asChild>
              <Link href={withLocale(`/dashboard/projects/${projectId}/record`)}>
                <Plus className="w-4 h-4 mr-2" />
                Record New Story
              </Link>
            </Button>
          )}
          
          <Button variant="secondary" onClick={onExportStories}>
            <Download className="w-4 h-4 mr-2" />
            Export Stories
          </Button>
          
          {(userRole === 'facilitator' || userRole === 'admin') && (
            <Button variant="tertiary" onClick={onManageProject} asChild>
              <Link href={withLocale(`/dashboard/projects/${projectId}/settings`)}>
                <Settings className="w-4 h-4 mr-2" />
                Manage Project
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-3 space-y-8">
          {/* Chapter Organization */}
          <div className="space-y-6">
            <h2 className="text-h2 font-semibold text-foreground">Chapters</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {chapters.map((chapter) => (
                <Card key={chapter.id} variant="content" className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-foreground">{chapter.name}</h3>
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: chapter.color || '#2D5A3D' }}
                      />
                    </div>
                    {chapter.description && (
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {chapter.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        {chapter.storyCount} stories
                      </span>
                      <Badge variant="outline" size="sm">
                        {Math.round(chapter.completionRate)}% complete
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Filters and Search */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search stories..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="flex gap-2">
                <Select value={selectedChapter} onValueChange={setSelectedChapter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All Chapters" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Chapters</SelectItem>
                    {chapters.map((chapter) => (
                      <SelectItem key={chapter.id} value={chapter.id}>
                        {chapter.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedStoryteller} onValueChange={setSelectedStoryteller}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All Storytellers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Storytellers</SelectItem>
                    {storytellers.map((storyteller) => (
                      <SelectItem key={storyteller!.id} value={storyteller!.id}>
                        {storyteller!.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="engagement">Engagement</SelectItem>
                    <SelectItem value="duration">Duration</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Story Cards */}
          <div className="space-y-4">
            {filteredStories.map((story) => (
              <Link key={story.id} href={withLocale(`/dashboard/projects/${projectId}/stories/${story.id}`)}>
                <Card variant="content" className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      {/* Story Thumbnail */}
                      <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                        {story.thumbnail ? (
                          <img 
                            src={story.thumbnail} 
                            alt={story.title}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        ) : (
                          <Play className="w-6 h-6 text-muted-foreground" />
                        )}
                      </div>

                      {/* Story Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-foreground hover:text-primary transition-colors line-clamp-1">
                              {story.title}
                            </h3>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-muted-foreground">
                                {formatDate(story.createdAt)}
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <StatusBadge status={story.status} size="sm" />
                            {story.chapter && (
                              <Badge 
                                variant="outline" 
                                size="sm"
                                style={{ 
                                  borderColor: story.chapter.color || '#2D5A3D',
                                  color: story.chapter.color || '#2D5A3D'
                                }}
                              >
                                {story.chapter.name}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Story Metadata */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>{formatDuration(story.duration)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <MessageCircle className="w-3 h-3" />
                              <span>{story.commentsCount}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <BookOpen className="w-3 h-3" />
                              <span>{story.followUpCount} follow-ups</span>
                            </div>
                            {story.theme && (
                              <Badge variant="outline" size="sm">
                                {story.theme}
                              </Badge>
                            )}
                          </div>
                          
                          {story.engagementScore && (
                            <div className="flex items-center gap-1 text-sm text-success">
                              <TrendingUp className="w-3 h-3" />
                              <span>{Math.round(story.engagementScore)}% engagement</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}

            {filteredStories.length === 0 && (
              <div className="text-center py-16">
                <BookOpen className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
                <h3 className="text-h3 text-foreground mb-2">No Stories Found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchQuery || selectedChapter !== 'all' || selectedStoryteller !== 'all'
                    ? 'Try adjusting your filters or search terms.'
                    : 'Start recording your first family story.'}
                </p>
                {userRole === 'storyteller' && (
                  <Button variant="primary" onClick={onRecordStory} asChild>
                    <Link href={withLocale(`/dashboard/projects/${projectId}/record`)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Record Your First Story
                    </Link>
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Statistics Sidebar */}
        <div className="space-y-6">
          <Card variant="content">
            <CardHeader>
              <CardTitle className="text-lg">Story Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  <span className="text-sm text-muted-foreground">Total Stories</span>
                </div>
                <span className="font-semibold text-foreground">{totalStories}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <span className="text-sm text-muted-foreground">This Month</span>
                </div>
                <span className="font-semibold text-foreground">{monthlyStories}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-muted-foreground">Total Comments</span>
                </div>
                <span className="font-semibold text-foreground">{totalComments}</span>
              </div>
            </CardContent>
          </Card>

          {/* Active Storytellers */}
          <Card variant="content">
            <CardHeader>
              <CardTitle className="text-lg">Active Storytellers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {storytellers.slice(0, 5).map((storyteller) => {
                  const storytellerStories = stories.filter(s => s.storyteller.id === storyteller!.id)
                  const recentActivity = storytellerStories.some(s => 
                    new Date(s.createdAt).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000
                  )
                  
                  return (
                    <div key={storyteller!.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <Avatar size="sm">
                            <AvatarImage src={storyteller!.avatar} />
                            <AvatarFallback>
                              {storyteller!.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          {recentActivity && (
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-success rounded-full border-2 border-background" />
                          )}
                        </div>
                        <span className="text-sm font-medium text-foreground">
                          {storyteller!.name}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {storytellerStories.length} stories
                      </span>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}