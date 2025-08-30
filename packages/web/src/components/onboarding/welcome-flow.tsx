'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useRouter } from 'next/navigation'

interface WelcomeFlowProps {
  onComplete: () => void
  userRole?: 'facilitator' | 'storyteller'
}

type Step = 'welcome' | 'role-selection' | 'platform-overview' | 'first-steps' | 'complete'

export function WelcomeFlow({ onComplete, userRole }: WelcomeFlowProps) {
  const [currentStep, setCurrentStep] = useState<Step>('welcome')
  const [selectedRole, setSelectedRole] = useState<'facilitator' | 'storyteller' | null>(userRole || null)
  const router = useRouter()

  const nextStep = () => {
    switch (currentStep) {
      case 'welcome':
        setCurrentStep(selectedRole ? 'platform-overview' : 'role-selection')
        break
      case 'role-selection':
        setCurrentStep('platform-overview')
        break
      case 'platform-overview':
        setCurrentStep('first-steps')
        break
      case 'first-steps':
        setCurrentStep('complete')
        break
      case 'complete':
        onComplete()
        break
    }
  }

  const prevStep = () => {
    switch (currentStep) {
      case 'role-selection':
        setCurrentStep('welcome')
        break
      case 'platform-overview':
        setCurrentStep(selectedRole ? 'welcome' : 'role-selection')
        break
      case 'first-steps':
        setCurrentStep('platform-overview')
        break
    }
  }

  const handleRoleSelect = (role: 'facilitator' | 'storyteller') => {
    setSelectedRole(role)
  }

  const getStepNumber = () => {
    const steps = ['welcome', 'role-selection', 'platform-overview', 'first-steps']
    return steps.indexOf(currentStep) + 1
  }

  const getTotalSteps = () => {
    return selectedRole ? 3 : 4
  }

  if (currentStep === 'complete') {
    return null
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 sm:p-8">
          {/* Progress Indicator */}
          <div className="mb-6">
            <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
              <span>Step {getStepNumber()} of {getTotalSteps()}</span>
              <button
                onClick={onComplete}
                className="text-gray-400 hover:text-gray-600 focus-visible"
                aria-label="Skip welcome flow"
              >
                Skip
              </button>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(getStepNumber() / getTotalSteps()) * 100}%` }}
              />
            </div>
          </div>

          {/* Welcome Step */}
          {currentStep === 'welcome' && (
            <div className="text-center">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
                Welcome to Saga! 🎉
              </h1>
              <p className="text-gray-600 mb-8 text-lg">
                We're excited to help you capture and preserve your family's precious stories and memories.
              </p>
            </div>
          )}

          {/* Role Selection Step */}
          {currentStep === 'role-selection' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4 text-center">
                What's your role in this journey?
              </h2>
              <p className="text-gray-600 mb-8 text-center">
                Choose the role that best describes you to get personalized guidance.
              </p>
              
              <div className="grid gap-4 sm:grid-cols-2">
                <button
                  onClick={() => handleRoleSelect('facilitator')}
                  className={`p-6 rounded-lg border-2 text-left transition-all hover:shadow-md focus-visible ${
                    selectedRole === 'facilitator'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-2xl mb-3">👨‍👩‍👧‍👦</div>
                  <h3 className="font-semibold text-lg mb-2">Facilitator</h3>
                  <p className="text-sm text-gray-600">
                    I'm organizing story collection for my family members (usually adult children helping parents)
                  </p>
                </button>
                
                <button
                  onClick={() => handleRoleSelect('storyteller')}
                  className={`p-6 rounded-lg border-2 text-left transition-all hover:shadow-md focus-visible ${
                    selectedRole === 'storyteller'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-2xl mb-3">🎙️</div>
                  <h3 className="font-semibold text-lg mb-2">Storyteller</h3>
                  <p className="text-sm text-gray-600">
                    I'm here to share my stories and memories with my family
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* Platform Overview Step */}
          {currentStep === 'platform-overview' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
                How Saga Works
              </h2>
              
              <div className="space-y-6">
                <div className="flex items-start space-x-4">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-600 font-semibold">1</span>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Create Projects</h3>
                    <p className="text-gray-600 text-sm">
                      Organize stories around themes like "Mom's Childhood" or "Family Traditions"
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-4">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-600 font-semibold">2</span>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Invite Family Members</h3>
                    <p className="text-gray-600 text-sm">
                      Send invitations to storytellers who will share their memories
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-4">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-600 font-semibold">3</span>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">AI-Guided Conversations</h3>
                    <p className="text-gray-600 text-sm">
                      Our AI creates personalized prompts to help storytellers share meaningful memories
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-4">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-600 font-semibold">4</span>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Preserve Forever</h3>
                    <p className="text-gray-600 text-sm">
                      Stories are transcribed, organized, and preserved for future generations
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* First Steps */}
          {currentStep === 'first-steps' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
                Ready to Get Started?
              </h2>
              
              {selectedRole === 'facilitator' ? (
                <div className="space-y-4">
                  <p className="text-gray-600 text-center mb-6">
                    As a Facilitator, here's what you can do first:
                  </p>
                  
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3 p-4 bg-blue-50 rounded-lg">
                      <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="font-medium">Create your first family story project</span>
                    </div>
                    
                    <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
                      <div className="w-6 h-6 bg-gray-400 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm">2</span>
                      </div>
                      <span className="text-gray-600">Invite family members to share stories</span>
                    </div>
                    
                    <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
                      <div className="w-6 h-6 bg-gray-400 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm">3</span>
                      </div>
                      <span className="text-gray-600">Review and organize collected stories</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-gray-600 text-center mb-6">
                    As a Storyteller, you'll receive invitations to share your memories:
                  </p>
                  
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3 p-4 bg-blue-50 rounded-lg">
                      <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="font-medium">Wait for project invitations from family</span>
                    </div>
                    
                    <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
                      <div className="w-6 h-6 bg-gray-400 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm">2</span>
                      </div>
                      <span className="text-gray-600">Record your stories using our simple interface</span>
                    </div>
                    
                    <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
                      <div className="w-6 h-6 bg-gray-400 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm">3</span>
                      </div>
                      <span className="text-gray-600">See your stories preserved for the family</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8 pt-6 border-t">
            <Button
              onClick={prevStep}
              variant="outline"
              disabled={currentStep === 'welcome'}
              className="touch-target"
            >
              Back
            </Button>
            
            <Button
              onClick={nextStep}
              disabled={currentStep === 'role-selection' && !selectedRole}
              className="touch-target bg-blue-600 hover:bg-blue-700 text-white"
            >
              {currentStep === 'first-steps' ? 'Get Started!' : 'Continue'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
