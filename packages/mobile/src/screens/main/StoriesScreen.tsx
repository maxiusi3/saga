import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { useStoryStore } from '../../stores/story-store';
import { useAccessibleTheme } from '../../hooks/useAccessibleTheme';
import { MainStackParamList } from '../../navigation/MainNavigator';
import type { Story } from '@saga/shared/types/story';

type NavigationProp = StackNavigationProp<MainStackParamList>;

interface StoryItemProps {
  story: Story;
  onPress: () => void;
}

function StoryItem({ story, onPress }: StoryItemProps) {
  const theme = useAccessibleTheme();
  
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const hasUnreadInteractions = story.interactions?.some(
    (interaction) => interaction.type === 'followup' && !interaction.answeredAt
  );

  return (
    <TouchableOpacity 
      style={[
        styles.storyItem, 
        { 
          backgroundColor: theme.colors.surface,
          minHeight: theme.minTapTarget,
          ...theme.shadows.sm,
        }
      ]} 
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Story: ${story.title || story.aiPrompt || 'Untitled Story'}, recorded on ${formatDate(story.createdAt)}`}
      accessibilityHint="Tap to view story details"
    >
      <View style={styles.storyHeader}>
        <View style={styles.storyInfo}>
          <Text style={[
            styles.storyTitle, 
            { 
              fontSize: theme.fontSizes.lg, 
              color: theme.colors.text 
            }
          ]} numberOfLines={2}>
            {story.title || story.aiPrompt || 'Untitled Story'}
          </Text>
          <Text style={[
            styles.storyDate, 
            { 
              fontSize: theme.fontSizes.sm, 
              color: theme.colors.textSecondary 
            }
          ]}>
            {formatDate(story.createdAt)}
          </Text>
        </View>
        
        {hasUnreadInteractions && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>New</Text>
          </View>
        )}
      </View>

      <View style={styles.storyContent}>
        {story.photoUrl && (
          <Image source={{ uri: story.photoUrl }} style={styles.storyPhoto} />
        )}
        
        <View style={styles.storyMeta}>
          <View style={styles.audioInfo}>
            <Ionicons name="play-circle-outline" size={16} color="#6b7280" />
            <Text style={styles.duration}>
              {formatDuration(story.audioDuration)}
            </Text>
          </View>
          
          {story.interactions && story.interactions.length > 0 && (
            <View style={styles.interactionInfo}>
              <Ionicons name="chatbubble-outline" size={16} color="#6b7280" />
              <Text style={styles.interactionCount}>
                {story.interactions.length}
              </Text>
            </View>
          )}
        </View>
      </View>

      {story.status === 'processing' && (
        <View style={styles.processingBadge}>
          <Ionicons name="time-outline" size={14} color="#f59e0b" />
          <Text style={styles.processingText}>Processing...</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export function StoriesScreen() {
  const navigation = useNavigation<NavigationProp>();
  const {
    stories,
    isLoading,
    error,
    searchQuery,
    hasMore,
    fetchStories,
    searchStories,
    clearSearch,
    refreshStories,
    clearError,
  } = useStoryStore();

  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchStories();
  }, []);

  useEffect(() => {
    if (error) {
      Alert.alert('Error', error, [{ text: 'OK', onPress: clearError }]);
    }
  }, [error]);

  const handleSearch = useCallback(
    (query: string) => {
      setLocalSearchQuery(query);
      if (query.trim()) {
        searchStories(query.trim());
      } else {
        clearSearch();
      }
    },
    [searchStories, clearSearch]
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshStories();
    setRefreshing(false);
  }, [refreshStories]);

  const handleLoadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      const nextPage = Math.floor(stories.length / 20) + 1;
      fetchStories(nextPage, searchQuery);
    }
  }, [isLoading, hasMore, stories.length, fetchStories, searchQuery]);

  const handleStoryPress = useCallback(
    (storyId: string) => {
      navigation.navigate('StoryDetail', { storyId });
    },
    [navigation]
  );

  const handleRecordPress = useCallback(() => {
    navigation.navigate('MainTabs', { screen: 'Record' });
  }, [navigation]);

  const renderStoryItem = ({ item }: { item: Story }) => (
    <StoryItem story={item} onPress={() => handleStoryPress(item.id)} />
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="library-outline" size={64} color="#d1d5db" />
      <Text style={styles.emptyTitle}>
        {searchQuery ? 'No Stories Found' : 'No Stories Yet'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {searchQuery
          ? `No stories match "${searchQuery}"`
          : 'Start recording your first story to see it here'}
      </Text>
      {!searchQuery && (
        <TouchableOpacity style={styles.recordButton} onPress={handleRecordPress}>
          <Ionicons name="mic" size={20} color="#ffffff" />
          <Text style={styles.recordButtonText}>Record First Story</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderFooter = () => {
    if (!isLoading || stories.length === 0) return null;
    
    return (
      <View style={styles.loadingFooter}>
        <Text style={styles.loadingText}>Loading more stories...</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Stories</Text>
        <Text style={styles.subtitle}>Your recorded memories</Text>
        
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color="#6b7280" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search your stories..."
            value={localSearchQuery}
            onChangeText={handleSearch}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      <FlatList
        testID="stories-list"
        data={stories}
        renderItem={renderStoryItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          stories.length === 0 && styles.emptyListContent,
        ]}
        ListEmptyComponent={renderEmptyState}
        ListFooterComponent={renderFooter}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1f2937',
    paddingVertical: 4,
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
    marginBottom: 32,
  },
  recordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563eb',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  recordButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  storyItem: {
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
  storyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  storyInfo: {
    flex: 1,
    marginRight: 12,
  },
  storyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
    lineHeight: 24,
  },
  storyDate: {
    fontSize: 14,
    color: '#6b7280',
  },
  unreadBadge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  unreadText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  storyContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  storyPhoto: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  storyMeta: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  audioInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  duration: {
    fontSize: 14,
    color: '#6b7280',
  },
  interactionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  interactionCount: {
    fontSize: 14,
    color: '#6b7280',
  },
  processingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  processingText: {
    fontSize: 14,
    color: '#f59e0b',
    fontWeight: '500',
  },
  loadingFooter: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#6b7280',
  },
});