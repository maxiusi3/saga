import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import { StoryDetailScreen } from '../StoryDetailScreen';
import { useStoryStore } from '../../../stores/story-store';
import type { Story } from '@saga/shared/types/story';
import type { Interaction } from '@saga/shared/types/interaction';

// Mock the store
jest.mock('../../../stores/story-store');
const mockUseStoryStore = useStoryStore as jest.MockedFunction<typeof useStoryStore>;

// Mock navigation
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
  }),
}));

// Mock Audio from expo-av
jest.mock('expo-av', () => ({
  Audio: {
    Sound: {
      createAsync: jest.fn(() => Promise.resolve({
        sound: {
          setOnPlaybackStatusUpdate: jest.fn(),
          playAsync: jest.fn(),
          pauseAsync: jest.fn(),
          unloadAsync: jest.fn(),
        },
      })),
    },
  },
}));

const Stack = createStackNavigator();

function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="StoryDetail" component={() => <>{children}</>} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const mockStory: Story = {
  id: 'story-1',
  projectId: 'project-1',
  title: 'My Childhood Memory',
  audioUrl: 'https://example.com/audio1.mp3',
  audioDuration: 120,
  transcript: 'This is a story about my childhood. I remember playing in the garden with my siblings...',
  photoUrl: 'https://example.com/photo1.jpg',
  aiPrompt: 'Tell me about your favorite childhood memory.',
  status: 'ready',
  createdAt: new Date('2024-01-15T10:00:00Z'),
  updatedAt: new Date('2024-01-15T10:00:00Z'),
};

const mockInteractions: Interaction[] = [
  {
    id: 'int-1',
    storyId: 'story-1',
    facilitatorId: 'facilitator-1',
    type: 'comment',
    content: 'What a wonderful memory! Thank you for sharing this with us.',
    createdAt: new Date('2024-01-16T10:00:00Z'),
  },
  {
    id: 'int-2',
    storyId: 'story-1',
    facilitatorId: 'facilitator-1',
    type: 'followup',
    content: 'Can you tell me more about your siblings? What were their names?',
    createdAt: new Date('2024-01-16T14:30:00Z'),
  },
  {
    id: 'int-3',
    storyId: 'story-1',
    facilitatorId: 'facilitator-1',
    type: 'followup',
    content: 'What was your favorite game to play?',
    answeredAt: new Date('2024-01-17T09:00:00Z'),
    createdAt: new Date('2024-01-16T16:00:00Z'),
  },
];

const mockRoute = {
  params: {
    storyId: 'story-1',
  },
};

