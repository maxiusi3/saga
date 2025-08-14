# Accessibility Features

This document outlines the accessibility features implemented in the Saga mobile app to ensure it meets WCAG 2.1 AA standards and provides an excellent experience for elderly users and users with disabilities.

## Overview

The Saga mobile app implements comprehensive accessibility features including:

- **Font Size Controls**: Three levels of font scaling (Standard, Large, Extra Large)
- **High Contrast Mode**: Enhanced contrast for better visibility
- **Minimum Tap Targets**: All interactive elements meet 44x44dp minimum size
- **Screen Reader Support**: Full VoiceOver/TalkBack compatibility
- **Keyboard Navigation**: Support for external keyboard users
- **Reduce Motion**: Respects system reduce motion preferences

## Font Size Controls

### Implementation
- Located in `src/contexts/AccessibilityContext.tsx`
- Three font size options: `standard` (1x), `large` (1.2x), `extraLarge` (1.5x)
- Settings persist across app sessions using AsyncStorage
- Automatically scales all text throughout the app

### Usage
```typescript
import { useAccessibility } from '../contexts/AccessibilityContext';

function MyComponent() {
  const { fontSize, setFontSize } = useAccessibility();
  
  return (
    <TouchableOpacity onPress={() => setFontSize('large')}>
      <Text>Set Large Font</Text>
    </TouchableOpacity>
  );
}
```

### Testing
- Font sizes scale correctly: 14pt → 17pt → 21pt
- Spacing adjusts proportionally to maintain visual hierarchy
- All text remains readable at maximum size

## High Contrast Mode

### Implementation
- Toggle between `normal` and `high` contrast themes
- High contrast uses white text on black backgrounds
- Enhanced shadow opacity for better element separation
- Maintains brand colors while improving accessibility

### Color Palette
```typescript
// High Contrast Colors
const highContrastColors = {
  background: '#000000',
  surface: '#1a1a1a',
  primary: '#ffffff',
  text: '#ffffff',
  accent: '#ffff00',
  success: '#00ff00',
  error: '#ff0000',
  // ...
};
```

### Usage
```typescript
import { useAccessibleTheme } from '../hooks/useAccessibleTheme';

function MyComponent() {
  const theme = useAccessibleTheme();
  
  return (
    <View style={{ backgroundColor: theme.colors.surface }}>
      <Text style={{ color: theme.colors.text }}>
        Accessible Text
      </Text>
    </View>
  );
}
```

## Minimum Tap Targets

### Implementation
- All interactive elements meet WCAG 2.1 AA minimum size of 44x44dp
- `useAccessibleTheme` hook provides `minTapTarget` constant
- Helper function `ensureMinTapTarget()` validates sizes
- Buttons automatically apply minimum dimensions

### Usage
```typescript
import { useAccessibleTheme } from '../hooks/useAccessibleTheme';

function MyButton() {
  const theme = useAccessibleTheme();
  
  return (
    <TouchableOpacity
      style={{
        minHeight: theme.minTapTarget,
        minWidth: theme.minTapTarget,
      }}
    >
      <Text>Accessible Button</Text>
    </TouchableOpacity>
  );
}
```

## Screen Reader Support

### Implementation
- Comprehensive accessibility labels and hints
- Proper accessibility roles for all components
- State announcements for dynamic content
- Support for VoiceOver (iOS) and TalkBack (Android)

### Accessibility Labels
```typescript
import { AccessibilityLabels } from '../utils/accessibility';

// Story item label
const label = AccessibilityLabels.storyItem(
  'My Childhood Memory',
  'Jan 15, 2024',
  true // has interactions
);
// Result: "Story: My Childhood Memory, recorded on Jan 15, 2024, has new messages"
```

### Usage
```typescript
import { createAccessibilityProps } from '../utils/accessibility';

function MyButton() {
  return (
    <TouchableOpacity
      {...createAccessibilityProps.button(
        'Record story',
        'Press and hold to start recording your story'
      )}
    >
      <Text>Record</Text>
    </TouchableOpacity>
  );
}
```

## Accessible Components

### AccessibleButton
Pre-built button component with accessibility features:

```typescript
import { AccessibleButton } from '../components/accessibility/AccessibleButton';

<AccessibleButton
  title="Save Story"
  onPress={handleSave}
  variant="primary"
  size="large"
  icon="save"
  accessibilityHint="Saves your story and uploads it to your family"
/>
```

### AccessibleTextInput
Text input with accessibility enhancements:

