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
      {/* 触发按钮 - 更简洁的设计 */}
      <Button
        variant="ghost"
        size="sm"
        className={`flex items-center space-x-1 h-8 px-2 rounded-full ${
          hasLowResources ? 'text-orange-600 hover:text-orange-700 bg-orange-50' : 'text-muted-foreground hover:text-foreground'
        }`}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        title="查看资源余额"
      >
        <Wallet className="w-4 h-4" />
        {hasLowResources && (
          <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse"></div>
        )}
        <span className="text-xs font-medium">
          {wallet.project_vouchers + wallet.facilitator_seats + wallet.storyteller_seats}
        </span>
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </Button>

      {/* 下拉菜单 - 统一样式 */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-64 z-50">
          <div className="bg-popover text-popover-foreground rounded-lg border shadow-md p-3">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">资源余额</h3>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-xs text-muted-foreground">免费体验</span>
              </div>
            </div>
            
            <div className="space-y-2">
              {/* 项目额度 */}
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center space-x-2">
                  <Coins className="w-3.5 h-3.5 text-blue-500" />
                  <span className="text-sm text-foreground">项目</span>
                </div>
                <div className={`text-sm font-semibold px-2 py-0.5 rounded-full ${
                  wallet.project_vouchers === 0
                    ? 'text-orange-700 bg-orange-100'
                    : 'text-green-700 bg-green-100'
                }`}>
                  {wallet.project_vouchers}
                </div>
              </div>

              {/* Facilitator席位 */}
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center space-x-2">
                  <Crown className="w-3.5 h-3.5 text-purple-500" />
                  <span className="text-sm text-foreground">管理员</span>
                </div>
                <div className={`text-sm font-semibold px-2 py-0.5 rounded-full ${
                  wallet.facilitator_seats === 0
                    ? 'text-orange-700 bg-orange-100'
                    : 'text-green-700 bg-green-100'
                }`}>
                  {wallet.facilitator_seats}
                </div>
              </div>

              {/* Storyteller席位 */}
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center space-x-2">
                  <Mic className="w-3.5 h-3.5 text-green-500" />
                  <span className="text-sm text-foreground">讲述者</span>
                </div>
                <div className={`text-sm font-semibold px-2 py-0.5 rounded-full ${
                  wallet.storyteller_seats === 0
                    ? 'text-orange-700 bg-orange-100'
                    : 'text-green-700 bg-green-100'
                }`}>
                  {wallet.storyteller_seats}
                </div>
              </div>
            </div>

            {/* 底部说明 - 更简洁 */}
            <div className="mt-3 pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground text-center">
                💡 免费体验中，无需付费
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
