/**
 * Google Pay Button Component
 * Renders Google Pay button and handles payment flow
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
import { GooglePayService } from '../../services/google-pay-service'
import { useAuthStore } from '../../stores/auth-store'
import type { ResourcePackage } from '@saga/shared/types'

interface GooglePayButtonProps {
  package: ResourcePackage
  onSuccess: (result: { transactionId: string; walletBalance: any }) => void
  onError: (error: string) => void
  disabled?: boolean
  style?: any
}

export const GooglePayButton: React.FC<GooglePayButtonProps> = ({
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
    checkGooglePayAvailability()
    prefetchPaymentData()
  }, [])

  const checkGooglePayAvailability = async () => {
    try {
      const available = await GooglePayService.isAvailable()
      setIsAvailable(available)
    } catch (error) {
      console.error('Error checking Google Pay availability:', error)
      setIsAvailable(false)
    }
  }

  const prefetchPaymentData = async () => {
    try {
      await GooglePayService.prefetchPaymentData(packageDetails)
    } catch (error) {
      console.error('Error prefetching Google Pay data:', error)
    }
  }

  const handleGooglePayPress = async () => {
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
            text: 'Buy with Google Pay',
            onPress: async () => {
              try {
                const result = await GooglePayService.completePurchase(
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
                const errorMessage = GooglePayService.handleError(error)
                onError(errorMessage)
              } finally {
                setIsProcessing(false)
              }
            }
          }
        ]
      )
    } catch (error) {
      console.error('Error initiating Google Pay:', error)
      onError('Failed to initiate Google Pay')
      setIsProcessing(false)
    }
  }

  // Don't render on iOS or if Google Pay is not available
  if (Platform.OS !== 'android' || !isAvailable) {
    return null
  }

  return (
    <TouchableOpacity
      style={[styles.googlePayButton, style, disabled && styles.disabled]}
      onPress={handleGooglePayPress}
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
          <View style={styles.googlePayLogo}>
            <Text style={styles.googleG}>G</Text>
          </View>
          <Text style={styles.googlePayText}>Buy with Google Pay</Text>
        </View>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  googlePayButton: {
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
  googlePayLogo: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  googleG: {
    color: '#4285f4',
    fontSize: 12,
    fontWeight: 'bold',
  },
  googlePayText: {
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

export default GooglePayButton