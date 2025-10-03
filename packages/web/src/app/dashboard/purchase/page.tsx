'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { EnhancedButton } from '@/components/ui/enhanced-button'
import { EnhancedCard, EnhancedCardContent, EnhancedCardHeader, EnhancedCardTitle } from '@/components/ui/enhanced-card'
import { PricingCard } from '@/components/ui/pricing-card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Check, Star, Shield, Clock, Users, BookOpen, Sparkles, CreditCard, ArrowRight, Lock } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

export default function PurchasePage() {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handlePurchase = async () => {
    setIsLoading(true)

    try {
      // Simulate purchase processing
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Simulate success
      router.push('/dashboard?purchase=success')
    } catch (error) {
      console.error('Purchase failed:', error)
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sage-50 to-sage-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-sage-100 text-sage-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            Limited Time Offer
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Preserve Your Family Stories Forever
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Create lasting digital biographies that capture precious memories and wisdom.
          </p>
        </div>

        {/* Hero Video/Image */}
        <div className="mb-16">
          <div className="relative bg-gradient-to-r from-sage-100 to-sage-200 rounded-2xl p-12">
            <div className="text-center">
              <div className="w-20 h-20 bg-sage-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-10 h-10 text-white" />
              </div>
              <p className="text-lg text-sage-700">
                Start capturing your family's unique story today
              </p>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <div className="text-center">
            <div className="w-16 h-16 bg-sage-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-sage-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Family Collaboration</h3>
            <p className="text-gray-600">Invite family members to contribute stories and memories together.</p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-sage-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-sage-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">AI-Powered Prompts</h3>
            <p className="text-gray-600">Intelligent questions that help unlock meaningful memories.</p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-sage-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-sage-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Secure & Private</h3>
            <p className="text-gray-600">Your family stories are encrypted and stored securely.</p>
          </div>
        </div>

        {/* Pricing Section */}
        <div className="mb-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Choose Your Package</h2>
            <p className="text-gray-600">Everything you need to create beautiful family biographies.</p>
          </div>

          <div className="max-w-4xl mx-auto">
            <PricingCard
              title="Family Saga Package"
              subtitle="Complete family biography solution with AI-powered storytelling"
              price={{
                amount: 209,
                currency: "$",
                period: "one-time"
              }}
              features={[
                { text: "Create unlimited projects", included: true },
                { text: "Invite unlimited family members", included: true },
                { text: "AI-powered story prompts", included: true },
                { text: "Professional transcription", included: true },
                { text: "Photo and audio integration", included: true },
                { text: "Secure cloud storage", included: true },
                { text: "Mobile and web access", included: true },
                { text: "1 year of interactive service", included: true, highlight: true },
                { text: "Permanent archival mode access", included: true }
              ]}
              popular={true}
              ctaText="Get Started"
              onCTAClick={handlePurchase}
            />
          </div>
        </div>

        {/* Checkout Form */}
        <div className="max-w-2xl mx-auto">
          <EnhancedCard>
            <EnhancedCardHeader>
              <EnhancedCardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-sage-600" />
                Complete Your Purchase
              </EnhancedCardTitle>
            </EnhancedCardHeader>
            <EnhancedCardContent className="space-y-6">
              {/* Order Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">Family Saga Package</span>
                  <span>$209</span>
                </div>
                <div className="flex justify-between items-center text-sm text-gray-600">
                  <span>One-time payment</span>
                  <span>No recurring fees</span>
                </div>
                <Separator className="my-3" />
                <div className="flex justify-between items-center font-bold">
                  <span>Total</span>
                  <span>$209</span>
                </div>
              </div>

              {/* Payment Form */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name</Label>
                    <Input id="firstName" placeholder="John" />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input id="lastName" placeholder="Doe" />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input id="email" type="email" placeholder="john@example.com" />
                </div>

                <div>
                  <Label htmlFor="cardNumber">Card Number</Label>
                  <Input id="cardNumber" placeholder="1234 5678 9012 3456" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="expiry">Expiry Date</Label>
                    <Input id="expiry" placeholder="MM/YY" />
                  </div>
                  <div>
                    <Label htmlFor="cvc">CVC</Label>
                    <Input id="cvc" placeholder="123" />
                  </div>
                </div>
              </div>

              {/* Security Badges */}
              <div className="flex items-center justify-center gap-6 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-green-600" />
                  SSL Encrypted
                </div>
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-green-600" />
                  Secure Payment
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-600" />
                  30-Day Guarantee
                </div>
              </div>

              {/* Purchase Button */}
              <EnhancedButton
                onClick={handlePurchase}
                disabled={isLoading}
                size="lg"
                className="w-full"
              >
                {isLoading ? (
                  'Processing...'
                ) : (
                  <>
                    Complete Purchase - $209
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </EnhancedButton>

              <p className="text-xs text-gray-500 text-center">
                By completing your purchase, you agree to our Terms of Service and Privacy Policy.
                You can cancel anytime within 30 days for a full refund.
              </p>
            </EnhancedCardContent>
          </EnhancedCard>
        </div>

        {/* Customer Reviews */}
        <div className="mt-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">What Families Are Saying</h2>
            <div className="flex items-center justify-center gap-1 mb-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star key={star} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
              ))}
              <span className="ml-2 text-gray-600">4.9/5 from 1,200+ families</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <EnhancedCard>
              <EnhancedCardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                  <div>
                    <p className="font-medium text-gray-900">Sarah Johnson</p>
                    <p className="text-sm text-gray-600">Family Historian</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 mb-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-700 mb-4">
                  "Saga helped us capture my grandmother's stories before it was too late. The AI prompts
                  brought out memories we never knew existed."
                </p>
              </EnhancedCardContent>
            </EnhancedCard>

            <EnhancedCard>
              <EnhancedCardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                  <div>
                    <p className="font-medium text-gray-900">Michael Chen</p>
                    <p className="text-sm text-gray-600">Project Facilitator</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 mb-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-700 mb-4">
                  "The transcription quality is amazing, and the family collaboration features made it
                  easy for everyone to contribute."
                </p>
              </EnhancedCardContent>
            </EnhancedCard>

            <EnhancedCard>
              <EnhancedCardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                  <div>
                    <p className="font-medium text-gray-900">Emma Rodriguez</p>
                    <p className="text-sm text-gray-600">Family Member</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 mb-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-700 mb-4">
                  "Worth every penny. We now have a beautiful digital archive of our family history
                  that will last forever."
                </p>
              </EnhancedCardContent>
            </EnhancedCard>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Frequently Asked Questions</h2>
          </div>
          <div className="max-w-3xl mx-auto space-y-6">
            <EnhancedCard>
              <EnhancedCardContent className="p-6">
                <h3 className="font-semibold text-gray-900 mb-2">What happens after the first year?</h3>
                <p className="text-gray-600">
                  After your first year of interactive service, you can reactivate interactive features
                  anytime, or you can still access, view, and export all your stories in archival mode.
                </p>
              </EnhancedCardContent>
            </EnhancedCard>

            <EnhancedCard>
              <EnhancedCardContent className="p-6">
                <h3 className="font-semibold text-gray-900 mb-2">How many family members can participate?</h3>
                <p className="text-gray-600">
                  You can invite unlimited family members to view and comment on stories. The package
                  includes seats for multiple facilitators and storytellers to actively contribute content.
                </p>
              </EnhancedCardContent>
            </EnhancedCard>

            <EnhancedCard>
              <EnhancedCardContent className="p-6">
                <h3 className="font-semibold text-gray-900 mb-2">Is my family data secure?</h3>
                <p className="text-gray-600">
                  Yes, absolutely. We use enterprise-grade encryption and secure storage. Your personal
                  family stories are never shared with third parties and are stored securely.
                </p>
              </EnhancedCardContent>
            </EnhancedCard>
          </div>
        </div>
      </div>
    </div>
  )
}