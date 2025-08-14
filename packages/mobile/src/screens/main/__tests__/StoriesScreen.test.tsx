import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import { StoriesScreen } from '../StoriesScreen';
import { useStoryStore } from '../../../stores/story-store';
import type { Story } from '@saga/shared/types/story';

// Mock the store
jest.mock('../../../stores/story-store');
const mockUseStoryStore = useStoryStore as jest.MockedFunction<typeof useStoryStore>;

// Mock navigation
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockNavigate,
  }),
}));

const Stack = createStackNavigator();

function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Stories" component={() => <>{children}</>} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const mockStories: Story[] = [
  {
    id: '1',
    projectId: 'project-1',
    title: 'My Childhood Memory',
    audioUrl: 'https://example.com/audio1.mp3',
    audioDuration: 120,
    transcript: 'This is a story about my childhood...',
    photoUrl: 'https://example.com/photo1.jpg',
    status: 'ready',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
    interactions: [
      {
        id: 'int-1',
        storyId: '1',
        facilitatorId: 'facilitator-1',
        type: 'comment',
        content: 'Great story!',
        createdAt: new Date('2024-01-16'),
      },
    ],
  },
  {
    id: '2',
    projectId: 'project-1',
    title: 'Career Journey',
    audioUrl: 'https://example.com/audio2.mp3',
    audioDuration: 180,
    status: 'processing',
    createdAt: new Date('2024-01-14'),
    updatedAt: new Date('2024-01-14'),
    interactions: [
      {
        id: 'int-2',
        storyId: '2',
        facilitatorId: 'facilitator-1',
        type: 'followup',
        content: 'Can you tell me more about your first job?',
        createdAt: new Date('2024-01-15'),
      },
    ],
  },
];

describe('StoriesScreen', () => {
  const mockStoreState = {
    stories: mockStories,
    currentStory: null,
    interactions: [],
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

  it('renders stories list correctly', async () => {
    const { getByText, getByTestId } = render(
      <TestWrapper>
        <StoriesScreen />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(getByText('My Stories')).toBeTruthy();
      expect(getByText('Your recorded memories')).toBeTruthy();
      expect(getByText('My Childhood Memory')).toBeTruthy();
      expect(getByText('Career Journey')).toBeTruthy();
    });
  });

  it('displays story metadata correctly', async () => {
    const { getByText } = render(
      <TestWrapper>
        <StoriesScreen />
      </TestWrapper>
    );

    await waitFor(() => {
      // Check duration formatting
      expect(getByText('2:00')).toBeTruthy(); // 120 seconds
      expect(getByText('3:00')).toBeTruthy(); // 180 seconds
      
      // Check interaction count
      expect(getByText('1')).toBeTruthy(); // interaction count
    });
  });

  it('shows processing status for stories being processed', async () => {
    const { getByText } = render(
      <TestWrapper>
        <StoriesScreen />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(getByText('Processing...')).toBeTruthy();
    });
  });

  it('shows unread badge for stories with unanswered follow-ups', async () => {
    const { getByText } = render(
      <TestWrapper>
        <StoriesScreen />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(getByText('New')).toBeTruthy();
    });
  });

  it('navigates to story detail when story is pressed', async () => {
    const { getByText } = render(
      <TestWrapper>
        <StoriesScreen />
      </TestWrapper>
    );

    await waitFor(() => {
      const storyItem = getByText('My Childhood Memory');
      fireEvent.press(storyItem);
    });

    expect(mockNavigate).toHaveBeenCalledWith('StoryDetail', { storyId: '1' });
  });

  it('handles search functionality', async () => {
    const { getByPlaceholderText } = render(
      <TestWrapper>
        <StoriesScreen />
      </TestWrapper>
    );

    const searchInput = getByPlaceholderText('Search your stories...');
    fireEvent.changeText(searchInput, 'childhood');

    await waitFor(() => {
      expect(mockStoreState.searchStories).toHaveBeenCalledWith('childhood');
    });
  });

  it('shows empty state when no stories exist', async () => {
    mockUseStoryStore.mockReturnValue({
      ...mockStoreState,
      stories: [],
    });

    const { getByText } = render(
      <TestWrapper>
        <StoriesScreen />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(getByText('No Stories Yet')).toBeTruthy();
      expect(getByText('Start recording your first story to see it here')).toBeTruthy();
      expect(getByText('Record First Story')).toBeTruthy();
    });
  });

  it('shows search empty state when no results found', async () => {
    mockUseStoryStore.mockReturnValue({
      ...mockStoreState,
      stories: [],
      searchQuery: 'nonexistent',
    });

    const { getByText } = render(
      <TestWrapper>
        <StoriesScreen />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(getByText('No Stories Found')).toBeTruthy();
      expect(getByText('No stories match "nonexistent"')).toBeTruthy();
    });
  });

  it('handles refresh functionality', async () => {
    const { getByTestId } = render(
      <TestWrapper>
        <StoriesScreen />
      </TestWrapper>
    );

    // Simulate pull-to-refresh
    const scrollView = getByTestId('stories-list');
    fireEvent(scrollView, 'refresh');

    await waitFor(() => {
      expect(mockStoreState.refreshStories).toHaveBeenCalled();
    });
  });

  it('handles load more functionality', async () => {
    mockUseStoryStore.mockReturnValue({
      ...mockStoreState,
      hasMore: true,
    });

    const { getByTestId } = render(
      <TestWrapper>
        <StoriesScreen />
      </TestWrapper>
    );

    const scrollView = getByTestId('stories-list');
    fireEvent(scrollView, 'endReached');

    await waitFor(() => {
      expect(mockStoreState.fetchStories).toHaveBeenCalledWith(1, '');
    });
  });

  it('displays error alert when error occurs', async () => {
    const mockAlert = jest.spyOn(require('react-native'), 'Alert', 'alert');
    
    mockUseStoryStore.mockReturnValue({
      ...mockStoreState,
      error: 'Failed to fetch stories',
    });

    render(
      <TestWrapper>
        <StoriesScreen />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(mockAlert).toHaveBeenCalledWith(
        'Error',
        'Failed to fetch stories',
        [{ text: 'OK', onPress: expect.any(Function) }]
      );
    });
  });

  it('calls fetchStories on component mount', async () => {
    render(
      <TestWrapper>
        <StoriesScreen />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(mockStoreState.fetchStories).toHaveBeenCalled();
    });
  });
});