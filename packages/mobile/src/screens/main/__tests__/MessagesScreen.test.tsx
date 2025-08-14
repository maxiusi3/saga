import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import { MessagesScreen } from '../MessagesScreen';
import { useStoryStore } from '../../../stores/story-store';
import type { Interaction } from '@saga/shared/types/interaction';
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
        <Stack.Screen name="Messages" component={() => <>{children}</>} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const mockStories: Story[] = [
  {
    id: 'story-1',
    projectId: 'project-1',
    title: 'My Childhood Memory',
    audioUrl: 'https://example.com/audio1.mp3',
    status: 'ready',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
  },
  {
    id: 'story-2',
    projectId: 'project-1',
    title: 'Career Journey',
    audioUrl: 'https://example.com/audio2.mp3',
    status: 'ready',
    createdAt: new Date('2024-01-14'),
    updatedAt: new Date('2024-01-14'),
  },
];

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
    storyId: 'story-2',
    facilitatorId: 'facilitator-1',
    type: 'followup',
    content: 'Can you tell me more about your first job? What was your boss like?',
    createdAt: new Date('2024-01-15T14:30:00Z'),
  },
  {
    id: 'int-3',
    storyId: 'story-1',
    facilitatorId: 'facilitator-1',
    type: 'followup',
    content: 'Do you remember what your favorite toy was?',
    answeredAt: new Date('2024-01-17T09:00:00Z'),
    createdAt: new Date('2024-01-16T16:00:00Z'),
  },
];

