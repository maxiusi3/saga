'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  CheckCircle, 
  Star, 
  Users, 
  FolderPlus, 
  Crown, 
  User,
  Clock,
  Shield,
  Download,
  Sparkles
} from 'lucide-react'

interface PricingFeature {
  icon: React.ReactNode
  text: string
  included: boolean
  highlight?: boolean
}

interface PricingPackage {
  id: string
  name: string
  description: string
  price: number
  originalPrice?: number
  currency: string
  period: string
  popular?: boolean
  features: PricingFeature[]
  resources: {
    projectVouchers: number
    facilitatorSeats: number
    storytellerSeats: number
  }
  onPurchase?: () => void
}

interface PricingCardsProps {
  packages: PricingPackage[]
  onPackageSelect?: (packageId: string) => void
}

function PricingCard({ 
  pkg, 
  onSelect 
}: { 
  pkg: PricingPackage
  onSelect?: (packageId: string) => void 
}) {
  const discount = pkg.originalPrice ? Math.round(((pkg.originalPrice - pkg.price) / pkg.originalPrice) * 100) : 0

  return (
    <Card 
      variant={pkg.popular ? "elevated" : "content"}
      className={`relative ${pkg.popular ? 'border-primary shadow-lg scale-105' : ''} transition-all duration-200 hover:shadow-lg`}
    >
      {pkg.popular && (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
          <Badge variant="primary" className="px-4 py-1">
            <Star className="w-3 h-3 mr-1" />
            Most Popular
          </Badge>
        </div>
      )}

      <CardHeader className="text-center pb-4">
        <div className="mb-4">
          <CardTitle className="text-h3 font-bold text-foreground mb-2">
            {pkg.name}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {pkg.description}
          </p>
        </div>

        {/* Pricing */}
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2">
            {pkg.originalPrice && (
              <span className="text-lg text-muted-foreground line-through">
                ${pkg.originalPrice}
              </span>
            )}
            <span className="text-4xl font-bold text-foreground">
              ${pkg.price}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {pkg.currency} {pkg.period}
          </p>
          {discount > 0 && (
            <Badge variant="success" size="sm">
              Save {discount}%
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Resource Allocation */}
        <div className="space-y-3">
          <h4 className="font-semibold text-foreground text-sm">Included Resources:</h4>
          <div className="grid grid-cols-1 gap-2">
            <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-primary" />
                <span className="text-sm">Project Vouchers</span>
              </div>
              <Badge variant="outline" size="sm">
                {pkg.resources.projectVouchers}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-500" />
                <span className="text-sm">Facilitator Seats</span>
              </div>
              <Badge variant="outline" size="sm">
                {pkg.resources.facilitatorSeats}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-blue-500" />
                <span className="text-sm">Storyteller Seats</span>
              </div>
              <Badge variant="outline" size="sm">
                {pkg.resources.storytellerSeats}
              </Badge>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="space-y-3">
          <h4 className="font-semibold text-foreground text-sm">Features & Benefits:</h4>
          <div className="space-y-2">
            {pkg.features.map((feature, index) => (
              <div 
                key={index} 
                className={`flex items-start gap-3 ${feature.highlight ? 'p-2 bg-primary/5 rounded-lg' : ''}`}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {feature.included ? (
                    <CheckCircle className={`w-4 h-4 ${feature.highlight ? 'text-primary' : 'text-success'}`} />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30" />
                  )}
                </div>
                <span className={`text-sm ${feature.included ? 'text-foreground' : 'text-muted-foreground'} ${feature.highlight ? 'font-medium' : ''}`}>
                  {feature.text}
                </span>
                {feature.highlight && (
                  <Sparkles className="w-4 h-4 text-primary flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>
      </CardContent>

      <CardFooter className="pt-6">
        <Button 
          variant={pkg.popular ? "primary" : "secondary"}
          size="lg"
          className="w-full"
          onClick={() => {
            onSelect?.(pkg.id)
            pkg.onPurchase?.()
          }}
        >
          {pkg.popular ? 'Get Started Now' : 'Choose This Package'}
        </Button>
      </CardFooter>
    </Card>
  )
}

export function PricingCards({ packages, onPackageSelect }: PricingCardsProps) {
  return (
    <div className="py-16">
      <div className="container">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="text-h1 font-bold text-foreground mb-4">
            Choose Your Family Saga Package
          </h2>
          <p className="text-body-large text-muted-foreground max-w-2xl mx-auto">
            Start preserving your family's stories today with our comprehensive packages 
            designed for families of all sizes.
          </p>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {packages.map((pkg) => (
            <PricingCard 
              key={pkg.id} 
              pkg={pkg} 
              onSelect={onPackageSelect}
            />
          ))}
        </div>

        {/* Additional Information */}
        <div className="mt-16 text-center">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <Shield className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">30-Day Money Back</h3>
                <p className="text-sm text-muted-foreground">
                  Not satisfied? Get a full refund within 30 days, no questions asked.
                </p>
              </div>
              
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <Clock className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Instant Access</h3>
                <p className="text-sm text-muted-foreground">
                  Start recording and preserving stories immediately after purchase.
                </p>
              </div>
              
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <Download className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Export Anytime</h3>
                <p className="text-sm text-muted-foreground">
                  Download your complete family archive in multiple formats.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Default package configurations
export const defaultPackages: PricingPackage[] = [
  {
    id: 'starter',
    name: 'Family Starter',
    description: 'Perfect for small families getting started',
    price: 99,
    currency: 'USD',
    period: 'one-time',
    resources: {
      projectVouchers: 1,
      facilitatorSeats: 1,
      storytellerSeats: 2
    },
    features: [
      { icon: <CheckCircle className="w-4 h-4" />, text: '1 Family Biography Project', included: true },
      { icon: <CheckCircle className="w-4 h-4" />, text: 'Up to 3 Family Members', included: true },
      { icon: <CheckCircle className="w-4 h-4" />, text: 'AI Transcription & Summaries', included: true },
      { icon: <CheckCircle className="w-4 h-4" />, text: '1 Year Interactive Service', included: true },
      { icon: <CheckCircle className="w-4 h-4" />, text: 'Secure Cloud Storage', included: true },
      { icon: <CheckCircle className="w-4 h-4" />, text: 'Export & Backup Options', included: true }
    ]
  },
  {
    id: 'family',
    name: 'The Family Saga',
    description: 'Our most popular package for growing families',
    price: 149,
    originalPrice: 199,
    currency: 'USD',
    period: 'one-time',
    popular: true,
    resources: {
      projectVouchers: 1,
      facilitatorSeats: 2,
      storytellerSeats: 4
    },
    features: [
      { icon: <CheckCircle className="w-4 h-4" />, text: '1 Family Biography Project', included: true },
      { icon: <CheckCircle className="w-4 h-4" />, text: 'Up to 7 Family Members', included: true, highlight: true },
      { icon: <CheckCircle className="w-4 h-4" />, text: 'Multiple Co-Facilitators', included: true, highlight: true },
      { icon: <CheckCircle className="w-4 h-4" />, text: 'AI Transcription & Summaries', included: true },
      { icon: <CheckCircle className="w-4 h-4" />, text: '1 Year Interactive Service', included: true },
      { icon: <CheckCircle className="w-4 h-4" />, text: 'Priority Support', included: true, highlight: true },
      { icon: <CheckCircle className="w-4 h-4" />, text: 'Advanced Export Options', included: true },
      { icon: <CheckCircle className="w-4 h-4" />, text: 'Permanent Archive Access', included: true }
    ]
  },
  {
    id: 'extended',
    name: 'Extended Family',
    description: 'For large families with multiple branches',
    price: 249,
    currency: 'USD',
    period: 'one-time',
    resources: {
      projectVouchers: 2,
      facilitatorSeats: 4,
      storytellerSeats: 8
    },
    features: [
      { icon: <CheckCircle className="w-4 h-4" />, text: '2 Family Biography Projects', included: true, highlight: true },
      { icon: <CheckCircle className="w-4 h-4" />, text: 'Up to 14 Family Members', included: true, highlight: true },
      { icon: <CheckCircle className="w-4 h-4" />, text: 'Multiple Project Managers', included: true, highlight: true },
      { icon: <CheckCircle className="w-4 h-4" />, text: 'AI Transcription & Summaries', included: true },
      { icon: <CheckCircle className="w-4 h-4" />, text: '1 Year Interactive Service', included: true },
      { icon: <CheckCircle className="w-4 h-4" />, text: 'Premium Support', included: true, highlight: true },
      { icon: <CheckCircle className="w-4 h-4" />, text: 'Professional Export Formats', included: true },
      { icon: <CheckCircle className="w-4 h-4" />, text: 'Family Tree Integration', included: true, highlight: true }
    ]
  }
]