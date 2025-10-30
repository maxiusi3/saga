'use client'

import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Wallet, Plus, AlertCircle, Crown } from 'lucide-react'
import Link from 'next/link'
import { useLocale } from 'next-intl'

interface ResourceWallet {
  projectVouchers: number
  facilitatorSeats: number
  storytellerSeats: number
}

interface WelcomeHeaderProps {
  userName?: string
  userAvatar?: string
  resourceWallet?: ResourceWallet
  isOwner?: boolean
  onPurchaseClick?: () => void
}

export function WelcomeHeader({
  userName = 'User',
  userAvatar,
  resourceWallet = {
    projectVouchers: 0,
    facilitatorSeats: 0,
    storytellerSeats: 0
  },
  isOwner = false,
  onPurchaseClick
}: WelcomeHeaderProps) {
  const locale = useLocale()
  const withLocale = (path: string) => {
    if (!path.startsWith('/')) return path
    if (path === `/${locale}` || path.startsWith(`/${locale}/`)) return path
    return `/${locale}${path}`
  }
  const hasLowResources = resourceWallet.projectVouchers < 1 || 
                         resourceWallet.facilitatorSeats < 1 || 
                         resourceWallet.storytellerSeats < 1

  const getTimeOfDayGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <div className="mb-8">
      <Card variant="content" className="bg-gradient-to-r from-primary/5 to-secondary/5 border-primary/20">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            {/* Welcome Message Section */}
            <div className="flex items-center gap-4">
              <Avatar size="lg">
                <AvatarImage src={userAvatar} alt={userName} />
                <AvatarFallback className="text-lg">
                  {userName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-h2 text-foreground">
                    {getTimeOfDayGreeting()}, {userName}
                  </h1>
                  {isOwner && (
                    <Badge variant="facilitator" size="sm" className="bg-amber-100 text-amber-800">
                      <Crown className="w-3 h-3 mr-1" />
                      Owner
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground">
                  Welcome back to your family story dashboard
                </p>
              </div>
            </div>

            {/* Resource Wallet Section */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <Card variant="information" size="compact" className="bg-background/50 border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Wallet className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground mb-1">Resource Wallet</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{resourceWallet.projectVouchers} Projects</span>
                        <span>•</span>
                        <span>{resourceWallet.facilitatorSeats} Facilitator Seats</span>
                        <span>•</span>
                        <span>{resourceWallet.storytellerSeats} Storyteller Seats</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Purchase Options */}
              {hasLowResources && (
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-warning" />
                  <span className="text-sm text-warning mr-2">Low resources</span>
                  <Button 
                    variant="secondary" 
                    size="sm"
                  onClick={onPurchaseClick}
                  asChild
                >
                  <Link href={withLocale('/dashboard/purchase')}>
                    <Plus className="w-4 h-4 mr-1" />
                    Purchase More
                  </Link>
                </Button>
                </div>
              )}

              {!hasLowResources && (
                <Button 
                  variant="tertiary" 
                  size="sm"
                  onClick={onPurchaseClick}
                  asChild
                >
                  <Link href={withLocale('/dashboard/purchase')}>
                    <Plus className="w-4 h-4 mr-1" />
                    Add Resources
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}