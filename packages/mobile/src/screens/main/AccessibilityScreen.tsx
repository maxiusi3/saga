import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StackNavigationProp } from '@react-navigation/stack';

import { useAccessibility, FontSize, ContrastMode } from '../../contexts/AccessibilityContext';
import { useAccessibleTheme, createAccessibleButtonStyle } from '../../hooks/useAccessibleTheme';
import { MainStackParamList } from '../../navigation/MainNavigator';
import { AccessibilityAnalytics } from '../../services/accessibility-analytics';

type Props = {
  navigation: StackNavigationProp<MainStackParamList, 'Accessibility'>;
};

interface SettingItemProps {
  title: string;
  description: string;
  children: React.ReactNode;
  testID?: string;
}

function SettingItem({ title, description, children, testID }: SettingItemProps) {
  const theme = useAccessibleTheme();
  
  return (
    <View style={[styles.settingItem, { backgroundColor: theme.colors.surface }]} testID={testID}>
      <View style={styles.settingContent}>
        <Text style={[styles.settingTitle, { 
          fontSize: theme.fontSizes.lg, 
          color: theme.colors.text 
        }]}>
          {title}
        </Text>
        <Text style={[styles.settingDescription, { 
          fontSize: theme.fontSizes.sm, 
          color: theme.colors.textSecondary 
        }]}>
          {description}
        </Text>
      </View>
      <View style={styles.settingControl}>
        {children}
      </View>
    </View>
  );
}

interface FontSizeOptionProps {
  size: FontSize;
  label: string;
  isSelected: boolean;
  onSelect: () => void;
}

function FontSizeOption({ size, label, isSelected, onSelect }: FontSizeOptionProps) {
  const theme = useAccessibleTheme();
  const buttonStyle = createAccessibleButtonStyle(theme, isSelected ? 'primary' : 'outline');
  
  return (
    <TouchableOpacity
      style={[
        buttonStyle,
        styles.fontSizeOption,
        isSelected && { backgroundColor: theme.colors.primary },
        !isSelected && { 
          backgroundColor: 'transparent',
          borderColor: theme.colors.border,
          borderWidth: 1,
        }
      ]}
      onPress={onSelect}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={`${label} font size${isSelected ? ', selected' : ''}`}
    >
      <Text style={[
        styles.fontSizeLabel,
        {
          fontSize: theme.fontSizes.base,
          color: isSelected ? '#ffffff' : theme.colors.text,
        }
      ]}>
        {label}
      </Text>
      <Text style={[
        styles.fontSizePreview,
        {
          fontSize: size === 'standard' ? 14 : size === 'large' ? 17 : 21,
          color: isSelected ? '#ffffff' : theme.colors.textSecondary,
        }
      ]}>
        Aa
      </Text>
    </TouchableOpacity>
  );
}

