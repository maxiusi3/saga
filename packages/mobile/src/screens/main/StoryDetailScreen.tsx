import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';

import { MainStackParamList } from '../../navigation/MainNavigator';
import { useStoryStore } from '../../stores/story-store';
import type { Interaction } from '@saga/shared/types/interaction';

type Props = {
  navigation: StackNavigationProp<MainStackParamList, 'StoryDetail'>;
  route: RouteProp<MainStackParamList, 'StoryDetail'>;
};

interface AudioPlayerProps {
  audioUrl: string;
  duration?: number;
}

function AudioPlayer({ audioUrl, duration }: AudioPlayerProps) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const loadAudio = async () => {
    try {
      setIsLoading(true);
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: false }
      );
      
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          setPosition(status.positionMillis || 0);
          setIsPlaying(status.isPlaying || false);
        }
      });
      
      setSound(newSound);
    } catch (error) {
      Alert.alert('Error', 'Failed to load audio');
    } finally {
      setIsLoading(false);
    }
  };

  const togglePlayback = async () => {
    if (!sound) {
      await loadAudio();
      return;
    }

    try {
      if (isPlaying) {
        await sound.pauseAsync();
      } else {
        await sound.playAsync();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to control audio playback');
    }
  };

  const formatTime = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const progress = duration ? position / (duration * 1000) : 0;

  return (
    <View style={styles.audioPlayer}>
      <TouchableOpacity
        testID="audio-play-button"
        style={styles.playButton}
        onPress={togglePlayback}
        disabled={isLoading}
      >
        {isLoading ? (
          <Ionicons name="hourglass-outline" size={24} color="#ffffff" />
        ) : isPlaying ? (
          <Ionicons name="pause" size={24} color="#ffffff" />
        ) : (
          <Ionicons name="play" size={24} color="#ffffff" />
        )}
      </TouchableOpacity>

      <View style={styles.audioInfo}>
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
        </View>
        
        <View style={styles.timeContainer}>
          <Text style={styles.timeText}>{formatTime(position)}</Text>
          {duration && (
            <Text style={styles.timeText}>{formatTime(duration * 1000)}</Text>
          )}
        </View>
      </View>
    </View>
  );
}

interface InteractionItemProps {
  interaction: Interaction;
  onAnswerPress: () => void;
}

function InteractionItem({ interaction, onAnswerPress }: InteractionItemProps) {
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const isFollowUp = interaction.type === 'followup';
  const isAnswered = interaction.answeredAt;

  return (
    <View style={[
      styles.interactionItem,
      isFollowUp && styles.followUpItem,
    ]}>
      <View style={styles.interactionHeader}>
        <View style={styles.interactionType}>
          <Ionicons
            name={isFollowUp ? 'help-circle-outline' : 'chatbubble-outline'}
            size={16}
            color={isFollowUp ? '#f59e0b' : '#10b981'}
          />
          <Text style={[
            styles.interactionTypeText,
            isFollowUp && styles.followUpTypeText,
          ]}>
            {isFollowUp ? 'Follow-up Question' : 'Comment'}
          </Text>
        </View>
        <Text style={styles.interactionDate}>
          {formatDate(interaction.createdAt)}
        </Text>
      </View>

      <Text style={styles.interactionContent}>{interaction.content}</Text>

      {isFollowUp && !isAnswered && (
        <TouchableOpacity style={styles.answerButton} onPress={onAnswerPress}>
          <Ionicons name="mic" size={16} color="#ffffff" />
          <Text style={styles.answerButtonText}>Record Answer</Text>
        </TouchableOpacity>
      )}

      {isFollowUp && isAnswered && (
        <View style={styles.answeredBadge}>
          <Ionicons name="checkmark-circle" size={16} color="#10b981" />
          <Text style={styles.answeredText}>
            Answered on {formatDate(interaction.answeredAt!)}
          </Text>
        </View>
      )}
    </View>
  );
}

