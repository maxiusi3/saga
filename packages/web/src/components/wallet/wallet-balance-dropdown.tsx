'use client'

import { useState, useRef, useEffect } from 'react'
import { Wallet, ChevronDown, Coins, Crown, Mic } from 'lucide-react'
import { useResourceWallet } from '@/hooks/use-resource-wallet'
import { Button } from '@/components/ui/button'

export function WalletBalanceDropdown() {
  const { wallet, loading } = useResourceWallet()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // 点击外部关闭下拉菜单
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

  if (loading || !wallet) {
    return (
      <div className="flex items-center">
        <div className="w-8 h-8 bg-muted rounded-full animate-pulse"></div>
      </div>
    )
  }

  const hasLowResources = wallet.project_vouchers === 0 || 
                         wallet.facilitator_seats === 0 || 
                         wallet.storyteller_seats === 0

  return (
    <div className="relative" ref={dropdownRef}>
      {/* 触发按钮 */}
      <Button
        variant="ghost"
        size="sm"
        className={`flex items-center space-x-2 h-8 px-2 ${
          hasLowResources ? 'text-orange-600 hover:text-orange-700' : 'text-muted-foreground hover:text-foreground'
        }`}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Wallet className="w-4 h-4" />
        {hasLowResources && (
          <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
        )}
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </Button>

      {/* 下拉菜单 */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-background border border-border rounded-lg shadow-lg z-50">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-foreground">资源余额</h3>
              <Wallet className="w-4 h-4 text-muted-foreground" />
            </div>
            
            <div className="space-y-3">
              {/* 项目额度 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Coins className="w-4 h-4 text-primary" />
                  <span className="text-sm text-foreground">项目额度</span>
                </div>
                <div className={`text-sm font-medium ${
                  wallet.project_vouchers === 0 ? 'text-orange-600' : 'text-foreground'
                }`}>
                  {wallet.project_vouchers}
                </div>
              </div>

              {/* Facilitator席位 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Crown className="w-4 h-4 text-primary" />
                  <span className="text-sm text-foreground">Facilitator席位</span>
                </div>
                <div className={`text-sm font-medium ${
                  wallet.facilitator_seats === 0 ? 'text-orange-600' : 'text-foreground'
                }`}>
                  {wallet.facilitator_seats}
                </div>
              </div>

              {/* Storyteller席位 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Mic className="w-4 h-4 text-primary" />
                  <span className="text-sm text-foreground">Storyteller席位</span>
                </div>
                <div className={`text-sm font-medium ${
                  wallet.storyteller_seats === 0 ? 'text-orange-600' : 'text-foreground'
                }`}>
                  {wallet.storyteller_seats}
                </div>
              </div>
            </div>

            {/* 底部说明 */}
            <div className="mt-4 pt-3 border-t border-border">
              <p className="text-xs text-muted-foreground">
                这是临时免费体验功能，正式版本将支持购买更多资源
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
