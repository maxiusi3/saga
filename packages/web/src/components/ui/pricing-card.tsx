import * as React from "react"
import { cn } from "@/lib/utils"
import { EnhancedCard, EnhancedCardContent, EnhancedCardHeader } from "./enhanced-card"
import { EnhancedButton } from "./enhanced-button"
import { Check, Star, Zap } from "lucide-react"

interface PricingFeature {
  text: string
  included: boolean
  highlight?: boolean
}

interface PricingCardProps {
  title: string
  subtitle?: string
  price: {
    amount: number
    currency?: string
    period?: string
    originalAmount?: number
  }
  badge?: {
    text: string
    variant?: 'default' | 'success' | 'warning' | 'info'
  }
  features: PricingFeature[]
  ctaText: string
  onCTAClick?: () => void
  popular?: boolean
  className?: string
}

const badgeVariants = {
  default: "bg-primary/10 text-primary border-primary/20",
  success: "bg-success/10 text-success border-success/20",
  warning: "bg-warning/10 text-warning border-warning/20",
  info: "bg-info/10 text-info border-info/20"
}

export function PricingCard({
  title,
  subtitle,
  price,
  badge,
  features,
  ctaText,
  onCTAClick,
  popular = false,
  className
}: PricingCardProps) {
  return (
    <EnhancedCard 
      variant={popular ? "elevated" : "default"}
      className={cn(
        "relative overflow-hidden",
        popular && "border-primary/30 bg-gradient-to-br from-primary/5 to-secondary/5",
        className
      )}
    >
      {/* Popular Badge */}
      {popular && (
        <div className="absolute top-0 right-0 bg-gradient-to-r from-primary to-secondary text-white px-4 py-1 text-xs font-medium">
          <div className="flex items-center gap-1">
            <Star className="h-3 w-3" />
            MOST POPULAR
          </div>
        </div>
      )}

      <EnhancedCardHeader className="text-center pb-6">
        {/* Title and Subtitle */}
        <div className="space-y-2">
          <h3 className="text-2xl font-bold text-foreground">{title}</h3>
          {subtitle && (
            <p className="text-muted-foreground">{subtitle}</p>
          )}
        </div>

        {/* Badge */}
        {badge && (
          <div className={cn(
            "inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border",
            badgeVariants[badge.variant || 'default']
          )}>
            {badge.text}
          </div>
        )}

        {/* Price */}
        <div className="space-y-2">
          <div className="flex items-baseline justify-center gap-2">
            {price.originalAmount && (
              <span className="text-lg text-muted-foreground line-through">
                {price.currency || '$'}{price.originalAmount}
              </span>
            )}
            <span className="text-5xl font-bold text-foreground">
              {price.currency || '$'}{price.amount}
            </span>
            {price.period && (
              <span className="text-muted-foreground">
                /{price.period}
              </span>
            )}
          </div>
          
          {price.originalAmount && (
            <div className="inline-flex items-center px-2 py-1 bg-success/10 text-success rounded-full text-sm font-medium">
              <Zap className="h-3 w-3 mr-1" />
              Save {price.currency || '$'}{price.originalAmount - price.amount}
            </div>
          )}
        </div>
      </EnhancedCardHeader>

      <EnhancedCardContent className="space-y-6">
        {/* Features */}
        <div className="space-y-3">
          {features.map((feature, index) => (
            <div 
              key={index}
              className={cn(
                "flex items-start gap-3",
                !feature.included && "opacity-50"
              )}
            >
              <div className={cn(
                "flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5",
                feature.included 
                  ? "bg-success/10 text-success" 
                  : "bg-muted text-muted-foreground"
              )}>
                <Check className="h-3 w-3" />
              </div>
              <span className={cn(
                "text-sm leading-relaxed",
                feature.highlight && "font-medium text-foreground",
                !feature.included && "text-muted-foreground"
              )}>
                {feature.text}
              </span>
            </div>
          ))}
        </div>

        {/* CTA Button */}
        <EnhancedButton
          variant={popular ? "default" : "outline"}
          size="lg"
          onClick={onCTAClick}
          className={cn(
            "w-full",
            popular && "bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 shadow-lg hover:shadow-xl"
          )}
        >
          {ctaText}
        </EnhancedButton>

        {/* Trust Indicators */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Check className="h-3 w-3 text-success" />
              <span>30-day money back</span>
            </div>
            <div className="flex items-center gap-1">
              <Check className="h-3 w-3 text-success" />
              <span>Secure payment</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            No setup fees • Cancel anytime
          </p>
        </div>
      </EnhancedCardContent>
    </EnhancedCard>
  )
}