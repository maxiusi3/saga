import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { AuthStackParamList } from '../../navigation/AuthNavigator';
import { useOnboardingStore } from '../../stores/onboarding-store';
import { InvitationService } from '../../services/invitation-service';

type Props = {
  navigation: StackNavigationProp<AuthStackParamList, 'Invitation'>;
  route: RouteProp<AuthStackParamList, 'Invitation'>;
};

export function InvitationScreen({ navigation, route }: Props) {
  const [inputValue, setInputValue] = useState(route.params?.invitationCode || '');
  const [isValidating, setIsValidating] = useState(false);
  
  const {
    invitationCode,
    setInvitationCode,
    setInvitation,
    setStep,
    setLoading,
    setError,
    error,
    isLoading,
  } = useOnboardingStore();

  useEffect(() => {
    // If we have an invitation code from deep link, validate it immediately
    if (route.params?.invitationCode) {
      const code = route.params.invitationCode;
      setInputValue(code);
      setInvitationCode(code);
      validateInvitation(code);
    }
  }, [route.params?.invitationCode]);

  const validateInvitation = async (code: string) => {
    if (!code.trim()) return;

    try {
      setIsValidating(true);
      setError(null);

      const result = await InvitationService.validateInvitation(code.trim().toUpperCase());
      
      if (result.isValid && result.invitation && result.project) {
        setInvitation(result.invitation, result.project, result.facilitators);
        setStep('user-info');
        navigation.navigate('Onboarding', { projectId: result.project.id });
      } else {
        setError(result.error || 'Invalid invitation code');
        Alert.alert(
          'Invalid Invitation',
          result.error || 'Please check your invitation code and try again'
        );
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to validate invitation';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setIsValidating(false);
    }
  };

  const handleInputChange = (text: string) => {
    // Format input as uppercase and limit to 8 characters
    const formatted = text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    setInputValue(formatted);
    setInvitationCode(formatted);
    
    // Clear any previous errors
    if (error) {
      setError(null);
    }
  };

  const handleJoin = async () => {
    if (!inputValue.trim()) {
      Alert.alert('Error', 'Please enter an invitation code');
      return;
    }

    await validateInvitation(inputValue);
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Ionicons name="mail-outline" size={64} color="#2563eb" />
          <Text style={styles.title}>Enter Invitation Code</Text>
          <Text style={styles.subtitle}>
            Enter the 8-character code shared by your family member
          </Text>
        </View>
        
        <View style={styles.inputContainer}>
          <TextInput
            style={[styles.input, error && styles.inputError]}
            value={inputValue}
            onChangeText={handleInputChange}
            placeholder="ABC12345"
            placeholderTextColor="#9ca3af"
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!isValidating && !isLoading}
            maxLength={8}
            textAlign="center"
          />
          
          {isValidating && (
            <View style={styles.validatingIndicator}>
              <ActivityIndicator size="small" color="#2563eb" />
            </View>
          )}
        </View>
        
        {error && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={24} color="#ef4444" />
            <View style={styles.errorContent}>
              <Text style={styles.errorTitle}>Invitation Issue</Text>
              <Text style={styles.errorText}>{error}</Text>
              <Text style={styles.errorHint}>
                Please ask your family member to send you a new invitation link, or double-check that you entered the code correctly.
              </Text>
            </View>
          </View>
        )}
        
        <View style={styles.actions}>
          <TouchableOpacity 
            style={[
              styles.joinButton, 
              (isValidating || isLoading || inputValue.length < 8) && styles.joinButtonDisabled
            ]} 
            onPress={handleJoin}
            disabled={isValidating || isLoading || inputValue.length < 8}
          >
            {isValidating ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.joinButtonText}>
                Join Family Project
              </Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            disabled={isValidating || isLoading}
          >
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.helpSection}>
          <Text style={styles.helpTitle}>Need help?</Text>
          <Text style={styles.helpText}>
            Ask your family member to resend the invitation or check that you entered the code correctly.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  inputContainer: {
    position: 'relative',
    marginBottom: 24,
  },
  input: {
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 20,
    fontSize: 24,
    color: '#1f2937',
    textAlign: 'center',
    letterSpacing: 4,
    fontWeight: '600',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  validatingIndicator: {
    position: 'absolute',
    right: 16,
    top: '50%',
    transform: [{ translateY: -10 }],
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorContent: {
    flex: 1,
    marginLeft: 12,
  },
  errorTitle: {
    color: '#dc2626',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 20,
  },
  errorHint: {
    color: '#7f1d1d',
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  actions: {
    marginBottom: 32,
  },
  joinButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
    minHeight: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  joinButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  joinButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  backButton: {
    paddingVertical: 12,
  },
  backButtonText: {
    color: '#6b7280',
    fontSize: 16,
    textAlign: 'center',
  },
  helpSection: {
    alignItems: 'center',
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  helpText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});