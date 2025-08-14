import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useOnboardingStore } from '../../stores/onboarding-store';

interface Props {
  onComplete: () => void;
}

const { width } = Dimensions.get('window');

const tutorialSteps = [
  {
    icon: 'home-outline',
    title: 'Welcome Home',
    description: 'Your home screen shows daily prompts and recent activity. This is where your storytelling journey begins.',
    color: '#2563eb',
  },
  {
    icon: 'mic-outline',
    title: 'Record Your Stories',
    description: 'Tap the record button to share a memory. AI will guide you with thoughtful prompts to help you tell your story.',
    color: '#10b981',
  },
  {
    icon: 'library-outline',
    title: 'Review Your Stories',
    description: 'See all your recorded stories, read transcripts, and view comments from your family members.',
    color: '#f59e0b',
  },
  {
    icon: 'chatbubble-outline',
    title: 'Family Interactions',
    description: 'Receive loving comments and follow-up questions from family. You can record responses to continue the conversation.',
    color: '#ef4444',
  },
  {
    icon: 'settings-outline',
    title: 'Personalize Your Experience',
    description: 'Adjust font sizes, enable high contrast mode, and customize notifications in your profile settings.',
    color: '#8b5cf6',
  },
];

export function TutorialStep({ onComplete }: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const { tutorialStep, setTutorialStep, completeTutorial } = useOnboardingStore();

  const handleNext = () => {
    if (currentStep < tutorialSteps.length - 1) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      setTutorialStep(nextStep);
    } else {
      completeTutorial();
      onComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      setTutorialStep(prevStep);
    }
  };

  const handleSkip = () => {
    completeTutorial();
    onComplete();
  };

  const currentTutorial = tutorialSteps[currentStep];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipButtonText}>Skip Tutorial</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.stepIndicator}>
          {tutorialSteps.map((_, index) => (
            <View
              key={index}
              style={[
                styles.stepDot,
                index === currentStep && styles.stepDotActive,
                index < currentStep && styles.stepDotCompleted,
              ]}
            />
          ))}
        </View>

        <View style={styles.tutorialCard}>
          <View style={[styles.iconContainer, { backgroundColor: `${currentTutorial.color}20` }]}>
            <Ionicons 
              name={currentTutorial.icon as any} 
              size={64} 
              color={currentTutorial.color} 
            />
          </View>
          
          <Text style={styles.title}>{currentTutorial.title}</Text>
          <Text style={styles.description}>{currentTutorial.description}</Text>
        </View>

        <View style={styles.tips}>
          <View style={styles.tip}>
            <Ionicons name="bulb-outline" size={20} color="#f59e0b" />
            <Text style={styles.tipText}>
              Tip: You can always access help from your profile settings
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.actions}>
        <View style={styles.navigationButtons}>
          {currentStep > 0 && (
            <TouchableOpacity style={styles.secondaryButton} onPress={handlePrevious}>
              <Ionicons name="chevron-back" size={20} color="#6b7280" />
              <Text style={styles.secondaryButtonText}>Previous</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity style={styles.primaryButton} onPress={handleNext}>
            <Text style={styles.primaryButtonText}>
              {currentStep === tutorialSteps.length - 1 ? 'Start Recording!' : 'Next'}
            </Text>
            {currentStep < tutorialSteps.length - 1 && (
              <Ionicons name="chevron-forward" size={20} color="#ffffff" />
            )}
          </TouchableOpacity>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 20,
    paddingTop: 60,
  },
  skipButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  skipButtonText: {
    color: '#6b7280',
    fontSize: 16,
  },
  content: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
  },
  stepIndicator: {
    flexDirection: 'row',
    marginBottom: 40,
    gap: 8,
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#e5e7eb',
  },
  stepDotActive: {
    backgroundColor: '#2563eb',
  },
  stepDotCompleted: {
    backgroundColor: '#10b981',
  },
  tutorialCard: {
    alignItems: 'center',
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    fontSize: 18,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 26,
  },
  tips: {
    width: '100%',
  },
  tip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: '#92400e',
    lineHeight: 20,
  },
  actions: {
    padding: 24,
  },
  navigationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563eb',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 4,
  },
  secondaryButtonText: {
    color: '#6b7280',
    fontSize: 16,
  },
});