export function StoryDetailScreen({ navigation, route }: Props) {
  const { storyId } = route.params;
  const {
    currentStory,
    interactions,
    isLoading,
    error,
    fetchStoryById,
    fetchStoryInteractions,
    clearError,
  } = useStoryStore();

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadStoryData();
  }, [storyId]);

  useEffect(() => {
    if (error) {
      Alert.alert('Error', error, [{ text: 'OK', onPress: clearError }]);
    }
  }, [error]);

  const loadStoryData = async () => {
    await Promise.all([
      fetchStoryById(storyId),
      fetchStoryInteractions(storyId),
    ]);
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadStoryData();
    setRefreshing(false);
  }, [storyId]);

  const handleAnswerPress = useCallback(
    (interactionId: string) => {
      navigation.navigate('RecordAnswer', {
        questionId: interactionId,
        storyId,
      });
    },
    [navigation, storyId]
  );

  if (!currentStory && !isLoading) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
        <Text style={styles.errorTitle}>Story Not Found</Text>
        <Text style={styles.errorSubtitle}>
          This story may have been deleted or you don't have access to it.
        </Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <ScrollView
      testID="story-detail-scroll"
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      {currentStory && (
        <>
          {/* Story Header */}
          <View style={styles.storyHeader}>
            <Text style={styles.storyTitle}>
              {currentStory.title || currentStory.aiPrompt || 'Untitled Story'}
            </Text>
            <Text style={styles.storyDate}>
              {formatDate(currentStory.createdAt)}
            </Text>
            
            {currentStory.status === 'processing' && (
              <View style={styles.processingBadge}>
                <Ionicons name="time-outline" size={16} color="#f59e0b" />
                <Text style={styles.processingText}>Processing...</Text>
              </View>
            )}
          </View>

          {/* Photo */}
          {currentStory.photoUrl && (
            <View style={styles.photoContainer}>
              <Image
                testID="story-photo"
                source={{ uri: currentStory.photoUrl }}
                style={styles.storyPhoto}
                resizeMode="cover"
              />
            </View>
          )}

          {/* Audio Player */}
          {currentStory.audioUrl && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Audio Recording</Text>
              <AudioPlayer
                audioUrl={currentStory.audioUrl}
                duration={currentStory.audioDuration}
              />
            </View>
          )}

          {/* Transcript */}
          {currentStory.transcript && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Transcript</Text>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => navigation.navigate('EditTranscript', { 
                    storyId: currentStory.id,
                    transcript: currentStory.transcript 
                  })}
                >
                  <Ionicons name="create-outline" size={20} color="#2563eb" />
                  <Text style={styles.editButtonText}>Edit</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.transcriptContainer}>
                <Text style={styles.transcriptText}>
                  {currentStory.transcript}
                </Text>
              </View>
            </View>
          )}

          {/* AI Prompt */}
          {currentStory.aiPrompt && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Original Prompt</Text>
              <View style={styles.promptContainer}>
                <Ionicons name="bulb-outline" size={20} color="#f59e0b" />
                <Text style={styles.promptText}>{currentStory.aiPrompt}</Text>
              </View>
            </View>
          )}

          {/* Interactions */}
          {interactions.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Messages & Questions ({interactions.length})
              </Text>
              {interactions.map((interaction) => (
                <InteractionItem
                  key={interaction.id}
                  interaction={interaction}
                  onAnswerPress={() => handleAnswerPress(interaction.id)}
                />
              ))}
            </View>
          )}

          {/* Empty Interactions State */}
          {interactions.length === 0 && (
            <View style={styles.section}>
              <View style={styles.emptyInteractions}>
                <Ionicons name="chatbubbles-outline" size={48} color="#d1d5db" />
                <Text style={styles.emptyInteractionsTitle}>
                  No Messages Yet
                </Text>
                <Text style={styles.emptyInteractionsSubtitle}>
                  Your family will see comments and questions here when they respond to your story.
                </Text>
              </View>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  content: {
    padding: 20,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#f9fafb',
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  backButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  storyHeader: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  storyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
    lineHeight: 32,
  },
  storyDate: {
    fontSize: 16,
    color: '#6b7280',
  },
  processingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  processingText: {
    fontSize: 14,
    color: '#f59e0b',
    fontWeight: '500',
  },
  photoContainer: {
    marginBottom: 20,
  },
  storyPhoto: {
    width: '100%',
    height: 200,
    borderRadius: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  editButtonText: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '500',
  },
  audioPlayer: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  audioInfo: {
    flex: 1,
  },
  progressContainer: {
    marginBottom: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2563eb',
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeText: {
    fontSize: 12,
    color: '#6b7280',
  },
  transcriptContainer: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  transcriptText: {
    fontSize: 16,
    color: '#1f2937',
    lineHeight: 24,
  },
  promptContainer: {
    backgroundColor: '#fef3c7',
    padding: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  promptText: {
    flex: 1,
    fontSize: 16,
    color: '#92400e',
    lineHeight: 24,
  },
  interactionItem: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  followUpItem: {
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  interactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  interactionType: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  interactionTypeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10b981',
  },
  followUpTypeText: {
    color: '#f59e0b',
  },
  interactionDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  interactionContent: {
    fontSize: 16,
    color: '#1f2937',
    lineHeight: 24,
    marginBottom: 12,
  },
  answerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
    alignSelf: 'flex-start',
  },
  answerButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  answeredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  answeredText: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '500',
  },
  emptyInteractions: {
    backgroundColor: '#ffffff',
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyInteractionsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyInteractionsSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
  },
});