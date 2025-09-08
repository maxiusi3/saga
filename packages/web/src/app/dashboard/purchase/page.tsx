'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Check } from 'lucide-react'
import Link from 'next/link'

export default function PurchasePage() {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handlePurchase = async () => {
    setIsLoading(true)

    try {
      // 模拟购买处理过程
      await new Promise(resolve => setTimeout(resolve, 1500))

      // 模拟购买成功，直接重定向到 dashboard
      console.log('Purchase completed successfully (simulated)')
      router.push('/dashboard')
    } catch (error) {
      console.error('Purchase failed:', error)
      setIsLoading(false)
    }
  }

  const features = [
    'Create unlimited family story projects',
    'Invite family members as storytellers',
    'AI-powered conversation prompts',
    'Automatic transcription and organization',
    'Export stories in multiple formats',
    'Secure cloud storage',
    'Mobile and web access'
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-foreground">
          The Saga Package
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Everything you need to capture and preserve your family's precious stories
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Package Details */}
        <Card className="p-8">
          <div className="space-y-6">
            <div className="text-center">
              <div className="text-5xl font-bold text-primary mb-2">
                $29
              </div>
              <div className="text-muted-foreground">
                One-time purchase
              </div>
              <Badge variant="secondary" className="mt-2">
                Most Popular
              </Badge>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold text-foreground mb-4">
                What's included:
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-foreground">Project Vouchers</span>
                  <Badge variant="outline">1</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-foreground">Facilitator Seats</span>
                  <Badge variant="outline">1</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-foreground">Storyteller Seats</span>
                  <Badge variant="outline">1</Badge>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold text-foreground mb-4">
                Features:
              </h3>
              <div className="space-y-3">
                {features.map((feature, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Purchase Form */}
        <div className="space-y-6">
          <Card className="p-8">
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold text-foreground">
                Complete Your Purchase
              </h2>

              <div className="space-y-4">
                <div className="flex justify-between items-center py-3 border-b border-border">
                  <span className="text-foreground">The Saga Package</span>
                  <span className="font-semibold text-foreground">$29.00</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-border">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="text-muted-foreground">$0.00</span>
                </div>
                <div className="flex justify-between items-center py-3 text-lg font-semibold">
                  <span className="text-foreground">Total</span>
                  <span className="text-primary">$29.00</span>
                </div>
              </div>

              <Button
                size="lg"
                className="w-full bg-primary"
                onClick={handlePurchase}
                disabled={isLoading}
              >
                {isLoading ? 'Processing...' : 'Purchase Now'}
              </Button>

              <div className="text-center space-y-2">
                <div className="text-sm text-muted-foreground">
                  Secure payment powered by Stripe
                </div>
                <div className="flex justify-center space-x-4 text-xs text-muted-foreground">
                  <span>💳 All major cards accepted</span>
                  <span>🔒 SSL encrypted</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Additional Options */}
          <Card className="p-6">
            <h3 className="font-semibold text-foreground mb-4">
              Need more seats?
            </h3>
            <p className="text-muted-foreground text-sm mb-4">
              You can purchase additional seats individually after completing your first purchase.
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Extra Project Voucher</span>
                <span className="text-foreground">$15</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Extra Facilitator Seat</span>
                <span className="text-foreground">$10</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Extra Storyteller Seat</span>
                <span className="text-foreground">$5</span>
              </div>
            </div>
          </Card>

          {/* Mobile App Note */}
          <div className="text-center text-sm text-muted-foreground">
            <Link href="/restore" className="hover:text-foreground">
              Already purchased? Restore Purchase
            </Link>
          </div>
        </div>
      </div>

      {/* Terms */}
      <div className="text-center text-sm text-muted-foreground space-x-4">
        <Link href="/terms" className="hover:text-foreground">
          Terms of Sale
        </Link>
        <span>•</span>
        <Link href="/privacy" className="hover:text-foreground">
          Privacy Policy
        </Link>
        <span>•</span>
        <Link href="/refund" className="hover:text-foreground">
          Refund Policy
        </Link>
      </div>
    </div>
  )
}
