'use client'

import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Heart, 
  Users, 
  MessageCircle, 
  Shield, 
  Clock, 
  Star,
  CheckCircle,
  ArrowDown
} from 'lucide-react'

interface HeroSectionProps {
  onGetStartedClick?: () => void
  onLearnMoreClick?: () => void
}

export function HeroSection({ onGetStartedClick, onLearnMoreClick }: HeroSectionProps) {
  const benefits = [
    {
      icon: <Heart className="w-5 h-5 text-red-500" />,
      title: "Preserve Family Legacy",
      description: "Capture precious memories and stories for future generations"
    },
    {
      icon: <Users className="w-5 h-5 text-blue-500" />,
      title: "Collaborative Storytelling",
      description: "Invite family members to share and contribute their unique perspectives"
    },
    {
      icon: <MessageCircle className="w-5 h-5 text-green-500" />,
      title: "AI-Powered Insights",
      description: "Get transcripts, summaries, and thoughtful follow-up questions automatically"
    },
    {
      icon: <Shield className="w-5 h-5 text-purple-500" />,
      title: "Secure & Private",
      description: "Your family stories are protected with enterprise-grade security"
    }
  ]

  const features = [
    "Unlimited story recordings",
    "AI transcription & summaries", 
    "Family collaboration tools",
    "Secure cloud storage",
    "Export & backup options",
    "1 year of interactive service"
  ]

  return (
    <div className="relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-secondary/5 to-primary/10" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(45,90,61,0.1),transparent_50%)]" />
      
      <div className="relative container py-16 lg:py-24">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <Badge variant="outline" className="mb-6 bg-background/50 backdrop-blur-sm">
            <Star className="w-3 h-3 mr-1 text-warning" />
            Trusted by families worldwide
          </Badge>

          {/* Main Headline */}
          <h1 className="text-display lg:text-6xl font-bold text-foreground mb-6 leading-tight">
            Preserve Your Family's
            <span className="text-primary block">
              Stories Forever
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-body-large text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
            Create a lasting digital biography with AI-powered tools that help capture, 
            organize, and preserve your family's most precious memories and stories.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
            <Button 
              variant="primary" 
              size="lg" 
              className="w-full sm:w-auto px-8 py-4 text-base"
              onClick={onGetStartedClick}
            >
              Start Your Family Saga
              <ArrowDown className="w-5 h-5 ml-2" />
            </Button>
            <Button 
              variant="secondary" 
              size="lg" 
              className="w-full sm:w-auto px-8 py-4 text-base"
              onClick={onLearnMoreClick}
            >
              Learn More
            </Button>
          </div>

          {/* Trust Indicators */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-muted-foreground mb-16">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-green-600" />
              <span>Secure & Private</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <span>No Setup Required</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-primary" />
              <span>30-Day Money Back</span>
            </div>
          </div>
        </div>

        {/* Benefits Grid */}
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            {benefits.map((benefit, index) => (
              <Card key={index} variant="content" className="text-center bg-background/50 backdrop-blur-sm border-border/50">
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-background rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                    {benefit.icon}
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">
                    {benefit.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {benefit.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Features List */}
          <Card variant="elevated" className="max-w-2xl mx-auto bg-background/80 backdrop-blur-sm">
            <CardContent className="p-8">
              <h3 className="text-h3 font-semibold text-foreground text-center mb-6">
                Everything You Need to Get Started
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {features.map((feature, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-success flex-shrink-0" />
                    <span className="text-sm text-foreground">{feature}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}