describe('StoryDetailScreen', () => {
  const mockStoreState = {
    stories: [],
    currentStory: mockStory,
    interactions: mockInteractions,
    unreadInteractions: [],
    isLoading: false,
    error: null,
    uploadProgress: 0,
    searchQuery: '',
    hasMore: false,
    currentPage: 1,
    fetchStories: jest.fn(),
    fetchStoryById: jest.fn(),
    fetchStoryInteractions: jest.fn(),
    fetchUnreadInteractions: jest.fn(),
    createStory: jest.fn(),
    uploadAudio: jest.fn(),
    updateTranscript: jest.fn(),
    markInteractionAsRead: jest.fn(),
    searchStories: jest.fn(),
    clearSearch: jest.fn(),
    refreshStories: jest.fn(),
    clearError: jest.fn(),
    setUploadProgress: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseStoryStore.mockReturnValue(mockStoreState);
  });

  it('renders story details correctly', async () => {
    const { getByText } = render(
      <TestWrapper>
        <StoryDetailScreen navigation={null as any} route={mockRoute as any} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(getByText('My Childhood Memory')).toBeTruthy();
      expect(getByText('Monday, January 15, 2024')).toBeTruthy();
      expect(getByText('This is a story about my childhood. I remember playing in the garden with my siblings...')).toBeTruthy();
      expect(getByText('Tell me about your favorite childhood memory.')).toBeTruthy();
    });
  });

  it('displays audio player with correct duration', async () => {
    const { getByText } = render(
      <TestWrapper>
        <StoryDetailScreen navigation={null as any} route={mockRoute as any} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(getByText('Audio Recording')).toBeTruthy();
      expect(getByText('2:00')).toBeTruthy(); // 120 seconds formatted
    });
  });

  it('shows processing status for processing stories', async () => {
    mockUseStoryStore.mockReturnValue({
      ...mockStoreState,
      currentStory: {
        ...mockStory,
        status: 'processing',
      },
    });

    const { getByText } = render(
      <TestWrapper>
        <StoryDetailScreen navigation={null as any} route={mockRoute as any} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(getByText('Processing...')).toBeTruthy();
    });
  });

  it('displays interactions correctly', async () => {
    const { getByText } = render(
      <TestWrapper>
        <StoryDetailScreen navigation={null as any} route={mockRoute as any} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(getByText('Messages & Questions (3)')).toBeTruthy();
      expect(getByText('What a wonderful memory! Thank you for sharing this with us.')).toBeTruthy();
      expect(getByText('Can you tell me more about your siblings? What were their names?')).toBeTruthy();
      expect(getByText('What was your favorite game to play?')).toBeTruthy();
    });
  });

  it('shows record answer button for unanswered follow-ups', async () => {
    const { getAllByText } = render(
      <TestWrapper>
        <StoryDetailScreen navigation={null as any} route={mockRoute as any} />
      </TestWrapper>
    );

    await waitFor(() => {
      const recordButtons = getAllByText('Record Answer');
      expect(recordButtons).toHaveLength(1); // Only one unanswered question
    });
  });

  it('shows answered status for answered follow-ups', async () => {
    const { getByText } = render(
      <TestWrapper>
        <StoryDetailScreen navigation={null as any} route={mockRoute as any} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(getByText(/Answered on/)).toBeTruthy();
    });
  });

  it('navigates to record answer when answer button is pressed', async () => {
    const { getByText } = render(
      <TestWrapper>
        <StoryDetailScreen navigation={null as any} route={mockRoute as any} />
      </TestWrapper>
    );

    await waitFor(() => {
      const recordButton = getByText('Record Answer');
      fireEvent.press(recordButton);
    });

    expect(mockNavigate).toHaveBeenCalledWith('RecordAnswer', {
      questionId: 'int-2',
      storyId: 'story-1',
    });
  });

  it('shows empty interactions state when no interactions exist', async () => {
    mockUseStoryStore.mockReturnValue({
      ...mockStoreState,
      interactions: [],
    });

    const { getByText } = render(
      <TestWrapper>
        <StoryDetailScreen navigation={null as any} route={mockRoute as any} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(getByText('No Messages Yet')).toBeTruthy();
      expect(getByText('Your family will see comments and questions here when they respond to your story.')).toBeTruthy();
    });
  });

  it('shows error state when story is not found', async () => {
    mockUseStoryStore.mockReturnValue({
      ...mockStoreState,
      currentStory: null,
      isLoading: false,
    });

    const { getByText } = render(
      <TestWrapper>
        <StoryDetailScreen navigation={null as any} route={mockRoute as any} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(getByText('Story Not Found')).toBeTruthy();
      expect(getByText('This story may have been deleted or you don\'t have access to it.')).toBeTruthy();
    });
  });

  it('handles go back when story not found', async () => {
    mockUseStoryStore.mockReturnValue({
      ...mockStoreState,
      currentStory: null,
      isLoading: false,
    });

    const { getByText } = render(
      <TestWrapper>
        <StoryDetailScreen navigation={null as any} route={mockRoute as any} />
      </TestWrapper>
    );

    await waitFor(() => {
      const goBackButton = getByText('Go Back');
      fireEvent.press(goBackButton);
    });

    expect(mockGoBack).toHaveBeenCalled();
  });

  it('loads story data on component mount', async () => {
    render(
      <TestWrapper>
        <StoryDetailScreen navigation={null as any} route={mockRoute as any} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(mockStoreState.fetchStoryById).toHaveBeenCalledWith('story-1');
      expect(mockStoreState.fetchStoryInteractions).toHaveBeenCalledWith('story-1');
    });
  });

  it('handles refresh functionality', async () => {
    const { getByTestId } = render(
      <TestWrapper>
        <StoryDetailScreen navigation={null as any} route={mockRoute as any} />
      </TestWrapper>
    );

    // Simulate pull-to-refresh
    const scrollView = getByTestId('story-detail-scroll');
    fireEvent(scrollView, 'refresh');

    await waitFor(() => {
      expect(mockStoreState.fetchStoryById).toHaveBeenCalledWith('story-1');
      expect(mockStoreState.fetchStoryInteractions).toHaveBeenCalledWith('story-1');
    });
  });

  it('displays error alert when error occurs', async () => {
    const mockAlert = jest.spyOn(require('react-native'), 'Alert', 'alert');
    
    mockUseStoryStore.mockReturnValue({
      ...mockStoreState,
      error: 'Failed to fetch story',
    });

    render(
      <TestWrapper>
        <StoryDetailScreen navigation={null as any} route={mockRoute as any} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(mockAlert).toHaveBeenCalledWith(
        'Error',
        'Failed to fetch story',
        [{ text: 'OK', onPress: expect.any(Function) }]
      );
    });
  });

  it('displays photo when available', async () => {
    const { getByTestId } = render(
      <TestWrapper>
        <StoryDetailScreen navigation={null as any} route={mockRoute as any} />
      </TestWrapper>
    );

    await waitFor(() => {
      const photo = getByTestId('story-photo');
      expect(photo.props.source.uri).toBe('https://example.com/photo1.jpg');
    });
  });

  it('handles audio playback controls', async () => {
    const { getByTestId } = render(
      <TestWrapper>
        <StoryDetailScreen navigation={null as any} route={mockRoute as any} />
      </TestWrapper>
    );

    await waitFor(() => {
      const playButton = getByTestId('audio-play-button');
      fireEvent.press(playButton);
      // Audio loading and playback would be tested with proper mocks
    });
  });
});