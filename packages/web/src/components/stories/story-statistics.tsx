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
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Story Insights</h3>
      
      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="text-center p-4 bg-blue-50 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">
            {statistics.totalStories}
          </div>
          <div className="text-sm text-gray-600">Total Stories</div>
        </div>
        
        <div className="text-center p-4 bg-green-50 rounded-lg">
          <div className="text-2xl font-bold text-green-600">
            {formatDuration(statistics.totalDuration)}
          </div>
          <div className="text-sm text-gray-600">Total Duration</div>
        </div>
        
        <div className="text-center p-4 bg-purple-50 rounded-lg">
          <div className="text-2xl font-bold text-purple-600">
            {statistics.interactionCount}
          </div>
          <div className="text-sm text-gray-600">Interactions</div>
        </div>
        
        <div className="text-center p-4 bg-orange-50 rounded-lg">
          <div className="text-2xl font-bold text-orange-600">
            {formatPercentage(statistics.engagementScore)}
          </div>
          <div className="text-sm text-gray-600">Engagement</div>
        </div>
      </div>

      {/* Chapter Breakdown */}
      <div className="mb-6">
        <h4 className="font-medium text-gray-900 mb-3">Chapter Breakdown</h4>
        <div className="space-y-2">
          {statistics.topChapters.map(chapter => (
            <div key={chapter.chapterId} className="flex items-center justify-between p-3 bg-gray-50 rounded">
              <div>
                <div className="font-medium text-sm">{chapter.chapterName}</div>
                <div className="text-xs text-gray-500">
                  {chapter.storyCount} stories • Avg {formatDuration(chapter.averageDuration)}
                </div>
              </div>
              <div className="text-right">
                <div className="w-16 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full"
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
        <h4 className="font-medium text-gray-900 mb-3">Recent Activity</h4>
        <div className="space-y-2">
          {statistics.recentActivity.slice(0, 5).map((activity, index) => (
            <div key={index} className="flex items-center justify-between text-sm">
              <span className="text-gray-600">
                {new Date(activity.date).toLocaleDateString()}
              </span>
              <div className="flex space-x-4">
                <span className="text-blue-600">
                  {activity.storiesCount} stories
                </span>
                <span className="text-green-600">
                  {activity.interactionsCount} interactions
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quality Metrics */}
      <div>
        <h4 className="font-medium text-gray-900 mb-3">Quality Metrics</h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-gray-50 rounded">
            <div className="text-sm text-gray-600">Average Duration</div>
            <div className="font-semibold">
              {formatDuration(statistics.averageDuration)}
            </div>
          </div>
          <div className="p-3 bg-gray-50 rounded">
            <div className="text-sm text-gray-600">Completion Rate</div>
            <div className="font-semibold">
              {formatPercentage(statistics.completionRate)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};