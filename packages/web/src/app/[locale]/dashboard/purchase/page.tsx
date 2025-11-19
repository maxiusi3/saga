'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
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
  const t = useTranslations('purchase-page')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const params = useParams()
  const locale = (params?.locale as string) || 'en'
  const withLocale = (path: string) => {
    const normalized = path.startsWith('/') ? path : `/${path}`
    return `/${locale}${normalized}`
  }

  const handlePurchase = async () => {
    setIsLoading(true)

    try {
      // Simulate purchase processing
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Simulate success
      router.push(withLocale('/dashboard?purchase=success'))
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
            {t('hero.limitedOffer')}
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            {t('hero.title')}
          </h1>
          <p className="text-2xl text-gray-700 max-w-3xl mx-auto">
            {t('hero.subtitle')}
          </p>
        </div>

        {/* Hero Video/Image */}
        <div className="mb-16">
          <div className="relative bg-gradient-to-r from-sage-100 to-sage-200 rounded-2xl p-12">
            <div className="text-center">
              <div className="w-20 h-20 bg-sage-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-10 h-10 text-white" />
              </div>
              <p className="text-xl text-sage-800 font-medium">
                {t('hero.startCapturing')}
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
            <h3 className="text-2xl font-bold text-gray-900 mb-3">{t('features.collaboration.title')}</h3>
            <p className="text-lg text-gray-700">{t('features.collaboration.description')}</p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-sage-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-sage-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">{t('features.aiPrompts.title')}</h3>
            <p className="text-lg text-gray-700">{t('features.aiPrompts.description')}</p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-sage-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-sage-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">{t('features.secure.title')}</h3>
            <p className="text-lg text-gray-700">{t('features.secure.description')}</p>
          </div>
        </div>

        {/* Pricing Section */}
        <div className="mb-16">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-6">{t('pricing.title')}</h2>
            <p className="text-xl text-gray-700">{t('pricing.subtitle')}</p>
          </div>

          <div className="max-w-4xl mx-auto">
            <PricingCard
              title={t('pricing.package.title')}
              subtitle={t('pricing.package.subtitle')}
              price={{
                amount: 209,
                currency: "$",
                period: t('pricing.package.period')
              }}
              features={[
                { text: t('pricing.package.features.unlimitedProjects'), included: true },
                { text: t('pricing.package.features.unlimitedMembers'), included: true },
                { text: t('pricing.package.features.aiPrompts'), included: true },
                { text: t('pricing.package.features.transcription'), included: true },
                { text: t('pricing.package.features.photoAudio'), included: true },
                { text: t('pricing.package.features.cloudStorage'), included: true },
                { text: t('pricing.package.features.mobileWeb'), included: true },
                { text: t('pricing.package.features.oneYear'), included: true, highlight: true },
                { text: t('pricing.package.features.archival'), included: true }
              ]}
              popular={true}
              ctaText={t('pricing.package.cta')}
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
                {t('checkout.title')}
              </EnhancedCardTitle>
            </EnhancedCardHeader>
            <EnhancedCardContent className="space-y-6">
              {/* Order Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">{t('checkout.packageName')}</span>
                  <span>$209</span>
                </div>
                <div className="flex justify-between items-center text-base text-gray-700">
                  <span>{t('checkout.oneTime')}</span>
                  <span>{t('checkout.noRecurring')}</span>
                </div>
                <Separator className="my-3" />
                <div className="flex justify-between items-center font-bold text-lg">
                  <span>{t('checkout.total')}</span>
                  <span>$209</span>
                </div>
              </div>

              {/* Payment Form */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName" className="text-base">{t('checkout.firstName')}</Label>
                    <Input id="firstName" placeholder="John" className="h-12 text-lg" />
                  </div>
                  <div>
                    <Label htmlFor="lastName" className="text-base">{t('checkout.lastName')}</Label>
                    <Input id="lastName" placeholder="Doe" className="h-12 text-lg" />
                  </div>
                </div>

                <div>
                  <Label htmlFor="email" className="text-base">{t('checkout.email')}</Label>
                  <Input id="email" type="email" placeholder="john@example.com" className="h-12 text-lg" />
                </div>

                <div>
                  <Label htmlFor="cardNumber" className="text-base">{t('checkout.cardNumber')}</Label>
                  <Input id="cardNumber" placeholder="1234 5678 9012 3456" className="h-12 text-lg" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="expiry" className="text-base">{t('checkout.expiry')}</Label>
                    <Input id="expiry" placeholder="MM/YY" className="h-12 text-lg" />
                  </div>
                  <div>
                    <Label htmlFor="cvc" className="text-base">{t('checkout.cvc')}</Label>
                    <Input id="cvc" placeholder="123" className="h-12 text-lg" />
                  </div>
                </div>
              </div>

              {/* Security Badges */}
              <div className="flex items-center justify-center gap-6 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-green-600" />
                  {t('checkout.security.ssl')}
                </div>
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-green-600" />
                  {t('checkout.security.secure')}
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-600" />
                  {t('checkout.security.guarantee')}
                </div>
              </div>

              {/* Purchase Button */}
              <EnhancedButton
                onClick={handlePurchase}
                disabled={isLoading}
                size="xl"
                className="w-full text-xl font-bold py-8"
              >
                {isLoading ? (
                  t('checkout.processing')
                ) : (
                  <>
                    {t('checkout.completePurchase')}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </EnhancedButton>

              <p className="text-sm text-gray-600 text-center">
                {t('checkout.terms')}
              </p>
            </EnhancedCardContent>
          </EnhancedCard>
        </div>

        {/* Customer Reviews */}
        <div className="mt-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">{t('reviews.title')}</h2>
            <div className="flex items-center justify-center gap-1 mb-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star key={star} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
              ))}
              <span className="ml-2 text-gray-600">4.9/5 {t('reviews.rating')}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <EnhancedCard>
              <EnhancedCardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                  <div>
                    <p className="font-medium text-gray-900">{t('reviews.testimonials.sarah.name')}</p>
                    <p className="text-sm text-gray-600">{t('reviews.testimonials.sarah.role')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 mb-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-700 mb-4">
                  "{t('reviews.testimonials.sarah.quote')}"
                </p>
              </EnhancedCardContent>
            </EnhancedCard>

            <EnhancedCard>
              <EnhancedCardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                  <div>
                    <p className="font-medium text-gray-900">{t('reviews.testimonials.michael.name')}</p>
                    <p className="text-sm text-gray-600">{t('reviews.testimonials.michael.role')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 mb-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-700 mb-4">
                  "{t('reviews.testimonials.michael.quote')}"
                </p>
              </EnhancedCardContent>
            </EnhancedCard>

            <EnhancedCard>
              <EnhancedCardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                  <div>
                    <p className="font-medium text-gray-900">{t('reviews.testimonials.emma.name')}</p>
                    <p className="text-sm text-gray-600">{t('reviews.testimonials.emma.role')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 mb-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-700 mb-4">
                  "{t('reviews.testimonials.emma.quote')}"
                </p>
              </EnhancedCardContent>
            </EnhancedCard>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">{t('faq.title')}</h2>
          </div>
          <div className="max-w-3xl mx-auto space-y-6">
            <EnhancedCard>
              <EnhancedCardContent className="p-6">
                <h3 className="font-semibold text-gray-900 mb-2">{t('faq.questions.afterYear.question')}</h3>
                <p className="text-gray-600">
                  {t('faq.questions.afterYear.answer')}
                </p>
              </EnhancedCardContent>
            </EnhancedCard>

            <EnhancedCard>
              <EnhancedCardContent className="p-6">
                <h3 className="font-semibold text-gray-900 mb-2">{t('faq.questions.members.question')}</h3>
                <p className="text-gray-600">
                  {t('faq.questions.members.answer')}
                </p>
              </EnhancedCardContent>
            </EnhancedCard>

            <EnhancedCard>
              <EnhancedCardContent className="p-6">
                <h3 className="font-semibold text-gray-900 mb-2">{t('faq.questions.security.question')}</h3>
                <p className="text-gray-600">
                  {t('faq.questions.security.answer')}
                </p>
              </EnhancedCardContent>
            </EnhancedCard>
          </div>
        </div>
      </div>
    </div>
  )
}