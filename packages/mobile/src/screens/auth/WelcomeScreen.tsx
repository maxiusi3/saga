import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';

import { AuthStackParamList } from '../../navigation/AuthNavigator';

type Props = {
  navigation: StackNavigationProp<AuthStackParamList, 'Welcome'>;
};

export function WelcomeScreen({ navigation }: Props) {
  const handleJoinWithInvitation = () => {
    navigation.navigate('Invitation', {});
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Ionicons name="book-outline" size={80} color="#2563eb" />
        <Text style={styles.title}>Welcome to Saga</Text>
        <Text style={styles.subtitle}>
          Share your life stories with family through voice recordings
        </Text>
        
        <TouchableOpacity 
          style={styles.primaryButton} 
          onPress={handleJoinWithInvitation}
        >
          <Text style={styles.primaryButtonText}>Join with Invitation</Text>
        </TouchableOpacity>
        
        <Text style={styles.helpText}>
          You need an invitation from a family member to get started
        </Text>
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
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 24,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 48,
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
    minWidth: 200,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  helpText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    maxWidth: 280,
  },
});