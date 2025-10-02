import * as React from "react"
import { cn } from "@/lib/utils"
import { EnhancedCard, EnhancedCardContent } from "./enhanced-card"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"

interface StatsCardProps {
  title: string
  value: string | number
  description?: string
  icon?: React.ReactNode
  trend?: {
    value: number
    label: string
    direction: 'up' | 'down' | 'neutral'
  }
  className?: string
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info'
}

const variantStyles = {
  default: {
    card: "border-border",
    icon: "text-primary bg-primary/10",
    trend: {
      up: "text-success",
      down: "text-error",
      neutral: "text-muted-foreground"
    }
  },
  success: {
    card: "border-success/20 bg-success/5",
    icon: "text-success bg-success/10",
    trend: {
      up: "text-success",
      down: "text-error",
      neutral: "text-muted-foreground"
    }
  },
  warning: {
    card: "border-warning/20 bg-warning/5",
    icon: "text-warning bg-warning/10",
    trend: {
      up: "text-success",
      down: "text-error",
      neutral: "text-muted-foreground"
    }
  },
  error: {
    card: "border-error/20 bg-error/5",
    icon: "text-error bg-error/10",
    trend: {
      up: "text-success",
      down: "text-error",
      neutral: "text-muted-foreground"
    }
  },
  info: {
    card: "border-info/20 bg-info/5",
    icon: "text-info bg-info/10",
    trend: {
      up: "text-success",
      down: "text-error",
      neutral: "text-muted-foreground"
    }
  }
}

export function StatsCard({
  title,
  value,
  description,
  icon,
  trend,
  className,
  variant = 'default'
}: StatsCardProps) {
  const styles = variantStyles[variant]
  
  const getTrendIcon = () => {
    if (!trend) return null
    
    switch (trend.direction) {
      case 'up':
        return <TrendingUp className="h-3 w-3" />
      case 'down':
        return <TrendingDown className="h-3 w-3" />
      case 'neutral':
        return <Minus className="h-3 w-3" />
      default:
        return null
    }
  }

  return (
    <EnhancedCard 
      variant="default" 
      className={cn(styles.card, className)}
    >
      <EnhancedCardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground mb-2">
              {title}
            </p>
            <div className="flex items-baseline space-x-2">
              <p className="text-2xl font-bold text-foreground">
                {value}
              </p>
              {trend && (
                <div className={cn(
                  "flex items-center space-x-1 text-xs font-medium",
                  styles.trend[trend.direction]
                )}>
                  {getTrendIcon()}
                  <span>{trend.value > 0 ? '+' : ''}{trend.value}%</span>
                </div>
              )}
            </div>
            {description && (
              <p className="text-xs text-muted-foreground mt-1">
                {description}
              </p>
            )}
            {trend?.label && (
              <p className="text-xs text-muted-foreground mt-1">
                {trend.label}
              </p>
            )}
          </div>
          
          {icon && (
            <div className={cn(
              "flex items-center justify-center w-12 h-12 rounded-lg",
              styles.icon
            )}>
              {icon}
            </div>
          )}
        </div>
      </EnhancedCardContent>
    </EnhancedCard>
  )
}