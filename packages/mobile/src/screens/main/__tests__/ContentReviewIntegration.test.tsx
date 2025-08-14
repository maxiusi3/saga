import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';

import { StoriesScreen } from '../StoriesScreen';
import { MessagesScreen } from '../MessagesScreen';
import { StoryDetailScreen } from '../StoryDetailScreen';
import { useStoryStore } from '../../../stores/story-store';
import type { Story } from '@saga/shared/types/story';
import type { Interaction } from '@saga/shared/types/interaction';

// Mock the store
jest.mock('../../../stores/story-store');
const mockUseStoryStore = useStoryStore as jest.MockedFunction<typeof useStoryStore>;

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

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function MainTabs() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Stories" component={StoriesScreen} />
      <Tab.Screen name="Messages" component={MessagesScreen} />
    </Tab.Navigator>
  );
}

function TestNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="MainTabs" component={MainTabs} />
        <Stack.Screen name="StoryDetail" component={StoryDetailScreen} />
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
    audioDuration: 120,
    transcript: 'This is a story about my childhood...',
    photoUrl: 'https://example.com/photo1.jpg',
    status: 'ready',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
    interactions: [
      {
        id: 'int-1',
        storyId: 'story-1',
        facilitatorId: 'facilitator-1',
        type: 'comment',
        content: 'Great story!',
        createdAt: new Date('2024-01-16'),
      },
      {
        id: 'int-2',
        storyId: 'story-1',
        facilitatorId: 'facilitator-1',
        type: 'followup',
        content: 'Can you tell me more about your siblings?',
        createdAt: new Date('2024-01-16'),
      },
    ],
  },
  {
    id: 'story-2',
    projectId: 'project-1',
    title: 'Career Journey',
    audioUrl: 'https://example.com/audio2.mp3',
    audioDuration: 180,
    status: 'ready',
    createdAt: new Date('2024-01-14'),
    updatedAt: new Date('2024-01-14'),
    interactions: [],
  },
];

const mockInteractions: Interaction[] = [
  {
    id: 'int-1',
    storyId: 'story-1',
    facilitatorId: 'facilitator-1',
    type: 'comment',
    content: 'Great story!',
    createdAt: new Date('2024-01-16'),
  },
  {
    id: 'int-2',
    storyId: 'story-1',
    facilitatorId: 'facilitator-1',
    type: 'followup',
    content: 'Can you tell me more about your siblings?',
    createdAt: new Date('2024-01-16'),
  },
];

