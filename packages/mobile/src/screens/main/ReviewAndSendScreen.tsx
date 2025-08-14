import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LocalRecordingDraft, RecordingQuality, RecordingUploadProgress } from '@saga/shared';
import { RecordingService } from '../../services/recording-service';
import { recordingAnalyticsClient } from '../../services/recording-analytics-client';
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../../utils/constants';
import { WaveformVisualization } from '../../components/recording/WaveformVisualization';
import { RecordingQualityIndicator } from '../../components/recording/RecordingQualityIndicator';
import { UploadProgressIndicator } from '../../components/recording/UploadProgressIndicator';

interface ReviewAndSendScreenProps {
  navigation: any;
  route: {
    params: {
      draft: LocalRecordingDraft;
      quality: RecordingQuality;
    };
  };
}

const { width: screenWidth } = Dimensions.get('window');

export const ReviewAndSendScreen: React.FC<ReviewAndSendScreenProps> = ({
  navigation,
  route,
}) => {
  const { draft, quality } = route.params;
  const insets = useSafeAreaInsets();

  // Audio playback state
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(draft.duration);
  const playbackTimer = useRef<NodeJS.Timeout | null>(null);

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<RecordingUploadProgress | null>(null);
  
  // Analytics tracking
  const [reviewStartTime, setReviewStartTime] = useState<Date>(new Date());
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    loadAudio();
    
    // Track that user is reviewing the recording
    recordingAnalyticsClient.trackRecordingReviewed(
      draft.sessionId,
      draft.projectId,
      draft.duration,
      quality
    );
    
    return () => {
      cleanup();
    };
  }, []);

  const loadAudio = async () => {
    try {
      const { sound: audioSound } = await Audio.Sound.createAsync(
        { uri: draft.localAudioUri },
        { shouldPlay: false }
      );
      
      setSound(audioSound);
      
      // Get actual duration
      const status = await audioSound.getStatusAsync();
      if (status.isLoaded) {
        setPlaybackDuration(status.durationMillis || draft.duration);
      }
    } catch (error) {
      console.error('Failed to load audio:', error);
      Alert.alert('Error', 'Failed to load recording for playback');
    }
  };

  const cleanup = async () => {
    if (playbackTimer.current) {
      clearInterval(playbackTimer.current);
    }
    
    if (sound) {
      try {
        await sound.unloadAsync();
      } catch (error) {
        console.error('Error unloading sound:', error);
      }
    }
  };

  const togglePlayback = async () => {
    if (!sound) return;

    try {
      const status = await sound.getStatusAsync();
      
      if (status.isLoaded) {
        if (isPlaying) {
          await sound.pauseAsync();
          setIsPlaying(false);
          if (playbackTimer.current) {
            clearInterval(playbackTimer.current);
          }
        } else {
          await sound.playAsync();
          setIsPlaying(true);
          startPlaybackTracking();
        }
      }
    } catch (error) {
      console.error('Playback error:', error);
      Alert.alert('Error', 'Failed to play recording');
    }
  };

  const startPlaybackTracking = () => {
    playbackTimer.current = setInterval(async () => {
      if (sound) {
        try {
          const status = await sound.getStatusAsync();
          if (status.isLoaded) {
            setPlaybackPosition(status.positionMillis || 0);
            
            // Stop when playback finishes
            if (status.didJustFinish) {
              setIsPlaying(false);
              setPlaybackPosition(0);
              if (playbackTimer.current) {
                clearInterval(playbackTimer.current);
              }
            }
          }
        } catch (error) {
          console.error('Error tracking playback:', error);
        }
      }
    }, 100);
  };

  const seekToPosition = async (position: number) => {
    if (!sound) return;

    try {
      await sound.setPositionAsync(position);
      setPlaybackPosition(position);
    } catch (error) {
      console.error('Seek error:', error);
    }
  };

  const handleSendToFamily = async () => {
    if (isUploading) return;

    // Show confirmation dialog
    Alert.alert(
      'Send to Family',
      'Are you ready to send this recording to your family? Once sent, it cannot be changed.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Send',
          style: 'default',
          onPress: () => performUpload(),
        },
      ]
    );
  };

  const performUpload = async () => {
    setIsUploading(true);
    
    try {
      const reviewDuration = Date.now() - reviewStartTime.getTime();
      
      const storyId = await RecordingService.sendToFamily({
        onProgress: (progress) => {
          setUploadProgress(progress);
        },
        onComplete: (storyId) => {
          setIsUploading(false);
          setUploadProgress(null);
          
          // Track successful recording sent
          recordingAnalyticsClient.trackRecordingSent(
            draft.sessionId,
            draft.projectId,
            draft.duration,
            quality,
            retryCount
          );
          
          // Show success message
          Alert.alert(
            'Success!',
            'Your story has been sent to your family. They will be notified and can listen to it right away.',
            [
              {
                text: 'OK',
                onPress: () => navigation.navigate('Home'),
              },
            ]
          );
        },
        onError: (error) => {
          setIsUploading(false);
          setUploadProgress(null);
          
          Alert.alert(
            'Upload Failed',
            `Failed to send recording: ${error}`,
            [
              {
                text: 'Try Again',
                onPress: () => {
                  setRetryCount(prev => prev + 1);
                  recordingAnalyticsClient.trackRecordingRetry(
                    draft.sessionId,
                    draft.projectId,
                    retryCount + 1
                  );
                  performUpload();
                },
              },
              {
                text: 'Cancel',
                style: 'cancel',
              },
            ]
          );
        },
      });
    } catch (error) {
      setIsUploading(false);
      setUploadProgress(null);
      console.error('Upload error:', error);
    }
  };

  const handleReRecord = () => {
    Alert.alert(
      'Re-record',
      'Are you sure you want to record again? This will discard the current recording.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Re-record',
          style: 'destructive',
          onPress: async () => {
            // Track recording retry
            setRetryCount(prev => prev + 1);
            recordingAnalyticsClient.trackRecordingRetry(
              draft.sessionId,
              draft.projectId,
              retryCount + 1
            );
            
            await RecordingService.discardDraft();
            navigation.goBack();
          },
        },
      ]
    );
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Recording',
      'Are you sure you want to delete this recording? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            // Track recording discarded
            recordingAnalyticsClient.trackRecordingDiscarded(
              draft.sessionId,
              draft.projectId,
              retryCount
            );
            
            await RecordingService.discardDraft();
            navigation.navigate('Home');
          },
        },
      ]
    );
  };

  const formatDuration = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const playbackProgress = playbackDuration > 0 ? playbackPosition / playbackDuration : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Review & Send</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Recording Quality Indicator */}
        <RecordingQualityIndicator quality={quality} style={styles.qualityIndicator} />

        {/* Waveform Visualization */}
        <View style={styles.waveformContainer}>
          <WaveformVisualization
            audioUri={draft.localAudioUri}
            duration={playbackDuration}
            currentPosition={playbackPosition}
            isPlaying={isPlaying}
            onSeek={seekToPosition}
            style={styles.waveform}
          />
        </View>

        {/* Playback Controls */}
        <View style={styles.playbackControls}>
          <TouchableOpacity
            style={styles.playButton}
            onPress={togglePlayback}
            accessibilityLabel={isPlaying ? 'Pause recording' : 'Play recording'}
            accessibilityRole="button"
          >
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={32}
              color={COLORS.background}
            />
          </TouchableOpacity>
          
          <View style={styles.timeInfo}>
            <Text style={styles.currentTime}>
              {formatDuration(playbackPosition)}
            </Text>
            <Text style={styles.totalTime}>
              {formatDuration(playbackDuration)}
            </Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${playbackProgress * 100}%` },
              ]}
            />
          </View>
        </View>

        {/* Upload Progress */}
        {uploadProgress && (
          <UploadProgressIndicator
            progress={uploadProgress}
            style={styles.uploadProgress}
          />
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          {/* Send to Family Button */}
          <TouchableOpacity
            style={[
              styles.sendButton,
              (isUploading || !quality.isValid) && styles.sendButtonDisabled,
            ]}
            onPress={handleSendToFamily}
            disabled={isUploading || !quality.isValid}
            accessibilityLabel="Send recording to family"
            accessibilityRole="button"
            accessibilityHint="Sends your recording to family members"
          >
            {isUploading ? (
              <ActivityIndicator color={COLORS.background} size="small" />
            ) : (
              <>
                <Ionicons name="heart" size={20} color={COLORS.background} />
                <Text style={styles.sendButtonText}>Send to Family</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Secondary Actions */}
          <View style={styles.secondaryActions}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleReRecord}
              disabled={isUploading}
              accessibilityLabel="Record again"
              accessibilityRole="button"
            >
              <Ionicons name="refresh" size={18} color={COLORS.primary} />
              <Text style={styles.secondaryButtonText}>Re-record</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleDelete}
              disabled={isUploading}
              accessibilityLabel="Delete recording"
              accessibilityRole="button"
            >
              <Ionicons name="trash" size={18} color={COLORS.danger} />
              <Text style={[styles.secondaryButtonText, { color: COLORS.danger }]}>
                Delete
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Quality Issues Warning */}
        {!quality.isValid && (
          <View style={styles.warningContainer}>
            <Ionicons name="warning" size={20} color={COLORS.warning} />
            <Text style={styles.warningText}>
              Please fix the quality issues above before sending.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  },
  backButton: {
    padding: SPACING.sm,
    marginLeft: -SPACING.sm,
  },
  headerTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
  },
  qualityIndicator: {
    marginTop: SPACING.lg,
    marginBottom: SPACING.md,
  },
  waveformContainer: {
    backgroundColor: COLORS.gray50,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  waveform: {
    height: 80,
  },
  playbackControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  playButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  timeInfo: {
    alignItems: 'flex-end',
  },
  currentTime: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.textPrimary,
  },
  totalTime: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  progressContainer: {
    marginBottom: SPACING['2xl'],
  },
  progressBar: {
    height: 4,
    backgroundColor: COLORS.gray200,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
  },
  uploadProgress: {
    marginBottom: SPACING.lg,
  },
  actionButtons: {
    marginBottom: SPACING['2xl'],
  },
  sendButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.gray400,
    shadowOpacity: 0,
    elevation: 0,
  },
  sendButtonText: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.background,
    marginLeft: SPACING.sm,
  },
  secondaryActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  secondaryButtonText: {
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.medium,
    color: COLORS.primary,
    marginLeft: SPACING.sm,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.warning + '20',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  warningText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.warning,
    marginLeft: SPACING.sm,
    flex: 1,
  },
});