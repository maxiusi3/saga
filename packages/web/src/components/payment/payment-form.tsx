'use client'

import React, { useState, useEffect } from 'react'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { stripeService } from '@/services/stripe.service'
import { getStripe } from '@/services/stripe.service'

interface PaymentFormProps {
  packageId: string
  packageName: string
  amount: number
  currency?: string
  onSuccess: (result: { packageId: string; paymentIntentId: string }) => void
  onError: (error: string) => void
  onCancel: () => void
}

// Card element styling
const cardElementOptions = {
  style: {
    base: {
      fontSize: '16px',
      color: '#424770',
      '::placeholder': {
        color: '#aab7c4',
      },
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
    invalid: {
      color: '#9e2146',
    },
  },
  hidePostalCode: false,
}

function PaymentFormContent({ packageId, packageName, amount, currency = 'usd', onSuccess, onError, onCancel }: PaymentFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  
  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentIntent, setPaymentIntent] = useState<any>(null)
  const [cardError, setCardError] = useState<string | null>(null)
  const [cardComplete, setCardComplete] = useState(false)

  // Create payment intent on component mount
  useEffect(() => {
    createPaymentIntent()
  }, [packageId, amount])

  const createPaymentIntent = async () => {
    try {
      const intent = await stripeService.createPaymentIntent({
        packageId,
        amount,
        currency,
        metadata: {
          packageName
        }
      })
      setPaymentIntent(intent)
    } catch (error) {
      console.error('Failed to create payment intent:', error)
      onError('Failed to initialize payment. Please try again.')
    }
  }

  const handleCardChange = (event: any) => {
    setCardError(event.error ? event.error.message : null)
    setCardComplete(event.complete)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!stripe || !elements || !paymentIntent) {
      return
    }

    setIsProcessing(true)
    setCardError(null)

    const cardElement = elements.getElement(CardElement)
    if (!cardElement) {
      setIsProcessing(false)
      return
    }

    try {
      // Create payment method
      const { paymentMethod, error: pmError } = await stripeService.createPaymentMethod(cardElement)
      
      if (pmError) {
        setCardError(pmError)
        setIsProcessing(false)
        return
      }

      // Confirm payment
      const { success, error: confirmError } = await stripeService.confirmPayment(
        paymentIntent.client_secret,
        paymentMethod.id
      )

      if (!success) {
        setCardError(confirmError || 'Payment failed')
        setIsProcessing(false)
        return
      }

      // Complete purchase
      const completionResult = await stripeService.completePurchase(paymentIntent.id)
      
      if (!completionResult.success) {
        setCardError(completionResult.error || 'Failed to complete purchase')
        setIsProcessing(false)
        return
      }

      // Success!
      onSuccess({
        packageId: completionResult.packageId || packageId,
        paymentIntentId: paymentIntent.id
      })

    } catch (error) {
      console.error('Payment error:', error)
      setCardError('An unexpected error occurred. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  const formatAmount = (amount: number, currency: string) => {
    return stripeService.formatAmount(amount, currency)
  }

  return (
    <Card className="max-w-md mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Complete Your Purchase</h2>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex justify-between items-center">
            <span className="font-medium text-blue-900">{packageName}</span>
            <span className="text-xl font-bold text-blue-900">
              {formatAmount(amount, currency)}
            </span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Card Information */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Card Information
          </label>
          <div className="border border-gray-300 rounded-lg p-3 bg-white">
            <CardElement
              options={cardElementOptions}
              onChange={handleCardChange}
            />
          </div>
          {cardError && (
            <p className="mt-2 text-sm text-red-600" role="alert">
              {cardError}
            </p>
          )}
        </div>

        {/* Security Notice */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <div className="text-sm">
              <p className="font-medium text-gray-900 mb-1">Secure Payment</p>
              <p className="text-gray-600">
                Your payment information is encrypted and secure. We never store your card details.
              </p>
            </div>
          </div>
        </div>

        {/* Development Notice */}
        {process.env.NODE_ENV === 'development' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div className="text-sm">
                <p className="font-medium text-yellow-800 mb-1">Development Mode</p>
                <p className="text-yellow-700">
                  This is a test payment. Use card number 4242424242424242 with any future expiry and CVC.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-3">
          <Button
            type="button"
            onClick={onCancel}
            variant="outline"
            className="flex-1"
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!stripe || !cardComplete || isProcessing}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isProcessing ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Processing...</span>
              </div>
            ) : (
              `Pay ${formatAmount(amount, currency)}`
            )}
          </Button>
        </div>
      </form>
    </Card>
  )
}

export function PaymentForm(props: PaymentFormProps) {
  const [stripePromise] = useState(() => getStripe())

  return (
    <Elements stripe={stripePromise}>
      <PaymentFormContent {...props} />
    </Elements>
  )
}

// Test card component for development
export function TestCardInfo() {
  const testCards = stripeService.getTestCards()

  return (
    <Card className="max-w-md mx-auto p-4 mb-4">
      <h3 className="font-medium text-gray-900 mb-3">Test Cards (Development Only)</h3>
      <div className="space-y-2">
        {testCards.map((card, index) => (
          <div key={index} className="text-sm">
            <div className="font-mono text-blue-600">{card.number}</div>
            <div className="text-gray-600">{card.brand} - {card.description}</div>
          </div>
        ))}
      </div>
    </Card>
  )
}