describe('Content Review Integration', () => {
  const mockStoreState = {
    stories: mockStories,
    currentStory: mockStories[0],
    interactions: mockInteractions,
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

  describe('Stories to Messages Navigation Flow', () => {
    it('allows navigation from stories with unread interactions to messages', async () => {
      const { getByText, getByRole } = render(<TestNavigator />);

      // Start on Stories tab
      await waitFor(() => {
        expect(getByText('My Stories')).toBeTruthy();
        expect(getByText('My Childhood Memory')).toBeTruthy();
      });

      // Should show unread badge on story with interactions
      await waitFor(() => {
        expect(getByText('New')).toBeTruthy();
      });

      // Navigate to Messages tab
      const messagesTab = getByRole('button', { name: /Messages/i });
      fireEvent.press(messagesTab);

      await waitFor(() => {
        expect(getByText('Messages')).toBeTruthy();
        expect(getByText('Comments and questions from your family')).toBeTruthy();
        expect(getByText('Great story!')).toBeTruthy();
        expect(getByText('Can you tell me more about your siblings?')).toBeTruthy();
      });
    });

    it('shows correct notification badges on tabs', async () => {
      const { getByText } = render(<TestNavigator />);

      await waitFor(() => {
        // Should show count badges
        expect(getByText('2')).toBeTruthy(); // Total interactions
        expect(getByText('1')).toBeTruthy(); // Unanswered questions
      });
    });
  });

  describe('Story Detail Navigation Flow', () => {
    it('allows navigation from stories list to story detail', async () => {
      const { getByText } = render(<TestNavigator />);

      // Start on Stories tab
      await waitFor(() => {
        expect(getByText('My Childhood Memory')).toBeTruthy();
      });

      // Tap on story to navigate to detail
      fireEvent.press(getByText('My Childhood Memory'));

      await waitFor(() => {
        expect(mockStoreState.fetchStoryById).toHaveBeenCalledWith('story-1');
        expect(mockStoreState.fetchStoryInteractions).toHaveBeenCalledWith('story-1');
      });
    });

    it('allows navigation from messages to story detail', async () => {
      const { getByText, getByRole } = render(<TestNavigator />);

      // Navigate to Messages tab
      const messagesTab = getByRole('button', { name: /Messages/i });
      fireEvent.press(messagesTab);

      await waitFor(() => {
        expect(getByText('Great story!')).toBeTruthy();
      });

      // Tap on message to navigate to story detail
      fireEvent.press(getByText('Great story!'));

      await waitFor(() => {
        expect(mockStoreState.fetchStoryById).toHaveBeenCalledWith('story-1');
        expect(mockStoreState.fetchStoryInteractions).toHaveBeenCalledWith('story-1');
      });
    });
  });

  describe('Interaction Management Flow', () => {
    it('handles the complete flow from viewing message to recording answer', async () => {
      const mockNavigate = jest.fn();
      
      // Mock navigation for this specific test
      jest.doMock('@react-navigation/native', () => ({
        ...jest.requireActual('@react-navigation/native'),
        useNavigation: () => ({
          navigate: mockNavigate,
        }),
      }));

      const { getByText, getByRole } = render(<TestNavigator />);

      // Navigate to Messages tab
      const messagesTab = getByRole('button', { name: /Messages/i });
      fireEvent.press(messagesTab);

      await waitFor(() => {
        expect(getByText('Can you tell me more about your siblings?')).toBeTruthy();
      });

      // Tap "Record Answer" button
      const recordButton = getByText('Record Answer');
      fireEvent.press(recordButton);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('RecordAnswer', {
          questionId: 'int-2',
          storyId: 'story-1',
        });
      });
    });

    it('marks comments as read when viewed', async () => {
      const { getByText, getByRole } = render(<TestNavigator />);

      // Navigate to Messages tab
      const messagesTab = getByRole('button', { name: /Messages/i });
      fireEvent.press(messagesTab);

      await waitFor(() => {
        expect(getByText('Great story!')).toBeTruthy();
      });

      // Tap on comment message
      fireEvent.press(getByText('Great story!'));

      await waitFor(() => {
        expect(mockStoreState.markInteractionAsRead).toHaveBeenCalledWith('int-1');
      });
    });
  });

  describe('Filter and Search Functionality', () => {
    it('filters messages by type correctly', async () => {
      const { getByText, getByRole, queryByText } = render(<TestNavigator />);

      // Navigate to Messages tab
      const messagesTab = getByRole('button', { name: /Messages/i });
      fireEvent.press(messagesTab);

      await waitFor(() => {
        expect(getByText('Great story!')).toBeTruthy();
        expect(getByText('Can you tell me more about your siblings?')).toBeTruthy();
      });

      // Filter by questions only
      fireEvent.press(getByText('Questions'));

      await waitFor(() => {
        expect(getByText('Can you tell me more about your siblings?')).toBeTruthy();
        expect(queryByText('Great story!')).toBeNull();
      });

      // Filter by comments only
      fireEvent.press(getByText('Comments'));

      await waitFor(() => {
        expect(getByText('Great story!')).toBeTruthy();
        expect(queryByText('Can you tell me more about your siblings?')).toBeNull();
      });
    });

    it('searches stories correctly', async () => {
      const { getByPlaceholderText } = render(<TestNavigator />);

      // Should start on Stories tab
      await waitFor(() => {
        const searchInput = getByPlaceholderText('Search your stories...');
        expect(searchInput).toBeTruthy();
      });

      const searchInput = getByPlaceholderText('Search your stories...');
      fireEvent.changeText(searchInput, 'childhood');

      await waitFor(() => {
        expect(mockStoreState.searchStories).toHaveBeenCalledWith('childhood');
      });
    });
  });

  describe('Accessibility Features', () => {
    it('provides proper accessibility labels for navigation', async () => {
      const { getByRole } = render(<TestNavigator />);

      await waitFor(() => {
        expect(getByRole('button', { name: /Stories/i })).toBeTruthy();
        expect(getByRole('button', { name: /Messages/i })).toBeTruthy();
      });
    });

    it('provides proper accessibility labels for story items', async () => {
      const { getByLabelText } = render(<TestNavigator />);

      await waitFor(() => {
        expect(getByLabelText(/Story: My Childhood Memory/)).toBeTruthy();
        expect(getByLabelText(/Story: Career Journey/)).toBeTruthy();
      });
    });
  });

  describe('Error Handling', () => {
    it('handles errors gracefully across all screens', async () => {
      const mockAlert = jest.spyOn(require('react-native'), 'Alert', 'alert');
      
      mockUseStoryStore.mockReturnValue({
        ...mockStoreState,
        error: 'Network error occurred',
      });

      const { getByRole } = render(<TestNavigator />);

      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith(
          'Error',
          'Network error occurred',
          [{ text: 'OK', onPress: expect.any(Function) }]
        );
      });

      // Navigate to Messages tab to ensure error handling works there too
      const messagesTab = getByRole('button', { name: /Messages/i });
      fireEvent.press(messagesTab);

      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledTimes(2); // Called again for Messages screen
      });
    });
  });

  describe('Data Loading and Refresh', () => {
    it('loads data correctly on initial mount', async () => {
      render(<TestNavigator />);

      await waitFor(() => {
        expect(mockStoreState.fetchStories).toHaveBeenCalled();
      });
    });

    it('refreshes data when pull-to-refresh is triggered', async () => {
      const { getByTestId, getByRole } = render(<TestNavigator />);

      // Test refresh on Stories screen
      await waitFor(() => {
        const storiesList = getByTestId('stories-list');
        fireEvent(storiesList, 'refresh');
      });

      expect(mockStoreState.refreshStories).toHaveBeenCalled();

      // Navigate to Messages and test refresh there
      const messagesTab = getByRole('button', { name: /Messages/i });
      fireEvent.press(messagesTab);

      await waitFor(() => {
        const messagesList = getByTestId('messages-list');
        fireEvent(messagesList, 'refresh');
      });

      expect(mockStoreState.fetchUnreadInteractions).toHaveBeenCalled();
    });
  });

  describe('Empty States', () => {
    it('shows appropriate empty states when no data is available', async () => {
      mockUseStoryStore.mockReturnValue({
        ...mockStoreState,
        stories: [],
        unreadInteractions: [],
      });

      const { getByText, getByRole } = render(<TestNavigator />);

      // Check Stories empty state
      await waitFor(() => {
        expect(getByText('No Stories Yet')).toBeTruthy();
        expect(getByText('Start recording your first story to see it here')).toBeTruthy();
      });

      // Check Messages empty state
      const messagesTab = getByRole('button', { name: /Messages/i });
      fireEvent.press(messagesTab);

      await waitFor(() => {
        expect(getByText('No Messages Yet')).toBeTruthy();
        expect(getByText('Comments and questions from your family will appear here')).toBeTruthy();
      });
    });
  });
});