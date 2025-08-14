'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ResourceValidationError, ResourceValidationService } from '@/lib/resource-validation'
import type { ResourceWallet } from '@saga/shared/types'

interface PurchasePromptProps {
  wallet: ResourceWallet | null
  trigger?: 'low' | 'empty' | 'insufficient'
  className?: string
  onDismiss?: () => void
  showDismiss?: boolean
}

export function PurchasePrompt({ 
  wallet, 
  trigger = 'low',
  className = '',
  onDismiss,
  showDismiss = true
}: PurchasePromptProps) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed || !wallet) return null

  const shouldShow = checkShouldShow(wallet, trigger)
  if (!shouldShow) return null

  const handleDismiss = () => {
    setDismissed(true)
    onDismiss?.()
  }

  const { title, message, urgency } = getPromptContent(wallet, trigger)

  return (
    <div className={`relative rounded-lg border p-4 ${getPromptStyles(urgency)} ${className}`}>
      {showDismiss && (
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      <div className="flex items-start">
        <div className="flex-shrink-0">
          {getPromptIcon(urgency)}
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium">
            {title}
          </h3>
          <div className="mt-2 text-sm">
            <p>{message}</p>
          </div>

          {/* Resource Status */}
          <div className="mt-3 space-y-2">
            <div className="grid grid-cols-3 gap-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Projects</span>
                <span className={`font-medium ${wallet.projectVouchers > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {wallet.projectVouchers}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Facilitators</span>
                <span className={`font-medium ${wallet.facilitatorSeats > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {wallet.facilitatorSeats}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Storytellers</span>
                <span className={`font-medium ${wallet.storytellerSeats > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {wallet.storytellerSeats}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-4 flex space-x-3">
            <Link
              href="/dashboard/billing/packages"
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Purchase Package
            </Link>
            <Link
              href="/dashboard/billing"
              className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              View Wallet
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function checkShouldShow(wallet: ResourceWallet, trigger: 'low' | 'empty' | 'insufficient'): boolean {
  const totalResources = wallet.projectVouchers + wallet.facilitatorSeats + wallet.storytellerSeats

  switch (trigger) {
    case 'empty':
      return totalResources === 0
    case 'low':
      return totalResources <= 2 && totalResources > 0
    case 'insufficient':
      return wallet.projectVouchers === 0 || wallet.facilitatorSeats === 0 || wallet.storytellerSeats === 0
    default:
      return false
  }
}

function getPromptContent(wallet: ResourceWallet, trigger: 'low' | 'empty' | 'insufficient') {
  switch (trigger) {
    case 'empty':
      return {
        title: 'No Resources Available',
        message: 'You have no project vouchers or seats remaining. Purchase a package to continue using Saga.',
        urgency: 'high' as const
      }
    case 'low':
      return {
        title: 'Running Low on Resources',
        message: 'You\'re running low on project vouchers and seats. Consider purchasing more to avoid interruptions.',
        urgency: 'medium' as const
      }
    case 'insufficient':
      return {
        title: 'Some Resources Depleted',
        message: 'You\'ve run out of some resources. Purchase a package to restore full functionality.',
        urgency: 'medium' as const
      }
    default:
      return {
        title: 'Consider Purchasing More Resources',
        message: 'Keep your family storytelling going with additional resources.',
        urgency: 'low' as const
      }
  }
}

function getPromptStyles(urgency: 'low' | 'medium' | 'high'): string {
  switch (urgency) {
    case 'high':
      return 'bg-red-50 border-red-200 text-red-800'
    case 'medium':
      return 'bg-amber-50 border-amber-200 text-amber-800'
    case 'low':
      return 'bg-blue-50 border-blue-200 text-blue-800'
    default:
      return 'bg-gray-50 border-gray-200 text-gray-800'
  }
}

function getPromptIcon(urgency: 'low' | 'medium' | 'high') {
  const iconClass = urgency === 'high' ? 'text-red-400' : urgency === 'medium' ? 'text-amber-400' : 'text-blue-400'
  
  if (urgency === 'high') {
    return (
      <svg className={`h-5 w-5 ${iconClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
    )
  }

  return (
    <svg className={`h-5 w-5 ${iconClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

// Smart purchase prompt that automatically determines when to show
export function SmartPurchasePrompt({ 
  wallet, 
  className = '',
  onDismiss,
  showDismiss = true 
}: {
  wallet: ResourceWallet | null
  className?: string
  onDismiss?: () => void
  showDismiss?: boolean
}) {
  if (!wallet) return null

  const totalResources = wallet.projectVouchers + wallet.facilitatorSeats + wallet.storytellerSeats

  let trigger: 'low' | 'empty' | 'insufficient' | null = null

  if (totalResources === 0) {
    trigger = 'empty'
  } else if (wallet.projectVouchers === 0 || wallet.facilitatorSeats === 0 || wallet.storytellerSeats === 0) {
    trigger = 'insufficient'
  } else if (totalResources <= 2) {
    trigger = 'low'
  }

  if (!trigger) return null

  return (
    <PurchasePrompt
      wallet={wallet}
      trigger={trigger}
      className={className}
      onDismiss={onDismiss}
      showDismiss={showDismiss}
    />
  )
}

// Hook for managing purchase prompt state
export function usePurchasePrompt(wallet: ResourceWallet | null) {
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({})

  const shouldShowPrompt = (trigger: 'low' | 'empty' | 'insufficient') => {
    if (!wallet || dismissed[trigger]) return false
    return checkShouldShow(wallet, trigger)
  }

  const dismissPrompt = (trigger: 'low' | 'empty' | 'insufficient') => {
    setDismissed(prev => ({ ...prev, [trigger]: true }))
  }

  const resetDismissed = () => {
    setDismissed({})
  }

  return {
    shouldShowPrompt,
    dismissPrompt,
    resetDismissed
  }
}