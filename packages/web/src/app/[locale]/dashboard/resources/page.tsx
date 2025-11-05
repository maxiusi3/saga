'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { ShoppingCart, Users, UserPlus, BookOpen } from 'lucide-react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'

interface ResourceSeat {
  type: 'project' | 'facilitator' | 'storyteller'
  available: number
  used: number
  total: number
  price: number
  description: string
}

export default function ResourcesPage() {
  const locale = useLocale()
  const t = useTranslations('resources')
  const withLocale = (path: string) => {
    if (!path.startsWith('/')) return path
    if (path === `/${locale}` || path.startsWith(`/${locale}/`)) return path
    return `/${locale}${path}`
  }
  const [resources, setResources] = useState<ResourceSeat[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadResources = async () => {
      try {
        // TODO: Load real resource data from Supabase
        // For now, show empty resources since user needs to purchase
        const realResources: ResourceSeat[] = [
          {
            type: 'project',
            available: 0,
            used: 0,
            total: 0,
            price: 15,
            description: t('types.project.description')
          },
          {
            type: 'facilitator',
            available: 0,
            used: 0,
            total: 0,
            price: 10,
            description: t('types.facilitator.description')
          },
          {
            type: 'storyteller',
            available: 0,
            used: 0,
            total: 0,
            price: 5,
            description: t('types.storyteller.description')
          }
        ]

        setResources(realResources)
        setLoading(false)
      } catch (error) {
        console.error('Error loading resources:', error)
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
                  value={(resource.used / resource.total) * 100} 
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
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border border-border rounded-lg">
              <div className="flex items-center space-x-3">
                <BookOpen className="h-5 w-5 text-primary" />
                <div>
                  <div className="font-medium text-foreground">{t('activity.created', { name: "Dad's Life Story" })}</div>
                  <div className="text-sm text-muted-foreground">{t('activity.usedProject')}</div>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                Jan 15, 2024
              </div>
            </div>

            <div className="flex items-center justify-between p-4 border border-border rounded-lg">
              <div className="flex items-center space-x-3">
                <UserPlus className="h-5 w-5 text-primary" />
                <div>
                  <div className="font-medium text-foreground">{t('activity.invitedStoryteller', { name: "John Doe" })}</div>
                  <div className="text-sm text-muted-foreground">{t('activity.usedStoryteller')}</div>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                Jan 16, 2024
              </div>
            </div>

            <div className="flex items-center justify-between p-4 border border-border rounded-lg">
              <div className="flex items-center space-x-3">
                <Users className="h-5 w-5 text-primary" />
                <div>
                  <div className="font-medium text-foreground">{t('activity.invitedFacilitator', { name: "Beth Smith" })}</div>
                  <div className="text-sm text-muted-foreground">{t('activity.usedFacilitator')}</div>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                Jan 18, 2024
              </div>
            </div>
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
