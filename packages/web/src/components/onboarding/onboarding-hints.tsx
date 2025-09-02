'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import Link from 'next/link'
import { useOnboarding } from '@/hooks/use-onboarding'

interface OnboardingHintsProps {
  className?: string
}

export function OnboardingHints({ className = '' }: OnboardingHintsProps) {
  const { shouldShowOnboardingHints, getNextAction, getProgress, isOnboardingComplete } = useOnboarding()
  const [isDismissed, setIsDismissed] = useState(false)

  if (!shouldShowOnboardingHints || isDismissed || isOnboardingComplete()) {
    return null
  }

  const nextAction = getNextAction()
  const progress = getProgress()

  if (!nextAction) return null

  const getActionButton = () => {
    switch (nextAction.action) {
      case 'create-project':
        return (
          <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white">
            <Link href="/dashboard/projects/new">
              Create Project
            </Link>
          </Button>
        )
      case 'invite-members':
        return (
          <Button asChild variant="outline">
            <Link href="/dashboard/projects">
              View Projects
            </Link>
          </Button>
        )
      case 'record-story':
        return (
          <Button asChild className="bg-green-600 hover:bg-green-700 text-white">
            <Link href="/dashboard">
              Go to Dashboard
            </Link>
          </Button>
        )
      default:
        return null
    }
  }

  const getPriorityColor = () => {
    switch (nextAction.priority) {
      case 'high':
        return 'border-blue-200 bg-blue-50'
      case 'medium':
        return 'border-yellow-200 bg-yellow-50'
      case 'low':
        return 'border-green-200 bg-green-50'
      default:
        return 'border-gray-200 bg-gray-50'
    }
  }

  const getPriorityIcon = () => {
    switch (nextAction.priority) {
      case 'high':
        return (
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        )
      case 'medium':
        return (
          <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      case 'low':
        return (
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      default:
        return null
    }
  }

  return (
    <Card className={`${getPriorityColor()} border-2 ${className}`}>
      <div className="p-4 sm:p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3 flex-1">
            <div className="flex-shrink-0 mt-1">
              {getPriorityIcon()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-2">
                <h3 className="text-lg font-semibold text-gray-900">
                  {nextAction.title}
                </h3>
                <span className="text-xs bg-white px-2 py-1 rounded-full text-gray-600 border">
                  {progress}% Complete
                </span>
              </div>
              <p className="text-gray-700 mb-4">
                {nextAction.description}
              </p>
              
              {/* Progress Bar */}
              <div className="mb-4">
                <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                  <span>Getting Started Progress</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full bg-white rounded-full h-2 border">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center space-x-3">
                {getActionButton()}
                <button
                  onClick={() => setIsDismissed(true)}
                  className="text-sm text-gray-500 hover:text-gray-700 focus-visible"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
          
          <button
            onClick={() => setIsDismissed(true)}
            className="text-gray-400 hover:text-gray-600 focus-visible ml-4"
            aria-label="Close hint"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </Card>
  )
}

// Quick action cards for specific onboarding steps
export function QuickActionCard({ 
  title, 
  description, 
  icon, 
  href, 
  buttonText,
  variant = 'default'
}: {
  title: string
  description: string
  icon: React.ReactNode
  href: string
  buttonText: string
  variant?: 'default' | 'primary' | 'success'
}) {
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return 'border-blue-200 bg-blue-50 hover:bg-blue-100'
      case 'success':
        return 'border-green-200 bg-green-50 hover:bg-green-100'
      default:
        return 'border-gray-200 bg-gray-50 hover:bg-gray-100'
    }
  }

  const getButtonStyles = () => {
    switch (variant) {
      case 'primary':
        return 'bg-blue-600 hover:bg-blue-700 text-white'
      case 'success':
        return 'bg-green-600 hover:bg-green-700 text-white'
      default:
        return 'bg-gray-600 hover:bg-gray-700 text-white'
    }
  }

  return (
    <Card className={`${getVariantStyles()} border-2 transition-all duration-200 hover:shadow-md`}>
      <Link href={href} className="block p-6 focus-visible">
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {title}
            </h3>
            <p className="text-gray-700 mb-4 text-sm">
              {description}
            </p>
            <Button 
              size="sm" 
              className={`${getButtonStyles()} touch-target`}
            >
              {buttonText}
            </Button>
          </div>
        </div>
      </Link>
    </Card>
  )
}

// Empty state with onboarding guidance
export function OnboardingEmptyState({ 
  userRole 
}: { 
  userRole: 'facilitator' | 'storyteller' 
}) {
  if (userRole === 'facilitator') {
    return (
      <div className="text-center py-12">
        <div className="max-w-md mx-auto">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-4">
            Let's Create Your First Project! 🎉
          </h3>
          <p className="text-gray-600 mb-8">
            Projects help you organize family stories around themes like "Mom's Childhood" or "Family Traditions". 
            Once created, you can invite family members to share their memories.
          </p>
          
          <div className="space-y-4">
            <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700 text-white w-full">
              <Link href="/dashboard/projects/new">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Create Your First Project
              </Link>
            </Button>
            
            <p className="text-sm text-gray-500">
              💡 Tip: Start with a simple theme like "Childhood Memories" or "How We Met"
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="text-center py-12">
      <div className="max-w-md mx-auto">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-4">
          Welcome, Storyteller! 🎙️
        </h3>
        <p className="text-gray-600 mb-8">
          You'll receive invitations from family members to share your stories. 
          When you do, our AI will guide you with thoughtful prompts to help capture your memories.
        </p>
        
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            <strong>What's next?</strong> Wait for project invitations from your family members, 
            or ask them to create a project and invite you to participate.
          </p>
        </div>
      </div>
    </div>
  )
}
