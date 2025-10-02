'use client'

import { useState } from "react"
import { EnhancedButton } from "@/components/ui/enhanced-button"
import { StoryCard } from "@/components/ui/story-card"
import { FilterTabs } from "@/components/ui/filter-tabs"
import { StatsCard } from "@/components/ui/stats-card"
import { EnhancedCard, EnhancedCardContent, EnhancedCardHeader, EnhancedCardTitle } from "@/components/ui/enhanced-card"
import { BookOpen, Download, Settings, Plus, Users, MessageCircle, TrendingUp, Filter, Search, Calendar, Tag } from "lucide-react"

export default function ModernStoriesPage() {
  const [selectedFilter, setSelectedFilter] = useState('all-storytellers')
  const [selectedTheme, setSelectedTheme] = useState('all-themes')
  const [selectedSort, setSelectedSort] = useState('latest-first')

  // Mock data based on prototype
  const mockStories = [
    {
      id: '1',
      title: "Rosa's Childhood Home",
      author: {
        name: "Grandmother Rosa",
        role: "Owner"
      },
      duration: "12:34",
      createdAt: "3 days ago",
      description: "Rosa describes the small adobe house where she grew up with her seven siblings, the courtyard filled with her mother's flowers, and the sounds of neighborhood children playing in the dusty streets of her Mexican hometown.",
      thumbnail: "/api/placeholder/400/300",
      tags: [
        { label: "Childhood", color: "primary" as const },
        { label: "Family", color: "secondary" as const },
        { label: "Mexico", color: "success" as const }
      ],
      stats: {
        comments: 8,
        likes: 12,
        plays: 45
      }
    },
    {
      id: '2',
      title: "Sunday Family Gatherings",
      author: {
        name: "Uncle Miguel",
        role: "Co-facilitator"
      },
      duration: "8:22",
      createdAt: "1 week ago",
      description: "Miguel shares memories of the weekly family gatherings at their grandparents' house, where all the aunts would cook together, the men would play dominoes, and the children would run wild in the garden until sunset.",
      thumbnail: "/api/placeholder/400/300",
      tags: [
        { label: "Family", color: "secondary" as const },
        { label: "Traditions", color: "warning" as const }
      ],
      stats: {
        comments: 12,
        likes: 18,
        plays: 67
      }
    },
    {
      id: '3',
      title: "The Journey North",
      author: {
        name: "Grandmother Rosa",
        role: "Owner"
      },
      duration: "15:47",
      createdAt: "2 weeks ago",
      description: "Rosa recounts the difficult decision to leave Mexico, the long train journey with three young children, and arriving in a new country where everything felt foreign and uncertain, but filled with hope for a better future.",
      thumbnail: "/api/placeholder/400/300",
      tags: [
        { label: "Immigration", color: "info" as const },
        { label: "Journey", color: "warning" as const },
        { label: "New", color: "success" as const }
      ],
      stats: {
        comments: 3,
        likes: 7,
        plays: 23
      }
    }
  ]

  const filterOptions = [
    { value: 'all-storytellers', label: 'All Storytellers', count: 23 },
    { value: 'rosa', label: 'Rosa Martinez', count: 16 },
    { value: 'miguel', label: 'Miguel Rodriguez', count: 7 }
  ]

  const themeOptions = [
    { value: 'all-themes', label: 'All Themes', count: 23 },
    { value: 'childhood', label: 'Childhood', count: 8 },
    { value: 'family', label: 'Family', count: 12 },
    { value: 'immigration', label: 'Immigration', count: 3 }
  ]

  const sortOptions = [
    { value: 'latest-first', label: 'Latest First' },
    { value: 'oldest-first', label: 'Oldest First' },
    { value: 'most-popular', label: 'Most Popular' }
  ]

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
                <h1 className="text-2xl font-bold text-foreground">Family Stories</h1>
                <p className="text-muted-foreground">23 Stories</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <EnhancedButton variant="outline" leftIcon={<Download className="h-4 w-4" />}>
                Export Stories
              </EnhancedButton>
              <EnhancedButton variant="outline" leftIcon={<Settings className="h-4 w-4" />}>
                Manage Project
              </EnhancedButton>
              <EnhancedButton 
                size="default"
                rightIcon={<Plus className="h-4 w-4" />}
                className="bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90"
              >
                Record New Story
              </EnhancedButton>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Filters */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Filter className="h-4 w-4" />
                <span>Filter by:</span>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Storytellers</label>
                  <FilterTabs
                    options={filterOptions}
                    value={selectedFilter}
                    onValueChange={setSelectedFilter}
                    variant="pills"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Themes</label>
                  <FilterTabs
                    options={themeOptions}
                    value={selectedTheme}
                    onValueChange={setSelectedTheme}
                    variant="pills"
                  />
                </div>
                
                <div className="flex items-center gap-4">
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">Sort</label>
                    <FilterTabs
                      options={sortOptions}
                      value={selectedSort}
                      onValueChange={setSelectedSort}
                      variant="dropdown"
                      className="w-48"
                    />
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <EnhancedButton variant="outline" size="sm" leftIcon={<Calendar className="h-3 w-3" />}>
                      Chronological
                    </EnhancedButton>
                    <EnhancedButton variant="outline" size="sm" leftIcon={<Tag className="h-3 w-3" />}>
                      Chapters
                    </EnhancedButton>
                  </div>
                </div>
              </div>
            </div>

            {/* Chapter Section */}
            <EnhancedCard className="bg-gradient-to-r from-primary/5 to-secondary/5 border-primary/20">
              <EnhancedCardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-lg flex items-center justify-center">
                      <BookOpen className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <EnhancedCardTitle>Chapter: Early Years in Mexico</EnhancedCardTitle>
                      <p className="text-sm text-muted-foreground">
                        AI has organized 5 stories from this period, highlighting Rosa's childhood memories, family traditions, and the cultural richness of her hometown before the journey to America.
                      </p>
                    </div>
                  </div>
                  <EnhancedButton variant="outline" size="sm">
                    Owner Edit
                  </EnhancedButton>
                </div>
              </EnhancedCardHeader>
              <EnhancedCardContent>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>5 Stories</span>
                  <span>•</span>
                  <span>Dec 2023 - Jan 2024</span>
                </div>
              </EnhancedCardContent>
            </EnhancedCard>

            {/* Stories Grid */}
            <div className="space-y-6">
              {mockStories.map((story) => (
                <StoryCard
                  key={story.id}
                  {...story}
                  onPlay={() => console.log('Play story:', story.id)}
                  onComment={() => console.log('Comment on story:', story.id)}
                  onLike={() => console.log('Like story:', story.id)}
                  onMore={() => console.log('More options:', story.id)}
                  variant="default"
                />
              ))}
            </div>

            {/* Load More */}
            <div className="flex justify-center pt-6">
              <EnhancedButton variant="outline" size="lg">
                Load More Stories
              </EnhancedButton>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <EnhancedCard>
              <EnhancedCardHeader>
                <EnhancedCardTitle>Quick Actions</EnhancedCardTitle>
              </EnhancedCardHeader>
              <EnhancedCardContent className="space-y-3">
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-foreground">Owner Actions</h4>
                  <div className="space-y-2">
                    <EnhancedButton variant="outline" size="sm" className="w-full justify-start" leftIcon={<Download className="h-3 w-3" />}>
                      Export All Stories
                    </EnhancedButton>
                    <EnhancedButton variant="outline" size="sm" className="w-full justify-start" leftIcon={<BookOpen className="h-3 w-3" />}>
                      Archive Selected
                    </EnhancedButton>
                    <EnhancedButton variant="outline" size="sm" className="w-full justify-start" leftIcon={<TrendingUp className="h-3 w-3" />}>
                      Refresh Feed
                    </EnhancedButton>
                    <EnhancedButton variant="outline" size="sm" className="w-full justify-start" leftIcon={<Settings className="h-3 w-3" />}>
                      Manage Permissions
                    </EnhancedButton>
                  </div>
                </div>
                
                <div className="pt-3 border-t border-border">
                  <EnhancedButton variant="success" size="sm" className="w-full" leftIcon={<Plus className="h-3 w-3" />}>
                    Add Storyteller
                  </EnhancedButton>
                </div>
              </EnhancedCardContent>
            </EnhancedCard>

            {/* Story Statistics */}
            <EnhancedCard>
              <EnhancedCardHeader>
                <EnhancedCardTitle>Story Statistics</EnhancedCardTitle>
              </EnhancedCardHeader>
              <EnhancedCardContent className="space-y-4">
                <StatsCard
                  title="Total Stories"
                  value="23"
                  className="p-4"
                />
                <StatsCard
                  title="This Month"
                  value="5"
                  trend={{ value: 25, label: "vs last month", direction: "up" }}
                  className="p-4"
                />
                <StatsCard
                  title="Total Comments"
                  value="67"
                  className="p-4"
                />
                <StatsCard
                  title="Follow-up Questions"
                  value="12"
                  className="p-4"
                />
              </EnhancedCardContent>
            </EnhancedCard>

            {/* Active Storytellers */}
            <EnhancedCard>
              <EnhancedCardHeader>
                <EnhancedCardTitle>Active Storytellers</EnhancedCardTitle>
              </EnhancedCardHeader>
              <EnhancedCardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                    <span className="text-xs font-medium text-primary">R</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Rosa Martinez</span>
                      <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded">Owner</span>
                    </div>
                    <p className="text-xs text-muted-foreground">16 stories • Last active today</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-secondary/10 rounded-full flex items-center justify-center">
                    <span className="text-xs font-medium text-secondary">M</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Miguel Rodriguez</span>
                      <span className="px-1.5 py-0.5 bg-secondary/10 text-secondary text-xs rounded">Co-facilitator</span>
                    </div>
                    <p className="text-xs text-muted-foreground">7 stories • Last active 3 days ago</p>
                  </div>
                </div>
              </EnhancedCardContent>
            </EnhancedCard>

            {/* My Permissions */}
            <EnhancedCard>
              <EnhancedCardHeader>
                <EnhancedCardTitle>My Permissions</EnhancedCardTitle>
              </EnhancedCardHeader>
              <EnhancedCardContent className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 bg-success rounded-full"></div>
                  <span>Full Project Access</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 bg-success rounded-full"></div>
                  <span>Manage Users & Roles</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 bg-success rounded-full"></div>
                  <span>Export All Data</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 bg-success rounded-full"></div>
                  <span>Archive Stories</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 bg-success rounded-full"></div>
                  <span>Moderate Content</span>
                </div>
              </EnhancedCardContent>
            </EnhancedCard>
          </div>
        </div>
      </div>
    </div>
  )
}