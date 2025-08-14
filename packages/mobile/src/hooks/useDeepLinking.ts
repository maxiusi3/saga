import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { useNavigation } from '@react-navigation/native';

import { InvitationService } from '../services/invitation-service';
import { useOnboardingStore } from '../stores/onboarding-store';
import { useAuthStore } from '../stores/auth-store';

export function useDeepLinking() {
  const navigation = useNavigation();
  const { setInvitationCode, setStep } = useOnboardingStore();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    // Handle initial URL when app is opened from a link
    const handleInitialURL = async () => {
      const initialURL = await Linking.getInitialURL();
      if (initialURL) {
        handleDeepLink(initialURL);
      }
    };

    // Handle URL when app is already running
    const handleURLChange = (event: { url: string }) => {
      handleDeepLink(event.url);
    };

    const handleDeepLink = (url: string) => {
      console.log('Deep link received:', url);
      
      // Extract invitation code from various URL formats
      const invitationCode = InvitationService.parseInvitationFromUrl(url);
      
      if (invitationCode) {
        console.log('Invitation code extracted:', invitationCode);
        
        // If user is already authenticated, don't process invitation
        if (isAuthenticated) {
          console.log('User already authenticated, ignoring invitation');
          return;
        }
        
        // Set the invitation code in the onboarding store
        setInvitationCode(invitationCode);
        setStep('invitation');
        
        // Navigate to invitation screen with the code
        navigation.navigate('Auth' as never, {
          screen: 'Invitation',
          params: { invitationCode },
        } as never);
      } else {
        console.log('No valid invitation code found in URL');
      }
    };

    handleInitialURL();
    
    const subscription = Linking.addEventListener('url', handleURLChange);
    
    return () => {
      subscription?.remove();
    };
  }, [navigation, isAuthenticated, setInvitationCode, setStep]);
}