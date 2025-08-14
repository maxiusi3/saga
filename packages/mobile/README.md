# Saga Mobile App

React Native mobile application for Storytellers in the Saga family biography platform.

## 🎯 Overview

The mobile app serves Storytellers (typically parents) who:
- Accept invitations from Facilitators
- Record voice stories using AI-guided prompts
- Attach photos to their recordings
- Review their shared stories and feedback
- Respond to follow-up questions

## 🏗️ Architecture

- **Framework**: React Native 0.72+ with Expo
- **Navigation**: React Navigation 6 with tab and stack navigation
- **Audio**: expo-av for recording and playback
- **State Management**: Zustand for client state
- **Forms**: React Hook Form with Zod validation
- **HTTP Client**: Axios with offline support
- **Push Notifications**: Expo Notifications with Firebase

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI
- iOS Simulator or Android Emulator
- Backend API server running

### Installation

```bash
# Install dependencies
npm install

# Start Expo development server
npm run dev

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android
```

### Environment Configuration

Create `.env` file:

```env
EXPO_PUBLIC_API_URL=http://localhost:3001
EXPO_PUBLIC_WS_URL=http://localhost:3001
```

## 📱 Features

### Invitation & Onboarding
- Deep link handling for invitation URLs
- One-tap join functionality
- Privacy pledge acceptance
- Interactive onboarding tutorial
- Help system integration

### Voice Recording
- AI prompt display with text-to-speech
- High-quality audio recording
- Visual feedback with waveform animation
- Photo attachment from camera/gallery
- Upload progress tracking
- Draft recovery system

### Story Management
- "My Stories" chronological list
- Story detail view with playback
- Transcript viewing
- Search and filtering
- Story sharing capabilities

### Interaction System
- View comments from Facilitators
- Respond to follow-up questions
- "Record Answer" functionality
- Push notification handling
- Messages aggregation

### Accessibility
- Font size controls (Standard, Large, Extra Large)
- High-contrast mode toggle
- Minimum 44x44dp tap targets
- Screen reader support
- Voice control compatibility

## 🧭 Navigation Structure

### Tab Navigation

```
Bottom Tabs:
├── Record        # Main recording interface
├── My Stories    # Story list and details
├── Messages      # Interactions and feedback
└── Settings      # User preferences and help
```

### Stack Navigation

```
Record Stack:
├── RecordScreen
├── PromptScreen
└── UploadScreen

Stories Stack:
├── StoriesListScreen
├── StoryDetailScreen
└── StoryPlayerScreen

Messages Stack:
├── MessagesListScreen
├── MessageDetailScreen
└── RecordResponseScreen
```

## 🎨 Design System

### Colors

```typescript
const colors = {
  primary: {
    50: '#fef7ee',
    500: '#ed7420',
    600: '#de5a16',
    700: '#b84315',
  },
  gray: {
    50: '#f9fafb',
    500: '#6b7280',
    900: '#111827',
  },
}
```

### Typography

```typescript
const typography = {
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
}
```

### Spacing

```typescript
const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
}
```

## 🔊 Audio Recording

### Recording Implementation

```typescript
const useAudioRecording = () => {
  const [recording, setRecording] = useState<Audio.Recording | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  
  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync()
      if (status !== 'granted') return
      
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      })
      
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      )
      
      setRecording(recording)
      setIsRecording(true)
    } catch (error) {
      console.error('Failed to start recording:', error)
    }
  }
  
  const stopRecording = async () => {
    if (!recording) return
    
    setIsRecording(false)
    await recording.stopAndUnloadAsync()
    
    const uri = recording.getURI()
    setRecording(null)
    
    return uri
  }
  
  return { startRecording, stopRecording, isRecording }
}
```

### Audio Playback

```typescript
const AudioPlayer = ({ audioUrl }: { audioUrl: string }) => {
  const [sound, setSound] = useState<Audio.Sound | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  
  const playAudio = async () => {
    try {
      const { sound } = await Audio.Sound.createAsync({ uri: audioUrl })
      setSound(sound)
      
      await sound.playAsync()
      setIsPlaying(true)
      
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlaying(false)
        }
      })
    } catch (error) {
      console.error('Failed to play audio:', error)
    }
  }
  
  return (
    <TouchableOpacity onPress={playAudio}>
      <Icon name={isPlaying ? 'pause' : 'play'} />
    </TouchableOpacity>
  )
}
```

