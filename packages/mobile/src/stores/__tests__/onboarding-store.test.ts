import { renderHook, act } from '@testing-library/react-native';
import { useOnboardingStore } from '../onboarding-store';

describe('OnboardingStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useOnboardingStore.getState().reset();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useOnboardingStore());
    
    expect(result.current.step).toBe('welcome');
    expect(result.current.invitationCode).toBe('');
    expect(result.current.userInfo.name).toBe('');
    expect(result.current.hasAcceptedPrivacy).toBe(false);
    expect(result.current.hasCompletedTutorial).toBe(false);
  });

  it('should set invitation code', () => {
    const { result } = renderHook(() => useOnboardingStore());
    
    act(() => {
      result.current.setInvitationCode('ABC12345');
    });
    
    expect(result.current.invitationCode).toBe('ABC12345');
  });

  it('should update user info', () => {
    const { result } = renderHook(() => useOnboardingStore());
    
    act(() => {
      result.current.setUserInfo({ name: 'John Doe', phone: '+1234567890' });
    });
    
    expect(result.current.userInfo.name).toBe('John Doe');
    expect(result.current.userInfo.phone).toBe('+1234567890');
    expect(result.current.userInfo.email).toBe(''); // Should preserve existing values
  });

  it('should navigate through steps', () => {
    const { result } = renderHook(() => useOnboardingStore());
    
    // Start at welcome
    expect(result.current.step).toBe('welcome');
    
    // Move to next step
    act(() => {
      result.current.nextStep();
    });
    expect(result.current.step).toBe('invitation');
    
    // Move to previous step
    act(() => {
      result.current.previousStep();
    });
    expect(result.current.step).toBe('welcome');
  });

  it('should not go beyond first and last steps', () => {
    const { result } = renderHook(() => useOnboardingStore());
    
    // Try to go before first step
    act(() => {
      result.current.previousStep();
    });
    expect(result.current.step).toBe('welcome');
    
    // Go to last step
    act(() => {
      result.current.setStep('complete');
    });
    
    // Try to go beyond last step
    act(() => {
      result.current.nextStep();
    });
    expect(result.current.step).toBe('complete');
  });

  it('should accept privacy', () => {
    const { result } = renderHook(() => useOnboardingStore());
    
    expect(result.current.hasAcceptedPrivacy).toBe(false);
    
    act(() => {
      result.current.acceptPrivacy();
    });
    
    expect(result.current.hasAcceptedPrivacy).toBe(true);
  });

  it('should manage tutorial state', () => {
    const { result } = renderHook(() => useOnboardingStore());
    
    expect(result.current.tutorialStep).toBe(0);
    expect(result.current.hasCompletedTutorial).toBe(false);
    
    act(() => {
      result.current.setTutorialStep(2);
    });
    expect(result.current.tutorialStep).toBe(2);
    
    act(() => {
      result.current.completeTutorial();
    });
    expect(result.current.hasCompletedTutorial).toBe(true);
    expect(result.current.tutorialStep).toBe(0); // Should reset
  });

  it('should reset to initial state', () => {
    const { result } = renderHook(() => useOnboardingStore());
    
    // Modify state
    act(() => {
      result.current.setInvitationCode('ABC12345');
      result.current.setUserInfo({ name: 'John Doe' });
      result.current.acceptPrivacy();
      result.current.setStep('privacy');
    });
    
    // Verify state is modified
    expect(result.current.invitationCode).toBe('ABC12345');
    expect(result.current.userInfo.name).toBe('John Doe');
    expect(result.current.hasAcceptedPrivacy).toBe(true);
    expect(result.current.step).toBe('privacy');
    
    // Reset
    act(() => {
      result.current.reset();
    });
    
    // Verify state is reset
    expect(result.current.invitationCode).toBe('');
    expect(result.current.userInfo.name).toBe('');
    expect(result.current.hasAcceptedPrivacy).toBe(false);
    expect(result.current.step).toBe('welcome');
  });
});