'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { useRecommendations } from '../../../hooks/use-recommendations';
import { format, parseISO } from 'date-fns';

interface StoryRecommendationsProps {
  projectId?: string;
  limit?: number;
  className?: string;
}

export function StoryRecommendations({ 
  projectId, 
  limit = 6, 
  className = '' 
}: StoryRecommendationsProps) {
  const [dismissedStories, setDismissedStories] = useState<Set<string>>(new Set());
  
  const {
    recommendations,
    loading,
    error,
    refreshRecommendations,
    trackInteraction
  } = useRecommendations({
    projectId,
    limit,
    excludeViewed: true
  });

  const handleStoryClick = async (storyId: string) => {
    await trackInteraction(storyId, 'click');
    // Navigate to story detail page
    window.location.href = `/dashboard/stories/${storyId}`;
  };

  const handleDismiss = async (storyId: string) => {
    await trackInteraction(storyId, 'dismiss');
    setDismissedStories(prev => new Set([...prev, storyId]));
  };

  const handleLike = async (storyId: string) => {
    await trackInteraction(storyId, 'like');
  };

  const handleDislike = async (storyId: string) => {
    await trackInteraction(storyId, 'dislike');
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className={`recommendations-container ${className}`}>
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Loading recommendations...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`recommendations-container ${className}`}>
        <Card className="p-4 text-center">
          <div className="text-red-600 mb-2">Failed to load recommendations</div>
          <p className="text-gray-600 mb-3 text-sm">{error}</p>
          <Button onClick={refreshRecommendations} variant="outline" size="sm">
            Try Again
          </Button>
        </Card>
      </div>
    );
  }

  const visibleRecommendations = recommendations?.recommendations.filter(
    story => !dismissedStories.has(story.id)
  ) || [];

  if (visibleRecommendations.length === 0) {
    return (
      <div className={`recommendations-container ${className}`}>
        <Card className="p-6 text-center">
          <div className="text-gray-500 mb-2">No recommendations available</div>
          <p className="text-gray-400 text-sm">
            Listen to more stories to get personalized recommendations.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className={`recommendations-container ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Recommended for You
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={refreshRecommendations}
          className="text-xs"
        >
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleRecommendations.map((story) => (
          <Card
            key={story.id}
            className="recommendation-card p-4 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => handleStoryClick(story.id)}
          >
            <div className="space-y-3">
              {/* Story header */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-medium text-sm line-clamp-2 mb-1">
                    {story.title || 'Untitled Story'}
                  </h4>
                  <div className="text-xs text-gray-500">
                    {format(parseISO(story.createdAt), 'MMM d, yyyy')} • by {story.facilitatorName}
                  </div>
                </div>
                
                {/* Dismiss button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDismiss(story.id);
                  }}
                  className="text-gray-400 hover:text-gray-600 ml-2"
                  title="Dismiss recommendation"
                >
                  ×
                </button>
              </div>

              {/* Chapter and duration */}
              <div className="flex items-center justify-between">
                {story.chapterTitle && (
                  <div className="text-xs text-blue-600 font-medium">
                    {story.chapterTitle}
                  </div>
                )}
                {story.duration && (
                  <Badge variant="secondary" className="text-xs">
                    {formatDuration(story.duration)}
                  </Badge>
                )}
              </div>

              {/* Description */}
              {story.description && (
                <p className="text-xs text-gray-600 line-clamp-2">
                  {story.description}
                </p>
              )}

              {/* Categories */}
              {story.categories.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {story.categories.slice(0, 2).map(category => (
                    <Badge key={category} variant="outline" className="text-xs">
                      {category}
                    </Badge>
                  ))}
                  {story.categories.length > 2 && (
                    <Badge variant="outline" className="text-xs">
                      +{story.categories.length - 2}
                    </Badge>
                  )}
                </div>
              )}

              {/* Recommendation reasoning */}
              <div className="text-xs text-gray-500 italic">
                {story.reasoning.join(', ')}
              </div>

              {/* Recommendation score */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <div className="text-xs text-gray-500">
                    Match: {Math.round(story.score * 100)}%
                  </div>
                </div>
                
                {/* Like/Dislike buttons */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLike(story.id);
                    }}
                    className="text-gray-400 hover:text-green-600 text-sm"
                    title="Like this recommendation"
                  >
                    👍
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDislike(story.id);
                    }}
                    className="text-gray-400 hover:text-red-600 text-sm"
                    title="Dislike this recommendation"
                  >
                    👎
                  </button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Algorithm info */}
      {recommendations && (
        <div className="mt-4 text-xs text-gray-500 text-center">
          Recommendations generated using {recommendations.algorithm} algorithm
        </div>
      )}
    </div>
  );
}