'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Wallet, 
  Plus, 
  AlertTriangle, 
  CheckCircle, 
  Users, 
  FolderPlus,
  Crown,
  User
} from 'lucide-react'
import Link from 'next/link'
import { useLocale } from 'next-intl'

interface ResourceWallet {
  projectVouchers: number
  facilitatorSeats: number
  storytellerSeats: number
}

interface ResourceWalletWidgetProps {
  resourceWallet: ResourceWallet
  onPurchaseClick?: () => void
  className?: string
}

interface ResourceItemProps {
  icon: React.ReactNode
  label: string
  count: number
  description: string
  isLow: boolean
}

function ResourceItem({ icon, label, count, description, isLow }: ResourceItemProps) {
  return (
    <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-background/50">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${isLow ? 'bg-warning/10' : 'bg-primary/10'}`}>
          {icon}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium text-foreground">{label}</p>
            {isLow ? (
              <AlertTriangle className="w-4 h-4 text-warning" />
            ) : (
              <CheckCircle className="w-4 h-4 text-success" />
            )}
          </div>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="text-right">
        <p className={`text-2xl font-bold ${isLow ? 'text-warning' : 'text-foreground'}`}>
          {count}
        </p>
        <Badge 
          variant={isLow ? 'warning' : 'success'} 
          size="sm"
        >
          {isLow ? 'Low' : 'Available'}
        </Badge>
      </div>
    </div>
  )
}

export function ResourceWalletWidget({ 
  resourceWallet, 
  onPurchaseClick,
  className = '' 
}: ResourceWalletWidgetProps) {
  const locale = useLocale()
  const withLocale = (path: string) => {
    if (!path.startsWith('/')) return path
    if (path === `/${locale}` || path.startsWith(`/${locale}/`)) return path
    return `/${locale}${path}`
  }
  const isProjectVouchersLow = resourceWallet.projectVouchers < 1
  const isFacilitatorSeatsLow = resourceWallet.facilitatorSeats < 2
  const isStorytellerSeatsLow = resourceWallet.storytellerSeats < 2
  
  const hasAnyLowResources = isProjectVouchersLow || isFacilitatorSeatsLow || isStorytellerSeatsLow
  const totalResources = resourceWallet.projectVouchers + resourceWallet.facilitatorSeats + resourceWallet.storytellerSeats

  return (
    <Card variant="content" className={`${className}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Wallet className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Resource Wallet</CardTitle>
              <p className="text-sm text-muted-foreground">
                Manage your Saga resources
              </p>
            </div>
          </div>
          
          {hasAnyLowResources && (
            <Badge variant="warning" className="animate-pulse">
              Action Required
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Resource Items */}
        <div className="space-y-3">
          <ResourceItem
            icon={<FolderPlus className={`w-5 h-5 ${isProjectVouchersLow ? 'text-warning' : 'text-primary'}`} />}
            label="Project Vouchers"
            count={resourceWallet.projectVouchers}
            description="Create new family biography projects"
            isLow={isProjectVouchersLow}
          />
          
          <ResourceItem
            icon={<Crown className={`w-5 h-5 ${isFacilitatorSeatsLow ? 'text-warning' : 'text-primary'}`} />}
            label="Facilitator Seats"
            count={resourceWallet.facilitatorSeats}
            description="Invite siblings to co-manage projects"
            isLow={isFacilitatorSeatsLow}
          />
          
          <ResourceItem
            icon={<User className={`w-5 h-5 ${isStorytellerSeatsLow ? 'text-warning' : 'text-primary'}`} />}
            label="Storyteller Seats"
            count={resourceWallet.storytellerSeats}
            description="Invite family members to share stories"
            isLow={isStorytellerSeatsLow}
          />
        </div>

        {/* Summary and Actions */}
        <div className="pt-4 border-t border-border/50">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-foreground">
                Total Resources: {totalResources}
              </p>
              <p className="text-xs text-muted-foreground">
                {hasAnyLowResources 
                  ? 'Some resources are running low' 
                  : 'All resources are well stocked'
                }
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-2">
            {hasAnyLowResources ? (
              <>
                <Button 
                  variant="primary" 
                  className="flex-1"
                  onClick={onPurchaseClick}
                  asChild
                >
                  <Link href={withLocale('/dashboard/purchase')}>
                    <Plus className="w-4 h-4 mr-2" />
                    Purchase Resources
                  </Link>
                </Button>
                <Button 
                  variant="secondary" 
                  size="sm"
                  asChild
                >
                  <Link href={withLocale('/dashboard/purchase#packages')}>
                    View Packages
                  </Link>
                </Button>
              </>
            ) : (
              <>
                <Button 
                  variant="secondary" 
                  className="flex-1"
                  onClick={onPurchaseClick}
                  asChild
                >
                  <Link href={withLocale('/dashboard/purchase')}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add More Resources
                  </Link>
                </Button>
                <Button 
                  variant="tertiary" 
                  size="sm"
                  asChild
                >
                  <Link href={withLocale('/dashboard/purchase#packages')}>
                    View Packages
                  </Link>
                </Button>
              </>
            )}
          </div>

          {/* Insufficient Resources Warning */}
          {hasAnyLowResources && (
            <div className="mt-4 p-3 bg-warning/10 border border-warning/20 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-warning">
                    Insufficient Resources
                  </p>
                  <p className="text-xs text-warning/80 mt-1">
                    {isProjectVouchersLow && 'You need Project Vouchers to create new projects. '}
                    {isFacilitatorSeatsLow && 'You need Facilitator Seats to invite co-managers. '}
                    {isStorytellerSeatsLow && 'You need Storyteller Seats to invite family members. '}
                    Purchase more resources to continue.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}