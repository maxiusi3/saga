import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';

import { useStoryStore } from '../stores/story-store';

import { HomeScreen } from '../screens/main/HomeScreen';
import { StoriesScreen } from '../screens/main/StoriesScreen';
import { MessagesScreen } from '../screens/main/MessagesScreen';
import { RecordScreen } from '../screens/main/RecordScreen';
import { ProfileScreen } from '../screens/main/ProfileScreen';
import { StoryDetailScreen } from '../screens/main/StoryDetailScreen';
import { RecordAnswerScreen } from '../screens/main/RecordAnswerScreen';
import { EditTranscriptScreen } from '../screens/main/EditTranscriptScreen';
import { AccessibilityScreen } from '../screens/main/AccessibilityScreen';
import { ReviewAndSendScreen } from '../screens/main/ReviewAndSendScreen';

export type MainTabParamList = {
  Home: undefined;
  Stories: undefined;
  Messages: undefined;
  Record: undefined;
  Profile: undefined;
};

export type MainStackParamList = {
  MainTabs: undefined;
  StoryDetail: { storyId: string };
  RecordAnswer: { questionId: string; storyId: string };
  EditTranscript: { storyId: string; transcript: string };
  Accessibility: undefined;
  ReviewAndSend: { 
    draft: import('@saga/shared').LocalRecordingDraft; 
    quality: import('@saga/shared').RecordingQuality; 
  };
};

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createStackNavigator<MainStackParamList>();

// Notification badge component for Messages tab
function NotificationBadge() {
  const { unreadInteractions } = useStoryStore();
  
  const unreadCount = unreadInteractions.filter(
    interaction => interaction.type === 'followup' && !interaction.answeredAt
  ).length;

  if (unreadCount === 0) return null;

  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>
        {unreadCount > 99 ? '99+' : unreadCount.toString()}
      </Text>
    </View>
  );
}

// Badge component for Stories tab (new stories)
function StoriesBadge() {
  const { stories } = useStoryStore();
  
  // Count stories from the last 24 hours as "new"
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const newStoriesCount = stories.filter(
    story => new Date(story.createdAt) > oneDayAgo
  ).length;

  if (newStoriesCount === 0) return null;

  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>
        {newStoriesCount > 99 ? '99+' : newStoriesCount.toString()}
      </Text>
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Stories') {
            iconName = focused ? 'library' : 'library-outline';
          } else if (route.name === 'Messages') {
            iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          } else if (route.name === 'Record') {
            iconName = focused ? 'mic' : 'mic-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          } else {
            iconName = 'help-outline';
          }

          return (
            <View style={{ position: 'relative' }}>
              <Ionicons name={iconName} size={size} color={color} />
              {route.name === 'Messages' && <NotificationBadge />}
              {route.name === 'Stories' && <StoriesBadge />}
            </View>
          );
        },
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#6b7280',
        headerShown: false,
        tabBarStyle: {
          paddingBottom: 8,
          paddingTop: 8,
          height: 88,
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#e5e7eb',
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginTop: 4,
        },
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarAccessibilityLabel: 'Home tab',
        }}
      />
      <Tab.Screen 
        name="Stories" 
        component={StoriesScreen}
        options={{
          tabBarLabel: 'My Stories',
          tabBarAccessibilityLabel: 'My Stories tab',
        }}
      />
      <Tab.Screen 
        name="Messages" 
        component={MessagesScreen}
        options={{
          tabBarLabel: 'Messages',
          tabBarAccessibilityLabel: 'Messages tab',
        }}
      />
      <Tab.Screen 
        name="Record" 
        component={RecordScreen}
        options={{
          tabBarLabel: 'Record',
          tabBarAccessibilityLabel: 'Record tab',
        }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarAccessibilityLabel: 'Profile tab',
        }}
      />
    </Tab.Navigator>
  );
}

export function MainNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="MainTabs" 
        component={MainTabs} 
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="StoryDetail" 
        component={StoryDetailScreen}
        options={{ title: 'Story Details' }}
      />
      <Stack.Screen 
        name="RecordAnswer" 
        component={RecordAnswerScreen}
        options={{ title: 'Record Answer' }}
      />
      <Stack.Screen 
        name="EditTranscript" 
        component={EditTranscriptScreen}
        options={{ headerShown: true }}
      />
      <Stack.Screen 
        name="Accessibility" 
        component={AccessibilityScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="ReviewAndSend" 
        component={ReviewAndSendScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});