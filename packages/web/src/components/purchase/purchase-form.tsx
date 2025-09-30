'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  CreditCard, 
  Lock, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  Shield,
  Apple,
  Smartphone
} from 'lucide-react'

interface PurchaseFormData {
  email: string
  fullName: string
  paymentMethod: 'card' | 'apple_pay' | 'google_pay'
  cardNumber: string
  expiryDate: string
  cvv: string
  billingAddress: {
    street: string
    city: string
    state: string
    zipCode: string
    country: string
  }
  agreeToTerms: boolean
  subscribeToUpdates: boolean
}

interface PurchaseFormProps {
  selectedPackage?: {
    id: string
    name: string
    price: number
    currency: string
  }
  onSubmit?: (formData: PurchaseFormData) => Promise<void>
  isLoading?: boolean
}

interface FormErrors {
  [key: string]: string
}

export function PurchaseForm({ 
  selectedPackage, 
  onSubmit,
  isLoading = false 
}: PurchaseFormProps) {
  const [formData, setFormData] = useState<PurchaseFormData>({
    email: '',
    fullName: '',
    paymentMethod: 'card',
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    billingAddress: {
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'US'
    },
    agreeToTerms: false,
    subscribeToUpdates: true
  })

  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    // Email validation
    if (!formData.email) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address'
    }

    // Full name validation
    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required'
    }

    // Payment method specific validation
    if (formData.paymentMethod === 'card') {
      if (!formData.cardNumber.replace(/\s/g, '')) {
        newErrors.cardNumber = 'Card number is required'
      } else if (formData.cardNumber.replace(/\s/g, '').length < 13) {
        newErrors.cardNumber = 'Please enter a valid card number'
      }

      if (!formData.expiryDate) {
        newErrors.expiryDate = 'Expiry date is required'
      } else if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(formData.expiryDate)) {
        newErrors.expiryDate = 'Please enter a valid expiry date (MM/YY)'
      }

      if (!formData.cvv) {
        newErrors.cvv = 'CVV is required'
      } else if (formData.cvv.length < 3) {
        newErrors.cvv = 'Please enter a valid CVV'
      }

      // Billing address validation
      if (!formData.billingAddress.street.trim()) {
        newErrors.billingStreet = 'Street address is required'
      }
      if (!formData.billingAddress.city.trim()) {
        newErrors.billingCity = 'City is required'
      }
      if (!formData.billingAddress.state.trim()) {
        newErrors.billingState = 'State is required'
      }
      if (!formData.billingAddress.zipCode.trim()) {
        newErrors.billingZipCode = 'ZIP code is required'
      }
    }

    // Terms agreement validation
    if (!formData.agreeToTerms) {
      newErrors.agreeToTerms = 'You must agree to the terms and conditions'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit?.(formData)
    } catch (error) {
      console.error('Purchase failed:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '')
    const matches = v.match(/\d{4,16}/g)
    const match = matches && matches[0] || ''
    const parts = []
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4))
    }
    if (parts.length) {
      return parts.join(' ')
    } else {
      return v
    }
  }

  const formatExpiryDate = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '')
    if (v.length >= 2) {
      return v.substring(0, 2) + '/' + v.substring(2, 4)
    }
    return v
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card variant="elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-primary" />
            Secure Checkout
          </CardTitle>
          {selectedPackage && (
            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
              <div>
                <p className="font-medium text-foreground">{selectedPackage.name}</p>
                <p className="text-sm text-muted-foreground">One-time purchase</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-foreground">
                  ${selectedPackage.price}
                </p>
                <p className="text-sm text-muted-foreground">{selectedPackage.currency}</p>
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Contact Information */}
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground">Contact Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className={errors.email ? 'border-destructive' : ''}
                    placeholder="your@email.com"
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.email}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="fullName">Full Name *</Label>
                  <Input
                    id="fullName"
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                    className={errors.fullName ? 'border-destructive' : ''}
                    placeholder="John Doe"
                  />
                  {errors.fullName && (
                    <p className="text-sm text-destructive mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.fullName}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Payment Method Selection */}
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground">Payment Method</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, paymentMethod: 'card' }))}
                  className={`p-4 border rounded-lg flex items-center justify-center gap-2 transition-colors ${
                    formData.paymentMethod === 'card' 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <CreditCard className="w-5 h-5" />
                  <span className="text-sm font-medium">Credit Card</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, paymentMethod: 'apple_pay' }))}
                  className={`p-4 border rounded-lg flex items-center justify-center gap-2 transition-colors ${
                    formData.paymentMethod === 'apple_pay' 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <Apple className="w-5 h-5" />
                  <span className="text-sm font-medium">Apple Pay</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, paymentMethod: 'google_pay' }))}
                  className={`p-4 border rounded-lg flex items-center justify-center gap-2 transition-colors ${
                    formData.paymentMethod === 'google_pay' 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <Smartphone className="w-5 h-5" />
                  <span className="text-sm font-medium">Google Pay</span>
                </button>
              </div>
            </div>

            {/* Credit Card Details */}
            {formData.paymentMethod === 'card' && (
              <div className="space-y-4">
                <h3 className="font-semibold text-foreground">Card Details</h3>
                
                <div>
                  <Label htmlFor="cardNumber">Card Number *</Label>
                  <Input
                    id="cardNumber"
                    type="text"
                    value={formData.cardNumber}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      cardNumber: formatCardNumber(e.target.value) 
                    }))}
                    className={errors.cardNumber ? 'border-destructive' : ''}
                    placeholder="1234 5678 9012 3456"
                    maxLength={19}
                  />
                  {errors.cardNumber && (
                    <p className="text-sm text-destructive mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.cardNumber}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="expiryDate">Expiry Date *</Label>
                    <Input
                      id="expiryDate"
                      type="text"
                      value={formData.expiryDate}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        expiryDate: formatExpiryDate(e.target.value) 
                      }))}
                      className={errors.expiryDate ? 'border-destructive' : ''}
                      placeholder="MM/YY"
                      maxLength={5}
                    />
                    {errors.expiryDate && (
                      <p className="text-sm text-destructive mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {errors.expiryDate}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="cvv">CVV *</Label>
                    <Input
                      id="cvv"
                      type="text"
                      value={formData.cvv}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        cvv: e.target.value.replace(/\D/g, '') 
                      }))}
                      className={errors.cvv ? 'border-destructive' : ''}
                      placeholder="123"
                      maxLength={4}
                    />
                    {errors.cvv && (
                      <p className="text-sm text-destructive mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {errors.cvv}
                      </p>
                    )}
                  </div>
                </div>

                {/* Billing Address */}
                <div className="space-y-4">
                  <h4 className="font-medium text-foreground">Billing Address</h4>
                  
                  <div>
                    <Label htmlFor="street">Street Address *</Label>
                    <Input
                      id="street"
                      type="text"
                      value={formData.billingAddress.street}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        billingAddress: { ...prev.billingAddress, street: e.target.value }
                      }))}
                      className={errors.billingStreet ? 'border-destructive' : ''}
                      placeholder="123 Main Street"
                    />
                    {errors.billingStreet && (
                      <p className="text-sm text-destructive mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {errors.billingStreet}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="city">City *</Label>
                      <Input
                        id="city"
                        type="text"
                        value={formData.billingAddress.city}
                        onChange={(e) => setFormData(prev => ({ 
                          ...prev, 
                          billingAddress: { ...prev.billingAddress, city: e.target.value }
                        }))}
                        className={errors.billingCity ? 'border-destructive' : ''}
                        placeholder="New York"
                      />
                      {errors.billingCity && (
                        <p className="text-sm text-destructive mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {errors.billingCity}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="state">State *</Label>
                      <Input
                        id="state"
                        type="text"
                        value={formData.billingAddress.state}
                        onChange={(e) => setFormData(prev => ({ 
                          ...prev, 
                          billingAddress: { ...prev.billingAddress, state: e.target.value }
                        }))}
                        className={errors.billingState ? 'border-destructive' : ''}
                        placeholder="NY"
                      />
                      {errors.billingState && (
                        <p className="text-sm text-destructive mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {errors.billingState}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="zipCode">ZIP Code *</Label>
                    <Input
                      id="zipCode"
                      type="text"
                      value={formData.billingAddress.zipCode}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        billingAddress: { ...prev.billingAddress, zipCode: e.target.value }
                      }))}
                      className={errors.billingZipCode ? 'border-destructive' : ''}
                      placeholder="10001"
                    />
                    {errors.billingZipCode && (
                      <p className="text-sm text-destructive mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {errors.billingZipCode}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Terms and Conditions */}
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="agreeToTerms"
                  checked={formData.agreeToTerms}
                  onCheckedChange={(checked) => 
                    setFormData(prev => ({ ...prev, agreeToTerms: checked as boolean }))
                  }
                  className={errors.agreeToTerms ? 'border-destructive' : ''}
                />
                <div className="flex-1">
                  <Label htmlFor="agreeToTerms" className="text-sm">
                    I agree to the{' '}
                    <a href="/terms" className="text-primary hover:underline">
                      Terms of Service
                    </a>{' '}
                    and{' '}
                    <a href="/privacy" className="text-primary hover:underline">
                      Privacy Policy
                    </a>
                    *
                  </Label>
                  {errors.agreeToTerms && (
                    <p className="text-sm text-destructive mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.agreeToTerms}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Checkbox
                  id="subscribeToUpdates"
                  checked={formData.subscribeToUpdates}
                  onCheckedChange={(checked) => 
                    setFormData(prev => ({ ...prev, subscribeToUpdates: checked as boolean }))
                  }
                />
                <Label htmlFor="subscribeToUpdates" className="text-sm">
                  Send me updates about new features and family storytelling tips
                </Label>
              </div>
            </div>

            {/* Security Notice */}
            <div className="p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-success" />
                <span className="text-sm font-medium text-foreground">Secure Payment</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Your payment information is encrypted and secure. We use industry-standard 
                SSL encryption to protect your data.
              </p>
            </div>

            {/* Submit Button */}
            <Button 
              type="submit" 
              variant="primary" 
              size="lg" 
              className="w-full"
              disabled={isSubmitting || isLoading}
            >
              {isSubmitting || isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 mr-2" />
                  Complete Purchase
                  {selectedPackage && ` - $${selectedPackage.price}`}
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}