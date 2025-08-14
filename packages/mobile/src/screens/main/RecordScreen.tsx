import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Alert, 
  Animated,
  Dimensions,
  ActivityIndicator 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { RecordingService, RecordingServiceState } from '../../services/recording-service';
import { PromptService, AIPrompt } from '../../services/prompt-service';
import { useAuthStore } from '../../stores/auth-store';
import { WaveformAnimation } from '../../components/recording/WaveformAnimation';
import { RecordingControls } from '../../components/recording/RecordingControls';
import { PromptCard } from '../../components/recording/PromptCard';
import { COLORS, FONTS, SPACING } from '../../utils/constants';

const { width } = Dimensions.get('window');

export function RecordScreen({ navigation }: { navigation: any }) {
  const [currentPrompt, setCurrentPrompt] = useState<AIPrompt | null>(null);
  const [isLoadingPrompt, setIsLoadingPrompt] = useState(true);
  const [attachedPhoto, setAttachedPhoto] = useState<string | null>(null);
  const [isPlayingPrompt, setIsPlayingPrompt] = useState(false);
  const [recordingState, setRecordingState] = useState<RecordingServiceState | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  
  const { user } = useAuthStore();
  
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;

  // Initialize recording service and load prompt
  useEffect(() => {
    initializeRecording();
    loadDailyPrompt();
    
    // Subscribe to recording state changes
    const unsubscribe = RecordingService.subscribe((state) => {
      setRecordingState(state);
    });
    
    return () => {
      unsubscribe();
      RecordingService.cleanup();
    };
  }, []);

  // Check for draft recovery on mount
  useEffect(() => {
    if (user && isInitialized) {
      checkForDraftRecovery();
    }
  }, [user, isInitialized]);

  // Animate recording button when recording
  useEffect(() => {
    if (recordingState?.recording.isRecording) {
      // Pulsing animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Wave animation
      Animated.loop(
        Animated.timing(waveAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      ).start();
    } else {
      pulseAnim.setValue(1);
      waveAnim.setValue(0);
    }
  }, [recordingState?.recording.isRecording, pulseAnim, waveAnim]);

  const initializeRecording = async () => {
    try {
      const success = await RecordingService.initialize();
      setIsInitialized(success);
      if (!success) {
        Alert.alert('Error', 'Failed to initialize recording. Please check permissions.');
      }
    } catch (error) {
      console.error('Failed to initialize recording:', error);
      setIsInitialized(false);
    }
  };

  const checkForDraftRecovery = async () => {
    if (!user) return;
    
    try {
      const hasDraft = await RecordingService.recoverDraft(user.id);
      
      if (hasDraft) {
        Alert.alert(
          'Recover Recording',
          'You have an unsent recording from a previous session. Would you like to continue with it?',
          [
            {
              text: 'Delete',
              style: 'destructive',
              onPress: async () => {
                await RecordingService.discardDraft();
              },
            },
            {
              text: 'Continue',
              onPress: () => {
                // Navigate to review screen with recovered draft
                navigateToReview();
              },
            },
          ]
        );
      }
    } catch (error) {
      console.error('Failed to check for draft recovery:', error);
    }
  };

  const loadDailyPrompt = async () => {
    try {
      setIsLoadingPrompt(true);
      const prompt = await PromptService.getDailyPrompt();
      setCurrentPrompt(prompt);
    } catch (error) {
      console.error('Failed to load prompt:', error);
      Alert.alert('Error', 'Failed to load today\'s prompt. Please try again.');
    } finally {
      setIsLoadingPrompt(false);
    }
  };

  const handlePlayPrompt = async () => {
    if (!currentPrompt) return;

    try {
      setIsPlayingPrompt(true);
      await PromptService.playPromptAudio(currentPrompt);
    } catch (error) {
      console.error('Failed to play prompt:', error);
    } finally {
      setIsPlayingPrompt(false);
    }
  };

  const handleStopPrompt = async () => {
    try {
      await PromptService.stopPromptAudio();
      setIsPlayingPrompt(false);
    } catch (error) {
      console.error('Failed to stop prompt:', error);
    }
  };

  const handleStartRecording = async () => {
    if (!isInitialized || !user || !currentPrompt) {
      Alert.alert('Error', 'Recording not ready. Please try again.');
      return;
    }

    try {
      const success = await RecordingService.startRecording({
        userId: user.id,
        projectId: user.currentProjectId || '', // Assume we have current project
        promptId: currentPrompt.id,
        chapterId: currentPrompt.chapterId,
      });
      
      if (!success) {
        Alert.alert('Recording Error', 'Failed to start recording. Please try again.');
      }
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Recording Error', 'Failed to start recording. Please try again.');
    }
  };

  const handleStopRecording = async () => {
    if (!user || !currentPrompt) return;
    
    try {
      const success = await RecordingService.stopRecording();
      
      if (success) {
        // Create draft with current recording
        const draftCreated = await RecordingService.createDraft(
          user.id,
          user.currentProjectId || '',
          attachedPhoto || undefined,
          currentPrompt.id,
          undefined,
          currentPrompt.chapterId
        );
        
        if (draftCreated) {
          // Navigate to review screen
          navigateToReview();
        } else {
          Alert.alert('Error', 'Failed to prepare recording for review.');
        }
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
      Alert.alert('Error', 'Failed to stop recording. Please try again.');
    }
  };

  const navigateToReview = async () => {
    if (!recordingState?.draft) return;
    
    // Validate recording quality
    const quality = await RecordingService.validateCurrentRecording();
    
    if (quality) {
      navigation.navigate('ReviewAndSend', {
        draft: recordingState.draft,
        quality: quality,
      });
    } else {
      Alert.alert('Error', 'Failed to validate recording quality.');
    }
  };

  const handleDiscardRecording = async () => {
    try {
      await RecordingService.discardDraft();
      setAttachedPhoto(null);
    } catch (error) {
      console.error('Failed to discard recording:', error);
    }
  };

  const handlePauseResume = async () => {
    // Note: Pause/resume functionality would need to be implemented in RecordingService
    // For now, we'll keep it simple with start/stop only
    console.log('Pause/resume not implemented in new recording service');
  };

  const handleAttachPhoto = async () => {
    Alert.alert(
      'Add Photo',
      'Choose how you\'d like to add a photo to your story',
      [
        {
          text: 'Camera',
          onPress: takePhoto,
        },
        {
          text: 'Photo Library',
          onPress: pickPhoto,
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const takePhoto = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled) {
        setAttachedPhoto(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Failed to take photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const pickPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled) {
        setAttachedPhoto(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Failed to pick photo:', error);
      Alert.alert('Error', 'Failed to select photo. Please try again.');
    }
  };

  const handleSkipPrompt = async () => {
    if (!currentPrompt) return;

    Alert.alert(
      'Skip This Prompt',
      'Would you like to get a different prompt?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Get New Prompt',
          onPress: async () => {
            await PromptService.skipPrompt(currentPrompt.id);
            handleGetNewPrompt();
          },
        },
      ]
    );
  };

  const handleGetNewPrompt = async () => {
    try {
      setIsLoadingPrompt(true);
      const prompt = await PromptService.getPersonalizedPrompt();
      setCurrentPrompt(prompt);
      setAttachedPhoto(null);
    } catch (error) {
      console.error('Failed to get new prompt:', error);
      Alert.alert('Error', 'Failed to get a new prompt. Please try again.');
    } finally {
      setIsLoadingPrompt(false);
    }
  };

  if (isLoadingPrompt) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading your prompt...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Record Your Story</Text>
        <Text style={styles.subtitle}>Share your memories with family</Text>
      </View>

      {currentPrompt && (
        <PromptCard
          prompt={currentPrompt}
          isPlaying={isPlayingPrompt}
          onPlay={handlePlayPrompt}
          onStop={handleStopPrompt}
          onSkip={handleSkipPrompt}
          onGetNew={handleGetNewPrompt}
        />
      )}

      <View style={styles.recordingSection}>
        {recordingState.isRecording && (
          <WaveformAnimation 
            isRecording={recordingState.isRecording}
            duration={recordingState.duration}
          />
        )}

        <View style={styles.recordingControls}>
          <Animated.View style={[styles.recordButtonContainer, { transform: [{ scale: pulseAnim }] }]}>
            <TouchableOpacity
              style={[
                styles.recordButton,
                recordingState?.recording.isRecording && styles.recordButtonActive,
              ]}
              onPress={recordingState?.recording.isRecording ? handleStopRecording : handleStartRecording}
              disabled={!isInitialized}
            >
              <Ionicons 
                name={recordingState?.recording.isRecording ? 'stop' : 'mic'} 
                size={48} 
                color="#ffffff" 
              />
            </TouchableOpacity>
          </Animated.View>
        </View>

        <View style={styles.recordingInfo}>
          {recordingState?.recording.isRecording || (recordingState?.recording.duration || 0) > 0 ? (
            <>
              <Text style={styles.durationText}>
                {RecordingService.formatDuration(recordingState?.recording.duration || 0)}
              </Text>
              {(recordingState?.recording.duration || 0) >= 600000 && (
                <Text style={styles.warningText}>Maximum duration reached</Text>
              )}
            </>
          ) : (
            <Text style={styles.recordHint}>
              Tap to start recording
            </Text>
          )}
        </View>
      </View>

      <RecordingControls
        isRecording={recordingState?.recording.isRecording || false}
        isPaused={false}
        hasRecording={(recordingState?.recording.duration || 0) > 0}
        attachedPhoto={attachedPhoto}
        onAttachPhoto={handleAttachPhoto}
        onRemovePhoto={() => setAttachedPhoto(null)}
        onDiscard={handleDiscardRecording}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundSecondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    fontSize: FONTS.sizes.base,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },
  header: {
    padding: SPACING.lg,
    paddingTop: 60,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  },
  title: {
    fontSize: FONTS.sizes['3xl'],
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: FONTS.sizes.base,
    color: COLORS.textSecondary,
  },
  content: {
    flex: 1,
    padding: SPACING.lg,
  },
  recordingSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: SPACING['2xl'],
  },
  recordingControls: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  recordButtonContainer: {
    marginBottom: SPACING.md,
  },
  recordButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.danger,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  recordButtonActive: {
    backgroundColor: COLORS.primary,
  },
  recordingInfo: {
    alignItems: 'center',
    minHeight: 60,
    justifyContent: 'center',
  },
  durationText: {
    fontSize: FONTS.sizes['2xl'],
    fontWeight: FONTS.weights.semibold,
    color: COLORS.textPrimary,
  },
  warningText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.warning,
    marginTop: 4,
  },
  recordHint: {
    fontSize: FONTS.sizes.base,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});