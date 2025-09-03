import React, { useState } from 'react'
import { Bell, BellRing } from 'lucide-react'
import { FurbridgeButton } from '@/components/ui/furbridge-button'
import { Badge } from '@/components/ui/badge'
import { useNotifications } from '@/hooks/useNotifications'
import { NotificationDropdown } from './NotificationDropdown'
import { useAuthStore } from '@/stores/auth-store'

interface NotificationBellProps {
  className?: string
}

export function NotificationBell({ className }: NotificationBellProps) {
  const { user } = useAuthStore()
  const { unreadCount, loading } = useNotifications()
  const [isOpen, setIsOpen] = useState(false)

  // Don't show notification bell if user is not authenticated
  if (!user) {
    return null
  }

  return (
    <div className="relative">
      <FurbridgeButton
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className={`relative ${className}`}
        disabled={loading}
      >
        {unreadCount > 0 ? (
          <BellRing className="h-5 w-5 text-furbridge-orange" />
        ) : (
          <Bell className="h-5 w-5" />
        )}
        
        {unreadCount > 0 && (
          <Badge 
            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-furbridge-orange text-white text-xs"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </FurbridgeButton>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-2 z-50">
            <NotificationDropdown onClose={() => setIsOpen(false)} />
          </div>
        </>
      )}
    </div>
  )
}
