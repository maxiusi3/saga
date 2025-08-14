import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { useAuthStore } from '../stores/auth-store';
import { ApiClient } from '../services/api-client';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

interface NotificationContextType {
  registerForPushNotifications: () => Promise<string | null>;
  scheduleLocalNotification: (title: string, body: string, delay?: number) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

interface Props {
  children: ReactNode;
}

export function NotificationProvider({ children }: Props) {
  const { isAuthenticated, user } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated && user) {
      registerForPushNotifications();
    }
  }, [isAuthenticated, user]);

  const registerForPushNotifications = async (): Promise<string | null> => {
    if (!Device.isDevice) {
      console.warn('Push notifications only work on physical devices');
      return null;
    }

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('Failed to get push token for push notification!');
        return null;
      }

      const token = (await Notifications.getExpoPushTokenAsync()).data;
      
      // Register token with backend
      if (isAuthenticated) {
        try {
          await ApiClient.post('/notifications/register-device', {
            token,
            platform: Platform.OS,
            deviceId: Device.osInternalBuildId,
          });
        } catch (error) {
          console.error('Failed to register device token:', error);
        }
      }

      return token;
    } catch (error) {
      console.error('Error registering for push notifications:', error);
      return null;
    }
  };

  const scheduleLocalNotification = async (
    title: string,
    body: string,
    delay: number = 0
  ): Promise<void> => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: 'default',
        },
        trigger: delay > 0 ? { seconds: delay } : null,
      });
    } catch (error) {
      console.error('Error scheduling local notification:', error);
    }
  };

  const contextValue: NotificationContextType = {
    registerForPushNotifications,
    scheduleLocalNotification,
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}