describe('MessagesScreen', () => {
  const mockStoreState = {
    stories: mockStories,
    currentStory: null,
    interactions: [],
    unreadInteractions: mockInteractions,
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

  it('renders messages screen correctly', async () => {
    const { getByText } = render(
      <TestWrapper>
        <MessagesScreen />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(getByText('Messages')).toBeTruthy();
      expect(getByText('Comments and questions from your family')).toBeTruthy();
    });
  });

  it('displays filter buttons with correct counts', async () => {
    const { getByText } = render(
      <TestWrapper>
        <MessagesScreen />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(getByText('All')).toBeTruthy();
      expect(getByText('Questions')).toBeTruthy();
      expect(getByText('Comments')).toBeTruthy();
      expect(getByText('3')).toBeTruthy(); // Total count
      expect(getByText('1')).toBeTruthy(); // Unanswered questions count
    });
  });

  it('displays interactions correctly', async () => {
    const { getByText } = render(
      <TestWrapper>
        <MessagesScreen />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(getByText('What a wonderful memory! Thank you for sharing this with us.')).toBeTruthy();
      expect(getByText('Can you tell me more about your first job? What was your boss like?')).toBeTruthy();
      expect(getByText('Do you remember what your favorite toy was?')).toBeTruthy();
    });
  });

  it('shows correct interaction types', async () => {
    const { getByText } = render(
      <TestWrapper>
        <MessagesScreen />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(getByText('Comment')).toBeTruthy();
      expect(getByText('Follow-up Question')).toBeTruthy();
    });
  });

  it('shows story titles for interactions', async () => {
    const { getByText } = render(
      <TestWrapper>
        <MessagesScreen />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(getByText('My Childhood Memory')).toBeTruthy();
      expect(getByText('Career Journey')).toBeTruthy();
    });
  });

  it('shows "Record Answer" button for unanswered follow-ups', async () => {
    const { getAllByText } = render(
      <TestWrapper>
        <MessagesScreen />
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
        <MessagesScreen />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(getByText(/Answered/)).toBeTruthy();
    });
  });

  it('filters interactions by type', async () => {
    const { getByText, queryByText } = render(
      <TestWrapper>
        <MessagesScreen />
      </TestWrapper>
    );

    // Filter by questions
    fireEvent.press(getByText('Questions'));

    await waitFor(() => {
      expect(getByText('Can you tell me more about your first job? What was your boss like?')).toBeTruthy();
      expect(getByText('Do you remember what your favorite toy was?')).toBeTruthy();
      expect(queryByText('What a wonderful memory! Thank you for sharing this with us.')).toBeNull();
    });

    // Filter by comments
    fireEvent.press(getByText('Comments'));

    await waitFor(() => {
      expect(getByText('What a wonderful memory! Thank you for sharing this with us.')).toBeTruthy();
      expect(queryByText('Can you tell me more about your first job? What was your boss like?')).toBeNull();
    });
  });

  it('navigates to story detail when message is pressed', async () => {
    const { getByText } = render(
      <TestWrapper>
        <MessagesScreen />
      </TestWrapper>
    );

    await waitFor(() => {
      const commentMessage = getByText('What a wonderful memory! Thank you for sharing this with us.');
      fireEvent.press(commentMessage);
    });

    expect(mockNavigate).toHaveBeenCalledWith('StoryDetail', { storyId: 'story-1' });
  });

  it('navigates to record answer when answer button is pressed', async () => {
    const { getByText } = render(
      <TestWrapper>
        <MessagesScreen />
      </TestWrapper>
    );

    await waitFor(() => {
      const recordButton = getByText('Record Answer');
      fireEvent.press(recordButton);
    });

    expect(mockNavigate).toHaveBeenCalledWith('RecordAnswer', {
      questionId: 'int-2',
      storyId: 'story-2',
    });
  });

  it('marks comment interactions as read when pressed', async () => {
    const { getByText } = render(
      <TestWrapper>
        <MessagesScreen />
      </TestWrapper>
    );

    await waitFor(() => {
      const commentMessage = getByText('What a wonderful memory! Thank you for sharing this with us.');
      fireEvent.press(commentMessage);
    });

    expect(mockStoreState.markInteractionAsRead).toHaveBeenCalledWith('int-1');
  });

  it('shows empty state when no interactions exist', async () => {
    mockUseStoryStore.mockReturnValue({
      ...mockStoreState,
      unreadInteractions: [],
    });

    const { getByText } = render(
      <TestWrapper>
        <MessagesScreen />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(getByText('No Messages Yet')).toBeTruthy();
      expect(getByText('Comments and questions from your family will appear here')).toBeTruthy();
    });
  });

  it('shows filtered empty state', async () => {
    mockUseStoryStore.mockReturnValue({
      ...mockStoreState,
      unreadInteractions: [mockInteractions[0]], // Only comment
    });

    const { getByText } = render(
      <TestWrapper>
        <MessagesScreen />
      </TestWrapper>
    );

    // Filter by questions
    fireEvent.press(getByText('Questions'));

    await waitFor(() => {
      expect(getByText('No Questions Yet')).toBeTruthy();
      expect(getByText('Follow-up questions from your family will appear here')).toBeTruthy();
    });
  });

  it('handles refresh functionality', async () => {
    const { getByTestId } = render(
      <TestWrapper>
        <MessagesScreen />
      </TestWrapper>
    );

    // Simulate pull-to-refresh
    const scrollView = getByTestId('messages-list');
    fireEvent(scrollView, 'refresh');

    await waitFor(() => {
      expect(mockStoreState.fetchUnreadInteractions).toHaveBeenCalled();
      expect(mockStoreState.fetchStories).toHaveBeenCalled();
    });
  });

  it('displays error alert when error occurs', async () => {
    const mockAlert = jest.spyOn(require('react-native'), 'Alert', 'alert');
    
    mockUseStoryStore.mockReturnValue({
      ...mockStoreState,
      error: 'Failed to fetch messages',
    });

    render(
      <TestWrapper>
        <MessagesScreen />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(mockAlert).toHaveBeenCalledWith(
        'Error',
        'Failed to fetch messages',
        [{ text: 'OK', onPress: expect.any(Function) }]
      );
    });
  });

  it('loads data on component mount', async () => {
    render(
      <TestWrapper>
        <MessagesScreen />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(mockStoreState.fetchUnreadInteractions).toHaveBeenCalled();
      expect(mockStoreState.fetchStories).toHaveBeenCalled();
    });
  });
});