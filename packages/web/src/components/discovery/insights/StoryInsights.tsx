'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { api } from '../../../lib/api';

interface StoryInsightsProps {
  storyId: string;
  className?: string;
}

interface StoryStats {
  totalListens: number;
  averageListenDuration: number;
  completionRate: number;
  bookmarkCount: number;
  shareCount: number;
  lastListened: string | null;
  popularTimeRanges: Array<{
    hour: number;
    count: number;
  }>;
  deviceBreakdown: Array<{
    device: string;
    count: number;
  }>;
}

export function StoryInsights({ storyId, className = '' }: StoryInsightsProps) {
  const [stats, setStats] = useState<StoryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStoryStats();
  }, [storyId]);

  const fetchStoryStats = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.get(`/stories/${storyId}/stats`);
      
      if (response.success) {
        setStats(response.data);
      } else {
        setError(response.error || 'Failed to load story statistics');
      }
    } catch (err) {
      console.error('Story stats fetch error:', err);
      setError('Failed to load story statistics');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatPercentage = (value: number) => {
    return `${Math.round(value * 100)}%`;
  };

  if (loading) {
    return (
      <Card className={`story-insights p-4 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-2/3"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </Card>
    );
  }

  if (error || !stats) {
    return (
      <Card className={`story-insights p-4 ${className}`}>
        <div className="text-center text-gray-500">
          <div className="text-sm">Unable to load story insights</div>
          {error && <div className="text-xs text-red-500 mt-1">{error}</div>}
        </div>
      </Card>
    );
  }

  return (
    <Card className={`story-insights p-4 ${className}`}>
      <h3 className="font-semibold text-gray-900 mb-4">Story Insights</h3>
      
      <div className="space-y-4">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {stats.totalListens}
            </div>
            <div className="text-xs text-gray-600">Total Listens</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {formatPercentage(stats.completionRate)}
            </div>
            <div className="text-xs text-gray-600">Completion Rate</div>
          </div>
        </div>

        {/* Engagement Metrics */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Average Listen Duration:</span>
            <span className="font-medium">
              {formatDuration(stats.averageListenDuration)}
            </span>
          </div>
          
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Bookmarks:</span>
            <span className="font-medium">{stats.bookmarkCount}</span>
          </div>
          
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Shares:</span>
            <span className="font-medium">{stats.shareCount}</span>
          </div>
          
          {stats.lastListened && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Last Listened:</span>
              <span className="font-medium">
                {new Date(stats.lastListened).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>

        {/* Device Breakdown */}
        {stats.deviceBreakdown.length > 0 && (
          <div>
            <div className="text-sm font-medium text-gray-700 mb-2">
              Listening Devices
            </div>
            <div className="flex flex-wrap gap-1">
              {stats.deviceBreakdown.map((device, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {device.device}: {device.count}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Popular Times */}
        {stats.popularTimeRanges.length > 0 && (
          <div>
            <div className="text-sm font-medium text-gray-700 mb-2">
              Popular Listening Times
            </div>
            <div className="space-y-1">
              {stats.popularTimeRanges.slice(0, 3).map((timeRange, index) => (
                <div key={index} className="flex justify-between text-xs">
                  <span className="text-gray-600">
                    {timeRange.hour}:00 - {timeRange.hour + 1}:00
                  </span>
                  <span className="font-medium">{timeRange.count} listens</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}