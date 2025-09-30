'use client'

import { useState, useRef, useEffect } from 'react'
import { Wallet, ChevronDown, Coins, Crown, Mic } from 'lucide-react'
import { useResourceWallet } from '@/hooks/use-resource-wallet'
import { Button } from '@/components/ui/button'

export function WalletBalanceDropdown() {
  const { wallet, loading } = useResourceWallet()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Click outside to close dropdown menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // When wallet is loading or not yet available, still render interactive entry to avoid "unresponsive" experience
  const isLoadingOrEmpty = loading || !wallet

  const hasLowResources = wallet ? (
    wallet.project_vouchers === 0 ||
    wallet.facilitator_seats === 0 ||
    wallet.storyteller_seats === 0
  ) : false

  return (
    <div className="relative" ref={dropdownRef}>
      {/* 触发按钮 - 更简洁的设计（在加载中也允许点击以展示占位） */}
      <Button
        variant="ghost"
        size="sm"
        className={`flex items-center space-x-1 h-8 px-2 rounded-full ${
          hasLowResources ? 'text-orange-600 hover:text-orange-700 bg-orange-50' : 'text-muted-foreground hover:text-foreground'
        }`}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-busy={isLoadingOrEmpty}
        title="View resource balance"
      >
        <Wallet className="w-4 h-4" />
        {hasLowResources && (
          <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse"></div>
        )}
        <span className="text-xs font-medium">
          {isLoadingOrEmpty ? '...' : (wallet!.project_vouchers + wallet!.facilitator_seats + wallet!.storyteller_seats)}
        </span>
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </Button>

      {/* Dropdown menu - unified styling (shows skeleton when loading) */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-64 z-50">
          <div className="bg-popover text-popover-foreground rounded-lg border shadow-md p-3">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">Resource Balance</h3>
              <div className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${isLoadingOrEmpty ? 'bg-gray-300' : 'bg-green-500'}`}></div>
                <span className="text-xs text-muted-foreground">{isLoadingOrEmpty ? 'Loading' : 'Free Trial'}</span>
              </div>
            </div>

            {isLoadingOrEmpty ? (
              <div className="space-y-2 animate-pulse" aria-live="polite">
                <div className="h-4 bg-muted rounded" />
                <div className="h-4 bg-muted rounded" />
                <div className="h-4 bg-muted rounded" />
              </div>
            ) : (
              <div className="space-y-2">
                {/* Project vouchers */}
                <div className="flex items-center justify-between py-1">
                  <div className="flex items-center space-x-2">
                    <Coins className="w-3.5 h-3.5 text-blue-500" />
                    <span className="text-sm text-foreground">Projects</span>
                  </div>
                  <div className={`text-sm font-semibold px-2 py-0.5 rounded-full ${
                    wallet!.project_vouchers === 0
                      ? 'text-orange-700 bg-orange-100'
                      : 'text-green-700 bg-green-100'
                  }`}>
                    {wallet!.project_vouchers}
                  </div>
                </div>

                {/* Facilitator seats */}
                <div className="flex items-center justify-between py-1">
                  <div className="flex items-center space-x-2">
                    <Crown className="w-3.5 h-3.5 text-purple-500" />
                    <span className="text-sm text-foreground">Facilitators</span>
                  </div>
                  <div className={`text-sm font-semibold px-2 py-0.5 rounded-full ${
                    wallet!.facilitator_seats === 0
                      ? 'text-orange-700 bg-orange-100'
                      : 'text-green-700 bg-green-100'
                  }`}>
                    {wallet!.facilitator_seats}
                  </div>
                </div>

                {/* Storyteller seats */}
                <div className="flex items-center justify-between py-1">
                  <div className="flex items-center space-x-2">
                    <Mic className="w-3.5 h-3.5 text-green-500" />
                    <span className="text-sm text-foreground">Storytellers</span>
                  </div>
                  <div className={`text-sm font-semibold px-2 py-0.5 rounded-full ${
                    wallet!.storyteller_seats === 0
                      ? 'text-orange-700 bg-orange-100'
                      : 'text-green-700 bg-green-100'
                  }`}>
                    {wallet!.storyteller_seats}
                  </div>
                </div>
              </div>
            )}

            {/* Bottom note - more concise */}
            <div className="mt-3 pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground text-center">
                💡 Free trial, no payment required
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
