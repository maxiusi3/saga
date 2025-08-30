'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PaymentForm, TestCardInfo } from '@/components/payment/payment-form'
import { useResourceWallet } from '@/hooks/use-resource-wallet'

interface Package {
  id: string
  name: string
  description: string
  price: number
  currency: string
  features: string[]
  contents: {
    projectVouchers: number
    facilitatorSeats: number
    storytellerSeats: number
  }
  popular?: boolean
}

const AVAILABLE_PACKAGES: Package[] = [
  {
    id: 'saga-package',
    name: 'Saga Package',
    description: 'Perfect for small families starting their storytelling journey',
    price: 12900, // $129.00 in cents
    currency: 'usd',
    features: [
      'Create 1 family story project',
      '2 Facilitator seats',
      '8 Storyteller seats',
      'AI-guided story prompts',
      'Automatic transcription',
      'Complete data export'
    ],
    contents: {
      projectVouchers: 1,
      facilitatorSeats: 2,
      storytellerSeats: 8
    }
  },
  {
    id: 'saga-package-family',
    name: 'Family Package',
    description: 'Ideal for larger families with multiple story projects',
    price: 19900, // $199.00 in cents
    currency: 'usd',
    features: [
      'Create 3 family story projects',
      '5 Facilitator seats',
      '20 Storyteller seats',
      'AI-guided story prompts',
      'Automatic transcription',
      'Complete data export',
      'Priority support'
    ],
    contents: {
      projectVouchers: 3,
      facilitatorSeats: 5,
      storytellerSeats: 20
    },
    popular: true
  },
  {
    id: 'saga-package-premium',
    name: 'Premium Package',
    description: 'For extended families and professional storytellers',
    price: 29900, // $299.00 in cents
    currency: 'usd',
    features: [
      'Create 5 family story projects',
      '10 Facilitator seats',
      '50 Storyteller seats',
      'AI-guided story prompts',
      'Automatic transcription',
      'Complete data export',
      'Priority support',
      'Advanced analytics'
    ],
    contents: {
      projectVouchers: 5,
      facilitatorSeats: 10,
      storytellerSeats: 50
    }
  }
]

export default function PurchasePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { refreshWallet } = useResourceWallet()
  
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null)
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [purchaseComplete, setPurchaseComplete] = useState(false)
  const [purchaseResult, setPurchaseResult] = useState<any>(null)

  // Get package from URL params
  useEffect(() => {
    const packageId = searchParams.get('package')
    if (packageId) {
      const pkg = AVAILABLE_PACKAGES.find(p => p.id === packageId)
      if (pkg) {
        setSelectedPackage(pkg)
        setShowPaymentForm(true)
      }
    }
  }, [searchParams])

  const handlePackageSelect = (pkg: Package) => {
    setSelectedPackage(pkg)
    setShowPaymentForm(true)
    
    // Update URL
    const url = new URL(window.location.href)
    url.searchParams.set('package', pkg.id)
    window.history.pushState({}, '', url.toString())
  }

  const handlePaymentSuccess = async (result: { packageId: string; paymentIntentId: string }) => {
    setPurchaseResult(result)
    setPurchaseComplete(true)
    
    // Refresh wallet to show new resources
    await refreshWallet()
    
    // Show success for a moment, then redirect
    setTimeout(() => {
      router.push('/dashboard?purchase=success')
    }, 3000)
  }

  const handlePaymentError = (error: string) => {
    console.error('Payment error:', error)
    // Error is handled by the payment form
  }

  const handlePaymentCancel = () => {
    setShowPaymentForm(false)
    setSelectedPackage(null)
    
    // Clear URL params
    const url = new URL(window.location.href)
    url.searchParams.delete('package')
    window.history.pushState({}, '', url.toString())
  }

  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(price / 100)
  }

  if (purchaseComplete) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md mx-auto p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Purchase Complete!</h1>
          <p className="text-gray-600 mb-6">
            Your {selectedPackage?.name} has been activated. You can now create family story projects and invite members.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-blue-900 mb-2">What's Next?</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Create your first family story project</li>
              <li>• Invite family members to participate</li>
              <li>• Start collecting precious memories</li>
            </ul>
          </div>
          <p className="text-sm text-gray-500">
            Redirecting to dashboard in a few seconds...
          </p>
        </Card>
      </div>
    )
  }

  if (showPaymentForm && selectedPackage) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Complete Your Purchase</h1>
            <p className="text-gray-600">
              You're purchasing the {selectedPackage.name} for {formatPrice(selectedPackage.price, selectedPackage.currency)}
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            {/* Package Summary */}
            <div>
              <Card className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Package Summary</h2>
                <div className="space-y-4">
                  <div className="flex justify-between items-center pb-4 border-b">
                    <span className="font-medium">{selectedPackage.name}</span>
                    <span className="text-xl font-bold">
                      {formatPrice(selectedPackage.price, selectedPackage.currency)}
                    </span>
                  </div>
                  
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">What's Included:</h3>
                    <ul className="space-y-2">
                      {selectedPackage.features.map((feature, index) => (
                        <li key={index} className="flex items-start space-x-2 text-sm">
                          <svg className="w-4 h-4 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900 mb-2">Resource Allocation:</h4>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {selectedPackage.contents.projectVouchers}
                        </div>
                        <div className="text-blue-800">Project{selectedPackage.contents.projectVouchers > 1 ? 's' : ''}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {selectedPackage.contents.facilitatorSeats}
                        </div>
                        <div className="text-blue-800">Facilitators</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {selectedPackage.contents.storytellerSeats}
                        </div>
                        <div className="text-blue-800">Storytellers</div>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Payment Form */}
            <div>
              {process.env.NODE_ENV === 'development' && <TestCardInfo />}
              <PaymentForm
                packageId={selectedPackage.id}
                packageName={selectedPackage.name}
                amount={selectedPackage.price}
                currency={selectedPackage.currency}
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
                onCancel={handlePaymentCancel}
              />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Package selection view
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Choose Your Saga Package</h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Start preserving your family's precious stories with our AI-powered platform. 
            Each package includes everything you need to create lasting memories.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {AVAILABLE_PACKAGES.map((pkg) => (
            <Card 
              key={pkg.id} 
              className={`relative p-8 ${pkg.popular ? 'border-2 border-blue-500 shadow-lg' : ''}`}
            >
              {pkg.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                    Most Popular
                  </span>
                </div>
              )}
              
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{pkg.name}</h2>
                <p className="text-gray-600 mb-4">{pkg.description}</p>
                <div className="text-4xl font-bold text-gray-900">
                  {formatPrice(pkg.price, pkg.currency)}
                </div>
              </div>

              <ul className="space-y-3 mb-8">
                {pkg.features.map((feature, index) => (
                  <li key={index} className="flex items-start space-x-3">
                    <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                onClick={() => handlePackageSelect(pkg)}
                className={`w-full ${pkg.popular ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-900 hover:bg-gray-800'} text-white`}
              >
                Choose {pkg.name}
              </Button>
            </Card>
          ))}
        </div>

        <div className="mt-12 text-center">
          <div className="bg-white rounded-lg p-8 max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Why Choose Saga?</h2>
            <div className="grid gap-6 md:grid-cols-3">
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">AI-Powered Prompts</h3>
                <p className="text-gray-600 text-sm">Smart questions that help unlock meaningful memories and stories</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Secure & Private</h3>
                <p className="text-gray-600 text-sm">Your family stories are encrypted and completely private</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Complete Export</h3>
                <p className="text-gray-600 text-sm">Download all your stories and keep them forever</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
