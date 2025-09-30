'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Clock, Calendar, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react'
import { formatServiceStatus, getDaysRemaining, getServiceProgress } from '@saga/shared/config/service-plans'

interface ProjectServiceTimeProps {
  projectId: string
  servicePlan?: {
    id: string
    name: string
    startDate: string
    endDate: string
  }
  className?: string
  onRenew?: () => void
}

export function ProjectServiceTime({ 
  projectId, 
  servicePlan, 
  className = '',
  onRenew 
}: ProjectServiceTimeProps) {
  const [timeInfo, setTimeInfo] = useState<{
    status: 'active' | 'expiring_soon' | 'expired'
    message: string
    daysRemaining: number
    progressPercentage: number
  } | null>(null)

  useEffect(() => {
    if (!servicePlan) return

    const endDate = new Date(servicePlan.endDate)
    const startDate = new Date(servicePlan.startDate)
    const statusInfo = formatServiceStatus(endDate)
    const progress = getServiceProgress(startDate, endDate)

    setTimeInfo({
      ...statusInfo,
      progressPercentage: progress
    })
  }, [servicePlan])

  if (!servicePlan || !timeInfo) {
    return null
  }

  const getStatusConfig = () => {
    switch (timeInfo.status) {
      case 'active':
        return {
          icon: CheckCircle,
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          badgeVariant: 'default' as const,
          progressColor: 'bg-green-500'
        }
      case 'expiring_soon':
        return {
          icon: AlertTriangle,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          badgeVariant: 'secondary' as const,
          progressColor: 'bg-yellow-500'
        }
      case 'expired':
        return {
          icon: AlertTriangle,
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          badgeVariant: 'destructive' as const,
          progressColor: 'bg-red-500'
        }
    }
  }

  const config = getStatusConfig()
  const Icon = config.icon

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  return (
    <Card className={`${config.bgColor} ${config.borderColor} border ${className}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Icon className={`h-5 w-5 ${config.color}`} />
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-1">
                <h3 className="text-sm font-medium text-foreground">Service Status</h3>
                <Badge variant={config.badgeVariant} className="text-xs">
                  {timeInfo.status === 'active' ? 'Active' : 
                   timeInfo.status === 'expiring_soon' ? 'Expiring Soon' : 'Expired'}
                </Badge>
              </div>
              
              <div className="space-y-1">
                <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                  <div className="flex items-center space-x-1">
                    <Calendar className="h-3 w-3" />
                    <span>Expires {formatDate(servicePlan.endDate)}</span>
                  </div>
                  {timeInfo.daysRemaining > 0 && (
                    <div className="flex items-center space-x-1">
                      <Clock className="h-3 w-3" />
                      <span>{timeInfo.daysRemaining} days left</span>
                    </div>
                  )}
                </div>

                {/* Progress bar */}
                {timeInfo.status !== 'expired' && (
                  <div className="w-full">
                    <Progress 
                      value={100 - timeInfo.progressPercentage} 
                      className="h-1.5 w-full"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action button */}
          {(timeInfo.status === 'expiring_soon' || timeInfo.status === 'expired') && onRenew && (
            <Button
              onClick={onRenew}
              size="sm"
              variant={timeInfo.status === 'expired' ? 'default' : 'outline'}
              className={timeInfo.status === 'expired' ? 'bg-primary hover:bg-primary/90' : ''}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              {timeInfo.status === 'expired' ? 'Reactivate' : 'Renew'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}