## 📷 Photo Handling

### Image Picker

```typescript
const useImagePicker = () => {
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') return null
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    })
    
    if (!result.canceled) {
      return result.assets[0]
    }
    
    return null
  }
  
  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') return null
    
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    })
    
    if (!result.canceled) {
      return result.assets[0]
    }
    
    return null
  }
  
  return { pickImage, takePhoto }
}
```

## 🔔 Push Notifications

### Setup

```typescript
const usePushNotifications = () => {
  const [expoPushToken, setExpoPushToken] = useState<string>('')
  
  useEffect(() => {
    registerForPushNotificationsAsync().then(token => {
      setExpoPushToken(token || '')
    })
    
    const subscription = Notifications.addNotificationReceivedListener(notification => {
      // Handle received notification
    })
    
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      // Handle notification tap
    })
    
    return () => {
      subscription.remove()
      responseSubscription.remove()
    }
  }, [])
  
  return expoPushToken
}
```

## 🧪 Testing

### Test Structure

```
src/
├── __tests__/          # Integration tests
├── components/
│   └── __tests__/      # Component tests
├── screens/
│   └── __tests__/      # Screen tests
├── hooks/
│   └── __tests__/      # Hook tests
└── utils/
    └── __tests__/      # Utility tests
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Test Examples

```typescript
// Component test
import { render, fireEvent } from '@testing-library/react-native'
import { RecordButton } from '../RecordButton'

test('starts recording when pressed', () => {
  const onStartRecording = jest.fn()
  const { getByTestId } = render(
    <RecordButton onStartRecording={onStartRecording} />
  )
  
  fireEvent.press(getByTestId('record-button'))
  expect(onStartRecording).toHaveBeenCalled()
})

// Hook test
import { renderHook, act } from '@testing-library/react-hooks'
import { useAudioRecording } from '../useAudioRecording'

test('manages recording state correctly', async () => {
  const { result } = renderHook(() => useAudioRecording())
  
  await act(async () => {
    await result.current.startRecording()
  })
  
  expect(result.current.isRecording).toBe(true)
})
```

## 🚀 Deployment

### Build for Production

```bash
# Build for iOS
npm run build:ios

# Build for Android
npm run build:android

# Submit to app stores
expo submit
```

### App Store Configuration

#### iOS (App Store)

```json
{
  "ios": {
    "bundleIdentifier": "com.saga.familybiography",
    "buildNumber": "1",
    "infoPlist": {
      "NSMicrophoneUsageDescription": "This app needs access to microphone to record your stories.",
      "NSCameraUsageDescription": "This app needs access to camera to take photos for your stories.",
      "NSPhotoLibraryUsageDescription": "This app needs access to photo library to attach photos to your stories."
    }
  }
}
```

#### Android (Google Play)

```json
{
  "android": {
    "package": "com.saga.familybiography",
    "versionCode": 1,
    "permissions": [
      "android.permission.RECORD_AUDIO",
      "android.permission.CAMERA",
      "android.permission.READ_EXTERNAL_STORAGE"
    ]
  }
}
```

## 🔧 Development

### Code Organization

```
src/
├── components/      # Reusable React Native components
├── screens/         # Screen components
├── navigation/      # Navigation configuration
├── services/        # API and external services
├── hooks/           # Custom React hooks
├── stores/          # Zustand state stores
├── utils/           # Helper functions
└── types/           # TypeScript type definitions
```

### Adding New Features

1. **Create types** in `src/types/`
2. **Add API methods** in `src/services/`
3. **Create store** if needed in `src/stores/`
4. **Build components** in `src/components/`
5. **Add screens** in `src/screens/`
6. **Update navigation** in `src/navigation/`
7. **Write tests** for all components

### Performance Optimization

- **Image Optimization**: Proper sizing and caching
- **List Performance**: FlatList with proper keyExtractor
- **Memory Management**: Cleanup audio/video resources
- **Bundle Size**: Tree shaking and code splitting
- **Offline Support**: AsyncStorage for critical data

## 📚 Additional Resources

- [React Native Documentation](https://reactnative.dev/docs/getting-started)
- [Expo Documentation](https://docs.expo.dev/)
- [React Navigation](https://reactnavigation.org/docs/getting-started)
- [Expo AV](https://docs.expo.dev/versions/latest/sdk/av/)
- [Accessibility Guide](docs/accessibility.md)