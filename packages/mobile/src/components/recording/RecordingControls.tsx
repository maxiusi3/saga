import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAccessibleTheme } from '../../hooks/useAccessibleTheme';
import { createAccessibilityProps } from '../../utils/accessibility';

interface Props {
  isRecording: boolean;
  isPaused: boolean;
  hasRecording: boolean;
  attachedPhoto: string | null;
  onAttachPhoto: () => void;
  onRemovePhoto: () => void;
  onDiscard: () => void;
}

export function RecordingControls({
  isRecording,
  isPaused,
  hasRecording,
  attachedPhoto,
  onAttachPhoto,
  onRemovePhoto,
  onDiscard,
}: Props) {
  const theme = useAccessibleTheme();
  
  return (
    <View style={styles.container}>
      {/* Photo attachment section */}
      <View style={styles.photoSection}>
        <Text style={[
          styles.sectionTitle,
          { 
            fontSize: theme.fontSizes.base, 
            color: theme.colors.text 
          }
        ]}>
          Add a Photo (Optional)
        </Text>
        
        {attachedPhoto ? (
          <View style={styles.attachedPhotoContainer}>
            <Image source={{ uri: attachedPhoto }} style={styles.attachedPhoto} />
            <TouchableOpacity
              style={[
                styles.removePhotoButton,
                { 
                  minHeight: theme.minTapTarget,
                  minWidth: theme.minTapTarget,
                }
              ]}
              onPress={onRemovePhoto}
              {...createAccessibilityProps.button(
                'Remove photo',
                'Removes the attached photo from your story'
              )}
            >
              <Ionicons name="close-circle" size={24} color={theme.colors.error} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[
              styles.attachPhotoButton,
              { 
                minHeight: theme.minTapTarget,
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.background,
              }
            ]}
            onPress={onAttachPhoto}
            disabled={isRecording}
            {...createAccessibilityProps.button(
              'Add photo',
              'Attach a photo to your story from camera or gallery',
              isRecording
            )}
          >
            <Ionicons name="camera-outline" size={32} color={theme.colors.textSecondary} />
            <Text style={[
              styles.attachPhotoText,
              { 
                fontSize: theme.fontSizes.base, 
                color: theme.colors.textSecondary 
              }
            ]}>
              Add Photo
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Recording actions */}
      {hasRecording && !isRecording && (
        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={[
              styles.discardButton,
              { 
                minHeight: theme.minTapTarget,
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.error,
              }
            ]}
            onPress={onDiscard}
            {...createAccessibilityProps.button(
              'Discard recording',
              'Permanently delete the current recording'
            )}
          >
            <Ionicons name="trash-outline" size={20} color={theme.colors.error} />
            <Text style={[
              styles.discardButtonText,
              { 
                fontSize: theme.fontSizes.base, 
                color: theme.colors.error 
              }
            ]}>
              Discard Recording
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Recording tips */}
      <View style={styles.tipsSection}>
        <View style={styles.tip}>
          <Ionicons name="bulb-outline" size={16} color="#f59e0b" />
          <Text style={styles.tipText}>
            Speak clearly and take your time. You can pause anytime.
          </Text>
        </View>
        
        <View style={styles.tip}>
          <Ionicons name="time-outline" size={16} color="#6b7280" />
          <Text style={styles.tipText}>
            Maximum recording time: 10 minutes
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  photoSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  attachedPhotoContainer: {
    position: 'relative',
    alignSelf: 'flex-start',
  },
  attachedPhoto: {
    width: 120,
    height: 90,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
  },
  removePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#ffffff',
    borderRadius: 12,
  },
  attachPhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 20,
    paddingHorizontal: 16,
    gap: 8,
  },
  attachPhotoText: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
  },
  actionsSection: {
    marginBottom: 24,
  },
  discardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  discardButtonText: {
    fontSize: 16,
    color: '#ef4444',
    fontWeight: '500',
  },
  tipsSection: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  tip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
});