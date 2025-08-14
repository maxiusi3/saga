import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';

import { AppNavigator } from './src/navigation/AppNavigator';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { NotificationProvider } from './src/providers/NotificationProvider';
import { AccessibilityProvider } from './src/contexts/AccessibilityContext';
import { useDeepLinking } from './src/hooks/useDeepLinking';
import { errorTracking } from './src/services/error-tracking-service';

function AppContent() {
  useDeepLinking();
  
  useEffect(() => {
    // Initialize error tracking
    errorTracking.init();
    
    // Track app launch
    errorTracking.captureMessage('Mobile app launched', 'info', {
      screen: 'app',
      action: 'launch',
    });
  }, []);
  
  return (
    <>
      <AppNavigator />
      <StatusBar style="auto" />
    </>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <AccessibilityProvider>
          <ErrorBoundary>
            <NotificationProvider>
              <AppContent />
            </NotificationProvider>
          </ErrorBoundary>
        </AccessibilityProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});