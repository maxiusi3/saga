import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { RecordingQuality } from '@saga/shared';
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../../utils/constants';

interface RecordingQualityIndicatorProps {
  quality: RecordingQuality;
  style?: any;
}

export const RecordingQualityIndicator: React.FC<RecordingQualityIndicatorProps> = ({
  quality,
  style,
}) => {
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDuration = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getQualityColor = () => {
    if (!quality.isValid) return COLORS.danger;
    const hasWarnings = quality.issues.some(issue => issue.severity === 'warning');
    return hasWarnings ? COLORS.warning : COLORS.success;
  };

  const getQualityIcon = () => {
    if (!quality.isValid) return 'close-circle';
    const hasWarnings = quality.issues.some(issue => issue.severity === 'warning');
    return hasWarnings ? 'warning' : 'checkmark-circle';
  };

  const getQualityText = () => {
    if (!quality.isValid) return 'Quality Issues';
    const hasWarnings = quality.issues.some(issue => issue.severity === 'warning');
    return hasWarnings ? 'Good Quality' : 'Excellent Quality';
  };

  return (
    <View style={[styles.container, style]}>
      {/* Quality Status */}
      <View style={styles.qualityHeader}>
        <View style={styles.qualityStatus}>
          <Ionicons
            name={getQualityIcon()}
            size={20}
            color={getQualityColor()}
          />
          <Text style={[styles.qualityText, { color: getQualityColor() }]}>
            {getQualityText()}
          </Text>
        </View>
        
        {/* Recording Info */}
        <View style={styles.recordingInfo}>
          <Text style={styles.infoText}>
            {formatDuration(quality.duration)} • {formatFileSize(quality.fileSize)}
          </Text>
        </View>
      </View>

      {/* Quality Issues */}
      {quality.issues.length > 0 && (
        <View style={styles.issuesContainer}>
          {quality.issues.map((issue, index) => (
            <View key={index} style={styles.issueItem}>
              <View style={styles.issueHeader}>
                <Ionicons
                  name={
                    issue.severity === 'error'
                      ? 'close-circle'
                      : issue.severity === 'warning'
                      ? 'warning'
                      : 'information-circle'
                  }
                  size={16}
                  color={
                    issue.severity === 'error'
                      ? COLORS.danger
                      : issue.severity === 'warning'
                      ? COLORS.warning
                      : COLORS.primary
                  }
                />
                <Text
                  style={[
                    styles.issueMessage,
                    {
                      color:
                        issue.severity === 'error'
                          ? COLORS.danger
                          : issue.severity === 'warning'
                          ? COLORS.warning
                          : COLORS.primary,
                    },
                  ]}
                >
                  {issue.message}
                </Text>
              </View>
              
              {issue.suggestion && (
                <Text style={styles.issueSuggestion}>
                  {issue.suggestion}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Technical Details (for debugging/advanced users) */}
      {__DEV__ && (
        <View style={styles.technicalDetails}>
          <Text style={styles.technicalTitle}>Technical Details</Text>
          <Text style={styles.technicalText}>
            Format: {quality.format.toUpperCase()}
          </Text>
          {quality.sampleRate && (
            <Text style={styles.technicalText}>
              Sample Rate: {quality.sampleRate} Hz
            </Text>
          )}
          {quality.bitRate && (
            <Text style={styles.technicalText}>
              Bit Rate: {quality.bitRate} bps
            </Text>
          )}
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
  },
  qualityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  qualityStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qualityText: {
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.semibold,
    marginLeft: SPACING.sm,
  },
  recordingInfo: {
    alignItems: 'flex-end',
  },
  infoText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: FONTS.weights.medium,
  },
  issuesContainer: {
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray200,
  },
  issueItem: {
    marginBottom: SPACING.sm,
  },
  issueHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 2,
  },
  issueMessage: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.medium,
    marginLeft: SPACING.sm,
    flex: 1,
  },
  issueSuggestion: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
    marginLeft: SPACING.lg + 4, // Align with message text
    fontStyle: 'italic',
  },
  technicalDetails: {
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray200,
  },
  technicalTitle: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  technicalText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textTertiary,
    marginBottom: 2,
  },
});