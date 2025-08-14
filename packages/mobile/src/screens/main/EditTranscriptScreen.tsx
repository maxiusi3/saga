import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';

import { MainStackParamList } from '../../navigation/MainNavigator';
import { useStoryStore } from '../../stores/story-store';

type Props = {
  navigation: StackNavigationProp<MainStackParamList, 'EditTranscript'>;
  route: RouteProp<MainStackParamList, 'EditTranscript'>;
};

export function EditTranscriptScreen({ navigation, route }: Props) {
  const { storyId, transcript: initialTranscript } = route.params;
  const { updateTranscript, isLoading, error } = useStoryStore();
  
  const [transcript, setTranscript] = useState(initialTranscript || '');
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const textInputRef = useRef<TextInput>(null);

  useEffect(() => {
    // Set up navigation header
    navigation.setOptions({
      title: 'Edit Transcript',
      headerLeft: () => (
        <TouchableOpacity
          style={styles.headerButton}
          onPress={handleCancel}
        >
          <Ionicons name="close" size={24} color="#2563eb" />
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity
          style={[styles.headerButton, !hasChanges && styles.headerButtonDisabled]}
          onPress={handleSave}
          disabled={!hasChanges || isSaving}
        >
          <Text style={[
            styles.headerButtonText,
            !hasChanges && styles.headerButtonTextDisabled
          ]}>
            {isSaving ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, hasChanges, isSaving]);

  useEffect(() => {
    if (error) {
      Alert.alert('Error', error);
    }
  }, [error]);

  const handleTextChange = (text: string) => {
    setTranscript(text);
    setHasChanges(text !== initialTranscript);
    
    // Set up auto-save
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    
    autoSaveTimeoutRef.current = setTimeout(() => {
      if (text !== initialTranscript && text.trim()) {
        handleAutoSave(text);
      }
    }, 3000); // Auto-save after 3 seconds of inactivity
  };

  const handleAutoSave = async (text: string) => {
    try {
      await updateTranscript(storyId, text.trim());
      setLastSaved(new Date());
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  };

  const handleSave = async () => {
    if (!hasChanges || !transcript.trim()) return;
    
    try {
      setIsSaving(true);
      await updateTranscript(storyId, transcript.trim());
      setLastSaved(new Date());
      setHasChanges(false);
      
      Alert.alert(
        'Success',
        'Transcript updated successfully',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to update transcript');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (hasChanges) {
      Alert.alert(
        'Unsaved Changes',
        'You have unsaved changes. Are you sure you want to cancel?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          { 
            text: 'Discard Changes', 
            style: 'destructive',
            onPress: () => navigation.goBack()
          },
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  const formatLastSaved = (date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) {
      return 'Saved just now';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `Saved ${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else {
      return `Saved at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Status Bar */}
        <View style={styles.statusBar}>
          <View style={styles.statusLeft}>
            <Text style={styles.characterCount}>
              {transcript.length}/5000 characters
            </Text>
            {lastSaved && (
              <Text style={styles.lastSaved}>
                {formatLastSaved(lastSaved)}
              </Text>
            )}
          </View>
          
          {hasChanges && (
            <View style={styles.unsavedIndicator}>
              <Ionicons name="ellipse" size={8} color="#f59e0b" />
              <Text style={styles.unsavedText}>Unsaved changes</Text>
            </View>
          )}
        </View>

        {/* Text Editor */}
        <View style={styles.editorContainer}>
          <TextInput
            ref={textInputRef}
            style={styles.textInput}
            value={transcript}
            onChangeText={handleTextChange}
            placeholder="Enter transcript text..."
            placeholderTextColor="#9ca3af"
            multiline
            textAlignVertical="top"
            maxLength={5000}
            autoFocus
          />
        </View>

        {/* Help Text */}
        <View style={styles.helpContainer}>
          <View style={styles.helpItem}>
            <Ionicons name="information-circle-outline" size={16} color="#6b7280" />
            <Text style={styles.helpText}>
              Changes are automatically saved as you type
            </Text>
          </View>
          <View style={styles.helpItem}>
            <Ionicons name="checkmark-circle-outline" size={16} color="#6b7280" />
            <Text style={styles.helpText}>
              Tap "Save" to finalize your changes and return
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={handleCancel}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.saveButton,
            (!hasChanges || isSaving) && styles.saveButtonDisabled
          ]}
          onPress={handleSave}
          disabled={!hasChanges || isSaving}
        >
          {isSaving ? (
            <Ionicons name="hourglass-outline" size={16} color="#ffffff" />
          ) : (
            <Ionicons name="checkmark" size={16} color="#ffffff" />
          )}
          <Text style={styles.saveButtonText}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  headerButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerButtonDisabled: {
    opacity: 0.5,
  },
  headerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563eb',
  },
  headerButtonTextDisabled: {
    color: '#9ca3af',
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  statusLeft: {
    flex: 1,
  },
  characterCount: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  lastSaved: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  unsavedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  unsavedText: {
    fontSize: 12,
    color: '#f59e0b',
    fontWeight: '500',
  },
  editorContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    minHeight: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  textInput: {
    fontSize: 16,
    lineHeight: 24,
    color: '#1f2937',
    textAlignVertical: 'top',
    minHeight: 360,
  },
  helpContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
  },
  helpItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  helpText: {
    fontSize: 14,
    color: '#6b7280',
    flex: 1,
  },
  actionBar: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  saveButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#2563eb',
    borderRadius: 12,
  },
  saveButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});