export function AccessibilityScreen({ navigation }: Props) {
  const {
    fontSize,
    contrastMode,
    isScreenReaderEnabled,
    setFontSize,
    setContrastMode,
    resetToDefaults,
  } = useAccessibility();
  
  const theme = useAccessibleTheme();

  // Track screen opening
  React.useEffect(() => {
    AccessibilityAnalytics.trackSettingsScreenOpened();
  }, []);

  const handleFontSizeChange = (newSize: FontSize) => {
    setFontSize(newSize);
    
    // Provide haptic feedback for accessibility
    if (isScreenReaderEnabled) {
      // Announce the change
      setTimeout(() => {
        Alert.alert(
          'Font Size Changed',
          `Font size has been changed to ${newSize === 'standard' ? 'Standard' : newSize === 'large' ? 'Large' : 'Extra Large'}`,
          [{ text: 'OK' }]
        );
      }, 100);
    }
  };

  const handleContrastModeChange = (newMode: ContrastMode) => {
    setContrastMode(newMode);
    
    if (isScreenReaderEnabled) {
      setTimeout(() => {
        Alert.alert(
          'Contrast Mode Changed',
          `Contrast mode has been changed to ${newMode === 'normal' ? 'Normal' : 'High Contrast'}`,
          [{ text: 'OK' }]
        );
      }, 100);
    }
  };

  const handleResetToDefaults = () => {
    Alert.alert(
      'Reset Settings',
      'Are you sure you want to reset all accessibility settings to their default values?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            resetToDefaults();
            Alert.alert('Settings Reset', 'All accessibility settings have been reset to defaults.');
          },
        },
      ]
    );
  };

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
        <TouchableOpacity
          style={[styles.backButton, { minHeight: theme.minTapTarget, minWidth: theme.minTapTarget }]}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { 
          fontSize: theme.fontSizes['2xl'], 
          color: theme.colors.text 
        }]}>
          Accessibility
        </Text>
      </View>

      {/* Font Size Setting */}
      <SettingItem
        title="Font Size"
        description="Choose a comfortable text size for reading"
        testID="font-size-setting"
      >
        <View style={styles.fontSizeOptions}>
          <FontSizeOption
            size="standard"
            label="Standard"
            isSelected={fontSize === 'standard'}
            onSelect={() => handleFontSizeChange('standard')}
          />
          <FontSizeOption
            size="large"
            label="Large"
            isSelected={fontSize === 'large'}
            onSelect={() => handleFontSizeChange('large')}
          />
          <FontSizeOption
            size="extraLarge"
            label="Extra Large"
            isSelected={fontSize === 'extraLarge'}
            onSelect={() => handleFontSizeChange('extraLarge')}
          />
        </View>
      </SettingItem>

      {/* High Contrast Setting */}
      <SettingItem
        title="High Contrast"
        description="Increase contrast for better visibility"
        testID="contrast-setting"
      >
        <Switch
          value={contrastMode === 'high'}
          onValueChange={(value) => handleContrastModeChange(value ? 'high' : 'normal')}
          trackColor={{ 
            false: theme.colors.disabled, 
            true: theme.colors.primary 
          }}
          thumbColor={contrastMode === 'high' ? '#ffffff' : theme.colors.surface}
          accessibilityRole="switch"
          accessibilityLabel="High contrast mode"
          accessibilityState={{ checked: contrastMode === 'high' }}
          style={{ transform: [{ scaleX: 1.2 }, { scaleY: 1.2 }] }}
        />
      </SettingItem>

      {/* System Settings Info */}
      <View style={[styles.infoSection, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.infoTitle, { 
          fontSize: theme.fontSizes.lg, 
          color: theme.colors.text 
        }]}>
          System Settings
        </Text>
        <Text style={[styles.infoDescription, { 
          fontSize: theme.fontSizes.sm, 
          color: theme.colors.textSecondary 
        }]}>
          Screen reader and reduce motion settings are automatically detected from your device's accessibility settings.
        </Text>
        
        {isScreenReaderEnabled && (
          <View style={[styles.statusItem, { borderColor: theme.colors.border }]}>
            <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />
            <Text style={[styles.statusText, { 
              fontSize: theme.fontSizes.sm, 
              color: theme.colors.text 
            }]}>
              Screen reader is enabled
            </Text>
          </View>
        )}
      </View>

      {/* Accessibility Tips */}
      <View style={[styles.tipsSection, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.tipsTitle, { 
          fontSize: theme.fontSizes.lg, 
          color: theme.colors.text 
        }]}>
          Accessibility Tips
        </Text>
        
        <View style={styles.tipItem}>
          <Ionicons name="bulb-outline" size={20} color={theme.colors.accent} />
          <Text style={[styles.tipText, { 
            fontSize: theme.fontSizes.sm, 
            color: theme.colors.textSecondary 
          }]}>
            All buttons and interactive elements are designed to be at least 44 points tall for easy tapping.
          </Text>
        </View>
        
        <View style={styles.tipItem}>
          <Ionicons name="volume-high-outline" size={20} color={theme.colors.accent} />
          <Text style={[styles.tipText, { 
            fontSize: theme.fontSizes.sm, 
            color: theme.colors.textSecondary 
          }]}>
            Voice prompts can be played aloud to help guide your story recording.
          </Text>
        </View>
        
        <View style={styles.tipItem}>
          <Ionicons name="hand-left-outline" size={20} color={theme.colors.accent} />
          <Text style={[styles.tipText, { 
            fontSize: theme.fontSizes.sm, 
            color: theme.colors.textSecondary 
          }]}>
            Use simple gestures: tap to select, press and hold to record.
          </Text>
        </View>
      </View>

      {/* Reset Button */}
      <TouchableOpacity
        style={[
          createAccessibleButtonStyle(theme, 'outline'),
          styles.resetButton,
          { borderColor: theme.colors.error }
        ]}
        onPress={handleResetToDefaults}
        accessibilityRole="button"
        accessibilityLabel="Reset all accessibility settings to defaults"
      >
        <Ionicons name="refresh-outline" size={20} color={theme.colors.error} />
        <Text style={[styles.resetButtonText, { 
          fontSize: theme.fontSizes.base, 
          color: theme.colors.error 
        }]}>
          Reset to Defaults
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    borderRadius: 8,
  },
  title: {
    fontWeight: 'bold',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  settingContent: {
    flex: 1,
    marginRight: 16,
  },
  settingTitle: {
    fontWeight: '600',
    marginBottom: 4,
  },
  settingDescription: {
    lineHeight: 20,
  },
  settingControl: {
    alignItems: 'flex-end',
  },
  fontSizeOptions: {
    flexDirection: 'column',
    gap: 8,
  },
  fontSizeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minWidth: 120,
  },
  fontSizeLabel: {
    fontWeight: '600',
  },
  fontSizePreview: {
    fontWeight: 'bold',
  },
  infoSection: {
    margin: 20,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoTitle: {
    fontWeight: '600',
    marginBottom: 8,
  },
  infoDescription: {
    lineHeight: 20,
    marginBottom: 16,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 8,
  },
  statusText: {
    fontWeight: '500',
  },
  tipsSection: {
    margin: 20,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tipsTitle: {
    fontWeight: '600',
    marginBottom: 16,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  tipText: {
    flex: 1,
    lineHeight: 20,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginTop: 16,
    gap: 8,
  },
  resetButtonText: {
    fontWeight: '600',
  },
});