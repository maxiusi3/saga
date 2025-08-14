/**
 * Payment Buttons Component
 * Unified component that shows appropriate payment methods based on platform
 */

import React from 'react'
import { View, StyleSheet, Platform } from 'react-native'
import ApplePayButton from './ApplePayButton'
import GooglePayButton from './GooglePayButton'
import type { ResourcePackage } from '@saga/shared/types'

interface PaymentButtonsProps {
  package: ResourcePackage
  onSuccess: (result: { transactionId: string; walletBalance: any }) => void
  onError: (error: string) => void
  disabled?: boolean
  showCreditCard?: boolean
  style?: any
}

export const PaymentButtons: React.FC<PaymentButtonsProps> = ({
  package: packageDetails,
  onSuccess,
  onError,
  disabled = false,
  showCreditCard = true,
  style
}) => {
  return (
    <View style={[styles.container, style]}>
      {/* Apple Pay for iOS */}
      {Platform.OS === 'ios' && (
        <ApplePayButton
          package={packageDetails}
          onSuccess={onSuccess}
          onError={onError}
          disabled={disabled}
        />
      )}

      {/* Google Pay for Android */}
      {Platform.OS === 'android' && (
        <GooglePayButton
          package={packageDetails}
          onSuccess={onSuccess}
          onError={onError}
          disabled={disabled}
        />
      )}

      {/* Credit Card option (always available as fallback) */}
      {showCreditCard && (
        <CreditCardButton
          package={packageDetails}
          onSuccess={onSuccess}
          onError={onError}
          disabled={disabled}
        />
      )}
    </View>
  )
}

// Placeholder for credit card button - would integrate with Stripe Elements
const CreditCardButton: React.FC<{
  package: ResourcePackage
  onSuccess: (result: { transactionId: string; walletBalance: any }) => void
  onError: (error: string) => void
  disabled?: boolean
}> = ({ package: packageDetails, onSuccess, onError, disabled }) => {
  const handleCreditCardPress = () => {
    // This would navigate to a credit card form or open Stripe payment sheet
    console.log('Credit card payment not implemented yet')
    onError('Credit card payment not implemented yet')
  }

  return (
    <View style={styles.creditCardButton}>
      {/* Credit card form would go here */}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  creditCardButton: {
    // Placeholder for credit card button styles
  },
})

export default PaymentButtons