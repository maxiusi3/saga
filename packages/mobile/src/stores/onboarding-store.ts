import { create } from 'zustand';
import type { Invitation } from '@saga/shared/types/invitation';
import type { Project } from '@saga/shared/types/project';

interface OnboardingState {
  // Current invitation being processed
  currentInvitation: Invitation | null;
  currentProject: Project | null;
  facilitators: Array<{
    id: string;
    name: string;
    email?: string;
  }>;
  
  // Onboarding flow state
  step: 'welcome' | 'invitation' | 'validation' | 'user-info' | 'privacy' | 'complete';
  isLoading: boolean;
  error: string | null;
  
  // User input data
  invitationCode: string;
  userInfo: {
    name: string;
    phone: string;
    email: string;
  };
  
  // Privacy agreement
  hasAcceptedPrivacy: boolean;
  
  // Tutorial state
  hasCompletedTutorial: boolean;
  tutorialStep: number;
}

interface OnboardingActions {
  // Navigation
  setStep: (step: OnboardingState['step']) => void;
  nextStep: () => void;
  previousStep: () => void;
  
  // Invitation handling
  setInvitationCode: (code: string) => void;
  setInvitation: (invitation: Invitation, project: Project, facilitators?: Array<{id: string; name: string; email?: string}>) => void;
  
  // User info
  setUserInfo: (info: Partial<OnboardingState['userInfo']>) => void;
  
  // Privacy
  acceptPrivacy: () => void;
  
  // Tutorial
  setTutorialStep: (step: number) => void;
  completeTutorial: () => void;
  
  // State management
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState: OnboardingState = {
  currentInvitation: null,
  currentProject: null,
  facilitators: [],
  step: 'welcome',
  isLoading: false,
  error: null,
  invitationCode: '',
  userInfo: {
    name: '',
    phone: '',
    email: '',
  },
  hasAcceptedPrivacy: false,
  hasCompletedTutorial: false,
  tutorialStep: 0,
};

export const useOnboardingStore = create<OnboardingState & OnboardingActions>((set, get) => ({
  ...initialState,

  // Navigation
  setStep: (step) => set({ step }),
  
  nextStep: () => {
    const { step } = get();
    const stepOrder: OnboardingState['step'][] = [
      'welcome',
      'invitation', 
      'validation',
      'user-info',
      'privacy',
      'complete'
    ];
    
    const currentIndex = stepOrder.indexOf(step);
    if (currentIndex < stepOrder.length - 1) {
      set({ step: stepOrder[currentIndex + 1] });
    }
  },
  
  previousStep: () => {
    const { step } = get();
    const stepOrder: OnboardingState['step'][] = [
      'welcome',
      'invitation',
      'validation', 
      'user-info',
      'privacy',
      'complete'
    ];
    
    const currentIndex = stepOrder.indexOf(step);
    if (currentIndex > 0) {
      set({ step: stepOrder[currentIndex - 1] });
    }
  },

  // Invitation handling
  setInvitationCode: (invitationCode) => set({ invitationCode }),
  
  setInvitation: (invitation, project, facilitators = []) => set({ 
    currentInvitation: invitation,
    currentProject: project,
    facilitators,
  }),

  // User info
  setUserInfo: (info) => set((state) => ({
    userInfo: { ...state.userInfo, ...info }
  })),

  // Privacy
  acceptPrivacy: () => set({ hasAcceptedPrivacy: true }),

  // Tutorial
  setTutorialStep: (tutorialStep) => set({ tutorialStep }),
  
  completeTutorial: () => set({ 
    hasCompletedTutorial: true,
    tutorialStep: 0,
  }),

  // State management
  setLoading: (isLoading) => set({ isLoading }),
  
  setError: (error) => set({ error }),
  
  reset: () => set(initialState),
}));