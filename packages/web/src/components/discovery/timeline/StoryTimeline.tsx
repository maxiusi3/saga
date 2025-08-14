'use client';

import React, { useState, useEffect, useRef } from 'react';
import { format, parseISO } from 'date-fns';
import { Card } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { TimelineControls } from './TimelineControls';
import { TimelineItem } from './TimelineItem';
import { useTimeline } from '../../../hooks/use-timeline';

interface TimelineFilters {
  startDate?: string;
  endDate?: string;
  categories?: string[];
  tags?: string[];
  facilitators?: string[];
  projectId?: string;
}

interface StoryTimelineProps {
  projectId?: string;
  className?: string;
}

export function StoryTimeline({ projectId, className = '' }: StoryTimelineProps) {
  const [filters, setFilters] = useState<TimelineFilters>({ projectId });
  const [viewMode, setViewMode] = useState<'horizontal' | 'vertical'>('horizontal');
  const [selectedStory, setSelectedStory] = useState<string | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  
  const {
    timeline,
    loading,
    error,
    refreshTimeline,
    trackInteraction
  } = useTimeline(filters);

  useEffect(() => {
    if (timeline) {
      trackInteraction('view', {
        viewMode,
        storyCount: timeline.totalCount,
        filters
      });
    }
  }, [timeline, viewMode]);

  const handleFilterChange = (newFilters: Partial<TimelineFilters>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    trackInteraction('filter', { filters: updatedFilters });
  };

  const handleStoryClick = (storyId: string) => {
    setSelectedStory(storyId);
    trackInteraction('click_story', { storyId, viewMode });
  };

  const handleZoomToDateRange = (startDate: string, endDate: string) => {
    handleFilterChange({ startDate, endDate });
  };

  if (loading) {
    return (
      <div className={`timeline-container ${className}`}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Loading timeline...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`timeline-container ${className}`}>
        <Card className="p-6 text-center">
          <div className="text-red-600 mb-2">Failed to load timeline</div>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={refreshTimeline} variant="outline">
            Try Again
          </Button>
        </Card>
      </div>
    );
  }

  if (!timeline || timeline.stories.length === 0) {
    return (
      <div className={`timeline-container ${className}`}>
        <TimelineControls
          filters={filters}
          onFilterChange={handleFilterChange}
          categories={timeline?.categories || []}
          facilitators={timeline?.facilitators || []}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
        <Card className="p-8 text-center mt-4">
          <div className="text-gray-500 mb-2">No stories found</div>
          <p className="text-gray-400">Try adjusting your filters or create some stories to get started.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className={`timeline-container ${className}`}>
      {/* Timeline Controls */}
      <TimelineControls
        filters={filters}
        onFilterChange={handleFilterChange}
        categories={timeline.categories}
        facilitators={timeline.facilitators}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {/* Timeline Stats */}
      <div className="timeline-stats mb-6">
        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
          <span>{timeline.totalCount} stories</span>
          <span>
            {format(parseISO(timeline.dateRange.start), 'MMM yyyy')} - 
            {format(parseISO(timeline.dateRange.end), 'MMM yyyy')}
          </span>
          <span>{timeline.categories.length} categories</span>
          <span>{timeline.facilitators.length} facilitators</span>
        </div>
      </div>

      {/* Timeline Visualization */}
      <Card className="timeline-visualization p-6">
        <div
          ref={timelineRef}
          className={`timeline-content ${
            viewMode === 'horizontal' ? 'horizontal-timeline' : 'vertical-timeline'
          }`}
        >
          {viewMode === 'horizontal' ? (
            <HorizontalTimeline
              stories={timeline.stories}
              dateRange={timeline.dateRange}
              onStoryClick={handleStoryClick}
              onZoomToRange={handleZoomToDateRange}
              selectedStory={selectedStory}
            />
          ) : (
            <VerticalTimeline
              stories={timeline.stories}
              onStoryClick={handleStoryClick}
              selectedStory={selectedStory}
            />
          )}
        </div>
      </Card>

      {/* Category Legend */}
      {timeline.categories.length > 0 && (
        <Card className="category-legend p-4 mt-4">
          <h3 className="text-sm font-medium mb-3">Categories</h3>
          <div className="flex flex-wrap gap-2">
            {timeline.categories.map(category => (
              <Badge
                key={category.name}
                variant="outline"
                className="cursor-pointer hover:bg-gray-50"
                style={{ borderColor: category.color, color: category.color }}
                onClick={() => {
                  const isSelected = filters.categories?.includes(category.name);
                  const newCategories = isSelected
                    ? filters.categories?.filter(c => c !== category.name)
                    : [...(filters.categories || []), category.name];
                  handleFilterChange({ categories: newCategories });
                }}
              >
                {category.name} ({category.count})
              </Badge>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// Horizontal Timeline Component
function HorizontalTimeline({
  stories,
  dateRange,
  onStoryClick,
  onZoomToRange,
  selectedStory
}: {
  stories: any[];
  dateRange: { start: string; end: string };
  onStoryClick: (storyId: string) => void;
  onZoomToRange: (start: string, end: string) => void;
  selectedStory: string | null;
}) {
  return (
    <div className="horizontal-timeline-container">
      <div className="timeline-axis relative h-2 bg-gray-200 rounded-full mb-8">
        {stories.map((story, index) => (
          <TimelineItem
            key={story.id}
            story={story}
            position={story.position}
            isSelected={selectedStory === story.id}
            onClick={() => onStoryClick(story.id)}
            layout="horizontal"
          />
        ))}
      </div>
      
      {/* Date markers */}
      <div className="date-markers flex justify-between text-xs text-gray-500 mt-2">
        <span>{format(parseISO(dateRange.start), 'MMM yyyy')}</span>
        <span>{format(parseISO(dateRange.end), 'MMM yyyy')}</span>
      </div>
    </div>
  );
}

// Vertical Timeline Component
function VerticalTimeline({
  stories,
  onStoryClick,
  selectedStory
}: {
  stories: any[];
  onStoryClick: (storyId: string) => void;
  selectedStory: string | null;
}) {
  return (
    <div className="vertical-timeline-container">
      <div className="timeline-axis relative">
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>
        
        {stories.map((story, index) => (
          <div key={story.id} className="relative mb-8">
            <TimelineItem
              story={story}
              position={{ x: 0, y: index * 100 }}
              isSelected={selectedStory === story.id}
              onClick={() => onStoryClick(story.id)}
              layout="vertical"
            />
          </div>
        ))}
      </div>
    </div>
  );
}