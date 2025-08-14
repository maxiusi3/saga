import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { EditTranscriptScreen } from '../EditTranscriptScreen';
import { useStoryStore } from '../../../stores/story-store';

// Mock dependencies
jest.mock('../../../stores/story-store');
jest.mock('react-native/Libraries/Alert/Alert', () => ({
  alert: jest.fn(),
}));

const mockUseStoryStore = useStoryStore as jest.MockedFunction<typeof useStoryStore>;
const mockAlert = Alert.alert as jest.MockedFunction<typeof Alert.alert>;

const mockNavigation = {
  setOptions: jest.fn(),
  goBack: jest.fn(),
  navigate: jest.fn(),
};

const mockRoute = {
  params: {
    storyId: 'story-1',
    transcript: 'This is the original transcript.',
  },
};

describe('EditTranscriptScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockUseStoryStore.mockReturnValue({
      updateTranscript: jest.fn(),
      isLoading: false,
      error: null,
      stories: [],
      currentStory: null,
      interactions: [],
      uploadProgress: 0,
      fetchStories: jest.fn(),
      fetchStoryById: jest.fn(),
      fetchStoryInteractions: jest.fn(),
      createStory: jest.fn(),
      uploadAudio: jest.fn(),
      addInteraction: jest.fn(),
      markInteractionAsRead: jest.fn(),
      searchStories: jest.fn(),
      clearError: jest.fn(),
    });
  });

  it('should render with initial transcript', () => {
    const { getByDisplayValue } = render(
      <EditTranscriptScreen 
        navigation={mockNavigation as any} 
        route={mockRoute as any} 
      />
    );

    expect(getByDisplayValue('This is the original transcript.')).toBeTruthy();
  });

  it('should show character count', () => {
    const { getByText } = render(
      <EditTranscriptScreen 
        navigation={mockNavigation as any} 
        route={mockRoute as any} 
      />
    );

    expect(getByText('33/5000 characters')).toBeTruthy();
  });

  it('should enable save button when text changes', () => {
    const { getByDisplayValue, getByText } = render(
      <EditTranscriptScreen 
        navigation={mockNavigation as any} 
        route={mockRoute as any} 
      />
    );

    const textInput = getByDisplayValue('This is the original transcript.');
    fireEvent.changeText(textInput, 'This is the updated transcript.');

    // Check that unsaved changes indicator appears
    expect(getByText('Unsaved changes')).toBeTruthy();
  });

  it('should call updateTranscript when save button is pressed', async () => {
    const mockUpdateTranscript = jest.fn().mockResolvedValue(undefined);
    mockUseStoryStore.mockReturnValue({
      updateTranscript: mockUpdateTranscript,
      isLoading: false,
      error: null,
      stories: [],
      currentStory: null,
      interactions: [],
      uploadProgress: 0,
      fetchStories: jest.fn(),
      fetchStoryById: jest.fn(),
      fetchStoryInteractions: jest.fn(),
      createStory: jest.fn(),
      uploadAudio: jest.fn(),
      addInteraction: jest.fn(),
      markInteractionAsRead: jest.fn(),
      searchStories: jest.fn(),
      clearError: jest.fn(),
    });

    const { getByDisplayValue } = render(
      <EditTranscriptScreen 
        navigation={mockNavigation as any} 
        route={mockRoute as any} 
      />
    );

    const textInput = getByDisplayValue('This is the original transcript.');
    fireEvent.changeText(textInput, 'This is the updated transcript.');

    // Simulate pressing save button (would be in header)
    // We'll test the save function directly since header buttons are set via navigation.setOptions
    expect(mockNavigation.setOptions).toHaveBeenCalled();
    
    // Get the headerRight function and simulate pressing it
    const setOptionsCall = mockNavigation.setOptions.mock.calls[0][0];
    const headerRight = setOptionsCall.headerRight();
    
    // Simulate pressing the save button
    fireEvent.press(headerRight);

    await waitFor(() => {
      expect(mockUpdateTranscript).toHaveBeenCalledWith('story-1', 'This is the updated transcript.');
    });
  });

  it('should show confirmation dialog when canceling with unsaved changes', () => {
    const { getByDisplayValue } = render(
      <EditTranscriptScreen 
        navigation={mockNavigation as any} 
        route={mockRoute as any} 
      />
    );

    const textInput = getByDisplayValue('This is the original transcript.');
    fireEvent.changeText(textInput, 'This is the updated transcript.');

    // Get the headerLeft function and simulate pressing it
    const setOptionsCall = mockNavigation.setOptions.mock.calls[0][0];
    const headerLeft = setOptionsCall.headerLeft();
    
    fireEvent.press(headerLeft);

    expect(mockAlert).toHaveBeenCalledWith(
      'Unsaved Changes',
      'You have unsaved changes. Are you sure you want to cancel?',
      expect.arrayContaining([
        expect.objectContaining({ text: 'Keep Editing' }),
        expect.objectContaining({ text: 'Discard Changes' }),
      ])
    );
  });

  it('should implement auto-save functionality', async () => {
    jest.useFakeTimers();
    
    const mockUpdateTranscript = jest.fn().mockResolvedValue(undefined);
    mockUseStoryStore.mockReturnValue({
      updateTranscript: mockUpdateTranscript,
      isLoading: false,
      error: null,
      stories: [],
      currentStory: null,
      interactions: [],
      uploadProgress: 0,
      fetchStories: jest.fn(),
      fetchStoryById: jest.fn(),
      fetchStoryInteractions: jest.fn(),
      createStory: jest.fn(),
      uploadAudio: jest.fn(),
      addInteraction: jest.fn(),
      markInteractionAsRead: jest.fn(),
      searchStories: jest.fn(),
      clearError: jest.fn(),
    });

    const { getByDisplayValue } = render(
      <EditTranscriptScreen 
        navigation={mockNavigation as any} 
        route={mockRoute as any} 
      />
    );

    const textInput = getByDisplayValue('This is the original transcript.');
    fireEvent.changeText(textInput, 'This is the auto-saved transcript.');

    // Fast-forward time to trigger auto-save
    jest.advanceTimersByTime(3000);

    await waitFor(() => {
      expect(mockUpdateTranscript).toHaveBeenCalledWith('story-1', 'This is the auto-saved transcript.');
    });

    jest.useRealTimers();
  });

  it('should handle save errors gracefully', async () => {
    const mockUpdateTranscript = jest.fn().mockRejectedValue(new Error('Network error'));
    mockUseStoryStore.mockReturnValue({
      updateTranscript: mockUpdateTranscript,
      isLoading: false,
      error: null,
      stories: [],
      currentStory: null,
      interactions: [],
      uploadProgress: 0,
      fetchStories: jest.fn(),
      fetchStoryById: jest.fn(),
      fetchStoryInteractions: jest.fn(),
      createStory: jest.fn(),
      uploadAudio: jest.fn(),
      addInteraction: jest.fn(),
      markInteractionAsRead: jest.fn(),
      searchStories: jest.fn(),
      clearError: jest.fn(),
    });

    const { getByDisplayValue } = render(
      <EditTranscriptScreen 
        navigation={mockNavigation as any} 
        route={mockRoute as any} 
      />
    );

    const textInput = getByDisplayValue('This is the original transcript.');
    fireEvent.changeText(textInput, 'This is the updated transcript.');

    // Simulate pressing save button
    const setOptionsCall = mockNavigation.setOptions.mock.calls[0][0];
    const headerRight = setOptionsCall.headerRight();
    fireEvent.press(headerRight);

    await waitFor(() => {
      expect(mockAlert).toHaveBeenCalledWith('Error', 'Failed to update transcript');
    });
  });

  it('should show last saved timestamp', async () => {
    jest.useFakeTimers();
    const mockDate = new Date('2024-01-01T12:00:00Z');
    jest.setSystemTime(mockDate);

    const mockUpdateTranscript = jest.fn().mockResolvedValue(undefined);
    mockUseStoryStore.mockReturnValue({
      updateTranscript: mockUpdateTranscript,
      isLoading: false,
      error: null,
      stories: [],
      currentStory: null,
      interactions: [],
      uploadProgress: 0,
      fetchStories: jest.fn(),
      fetchStoryById: jest.fn(),
      fetchStoryInteractions: jest.fn(),
      createStory: jest.fn(),
      uploadAudio: jest.fn(),
      addInteraction: jest.fn(),
      markInteractionAsRead: jest.fn(),
      searchStories: jest.fn(),
      clearError: jest.fn(),
    });

    const { getByDisplayValue, getByText } = render(
      <EditTranscriptScreen 
        navigation={mockNavigation as any} 
        route={mockRoute as any} 
      />
    );

    const textInput = getByDisplayValue('This is the original transcript.');
    fireEvent.changeText(textInput, 'This is the updated transcript.');

    // Trigger auto-save
    jest.advanceTimersByTime(3000);

    await waitFor(() => {
      expect(getByText('Saved just now')).toBeTruthy();
    });

    jest.useRealTimers();
  });

  it('should prevent saving empty transcript', () => {
    const mockUpdateTranscript = jest.fn();
    mockUseStoryStore.mockReturnValue({
      updateTranscript: mockUpdateTranscript,
      isLoading: false,
      error: null,
      stories: [],
      currentStory: null,
      interactions: [],
      uploadProgress: 0,
      fetchStories: jest.fn(),
      fetchStoryById: jest.fn(),
      fetchStoryInteractions: jest.fn(),
      createStory: jest.fn(),
      uploadAudio: jest.fn(),
      addInteraction: jest.fn(),
      markInteractionAsRead: jest.fn(),
      searchStories: jest.fn(),
      clearError: jest.fn(),
    });

    const { getByDisplayValue } = render(
      <EditTranscriptScreen 
        navigation={mockNavigation as any} 
        route={mockRoute as any} 
      />
    );

    const textInput = getByDisplayValue('This is the original transcript.');
    fireEvent.changeText(textInput, '   '); // Empty/whitespace only

    // Simulate pressing save button
    const setOptionsCall = mockNavigation.setOptions.mock.calls[0][0];
    const headerRight = setOptionsCall.headerRight();
    fireEvent.press(headerRight);

    expect(mockUpdateTranscript).not.toHaveBeenCalled();
  });

  it('should show help text', () => {
    const { getByText } = render(
      <EditTranscriptScreen 
        navigation={mockNavigation as any} 
        route={mockRoute as any} 
      />
    );

    expect(getByText('Changes are automatically saved as you type')).toBeTruthy();
    expect(getByText('Tap "Save" to finalize your changes and return')).toBeTruthy();
  });
});