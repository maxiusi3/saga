import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import { WelcomeScreen } from '../screens/auth/WelcomeScreen';
import { InvitationScreen } from '../screens/auth/InvitationScreen';
import { OnboardingScreen } from '../screens/auth/OnboardingScreen';

export type AuthStackParamList = {
  Welcome: undefined;
  Invitation: { invitationCode?: string };
  Onboarding: { projectId: string };
};

const Stack = createStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: '#ffffff' },
      }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Invitation" component={InvitationScreen} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
    </Stack.Navigator>
  );
}