```typescript
import { AccessibleTextInput } from '../components/accessibility/AccessibleTextInput';

<AccessibleTextInput
  label="Story Title"
  value={title}
  onChangeText={setTitle}
  required
  error={titleError}
  helperText="Give your story a memorable title"
/>
```

## System Integration

### Screen Reader Detection
```typescript
import { useAccessibility } from '../contexts/AccessibilityContext';

function MyComponent() {
  const { isScreenReaderEnabled } = useAccessibility();
  
  if (isScreenReaderEnabled) {
    // Provide additional audio feedback
    announceForAccessibility('Story uploaded successfully');
  }
}
```

### Reduce Motion Support
```typescript
import { useAccessibility } from '../contexts/AccessibilityContext';

function AnimatedComponent() {
  const { isReduceMotionEnabled } = useAccessibility();
  
  return (
    <Animated.View
      style={{
        transform: [{
          scale: isReduceMotionEnabled ? 1 : animatedValue
        }]
      }}
    >
      {/* Content */}
    </Animated.View>
  );
}
```

## Accessibility Settings Screen

### Features
- Font size preview and selection
- High contrast mode toggle
- System settings status display
- Accessibility tips and guidance
- Reset to defaults option

### Navigation
Accessible from Profile → Accessibility Settings

### Screen Reader Feedback
- Announces changes when settings are modified
- Provides confirmation alerts for important actions
- Includes helpful tips for using accessibility features

## Testing

### Automated Tests
- Font scaling validation
- Contrast ratio calculations
- Tap target size verification
- Screen reader integration
- Theme consistency checks

### Manual Testing Checklist
- [ ] All text scales correctly with font size settings
- [ ] High contrast mode improves visibility
- [ ] All buttons meet minimum tap target size
- [ ] Screen reader announces all content correctly
- [ ] Keyboard navigation works for all interactive elements
- [ ] Settings persist across app restarts
- [ ] Error states are announced to screen readers

### Testing with Real Users
- Conduct usability testing with elderly users
- Test with actual screen reader users
- Validate with users who have motor impairments
- Gather feedback on font size and contrast preferences

## Best Practices

### For Developers
1. Always use `useAccessibleTheme()` for styling
2. Provide meaningful accessibility labels
3. Test with screen readers enabled
4. Validate tap target sizes
5. Use semantic HTML/React Native elements
6. Provide alternative text for images
7. Ensure proper focus management

### For Designers
1. Design with 1.5x font scaling in mind
2. Ensure 4.5:1 contrast ratio minimum
3. Design touch targets at least 44x44dp
4. Provide visual focus indicators
5. Use clear, simple language
6. Avoid relying solely on color for information

## Compliance

### WCAG 2.1 AA Standards
- ✅ **1.3.1 Info and Relationships**: Proper semantic structure
- ✅ **1.4.3 Contrast**: 4.5:1 minimum contrast ratio
- ✅ **1.4.4 Resize Text**: Text scales up to 200%
- ✅ **1.4.10 Reflow**: Content reflows at 320px width
- ✅ **1.4.11 Non-text Contrast**: UI components meet 3:1 ratio
- ✅ **2.1.1 Keyboard**: All functionality available via keyboard
- ✅ **2.4.3 Focus Order**: Logical focus sequence
- ✅ **2.5.5 Target Size**: Minimum 44x44dp touch targets
- ✅ **4.1.2 Name, Role, Value**: Proper accessibility properties

### Platform Guidelines
- **iOS**: Follows Human Interface Guidelines for accessibility
- **Android**: Adheres to Material Design accessibility principles
- **React Native**: Uses platform-appropriate accessibility APIs

## Future Enhancements

### Planned Features
- Voice control integration
- Gesture customization
- Color blind friendly themes
- Dyslexia-friendly fonts
- Magnification support
- Haptic feedback options

### Monitoring
- Analytics on accessibility feature usage
- User feedback collection
- Performance monitoring for accessibility features
- Regular accessibility audits

## Resources

### Documentation
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [React Native Accessibility](https://reactnative.dev/docs/accessibility)
- [iOS Accessibility](https://developer.apple.com/accessibility/)
- [Android Accessibility](https://developer.android.com/guide/topics/ui/accessibility)

### Testing Tools
- [Accessibility Inspector (iOS)](https://developer.apple.com/library/archive/documentation/Accessibility/Conceptual/AccessibilityMacOSX/OSXAXTestingApps.html)
- [Accessibility Scanner (Android)](https://play.google.com/store/apps/details?id=com.google.android.apps.accessibility.auditor)
- [axe-core](https://github.com/dequelabs/axe-core) for automated testing