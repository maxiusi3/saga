'use client'

import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { ShoppingCart, Users, UserPlus, BookOpen } from 'lucide-react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { settingsService } from '@/services/settings-service'

interface ResourceSeat {
  type: 'project' | 'facilitator' | 'storyteller'
  available: number
  used: number
  total: number
  price: number
  description: string
}

interface ResourceWalletState {
  project_vouchers: number
  facilitator_seats: number
  storyteller_seats: number
}

export default function ResourcesPage() {
  const locale = useLocale()
  const t = useTranslations('resources')
  const withLocale = (path: string) => {
    if (!path.startsWith('/')) return path
    if (path === `/${locale}` || path.startsWith(`/${locale}/`)) return path
    return `/${locale}${path}`
  }
  const [wallet, setWallet] = useState<ResourceWalletState | null>(null)
  const [loading, setLoading] = useState(true)

  const resources = useMemo<ResourceSeat[]>(() => {
    const currentWallet = wallet || {
      project_vouchers: 0,
      facilitator_seats: 0,
      storyteller_seats: 0
    }

    return [
      {
        type: 'project',
        available: currentWallet.project_vouchers,
        used: 0,
        total: currentWallet.project_vouchers,
        price: 15,
        description: t('types.project.description')
      },
      {
        type: 'facilitator',
        available: currentWallet.facilitator_seats,
        used: 0,
        total: currentWallet.facilitator_seats,
        price: 10,
        description: t('types.facilitator.description')
      },
      {
        type: 'storyteller',
        available: currentWallet.storyteller_seats,
        used: 0,
        total: currentWallet.storyteller_seats,
        price: 5,
        description: t('types.storyteller.description')
      }
    ]
  }, [wallet, t])

  useEffect(() => {
    const loadResources = async () => {
      try {
        const nextWallet = await settingsService.getResourceWallet()
        setWallet(nextWallet)
        setLoading(false)
      } catch (error) {
        console.error('Error loading resources:', error)
        setWallet({
          project_vouchers: 0,
          facilitator_seats: 0,
          storyteller_seats: 0
        })
        setLoading(false)
      }
    }

    loadResources()
  }, [])

  const getResourceIcon = (type: ResourceSeat['type']) => {
    switch (type) {
      case 'project':
        return <BookOpen className="h-6 w-6 text-primary" />
      case 'facilitator':
        return <Users className="h-6 w-6 text-primary" />
      case 'storyteller':
        return <UserPlus className="h-6 w-6 text-primary" />
    }
  }

  const getResourceTitle = (type: ResourceSeat['type']) => {
    switch (type) {
      case 'project':
        return t('types.project.title')
      case 'facilitator':
        return t('types.facilitator.title')
      case 'storyteller':
        return t('types.storyteller.title')
    }
  }

  const handlePurchase = (type: ResourceSeat['type']) => {
    // TODO: Implement individual seat purchase flow
    alert(t('alerts.purchaseComingSoon', { type }))
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-muted rounded animate-pulse"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-muted rounded-lg animate-pulse"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('title')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('subtitle')}
          </p>
        </div>
        
        <Link href={withLocale('/dashboard/purchase')}>
          <Button>
            <ShoppingCart className="h-4 w-4 mr-2" />
            {t('buyMoreSeats')}
          </Button>
        </Link>
      </div>

      {/* Resource Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {resources.map((resource) => (
          <Card key={resource.type} className="p-6">
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {getResourceIcon(resource.type)}
                  <h3 className="font-semibold text-foreground">
                    {getResourceTitle(resource.type)}
                  </h3>
                </div>
                <Badge 
                  variant={resource.available > 0 ? "default" : "secondary"}
                >
                  {resource.available} {t('available')}
                </Badge>
              </div>

              {/* Usage Stats */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('usage')}</span>
                  <span className="text-foreground">
                    {t('usageStats', { used: resource.used, total: resource.total })}
                  </span>
                </div>
                <Progress 
                  value={resource.total > 0 ? (resource.used / resource.total) * 100 : 0}
                  className="h-2"
                />
              </div>

              {/* Description */}
              <p className="text-sm text-muted-foreground">
                {resource.description}
              </p>

              {/* Purchase Button */}
              <Button
                variant="outline"
                className="w-full"
                onClick={() => handlePurchase(resource.type)}
              >
                {t('buyMore', { price: resource.price })}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Usage History */}
      <Card className="p-6">
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-foreground">{t('recentActivity')}</h2>
          
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            {t('activity.empty')}
          </div>
        </div>
      </Card>

      {/* Purchase Options */}
      <Card className="p-6">
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-foreground">{t('purchaseAdditional')}</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border border-border rounded-lg p-4">
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  <span className="font-medium text-foreground">{t('purchase.project.title')}</span>
                </div>
                <div className="text-2xl font-bold text-primary">$15</div>
                <p className="text-sm text-muted-foreground">
                  {t('purchase.project.description')}
                </p>
                <Button variant="outline" size="sm" className="w-full">
                  {t('purchase.button')}
                </Button>
              </div>
            </div>

            <div className="border border-border rounded-lg p-4">
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Users className="h-5 w-5 text-primary" />
                  <span className="font-medium text-foreground">{t('purchase.facilitator.title')}</span>
                </div>
                <div className="text-2xl font-bold text-primary">$10</div>
                <p className="text-sm text-muted-foreground">
                  {t('purchase.facilitator.description')}
                </p>
                <Button variant="outline" size="sm" className="w-full">
                  {t('purchase.button')}
                </Button>
              </div>
            </div>

            <div className="border border-border rounded-lg p-4">
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <UserPlus className="h-5 w-5 text-primary" />
                  <span className="font-medium text-foreground">{t('purchase.storyteller.title')}</span>
                </div>
                <div className="text-2xl font-bold text-primary">$5</div>
                <p className="text-sm text-muted-foreground">
                  {t('purchase.storyteller.description')}
                </p>
                <Button variant="outline" size="sm" className="w-full">
                  {t('purchase.button')}
                </Button>
              </div>
            </div>
          </div>

          <Separator />

          <div className="text-center">
            <p className="text-muted-foreground mb-4">
              {t('packagePromo')}
            </p>
            <Link href={withLocale('/dashboard/purchase')}>
              <Button>
                {t('viewPackage')}
              </Button>
            </Link>
          </div>
        </div>
      </Card>
    </div>
  )
}
