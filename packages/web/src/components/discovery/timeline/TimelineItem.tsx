'use client';

import React from 'react';
import { format, parseISO } from 'date-fns';
import { Card } from '../../ui/card';
import { Badge } from '../../ui/badge';

interface TimelineStory {
  id: string;
  title: string;
  description?: string;
  createdAt: string;
  duration?: number;
  facilitatorName: string;
  facilitatorId: string;
  categories: string[];
  tags: string[];
  thumbnailUrl?: string;
  chapterTitle?: string;
  position: {
    x: number;
    y: number;
  };
}

interface TimelineItemProps {
  story: TimelineStory;
  position: { x: number; y: number };
  isSelected: boolean;
  onClick: () => void;
  layout: 'horizontal' | 'vertical';
}

export function TimelineItem({
  story,
  position,
  isSelected,
  onClick,
  layout
}: TimelineItemProps) {
  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (layout === 'horizontal') {
    return (
      <div
        className="absolute transform -translate-x-1/2"
        style={{
          left: `${position.x}%`,
          top: `${position.y}px`
        }}
      >
        {/* Timeline dot */}
        <div
          className={`w-4 h-4 rounded-full border-2 cursor-pointer transition-all duration-200 ${
            isSelected
              ? 'bg-primary border-primary scale-125'
              : 'bg-background border-border hover:border-primary'
          }`}
          onClick={onClick}
        />
        
        {/* Story card */}
        <Card
          className={`mt-4 p-3 w-64 cursor-pointer transition-all duration-200 ${
            isSelected
              ? 'ring-2 ring-primary shadow-lg'
              : 'hover:shadow-md hover:ring-1 hover:ring-border'
          }`}
          onClick={onClick}
        >
          <div className="space-y-2">
            {/* Story header */}
            <div className="flex items-start justify-between">
              <h4 className="font-medium text-sm line-clamp-2 flex-1">
                {story.title || 'Untitled Story'}
              </h4>
              {story.duration && (
                <Badge variant="secondary" className="text-xs ml-2">
                  {formatDuration(story.duration)}
                </Badge>
              )}
            </div>
            
            {/* Story metadata */}
            <div className="text-xs text-muted-foreground space-y-1">
              <div>{format(parseISO(story.createdAt), 'MMM d, yyyy')}</div>
              <div>by {story.facilitatorName}</div>
              {story.chapterTitle && (
                <div className="text-primary">{story.chapterTitle}</div>
              )}
            </div>
            
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
            
            {/* Description preview */}
            {story.description && (
              <p className="text-xs text-muted-foreground line-clamp-2">
                {story.description}
              </p>
            )}
          </div>
        </Card>
      </div>
    );
  }

  // Vertical layout
  return (
    <div className="flex items-start gap-4">
      {/* Timeline dot */}
      <div className="relative flex-shrink-0">
        <div
          className={`w-4 h-4 rounded-full border-2 cursor-pointer transition-all duration-200 ${
            isSelected
              ? 'bg-primary border-primary scale-125'
              : 'bg-background border-border hover:border-primary'
          }`}
          onClick={onClick}
        />
      </div>
      
      {/* Story card */}
      <Card
        className={`flex-1 p-4 cursor-pointer transition-all duration-200 ${
          isSelected
            ? 'ring-2 ring-primary shadow-lg'
            : 'hover:shadow-md hover:ring-1 hover:ring-border'
        }`}
        onClick={onClick}
      >
        <div className="space-y-3">
          {/* Story header */}
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h4 className="font-medium text-base mb-1">
                {story.title || 'Untitled Story'}
              </h4>
              <div className="text-sm text-muted-foreground">
                {format(parseISO(story.createdAt), 'MMMM d, yyyy')} • by {story.facilitatorName}
              </div>
            </div>
            {story.duration && (
              <Badge variant="secondary" className="ml-4">
                {formatDuration(story.duration)}
              </Badge>
            )}
          </div>
          
          {/* Chapter info */}
          {story.chapterTitle && (
            <div className="text-sm text-primary font-medium">
              {story.chapterTitle}
            </div>
          )}
          
          {/* Description */}
          {story.description && (
            <p className="text-sm text-muted-foreground line-clamp-3">
              {story.description}
            </p>
          )}
          
          {/* Categories and tags */}
          <div className="flex flex-wrap gap-2">
            {story.categories.map(category => (
              <Badge key={category} variant="outline" className="text-xs">
                {category}
              </Badge>
            ))}
            {story.tags.slice(0, 3).map(tag => (
              <Badge key={tag} variant="secondary" className="text-xs">
                #{tag}
              </Badge>
            ))}
            {story.tags.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{story.tags.length - 3} more
              </Badge>
            )}
          </div>
          
          {/* Thumbnail if available */}
          {story.thumbnailUrl && (
            <div className="mt-3">
              <img
                src={story.thumbnailUrl}
                alt="Story thumbnail"
                className="w-full h-32 object-cover rounded-md"
              />
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}