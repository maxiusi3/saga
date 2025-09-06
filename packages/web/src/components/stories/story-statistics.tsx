'use client';

import React from 'react';
import { Story } from '@saga/shared';

interface StoryStatistics {
  totalDuration: number;
  averageDuration: number;
  totalStories: number;
  interactionCount: number;
  completionRate: number;
  engagementScore: number;
  topChapters: Array<{
    chapterId: string;
    chapterName: string;
    storyCount: number;
    averageDuration: number;
  }>;
  recentActivity: Array<{
    date: string;
    storiesCount: number;
    interactionsCount: number;
  }>;
}

interface StoryStatisticsProps {
  projectId: string;
  statistics: StoryStatistics;
  stories: Story[];
}

export const StoryStatisticsPanel: React.FC<StoryStatisticsProps> = ({
  projectId,
  statistics,
  stories
}) => {
  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatPercentage = (value: number): string => {
    return `${Math.round(value * 100)}%`;
  };

  return (
    <div className="bg-card rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-foreground mb-6">Story Insights</h3>
      
      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="text-center p-4 bg-primary/10 rounded-lg">
          <div className="text-2xl font-bold text-primary">
            {statistics.totalStories}
          </div>
          <div className="text-sm text-muted-foreground">Total Stories</div>
        </div>
        
        <div className="text-center p-4 bg-success/10 rounded-lg">
          <div className="text-2xl font-bold text-success">
            {formatDuration(statistics.totalDuration)}
          </div>
          <div className="text-sm text-muted-foreground">Total Duration</div>
        </div>
        
        <div className="text-center p-4 bg-violet-500/10 rounded-lg">
          <div className="text-2xl font-bold text-violet-500">
            {statistics.interactionCount}
          </div>
          <div className="text-sm text-muted-foreground">Interactions</div>
        </div>
        
        <div className="text-center p-4 bg-warning/10 rounded-lg">
          <div className="text-2xl font-bold text-warning">
            {formatPercentage(statistics.engagementScore)}
          </div>
          <div className="text-sm text-muted-foreground">Engagement</div>
        </div>
      </div>

      {/* Chapter Breakdown */}
      <div className="mb-6">
        <h4 className="font-medium text-foreground mb-3">Chapter Breakdown</h4>
        <div className="space-y-2">
          {statistics.topChapters.map(chapter => (
            <div key={chapter.chapterId} className="flex items-center justify-between p-3 bg-muted rounded">
              <div>
                <div className="font-medium text-sm">{chapter.chapterName}</div>
                <div className="text-xs text-muted-foreground">
                  {chapter.storyCount} stories • Avg {formatDuration(chapter.averageDuration)}
                </div>
              </div>
              <div className="text-right">
                <div className="w-16 bg-muted rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full"
                    style={{ 
                      width: `${Math.min(100, (chapter.storyCount / statistics.totalStories) * 100)}%` 
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="mb-6">
        <h4 className="font-medium text-foreground mb-3">Recent Activity</h4>
        <div className="space-y-2">
          {statistics.recentActivity.slice(0, 5).map((activity, index) => (
            <div key={index} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {new Date(activity.date).toLocaleDateString()}
              </span>
              <div className="flex space-x-4">
                <span className="text-primary">
                  {activity.storiesCount} stories
                </span>
                <span className="text-success">
                  {activity.interactionsCount} interactions
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quality Metrics */}
      <div>
        <h4 className="font-medium text-foreground mb-3">Quality Metrics</h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-muted rounded">
            <div className="text-sm text-muted-foreground">Average Duration</div>
            <div className="font-semibold">
              {formatDuration(statistics.averageDuration)}
            </div>
          </div>
          <div className="p-3 bg-muted rounded">
            <div className="text-sm text-muted-foreground">Completion Rate</div>
            <div className="font-semibold">
              {formatPercentage(statistics.completionRate)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};