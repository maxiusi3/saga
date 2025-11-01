'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import api from '@/lib/api'
import type { UserResourceWallet } from '@saga/shared/types'
type WalletView = Pick<UserResourceWallet, 'projectVouchers' | 'facilitatorSeats' | 'storytellerSeats'>

interface WalletStatusProps {
  showDetails?: boolean
  className?: string
}

export function WalletStatus({ showDetails = false, className = '' }: WalletStatusProps) {
  const [wallet, setWallet] = useState<WalletView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 本地 withLocale，保证跳转链接包含当前语言
  const locale = useLocale()
  const tDashboard = useTranslations('dashboard')
  const tActions = useTranslations('common.actions')
  const withLocale = (path: string) => {
    if (!path || typeof path !== 'string') return path as any
    const sanitized = path.startsWith('/') ? path : `/${path}`
    if (sanitized === `/${locale}` || sanitized.startsWith(`/${locale}/`)) return sanitized
    return `/${locale}${sanitized}`
  }

  useEffect(() => {
    fetchWalletStatus()
  }, [])

  const fetchWalletStatus = async () => {
    try {
      setLoading(true)
      const { data } = await api.wallets.me()
      if (!data) {
        setError('Failed to load wallet status')
        return
      }
      const normalized: WalletView = {
        projectVouchers: (data as any).project_vouchers ?? (data as any).projectVouchers ?? 0,
        facilitatorSeats: (data as any).facilitator_seats ?? (data as any).facilitatorSeats ?? 0,
        storytellerSeats: (data as any).storyteller_seats ?? (data as any).storytellerSeats ?? 0,
      }
      setWallet(normalized)
    } catch (err) {
      setError('Failed to load wallet status')
      console.error('Error fetching wallet status:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="bg-gray-200 rounded-lg p-4">
          <div className="h-4 bg-gray-300 rounded w-1/2 mb-2"></div>
          <div className="h-3 bg-gray-300 rounded w-3/4"></div>
        </div>
      </div>
    )
  }

  if (error || !wallet) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center">
          <svg className="h-5 w-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <span className="text-sm text-red-800">{error}</span>
        </div>
      </div>
    )
  }

  const hasProjectVouchers = wallet.projectVouchers > 0
  const hasFacilitatorSeats = wallet.facilitatorSeats > 0
  const hasStorytellerSeats = wallet.storytellerSeats > 0

  if (!showDetails) {
    // Compact view for inline display
    return (
      <div className={`flex items-center space-x-4 ${className}`}>
        <div className="flex items-center">
          <div className={`w-2 h-2 rounded-full mr-2 ${hasProjectVouchers ? 'bg-green-400' : 'bg-red-400'}`}></div>
          <span className="text-sm text-gray-600">
            {wallet.projectVouchers} {tDashboard('welcomeHeader.metrics.projectVouchers')}
          </span>
        </div>
        <div className="flex items-center">
          <div className={`w-2 h-2 rounded-full mr-2 ${hasFacilitatorSeats ? 'bg-green-400' : 'bg-red-400'}`}></div>
          <span className="text-sm text-gray-600">
            {wallet.facilitatorSeats} {tDashboard('welcomeHeader.metrics.facilitatorSeats')}
          </span>
        </div>
        <div className="flex items-center">
          <div className={`w-2 h-2 rounded-full mr-2 ${hasStorytellerSeats ? 'bg-green-400' : 'bg-red-400'}`}></div>
          <span className="text-sm text-gray-600">
            {wallet.storytellerSeats} {tDashboard('welcomeHeader.metrics.storytellerSeats')}
          </span>
        </div>
      </div>
    )
  }

  // Detailed view for cards/panels
  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-900">{tDashboard('welcomeHeader.resourceWallet')}</h3>
        <Link
          href={withLocale('/dashboard/purchase')}
          className="text-xs text-primary-600 hover:text-primary-700 font-medium"
        >
          {tActions('manage')}
        </Link>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <svg className="h-4 w-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <span className="text-sm text-gray-600">{tDashboard('welcomeHeader.metrics.projectVouchers')}</span>
          </div>
          <div className="flex items-center">
            <span className={`text-sm font-medium ${hasProjectVouchers ? 'text-green-600' : 'text-red-600'}`}>
              {wallet.projectVouchers}
            </span>
            {!hasProjectVouchers && (
              <svg className="h-4 w-4 text-red-400 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <svg className="h-4 w-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span className="text-sm text-gray-600">{tDashboard('welcomeHeader.metrics.facilitatorSeats')}</span>
          </div>
          <div className="flex items-center">
            <span className={`text-sm font-medium ${hasFacilitatorSeats ? 'text-green-600' : 'text-red-600'}`}>
              {wallet.facilitatorSeats}
            </span>
            {!hasFacilitatorSeats && (
              <svg className="h-4 w-4 text-red-400 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <svg className="h-4 w-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="text-sm text-gray-600">{tDashboard('welcomeHeader.metrics.storytellerSeats')}</span>
          </div>
          <div className="flex items-center">
            <span className={`text-sm font-medium ${hasStorytellerSeats ? 'text-green-600' : 'text-red-600'}`}>
              {wallet.storytellerSeats}
            </span>
            {!hasStorytellerSeats && (
              <svg className="h-4 w-4 text-red-400 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            )}
          </div>
        </div>
      </div>

      {(!hasProjectVouchers || !hasFacilitatorSeats || !hasStorytellerSeats) && (
        <div className="mt-4 pt-3 border-t border-gray-200">
          <Link
            href={withLocale('/dashboard/purchase#packages')}
            className="inline-flex items-center text-xs text-primary-600 hover:text-primary-700 font-medium"
          >
            <svg className="h-3 w-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            {tActions('purchaseMore')}
          </Link>
        </div>
      )}
    </div>
  )
}

export function InsufficientResourcesAlert({ 
  resourceType, 
  required = 1, 
  available = 0,
  className = '' 
}: {
  resourceType: 'projectVouchers' | 'facilitatorSeats' | 'storytellerSeats'
  required?: number
  available?: number
  className?: string
}) {
  const locale = useLocale()
  const tDashboard = useTranslations('dashboard')
  const withLocale = (path: string) => {
    if (!path || typeof path !== 'string') return path as any
    const sanitized = path.startsWith('/') ? path : `/${path}`
    if (sanitized === `/${locale}` || sanitized.startsWith(`/${locale}/`)) return sanitized
    return `/${locale}${sanitized}`
  }
  const metricKey = resourceType === 'projectVouchers'
    ? 'projectVouchers'
    : resourceType === 'facilitatorSeats'
      ? 'facilitatorSeats'
      : 'storytellerSeats'
  const resourceLabel = tDashboard(`welcomeHeader.metrics.${metricKey}`)

  return (
    <div className={`bg-amber-50 border border-amber-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-amber-800">
            {tDashboard('wallet.insufficientResources')}
          </h3>
          <div className="mt-2 text-sm text-amber-700">
            <p>
              {tDashboard('wallet.needResources', { required, resource: resourceLabel, available })}
            </p>
          </div>
          <div className="mt-4">
            <div className="flex space-x-3">
              <Link
                href={withLocale('/dashboard/purchase#packages')}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-amber-700 bg-amber-100 hover:bg-amber-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500"
              >
                {tDashboard('wallet.purchasePackage')}
              </Link>
              <Link
                href={withLocale('/dashboard/purchase')}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-amber-700 bg-transparent hover:bg-amber-50"
              >
                {tDashboard('wallet.viewWallet')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}