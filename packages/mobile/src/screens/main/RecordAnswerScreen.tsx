import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';

import { MainStackParamList } from '../../navigation/MainNavigator';
import { useStoryStore } from '../../stores/story-store';
import { useAudioRecording } from '../../hooks/useAudioRecording';
import { RecordingControls } from '../../components/recording/RecordingControls';
import { WaveformAnimation } from '../../components/recording/WaveformAnimation';
import type { Interaction } from '@saga/shared/types/interaction';

type Props = {
  navigation: StackNavigationProp<MainStackParamList, 'RecordAnswer'>;
  route: RouteProp<MainStackParamList, 'RecordAnswer'>;
};

export function RecordAnswerScreen({ navigation, route }: Props) {
  const { questionId, storyId } = route.params;
  const {
    interactions,
    currentStory,
    isLoading,
    error,
    fetchStoryById,
    fetchStoryInteractions,
    createStory,
    uploadAudio,
    clearError,
  } = useStoryStore();

  const [question, setQuestion] = useState<Interaction | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const {
    isRecording,
    recordingDuration,
    audioUri,
    startRecording,
    stopRecording,
    playRecording,
    isPlaying,
    resetRecording,
    hasPermission,
    requestPermission,
  } = useAudioRecording();

  useEffect(() => {
    loadData();
  }, [questionId, storyId]);

  useEffect(() => {
    if (error) {
      Alert.alert('Error', error, [{ text: 'OK', onPress: clearError }]);
    }
  }, [error]);

  useEffect(() => {
    // Find the specific question from interactions
    const foundQuestion = interactions.find(i => i.id === questionId);
    setQuestion(foundQuestion || null);
  }, [interactions, questionId]);

  const loadData = async () => {
    await Promise.all([
      fetchStoryById(storyId),
      fetchStoryInteractions(storyId),
    ]);
  };

  const handleStartRecording = useCallback(async () => {
    if (!hasPermission) {
      const granted = await requestPermission();
      if (!granted) {
        Alert.alert(
          'Permission Required',
          'Please allow microphone access to record your answer.'
        );
        return;
      }
    }

    try {
      await startRecording();
    } catch (error) {
      Alert.alert('Error', 'Failed to start recording. Please try again.');
    }
  }, [hasPermission, requestPermission, startRecording]);

  const handleStopRecording = useCallback(async () => {
    try {
      await stopRecording();
    } catch (error) {
      Alert.alert('Error', 'Failed to stop recording. Please try again.');
    }
  }, [stopRecording]);

  const handleSubmitAnswer = useCallback(async () => {
    if (!audioUri || !question) {
      Alert.alert('Error', 'Please record your answer first.');
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);

      // Create a new story for the answer
      const answerStory = await createStory({
        projectId: currentStory?.projectId || '',
        title: `Answer to: ${question.content.substring(0, 50)}...`,
        aiPrompt: `Answer to follow-up question: ${question.content}`,
      });

      // Upload the audio
      await uploadAudio(answerStory.id, audioUri, (progress) => {
        setUploadProgress(progress);
      });

      // Mark the interaction as answered
      await fetch(`/api/interactions/${questionId}/answer`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answeredAt: new Date().toISOString() }),
      });

      Alert.alert(
        'Answer Submitted',
        'Your answer has been recorded and sent to your family.',
        [
          {
            text: 'OK',
            onPress: () => {
              navigation.goBack();
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to submit your answer. Please try again.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [audioUri, question, currentStory, createStory, uploadAudio, questionId, navigation]);

  const handleRetry = useCallback(() => {
    resetRecording();
  }, [resetRecording]);

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading question...</Text>
      </View>
    );
  }

  if (!question) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
        <Text style={styles.errorTitle}>Question Not Found</Text>
        <Text style={styles.errorSubtitle}>
          This question may have been deleted or you don't have access to it.
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Question Display */}
      <View style={styles.questionContainer}>
        <View style={styles.questionHeader}>
          <Ionicons name="help-circle" size={24} color="#f59e0b" />
          <Text style={styles.questionLabel}>Follow-up Question</Text>
        </View>
        <Text style={styles.questionText}>{question.content}</Text>
        
        {currentStory && (
          <View style={styles.storyContext}>
            <Text style={styles.contextLabel}>About your story:</Text>
            <Text style={styles.contextText}>
              {currentStory.title || currentStory.aiPrompt || 'Untitled Story'}
            </Text>
          </View>
        )}
      </View>

      {/* Recording Interface */}
      <View style={styles.recordingContainer}>
        <Text style={styles.recordingTitle}>Record Your Answer</Text>
        
        {isRecording && (
          <View style={styles.recordingIndicator}>
            <WaveformAnimation isActive={isRecording} />
            <Text style={styles.recordingDuration}>
              {formatDuration(recordingDuration)}
            </Text>
          </View>
        )}

        {audioUri && !isRecording && (
          <View style={styles.playbackContainer}>
            <TouchableOpacity
              style={styles.playButton}
              onPress={playRecording}
            >
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={24}
                color="#ffffff"
              />
            </TouchableOpacity>
            <Text style={styles.playbackDuration}>
              {formatDuration(recordingDuration)}
            </Text>
            <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
              <Ionicons name="refresh" size={20} color="#6b7280" />
              <Text style={styles.retryText}>Re-record</Text>
            </TouchableOpacity>
          </View>
        )}

        <RecordingControls
          isRecording={isRecording}
          hasRecording={!!audioUri}
          onStartRecording={handleStartRecording}
          onStopRecording={handleStopRecording}
          disabled={isUploading}
        />

        {isUploading && (
          <View style={styles.uploadContainer}>
            <ActivityIndicator size="small" color="#2563eb" />
            <Text style={styles.uploadText}>
              Uploading answer... {uploadProgress}%
            </Text>
          </View>
        )}
      </View>

      {/* Submit Button */}
      {audioUri && !isRecording && (
        <TouchableOpacity
          style={[styles.submitButton, isUploading && styles.disabledButton]}
          onPress={handleSubmitAnswer}
          disabled={isUploading}
        >
          <Ionicons name="send" size={20} color="#ffffff" />
          <Text style={styles.submitButtonText}>
            {isUploading ? 'Submitting...' : 'Submit Answer'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Instructions */}
      <View style={styles.instructionsContainer}>
        <Text style={styles.instructionsTitle}>How to record your answer:</Text>
        <View style={styles.instructionItem}>
          <Ionicons name="mic" size={16} color="#6b7280" />
          <Text style={styles.instructionText}>
            Tap and hold the record button to start recording
          </Text>
        </View>
        <View style={styles.instructionItem}>
          <Ionicons name="play" size={16} color="#6b7280" />
          <Text style={styles.instructionText}>
            Listen to your recording before submitting
          </Text>
        </View>
        <View style={styles.instructionItem}>
          <Ionicons name="send" size={16} color="#6b7280" />
          <Text style={styles.instructionText}>
            Submit to send your answer to your family
          </Text>
        </View>
      </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 16,
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
  questionContainer: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  questionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  questionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f59e0b',
  },
  questionText: {
    fontSize: 18,
    color: '#1f2937',
    lineHeight: 26,
    marginBottom: 16,
  },
  storyContext: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  contextLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 4,
  },
  contextText: {
    fontSize: 14,
    color: '#1f2937',
  },
  recordingContainer: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  recordingTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 24,
  },
  recordingIndicator: {
    alignItems: 'center',
    marginBottom: 24,
  },
  recordingDuration: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2563eb',
    marginTop: 16,
  },
  playbackContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 24,
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playbackDuration: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  retryText: {
    fontSize: 14,
    color: '#6b7280',
  },
  uploadContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
  },
  uploadText: {
    fontSize: 14,
    color: '#6b7280',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
    marginBottom: 24,
  },
  disabledButton: {
    backgroundColor: '#9ca3af',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  instructionsContainer: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  instructionText: {
    flex: 1,
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
});