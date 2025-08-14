import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AIPrompt, PromptService } from '../../services/prompt-service';

interface Props {
  prompt: AIPrompt;
  isPlaying: boolean;
  onPlay: () => void;
  onStop: () => void;
  onSkip: () => void;
  onGetNew: () => void;
}

export function PromptCard({ prompt, isPlaying, onPlay, onStop, onSkip, onGetNew }: Props) {
  const categoryColor = PromptService.getDifficultyColor(prompt.difficulty);
  const categoryName = PromptService.getCategoryDisplayName(prompt.category);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.categoryBadge}>
          <View 
            style={[styles.categoryDot, { backgroundColor: categoryColor }]} 
            testID="category-dot"
          />
          <Text style={styles.categoryText}>{categoryName}</Text>
        </View>
        
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={isPlaying ? onStop : onPlay}
            testID={isPlaying ? 'stop-button' : 'play-button'}
          >
            <Ionicons 
              name={isPlaying ? 'stop-circle' : 'play-circle'} 
              size={24} 
              color="#2563eb" 
            />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onGetNew}
            testID="refresh-button"
          >
            <Ionicons name="refresh" size={20} color="#6b7280" />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.promptText}>{prompt.text}</Text>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.skipButton} onPress={onSkip}>
          <Text style={styles.skipButtonText}>Skip This Prompt</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 4,
  },
  promptText: {
    fontSize: 18,
    lineHeight: 26,
    color: '#1f2937',
    marginBottom: 16,
  },
  footer: {
    alignItems: 'center',
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  skipButtonText: {
    fontSize: 14,
    color: '#6b7280',
    textDecorationLine: 'underline',
  },
});