/**
 * Apple Pay Button Component
 * Renders Apple Pay button and handles payment flow
 */

import React, { useState, useEffect } from 'react'
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform
} from 'react-native'
import { ApplePayService } from '../../services/apple-pay-service'
import { useAuthStore } from '../../stores/auth-store'
import type { ResourcePackage } from '@saga/shared/types'

interface ApplePayButtonProps {
  package: ResourcePackage
  onSuccess: (result: { transactionId: string; walletBalance: any }) => void
  onError: (error: string) => void
  disabled?: boolean
  style?: any
}

export const ApplePayButton: React.FC<ApplePayButtonProps> = ({
  package: packageDetails,
  onSuccess,
  onError,
  disabled = false,
  style
}) => {
  const [isAvailable, setIsAvailable] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const { user } = useAuthStore()

  useEffect(() => {
    checkApplePayAvailability()
  }, [])

  const checkApplePayAvailability = async () => {
    try {
      const available = await ApplePayService.isAvailable()
      setIsAvailable(available)
    } catch (error) {
      console.error('Error checking Apple Pay availability:', error)
      setIsAvailable(false)
    }
  }

  const handleApplePayPress = async () => {
    if (!user) {
      onError('User not authenticated')
      return
    }

    if (isProcessing || disabled) {
      return
    }

    setIsProcessing(true)

    try {
      // Show confirmation alert
      Alert.alert(
        'Confirm Purchase',
        `Purchase ${packageDetails.name} for $${packageDetails.price.toFixed(2)}?`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => setIsProcessing(false)
          },
          {
            text: 'Buy with Apple Pay',
            onPress: async () => {
              try {
                const result = await ApplePayService.completePurchase(
                  packageDetails,
                  user.id
                )

                if (result.success) {
                  onSuccess({
                    transactionId: result.transactionId!,
                    walletBalance: result.walletBalance
                  })
                } else {
                  onError(result.error || 'Purchase failed')
                }
              } catch (error) {
                const errorMessage = ApplePayService.handleError(error)
                onError(errorMessage)
              } finally {
                setIsProcessing(false)
              }
            }
          }
        ]
      )
    } catch (error) {
      console.error('Error initiating Apple Pay:', error)
      onError('Failed to initiate Apple Pay')
      setIsProcessing(false)
    }
  }

  // Don't render on Android or if Apple Pay is not available
  if (Platform.OS !== 'ios' || !isAvailable) {
    return null
  }

  return (
    <TouchableOpacity
      style={[styles.applePayButton, style, disabled && styles.disabled]}
      onPress={handleApplePayPress}
      disabled={disabled || isProcessing}
      activeOpacity={0.8}
    >
      {isProcessing ? (
        <View style={styles.processingContainer}>
          <ActivityIndicator color="#ffffff" size="small" />
          <Text style={styles.processingText}>Processing...</Text>
        </View>
      ) : (
        <View style={styles.buttonContent}>
          <Text style={styles.applePayIcon}>🍎</Text>
          <Text style={styles.applePayText}>Buy with Apple Pay</Text>
        </View>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  applePayButton: {
    backgroundColor: '#000000',
    borderRadius: 8,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  disabled: {
    backgroundColor: '#cccccc',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  applePayIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  applePayText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  processingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  processingText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
})

export default ApplePayButton