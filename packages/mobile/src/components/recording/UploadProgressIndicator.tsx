import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  useEffect as useReanimatedEffect,
} from 'react-native-reanimated';

import { RecordingUploadProgress } from '@saga/shared';
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../../utils/constants';

interface UploadProgressIndicatorProps {
  progress: RecordingUploadProgress;
  style?: any;
}

export const UploadProgressIndicator: React.FC<UploadProgressIndicatorProps> = ({
  progress,
  style,
}) => {
  const progressWidth = useSharedValue(0);

  useReanimatedEffect(() => {
    progressWidth.value = withSpring(progress.percentage / 100, {
      damping: 15,
      stiffness: 100,
    });
  }, [progress.percentage]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value * 100}%`,
  }));

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getStatusIcon = () => {
    switch (progress.status) {
      case 'uploading':
        return null; // Will show ActivityIndicator
      case 'processing':
        return 'cog';
      case 'completed':
        return 'checkmark-circle';
      case 'failed':
        return 'close-circle';
      default:
        return 'cloud-upload';
    }
  };

  const getStatusColor = () => {
    switch (progress.status) {
      case 'uploading':
      case 'processing':
        return COLORS.primary;
      case 'completed':
        return COLORS.success;
      case 'failed':
        return COLORS.danger;
      default:
        return COLORS.textSecondary;
    }
  };

  const getStatusText = () => {
    switch (progress.status) {
      case 'uploading':
        return 'Uploading to family...';
      case 'processing':
        return 'Processing recording...';
      case 'completed':
        return 'Successfully sent to family!';
      case 'failed':
        return progress.error || 'Upload failed';
      default:
        return 'Preparing upload...';
    }
  };

  const showProgressBar = progress.status === 'uploading' || progress.status === 'processing';
  const showSpinner = progress.status === 'uploading' || progress.status === 'processing';

  return (
    <View style={[styles.container, style]}>
      {/* Status Header */}
      <View style={styles.statusHeader}>
        <View style={styles.statusInfo}>
          {showSpinner ? (
            <ActivityIndicator size="small" color={getStatusColor()} />
          ) : (
            <Ionicons
              name={getStatusIcon()}
              size={20}
              color={getStatusColor()}
            />
          )}
          <Text style={[styles.statusText, { color: getStatusColor() }]}>
            {getStatusText()}
          </Text>
        </View>

        {/* Upload Stats */}
        {progress.totalBytes > 0 && (
          <Text style={styles.uploadStats}>
            {formatFileSize(progress.bytesUploaded)} / {formatFileSize(progress.totalBytes)}
          </Text>
        )}
      </View>

      {/* Progress Bar */}
      {showProgressBar && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <Animated.View
              style={[
                styles.progressFill,
                progressStyle,
                { backgroundColor: getStatusColor() },
              ]}
            />
          </View>
          <Text style={styles.percentageText}>
            {Math.round(progress.percentage)}%
          </Text>
        </View>
      )}

      {/* Error Details */}
      {progress.status === 'failed' && progress.error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            {progress.error}
          </Text>
        </View>
      )}

      {/* Success Message */}
      {progress.status === 'completed' && (
        <View style={styles.successContainer}>
          <Text style={styles.successText}>
            Your family will be notified and can listen to your story right away.
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusText: {
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.medium,
    marginLeft: SPACING.sm,
    flex: 1,
  },
  uploadStats: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: FONTS.weights.medium,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: COLORS.gray200,
    borderRadius: 3,
    overflow: 'hidden',
    marginRight: SPACING.sm,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  percentageText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.textPrimary,
    minWidth: 35,
    textAlign: 'right',
  },
  errorContainer: {
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray200,
  },
  errorText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.danger,
    fontStyle: 'italic',
  },
  successContainer: {
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray200,
  },
  successText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.success,
    fontStyle: 'italic',
  },
});