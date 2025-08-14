import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { AuthStackParamList } from '../../navigation/AuthNavigator';
import { useOnboardingStore } from '../../stores/onboarding-store';
import { useAuthStore } from '../../stores/auth-store';
import { InvitationService } from '../../services/invitation-service';
import { UserInfoStep } from '../../components/onboarding/UserInfoStep';
import { PrivacyStep } from '../../components/onboarding/PrivacyStep';
import { TutorialStep } from '../../components/onboarding/TutorialStep';
import { OnboardingAnalytics } from '../../services/onboarding-analytics';

type Props = {
  navigation: StackNavigationProp<AuthStackParamList, 'Onboarding'>;
  route: RouteProp<AuthStackParamList, 'Onboarding'>;
};

export function OnboardingScreen({ navigation, route }: Props) {
  const { projectId } = route.params;
  
  const {
    step,
    currentProject,
    currentInvitation,
    facilitators,
    invitationCode,
    userInfo,
    hasAcceptedPrivacy,
    hasCompletedTutorial,
    isLoading,
    error,
    setStep,
    nextStep,
    previousStep,
    setLoading,
    setError,
  } = useOnboardingStore();

  const { login } = useAuthStore();

  // Track step changes
  useEffect(() => {
    OnboardingAnalytics.trackStepStarted(step, {
      project_id: projectId,
      project_name: currentProject?.name,
      facilitator_count: facilitators?.length || 0,
    });
  }, [step, projectId, currentProject?.name, facilitators?.length]);

  const handleCompleteOnboarding = async () => {
    try {
      setLoading(true);
      setError(null);

      // Accept the invitation with user info
      const result = await InvitationService.acceptInvitation(invitationCode, userInfo);
      
      if (result.success && result.user && result.token) {
        // This will trigger the auth state change and navigate to main app
        await login(invitationCode);
      } else {
        throw new Error(result.error || 'Failed to complete onboarding');
      }
    } catch (error: any) {
      setError(error.message || 'Failed to complete onboarding');
      Alert.alert('Error', error.message || 'Failed to complete onboarding');
    } finally {
      setLoading(false);
    }
  };

  const renderCurrentStep = () => {
    switch (step) {
      case 'user-info':
        return <UserInfoStep onNext={nextStep} onBack={previousStep} />;
      
      case 'privacy':
        return <PrivacyStep onNext={nextStep} onBack={previousStep} />;
      
      case 'complete':
        return <TutorialStep onComplete={handleCompleteOnboarding} />;
      
      default:
        return <WelcomeStep />;
    }
  };

  const getFacilitatorNames = () => {
    if (!facilitators || facilitators.length === 0) {
      return 'your family';
    }
    
    if (facilitators.length === 1) {
      return facilitators[0].name;
    }
    
    if (facilitators.length === 2) {
      return `${facilitators[0].name} and ${facilitators[1].name}`;
    }
    
    return `${facilitators[0].name} and ${facilitators.length - 1} others`;
  };

  const WelcomeStep = () => (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Ionicons name="heart" size={80} color="#ef4444" />
        <Text style={styles.title}>Welcome to the Family!</Text>
        <Text style={styles.subtitle}>
          {getFacilitatorNames()} invited you to join "{currentProject?.name || 'Family Biography Project'}"
        </Text>
        
        {facilitators && facilitators.length > 0 && (
          <View style={styles.facilitatorsList}>
            <Text style={styles.facilitatorsTitle}>Project Facilitators:</Text>
            {facilitators.map((facilitator, index) => (
              <View key={facilitator.id} style={styles.facilitatorItem}>
                <Ionicons name="person-circle" size={24} color="#2563eb" />
                <Text style={styles.facilitatorName}>{facilitator.name}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.features}>
        <View style={styles.feature}>
          <Ionicons name="mic" size={32} color="#2563eb" />
          <Text style={styles.featureTitle}>Share Your Stories</Text>
          <Text style={styles.featureText}>
            Record your memories with AI-guided prompts designed to capture your unique experiences
          </Text>
        </View>

        <View style={styles.feature}>
          <Ionicons name="chatbubbles" size={32} color="#2563eb" />
          <Text style={styles.featureTitle}>Connect with Family</Text>
          <Text style={styles.featureText}>
            Receive loving comments and thoughtful follow-up questions from {getFacilitatorNames()}
          </Text>
        </View>

        <View style={styles.feature}>
          <Ionicons name="library" size={32} color="#2563eb" />
          <Text style={styles.featureTitle}>Build Your Legacy</Text>
          <Text style={styles.featureText}>
            Create a lasting digital biography that will be treasured for generations
          </Text>
        </View>
      </View>

      <TouchableOpacity 
        style={styles.acceptJoinButton} 
        onPress={nextStep}
        accessibilityLabel="Accept invitation and join family project"
        accessibilityHint="Tap to continue with the onboarding process"
      >
        <Text style={styles.acceptJoinButtonText}>Accept & Join</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  return renderCurrentStep();
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    padding: 24,
    paddingTop: 60,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
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
  features: {
    marginBottom: 48,
  },
  feature: {
    alignItems: 'center',
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  featureTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  featureText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  facilitatorsList: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    alignItems: 'center',
  },
  facilitatorsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
    textAlign: 'center',
  },
  facilitatorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    minWidth: 200,
  },
  facilitatorName: {
    fontSize: 16,
    color: '#1f2937',
    marginLeft: 8,
    fontWeight: '500',
  },
  acceptJoinButton: {
    backgroundColor: '#10b981',
    paddingVertical: 18,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  acceptJoinButtonText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
});