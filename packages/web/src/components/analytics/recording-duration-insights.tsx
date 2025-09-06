'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  AreaChart
} from 'recharts';
import { Clock, TrendingUp, TrendingDown, Target, AlertCircle } from 'lucide-react';

interface RecordingDurationInsightsProps {
  projectId?: string;
  className?: string;
}

interface DurationAnalysis {
  averageDuration: number;
  medianDuration: number;
  shortRecordings: number; // < 30 seconds
  optimalRecordings: number; // 30 seconds - 5 minutes
  longRecordings: number; // > 5 minutes
  durationTrend: 'increasing' | 'decreasing' | 'stable';
  distributionData: Array<{
    range: string;
    count: number;
    percentage: number;
  }>;
  timeSeriesData: Array<{
    date: string;
    averageDuration: number;
    recordingCount: number;
  }>;
  insights: string[];
  recommendations: string[];
}

export function RecordingDurationInsights({ projectId, className }: RecordingDurationInsightsProps) {
  const [data, setData] = useState<DurationAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDurationAnalysis();
  }, [projectId]);

  const fetchDurationAnalysis = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (projectId) {
        params.append('projectId', projectId);
      }

      // This would be a specific endpoint for duration analysis
      const response = await fetch(`/api/recording-analytics/duration-analysis?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch duration analysis');
      }

      const analysisData = await response.json();
      setData(analysisData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    if (minutes === 0) {
      return `${seconds}s`;
    } else if (minutes < 60) {
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return `${hours}h ${remainingMinutes}m`;
    }
  };

  const getDurationQualityColor = (duration: number): string => {
    if (duration < 30000) return 'text-destructive'; // Too short
    if (duration > 300000) return 'text-warning'; // Very long
    return 'text-success'; // Optimal
  };

  const getDurationQualityBadge = (duration: number): { variant: 'default' | 'secondary' | 'destructive', text: string } => {
    if (duration < 30000) return { variant: 'destructive', text: 'Too Short' };
    if (duration > 300000) return { variant: 'secondary', text: 'Very Long' };
    return { variant: 'default', text: 'Optimal' };
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-64 ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Analyzing recording durations...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
            <p className="text-destructive">Failed to load duration analysis</p>
            <button 
              onClick={fetchDurationAnalysis}
              className="mt-2 text-primary hover:text-primary/80 underline"
            >
              Try again
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">No duration data available</p>
        </CardContent>
      </Card>
    );
  }

  const trendIcon = data.durationTrend === 'increasing' ? TrendingUp : 
                   data.durationTrend === 'decreasing' ? TrendingDown : Target;
  const trendColor = data.durationTrend === 'increasing' ? 'text-success' : 
                    data.durationTrend === 'decreasing' ? 'text-destructive' : 'text-muted-foreground';

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Recording Duration Analysis</h3>
          <p className="text-muted-foreground">Insights into storytelling length and engagement</p>
        </div>
        <Clock className="h-6 w-6 text-primary" />
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Average Duration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getDurationQualityColor(data.averageDuration)}`}>
              {formatDuration(data.averageDuration)}
            </div>
            <Badge {...getDurationQualityBadge(data.averageDuration)} className="mt-1">
              {getDurationQualityBadge(data.averageDuration).text}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Median Duration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {formatDuration(data.medianDuration)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">50th percentile</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Optimal Length</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {data.optimalRecordings}
            </div>
            <p className="text-xs text-muted-foreground mt-1">30s - 5min recordings</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Duration Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`flex items-center gap-2 ${trendColor}`}>
              {React.createElement(trendIcon, { className: "h-6 w-6" })}
              <span className="text-lg font-semibold capitalize">
                {data.durationTrend}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Duration Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Duration Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.distributionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip 
                  formatter={(value, name) => [
                    `${value} recordings (${data.distributionData.find(d => d.count === value)?.percentage.toFixed(1)}%)`,
                    'Count'
                  ]}
                />
                <Bar dataKey="count" fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Duration Trend Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={data.timeSeriesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis tickFormatter={(value) => formatDuration(value)} />
                <Tooltip 
                  formatter={(value, name) => [
                    formatDuration(value as number),
                    'Average Duration'
                  ]}
                  labelFormatter={(label) => `Date: ${label}`}
                />
                <Area 
                  type="monotone" 
                  dataKey="averageDuration" 
                  stroke="#3B82F6" 
                  fill="#3B82F6" 
                  fillOpacity={0.3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Quality Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Recording Length Quality</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-destructive rounded-full"></div>
                <span className="text-sm">Too Short (&lt; 30s)</span>
              </div>
              <div className="flex items-center gap-2">
                <Progress value={(data.shortRecordings / (data.shortRecordings + data.optimalRecordings + data.longRecordings)) * 100} className="w-20" />
                <span className="text-sm font-medium">{data.shortRecordings}</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-success rounded-full"></div>
                <span className="text-sm">Optimal (30s - 5min)</span>
              </div>
              <div className="flex items-center gap-2">
                <Progress value={(data.optimalRecordings / (data.shortRecordings + data.optimalRecordings + data.longRecordings)) * 100} className="w-20" />
                <span className="text-sm font-medium">{data.optimalRecordings}</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-warning rounded-full"></div>
                <span className="text-sm">Very Long (&gt; 5min)</span>
              </div>
              <div className="flex items-center gap-2">
                <Progress value={(data.longRecordings / (data.shortRecordings + data.optimalRecordings + data.longRecordings)) * 100} className="w-20" />
                <span className="text-sm font-medium">{data.longRecordings}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Insights and Recommendations */}
      {(data.insights.length > 0 || data.recommendations.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {data.insights.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Duration Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {data.insights.map((insight, index) => (
                    <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0" />
                      {insight}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {data.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {data.recommendations.map((recommendation, index) => (
                    <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-warning rounded-full mt-2 flex-shrink-0" />
                      {recommendation}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}