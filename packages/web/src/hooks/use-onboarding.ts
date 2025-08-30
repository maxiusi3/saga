'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/auth-store'

interface OnboardingState {
  hasCompletedWelcome: boolean
  hasCreatedFirstProject: boolean
  hasInvitedFirstMember: boolean
  hasRecordedFirstStory: boolean
  userRole: 'facilitator' | 'storyteller' | null
  currentStep: string | null
}

const ONBOARDING_STORAGE_KEY = 'saga-onboarding-state'

export function useOnboarding() {
  const { user } = useAuthStore()
  const [onboardingState, setOnboardingState] = useState<OnboardingState>({
    hasCompletedWelcome: false,
    hasCreatedFirstProject: false,
    hasInvitedFirstMember: false,
    hasRecordedFirstStory: false,
    userRole: null,
    currentStep: null
  })

  // Load onboarding state from localStorage on mount
  useEffect(() => {
    if (user?.id) {
      const stored = localStorage.getItem(`${ONBOARDING_STORAGE_KEY}-${user.id}`)
      if (stored) {
        try {
          const parsedState = JSON.parse(stored)
          setOnboardingState(parsedState)
        } catch (error) {
          console.error('Failed to parse onboarding state:', error)
        }
      }
    }
  }, [user?.id])

  // Save onboarding state to localStorage whenever it changes
  useEffect(() => {
    if (user?.id) {
      localStorage.setItem(
        `${ONBOARDING_STORAGE_KEY}-${user.id}`,
        JSON.stringify(onboardingState)
      )
    }
  }, [onboardingState, user?.id])

  const updateOnboardingState = (updates: Partial<OnboardingState>) => {
    setOnboardingState(prev => ({ ...prev, ...updates }))
  }

  const completeWelcome = (userRole: 'facilitator' | 'storyteller') => {
    updateOnboardingState({
      hasCompletedWelcome: true,
      userRole,
      currentStep: userRole === 'facilitator' ? 'create-project' : 'wait-for-invitation'
    })
  }

  const completeFirstProject = () => {
    updateOnboardingState({
      hasCreatedFirstProject: true,
      currentStep: 'invite-members'
    })
  }

  const completeFirstInvitation = () => {
    updateOnboardingState({
      hasInvitedFirstMember: true,
      currentStep: 'wait-for-stories'
    })
  }

  const completeFirstStory = () => {
    updateOnboardingState({
      hasRecordedFirstStory: true,
      currentStep: null // Onboarding complete
    })
  }

  const resetOnboarding = () => {
    setOnboardingState({
      hasCompletedWelcome: false,
      hasCreatedFirstProject: false,
      hasInvitedFirstMember: false,
      hasRecordedFirstStory: false,
      userRole: null,
      currentStep: null
    })
  }

  // Determine if user should see welcome flow
  const shouldShowWelcome = !onboardingState.hasCompletedWelcome

  // Determine if user should see onboarding hints
  const shouldShowOnboardingHints = onboardingState.hasCompletedWelcome && onboardingState.currentStep

  // Get next recommended action
  const getNextAction = () => {
    if (!onboardingState.hasCompletedWelcome) {
      return {
        title: 'Welcome to Saga!',
        description: 'Complete the welcome flow to get started',
        action: 'complete-welcome',
        priority: 'high'
      }
    }

    if (onboardingState.userRole === 'facilitator') {
      if (!onboardingState.hasCreatedFirstProject) {
        return {
          title: 'Create Your First Project',
          description: 'Start collecting family stories by creating a project',
          action: 'create-project',
          priority: 'high'
        }
      }

      if (!onboardingState.hasInvitedFirstMember) {
        return {
          title: 'Invite Family Members',
          description: 'Send invitations to family members to start collecting stories',
          action: 'invite-members',
          priority: 'medium'
        }
      }

      return {
        title: 'Wait for Stories',
        description: 'Your family members will receive prompts and can start sharing stories',
        action: 'wait-for-stories',
        priority: 'low'
      }
    }

    if (onboardingState.userRole === 'storyteller') {
      if (!onboardingState.hasRecordedFirstStory) {
        return {
          title: 'Share Your First Story',
          description: 'Look for project invitations and start sharing your memories',
          action: 'record-story',
          priority: 'medium'
        }
      }

      return {
        title: 'Keep Sharing',
        description: 'Continue sharing stories as you receive new prompts',
        action: 'continue-sharing',
        priority: 'low'
      }
    }

    return null
  }

  // Get onboarding progress percentage
  const getProgress = () => {
    if (!onboardingState.hasCompletedWelcome) return 0

    if (onboardingState.userRole === 'facilitator') {
      let completed = 1 // Welcome completed
      if (onboardingState.hasCreatedFirstProject) completed++
      if (onboardingState.hasInvitedFirstMember) completed++
      return Math.round((completed / 3) * 100)
    }

    if (onboardingState.userRole === 'storyteller') {
      let completed = 1 // Welcome completed
      if (onboardingState.hasRecordedFirstStory) completed++
      return Math.round((completed / 2) * 100)
    }

    return 0
  }

  // Check if onboarding is complete
  const isOnboardingComplete = () => {
    if (!onboardingState.hasCompletedWelcome) return false

    if (onboardingState.userRole === 'facilitator') {
      return onboardingState.hasCreatedFirstProject && onboardingState.hasInvitedFirstMember
    }

    if (onboardingState.userRole === 'storyteller') {
      return onboardingState.hasRecordedFirstStory
    }

    return false
  }

  return {
    onboardingState,
    shouldShowWelcome,
    shouldShowOnboardingHints,
    completeWelcome,
    completeFirstProject,
    completeFirstInvitation,
    completeFirstStory,
    resetOnboarding,
    getNextAction,
    getProgress,
    isOnboardingComplete,
    updateOnboardingState
  }
}
