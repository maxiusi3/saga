import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { height: screenHeight } = Dimensions.get('window');

import { useOnboardingStore } from '../../stores/onboarding-store';

interface Props {
  onNext: () => void;
  onBack: () => void;
}

export function PrivacyStep({ onNext, onBack }: Props) {
  const { hasAcceptedPrivacy, acceptPrivacy, currentProject } = useOnboardingStore();
  const [showModal, setShowModal] = useState(true);

  const handleAcceptPrivacy = () => {
    acceptPrivacy();
    setShowModal(false);
    onNext();
  };

  return (
    <Modal
      visible={showModal}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={() => {}} // Prevent dismissal
    >
      <View style={styles.modalContainer}>
        <ScrollView 
          style={styles.scrollContainer} 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
        >
          <View style={styles.header}>
            <Ionicons name="shield-checkmark" size={80} color="#10b981" />
            <Text style={styles.title}>Our Privacy Pledge</Text>
            <Text style={styles.subtitle}>
              Your stories are precious memories. Here's our commitment to protecting them.
            </Text>
          </View>

          <View style={styles.pledgeContent}>
            <View style={styles.pledgeSection}>
              <View style={styles.pledgeIcon}>
                <Ionicons name="lock-closed" size={24} color="#10b981" />
              </View>
              <View style={styles.pledgeText}>
                <Text style={styles.pledgeTitle}>Your Data is Secure</Text>
                <Text style={styles.pledgeDescription}>
                  All recordings are encrypted during upload and storage. Only invited family members can access your stories.
                </Text>
              </View>
            </View>

            <View style={styles.pledgeSection}>
              <View style={styles.pledgeIcon}>
                <Ionicons name="people" size={24} color="#10b981" />
              </View>
              <View style={styles.pledgeText}>
                <Text style={styles.pledgeTitle}>Family Only Access</Text>
                <Text style={styles.pledgeDescription}>
                  Your stories are shared only with family members you've been invited to connect with. No one else can see them.
                </Text>
              </View>
            </View>

            <View style={styles.pledgeSection}>
              <View style={styles.pledgeIcon}>
                <Ionicons name="heart" size={24} color="#10b981" />
              </View>
              <View style={styles.pledgeText}>
                <Text style={styles.pledgeTitle}>You Own Your Stories</Text>
                <Text style={styles.pledgeDescription}>
                  Your memories belong to you. You can export your data or leave the project at any time.
                </Text>
              </View>
            </View>

            <View style={styles.pledgeSection}>
              <View style={styles.pledgeIcon}>
                <Ionicons name="shield-checkmark" size={24} color="#10b981" />
              </View>
              <View style={styles.pledgeText}>
                <Text style={styles.pledgeTitle}>No Third-Party Sharing</Text>
                <Text style={styles.pledgeDescription}>
                  We never share your personal data or recordings with advertisers, marketers, or other companies.
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.commitmentBox}>
            <Text style={styles.commitmentText}>
              We are committed to protecting your privacy and treating your family stories with the respect and care they deserve.
            </Text>
          </View>
        </ScrollView>

        <View style={styles.actionContainer}>
          <TouchableOpacity 
            style={styles.agreeButton}
            onPress={handleAcceptPrivacy}
            accessibilityLabel="I understand and agree to privacy terms"
            accessibilityHint="Tap to accept privacy terms and continue"
          >
            <Text style={styles.agreeButtonText}>I Understand and Agree</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 60,
    paddingBottom: 120, // Space for fixed button
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 20,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 26,
    paddingHorizontal: 16,
  },
  pledgeContent: {
    marginBottom: 32,
  },
  pledgeSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  pledgeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  pledgeText: {
    flex: 1,
    paddingTop: 4,
  },
  pledgeTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
    lineHeight: 24,
  },
  pledgeDescription: {
    fontSize: 16,
    color: '#4b5563',
    lineHeight: 24,
  },
  commitmentBox: {
    backgroundColor: '#f0fdf4',
    padding: 24,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#bbf7d0',
    marginBottom: 20,
  },
  commitmentText: {
    fontSize: 18,
    color: '#166534',
    textAlign: 'center',
    lineHeight: 26,
    fontWeight: '600',
  },
  actionContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    padding: 24,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  agreeButton: {
    backgroundColor: '#10b981',
    paddingVertical: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 8,
  },
  agreeButtonText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
});