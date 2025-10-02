'use client'

import { EnhancedButton } from "@/components/ui/enhanced-button"
import { EnhancedCard, EnhancedCardContent, EnhancedCardHeader, EnhancedCardTitle, EnhancedCardDescription } from "@/components/ui/enhanced-card"
import { ModernAudioPlayer } from "@/components/ui/modern-audio-player"
import { StatsCard } from "@/components/ui/stats-card"
import { StoryCard } from "@/components/ui/story-card"
import { Users, MessageCircle, Heart, BookOpen, TrendingUp, Play, Download, Settings } from "lucide-react"

export default function DesignShowcasePage() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-foreground">Saga Design System Showcase</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Enhanced UI components based on prototype analysis, featuring modern design patterns and micro-interactions.
          </p>
        </div>

        {/* Enhanced Buttons */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-foreground">Enhanced Buttons</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <EnhancedButton variant="default">Primary</EnhancedButton>
            <EnhancedButton variant="secondary">Secondary</EnhancedButton>
            <EnhancedButton variant="success">Success</EnhancedButton>
            <EnhancedButton variant="warning">Warning</EnhancedButton>
            <EnhancedButton variant="destructive">Destructive</EnhancedButton>
            <EnhancedButton variant="outline">Outline</EnhancedButton>
            <EnhancedButton variant="ghost">Ghost</EnhancedButton>
            <EnhancedButton variant="link">Link</EnhancedButton>
            <EnhancedButton loading>Loading</EnhancedButton>
            <EnhancedButton leftIcon={<Play className="h-4 w-4" />}>With Icon</EnhancedButton>
            <EnhancedButton size="sm">Small</EnhancedButton>
            <EnhancedButton size="lg">Large</EnhancedButton>
          </div>
        </section>

        {/* Stats Cards */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-foreground">Statistics Cards</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatsCard
              title="Total Stories"
              value="1,234"
              description="Stories recorded this month"
              icon={<BookOpen className="h-6 w-6" />}
              trend={{ value: 12, label: "vs last month", direction: "up" }}
              variant="success"
            />
            <StatsCard
              title="Active Users"
              value="567"
              description="Family members engaged"
              icon={<Users className="h-6 w-6" />}
              trend={{ value: -3, label: "vs last month", direction: "down" }}
            />
            <StatsCard
              title="Comments"
              value="2,890"
              description="Family interactions"
              icon={<MessageCircle className="h-6 w-6" />}
              trend={{ value: 25, label: "vs last month", direction: "up" }}
              variant="info"
            />
            <StatsCard
              title="Satisfaction"
              value="98.5%"
              description="User satisfaction rate"
              icon={<Heart className="h-6 w-6" />}
              trend={{ value: 0, label: "vs last month", direction: "neutral" }}
              variant="success"
            />
          </div>
        </section>

        {/* Enhanced Cards */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-foreground">Enhanced Cards</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <EnhancedCard variant="default">
              <EnhancedCardHeader>
                <EnhancedCardTitle>Default Card</EnhancedCardTitle>
                <EnhancedCardDescription>
                  A standard card with subtle shadow and hover effects.
                </EnhancedCardDescription>
              </EnhancedCardHeader>
              <EnhancedCardContent>
                <p className="text-sm text-muted-foreground">
                  This card demonstrates the default styling with clean typography and spacing.
                </p>
              </EnhancedCardContent>
            </EnhancedCard>

            <EnhancedCard variant="elevated">
              <EnhancedCardHeader>
                <EnhancedCardTitle>Elevated Card</EnhancedCardTitle>
                <EnhancedCardDescription>
                  A card with enhanced shadow for important content.
                </EnhancedCardDescription>
              </EnhancedCardHeader>
              <EnhancedCardContent>
                <p className="text-sm text-muted-foreground">
                  Perfect for highlighting key information or featured content.
                </p>
              </EnhancedCardContent>
            </EnhancedCard>

            <EnhancedCard variant="interactive">
              <EnhancedCardHeader>
                <EnhancedCardTitle>Interactive Card</EnhancedCardTitle>
                <EnhancedCardDescription>
                  A clickable card with hover animations.
                </EnhancedCardDescription>
              </EnhancedCardHeader>
              <EnhancedCardContent>
                <p className="text-sm text-muted-foreground">
                  Includes hover effects and cursor pointer for interactive elements.
                </p>
              </EnhancedCardContent>
            </EnhancedCard>
          </div>
        </section>

        {/* Modern Audio Player */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-foreground">Modern Audio Player</h2>
          <div className="max-w-2xl">
            <ModernAudioPlayer
              src="/test.wav"
              title="Rosa's Childhood Home"
              subtitle="by Grandmother Rosa • 3 days ago"
              showDownload
              onDownload={() => console.log('Download clicked')}
            />
          </div>
        </section>

        {/* Story Cards */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-foreground">Story Cards</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <StoryCard
              id="1"
              title="Rosa's Childhood Home"
              author={{
                name: "Grandmother Rosa",
                role: "Storyteller"
              }}
              duration="12:34"
              createdAt="3 days ago"
              description="Rosa describes the small adobe house where she grew up with her seven siblings, the courtyard filled with her mother's flowers, and the sounds of neighborhood children playing in the dusty streets of her Mexican hometown."
              tags={[
                { label: "Childhood", color: "primary" },
                { label: "Family", color: "secondary" },
                { label: "Mexico", color: "success" }
              ]}
              stats={{
                comments: 8,
                likes: 12,
                plays: 45
              }}
              onPlay={() => console.log('Play story')}
              onComment={() => console.log('Comment')}
              onLike={() => console.log('Like')}
              variant="featured"
            />

            <StoryCard
              id="2"
              title="Sunday Family Gatherings"
              author={{
                name: "Uncle Miguel",
                role: "Co-facilitator"
              }}
              duration="8:22"
              createdAt="1 week ago"
              description="Miguel shares memories of the weekly family gatherings at their grandparents' house."
              tags={[
                { label: "Family", color: "secondary" },
                { label: "Traditions", color: "warning" }
              ]}
              stats={{
                comments: 12,
                likes: 18
              }}
              onPlay={() => console.log('Play story')}
              onComment={() => console.log('Comment')}
              onLike={() => console.log('Like')}
            />

            <StoryCard
              id="3"
              title="The Journey North"
              author={{
                name: "Grandmother Rosa",
                role: "Storyteller"
              }}
              duration="15:47"
              createdAt="2 weeks ago"
              description="Rosa recounts the difficult decision to leave Mexico and the long train journey with three young children."
              tags={[
                { label: "Immigration", color: "info" },
                { label: "Journey", color: "warning" }
              ]}
              stats={{
                comments: 3,
                likes: 7
              }}
              onPlay={() => console.log('Play story')}
              onComment={() => console.log('Comment')}
              onLike={() => console.log('Like')}
              variant="compact"
            />
          </div>
        </section>

        {/* Action Buttons */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-foreground">Action Examples</h2>
          <div className="flex flex-wrap gap-4">
            <EnhancedButton 
              variant="default" 
              size="lg"
              leftIcon={<BookOpen className="h-5 w-5" />}
            >
              Start Your Saga
            </EnhancedButton>
            <EnhancedButton 
              variant="secondary"
              leftIcon={<Download className="h-4 w-4" />}
            >
              Export Stories
            </EnhancedButton>
            <EnhancedButton 
              variant="outline"
              leftIcon={<Settings className="h-4 w-4" />}
            >
              Manage Project
            </EnhancedButton>
            <EnhancedButton 
              variant="success"
              rightIcon={<TrendingUp className="h-4 w-4" />}
            >
              Upgrade Plan
            </EnhancedButton>
          </div>
        </section>
      </div>
    </div>
  )
}