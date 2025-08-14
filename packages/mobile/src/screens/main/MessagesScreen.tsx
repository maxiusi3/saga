import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { useStoryStore } from '../../stores/story-store';
import { MainStackParamList } from '../../navigation/MainNavigator';
import type { Interaction } from '@saga/shared/types/interaction';

type NavigationProp = StackNavigationProp<MainStackParamList>;

interface MessageItemProps {
  interaction: Interaction;
  storyTitle?: string;
  onPress: () => void;
  onAnswerPress?: () => void;
}

function MessageItem({ interaction, storyTitle, onPress, onAnswerPress }: MessageItemProps) {
  const formatDate = (date: Date) => {
    const now = new Date();
    const messageDate = new Date(date);
    const diffInHours = (now.getTime() - messageDate.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return messageDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      });
    } else if (diffInHours < 168) { // 7 days
      return messageDate.toLocaleDateString('en-US', {
        weekday: 'short',
        hour: 'numeric',
        minute: '2-digit',
      });
    } else {
      return messageDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    }
  };

  const isFollowUp = interaction.type === 'followup';
  const isAnswered = interaction.answeredAt;
  const needsAnswer = isFollowUp && !isAnswered;

  return (
    <TouchableOpacity style={styles.messageItem} onPress={onPress}>
      <View style={styles.messageHeader}>
        <View style={styles.messageType}>
          <Ionicons
            name={isFollowUp ? 'help-circle' : 'chatbubble'}
            size={20}
            color={isFollowUp ? '#f59e0b' : '#10b981'}
          />
          <View style={styles.messageInfo}>
            <Text style={[
              styles.messageTypeText,
              isFollowUp && styles.followUpTypeText,
            ]}>
              {isFollowUp ? 'Follow-up Question' : 'Comment'}
            </Text>
            {storyTitle && (
              <Text style={styles.storyTitle} numberOfLines={1}>
                {storyTitle}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.messageStatus}>
          <Text style={styles.messageDate}>{formatDate(interaction.createdAt)}</Text>
          {needsAnswer && (
            <View style={styles.needsAnswerBadge}>
              <Text style={styles.needsAnswerText}>Answer</Text>
            </View>
          )}
        </View>
      </View>

      <Text style={styles.messageContent} numberOfLines={3}>
        {interaction.content}
      </Text>

      {needsAnswer && onAnswerPress && (
        <TouchableOpacity style={styles.quickAnswerButton} onPress={onAnswerPress}>
          <Ionicons name="mic" size={16} color="#ffffff" />
          <Text style={styles.quickAnswerText}>Record Answer</Text>
        </TouchableOpacity>
      )}

      {isFollowUp && isAnswered && (
        <View style={styles.answeredIndicator}>
          <Ionicons name="checkmark-circle" size={16} color="#10b981" />
          <Text style={styles.answeredText}>
            Answered {formatDate(interaction.answeredAt!)}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export function MessagesScreen() {
  const navigation = useNavigation<NavigationProp>();
  const {
    unreadInteractions,
    stories,
    isLoading,
    error,
    fetchUnreadInteractions,
    fetchStories,
    markInteractionAsRead,
    clearError,
  } = useStoryStore();

  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'questions' | 'comments'>('all');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (error) {
      Alert.alert('Error', error, [{ text: 'OK', onPress: clearError }]);
    }
  }, [error]);

  const loadData = async () => {
    await Promise.all([
      fetchUnreadInteractions(),
      fetchStories(),
    ]);
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  const handleMessagePress = useCallback(
    async (interaction: Interaction) => {
      // Mark as read when viewing
      if (interaction.type === 'comment') {
        await markInteractionAsRead(interaction.id);
      }
      
      navigation.navigate('StoryDetail', { storyId: interaction.storyId });
    },
    [navigation, markInteractionAsRead]
  );

  const handleAnswerPress = useCallback(
    (interaction: Interaction) => {
      navigation.navigate('RecordAnswer', {
        questionId: interaction.id,
        storyId: interaction.storyId,
      });
    },
    [navigation]
  );

  const getStoryTitle = (storyId: string) => {
    const story = stories.find(s => s.id === storyId);
    return story?.title || story?.aiPrompt || 'Untitled Story';
  };

  const filteredInteractions = unreadInteractions.filter((interaction) => {
    if (filter === 'questions') return interaction.type === 'followup';
    if (filter === 'comments') return interaction.type === 'comment';
    return true;
  });

  const unansweredQuestions = unreadInteractions.filter(
    (interaction) => interaction.type === 'followup' && !interaction.answeredAt
  ).length;

  const renderMessageItem = ({ item }: { item: Interaction }) => (
    <MessageItem
      interaction={item}
      storyTitle={getStoryTitle(item.storyId)}
      onPress={() => handleMessagePress(item)}
      onAnswerPress={
        item.type === 'followup' && !item.answeredAt
          ? () => handleAnswerPress(item)
          : undefined
      }
    />
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="chatbubbles-outline" size={64} color="#d1d5db" />
      <Text style={styles.emptyTitle}>
        {filter === 'all' ? 'No Messages Yet' : 
         filter === 'questions' ? 'No Questions Yet' : 'No Comments Yet'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {filter === 'all' 
          ? 'Comments and questions from your family will appear here'
          : filter === 'questions'
          ? 'Follow-up questions from your family will appear here'
          : 'Comments from your family will appear here'
        }
      </Text>
    </View>
  );

  const renderFilterButton = (
    filterType: 'all' | 'questions' | 'comments',
    label: string,
    count?: number
  ) => (
    <TouchableOpacity
      style={[
        styles.filterButton,
        filter === filterType && styles.activeFilterButton,
      ]}
      onPress={() => setFilter(filterType)}
    >
      <Text style={[
        styles.filterButtonText,
        filter === filterType && styles.activeFilterButtonText,
      ]}>
        {label}
      </Text>
      {count !== undefined && count > 0 && (
        <View style={styles.filterBadge}>
          <Text style={styles.filterBadgeText}>{count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
        <Text style={styles.subtitle}>
          Comments and questions from your family
        </Text>

        {/* Filter Buttons */}
        <View style={styles.filterContainer}>
          {renderFilterButton('all', 'All', unreadInteractions.length)}
          {renderFilterButton('questions', 'Questions', unansweredQuestions)}
          {renderFilterButton('comments', 'Comments')}
        </View>
      </View>

      <FlatList
        testID="messages-list"
        data={filteredInteractions}
        renderItem={renderMessageItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          filteredInteractions.length === 0 && styles.emptyListContent,
        ]}
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 16,
  },
  filterContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    gap: 6,
  },
  activeFilterButton: {
    backgroundColor: '#2563eb',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  activeFilterButtonText: {
    color: '#ffffff',
  },
  filterBadge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  filterBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  listContent: {
    padding: 20,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  messageItem: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  messageType: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    flex: 1,
  },
  messageInfo: {
    flex: 1,
  },
  messageTypeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10b981',
    marginBottom: 2,
  },
  followUpTypeText: {
    color: '#f59e0b',
  },
  storyTitle: {
    fontSize: 12,
    color: '#6b7280',
  },
  messageStatus: {
    alignItems: 'flex-end',
    gap: 4,
  },
  messageDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  needsAnswerBadge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  needsAnswerText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '600',
  },
  messageContent: {
    fontSize: 16,
    color: '#1f2937',
    lineHeight: 24,
    marginBottom: 12,
  },
  quickAnswerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
    alignSelf: 'flex-start',
  },
  quickAnswerText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  answeredIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  answeredText: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '500',
  },
});