import { Alert, Linking, Platform } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';

export async function requestAudioPermission(): Promise<boolean> {
  try {
    const { status } = await Audio.requestPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert(
        'Microphone Permission Required',
        'This app needs access to your microphone to record stories. Please enable microphone access in your device settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error requesting audio permission:', error);
    return false;
  }
}

export async function requestCameraPermission(): Promise<boolean> {
  try {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert(
        'Camera Permission Required',
        'This app needs access to your camera to take photos for your stories. Please enable camera access in your device settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error requesting camera permission:', error);
    return false;
  }
}

export async function requestMediaLibraryPermission(): Promise<boolean> {
  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert(
        'Photo Library Permission Required',
        'This app needs access to your photo library to attach photos to your stories. Please enable photo library access in your device settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error requesting media library permission:', error);
    return false;
  }
}

export async function checkAllPermissions(): Promise<{
  audio: boolean;
  camera: boolean;
  mediaLibrary: boolean;
}> {
  const [audioStatus, cameraStatus, mediaLibraryStatus] = await Promise.all([
    Audio.getPermissionsAsync(),
    ImagePicker.getCameraPermissionsAsync(),
    ImagePicker.getMediaLibraryPermissionsAsync(),
  ]);

  return {
    audio: audioStatus.status === 'granted',
    camera: cameraStatus.status === 'granted',
    mediaLibrary: mediaLibraryStatus.status === 'granted',
  };
}