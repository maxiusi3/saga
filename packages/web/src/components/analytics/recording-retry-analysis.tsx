'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Alert, AlertDescription } from '../ui/alert';
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
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  TrendingUp,
  TrendingDown,
  Target
} from 'lucide-react';

interface RecordingRetryAnalysisProps {
  projectId?: string;
  className?: string;
}

interface RetryAnalysis {
  averageRetryCount: number;
  maxRetryCount: number;
  retryDistribution: Array<{
    retryCount: number;
    sessionCount: number;
    percentage: number;
  }>;
  retryReasons: Array<{
    reason: string;
    count: number;
    percentage: number;
  }>;
  retryTrend: 'increasing' | 'decreasing' | 'stable';
  timeSeriesData: Array<{
    date: string;
    averageRetries: number;
    sessionCount: number;
  }>;
  successRateByRetries: Array<{
    retryCount: number;
    successRate: number;
    totalSessions: number;
  }>;
  insights: string[];
  recommendations: string[];
}

const COLORS = ['#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

export function RecordingRetryAnalysis({ projectId, className }: RecordingRetryAnalysisProps) {
  const [data, setData] = useState<RetryAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRetryAnalysis();
  }, [projectId]);

  const fetchRetryAnalysis = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (projectId) {
        params.append('projectId', projectId);
      }

      // This would be a specific endpoint for retry analysis
      const response = await fetch(`/api/recording-analytics/retry-analysis?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch retry analysis');
      }

      const analysisData = await response.json();
      setData(analysisData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const getRetryRateColor = (retryCount: number): string => {
    if (retryCount <= 1) return 'text-green-600';
    if (retryCount <= 2) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getRetryRateBadge = (retryCount: number): { variant: 'default' | 'secondary' | 'destructive', text: string } => {
    if (retryCount <= 1) return { variant: 'default', text: 'Excellent' };
    if (retryCount <= 2) return { variant: 'secondary', text: 'Good' };
    return { variant: 'destructive', text: 'Needs Attention' };
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-64 ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Analyzing retry patterns...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert className={className}>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Failed to load retry analysis: {error}
          <button 
            onClick={fetchRetryAnalysis}
            className="ml-2 text-blue-600 hover:text-blue-800 underline"
          >
            Try again
          </button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!data) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center h-64">
          <p className="text-gray-600">No retry data available</p>
        </CardContent>
      </Card>
    );
  }

  const trendIcon = data.retryTrend === 'increasing' ? TrendingUp : 
                   data.retryTrend === 'decreasing' ? TrendingDown : Target;
  const trendColor = data.retryTrend === 'increasing' ? 'text-red-600' : 
                    data.retryTrend === 'decreasing' ? 'text-green-600' : 'text-gray-600';

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Recording Retry Analysis</h3>
          <p className="text-gray-600">Understanding user recording behavior and friction points</p>
        </div>
        <RefreshCw className="h-6 w-6 text-blue-600" />
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Average Retries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getRetryRateColor(data.averageRetryCount)}`}>
              {data.averageRetryCount.toFixed(1)}
            </div>
            <Badge {...getRetryRateBadge(data.averageRetryCount)} className="mt-1">
              {getRetryRateBadge(data.averageRetryCount).text}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Max Retries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {data.maxRetryCount}
            </div>
            <p className="text-xs text-gray-500 mt-1">Highest retry count</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">First-Try Success</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {data.retryDistribution.find(d => d.retryCount === 0)?.percentage.toFixed(1) || '0'}%
            </div>
            <p className="text-xs text-gray-500 mt-1">No retries needed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Retry Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`flex items-center gap-2 ${trendColor}`}>
              {React.createElement(trendIcon, { className: "h-6 w-6" })}
              <span className="text-lg font-semibold capitalize">
                {data.retryTrend}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Retry Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Retry Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.retryDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="retryCount" 
                  tickFormatter={(value) => value === 0 ? 'No Retry' : `${value} Retries`}
                />
                <YAxis />
                <Tooltip 
                  formatter={(value, name) => [
                    `${value} sessions (${data.retryDistribution.find(d => d.sessionCount === value)?.percentage.toFixed(1)}%)`,
                    'Sessions'
                  ]}
                  labelFormatter={(label) => label === 0 ? 'No Retries' : `${label} Retries`}
                />
                <Bar dataKey="sessionCount" fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Success Rate by Retry Count</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.successRateByRetries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="retryCount"
                  tickFormatter={(value) => `${value} Retries`}
                />
                <YAxis 
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip 
                  formatter={(value, name) => [`${value}%`, 'Success Rate']}
                  labelFormatter={(label) => `After ${label} Retries`}
                />
                <Line 
                  type="monotone" 
                  dataKey="successRate" 
                  stroke="#10B981" 
                  strokeWidth={2}
                  dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Retry Reasons */}
      {data.retryReasons.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Common Retry Reasons</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                {data.retryReasons.map((reason, index) => (
                  <div key={reason.reason} className="flex items-center justify-between">
                    <span className="text-sm">{reason.reason}</span>
                    <div className="flex items-center gap-2">
                      <Progress value={reason.percentage} className="w-20" />
                      <span className="text-sm font-medium">{reason.percentage.toFixed(1)}%</span>
                    </div>
                  </div>
                ))}
              </div>
              
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={data.retryReasons}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="percentage"
                    label={({ reason, percentage }) => `${reason}: ${percentage.toFixed(1)}%`}
                  >
                    {data.retryReasons.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value}%`, 'Percentage']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Retry Trend Over Time */}
      <Card>
        <CardHeader>
          <CardTitle>Retry Trend Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.timeSeriesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip 
                formatter={(value, name) => [
                  `${value} average retries`,
                  'Average Retries'
                ]}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Line 
                type="monotone" 
                dataKey="averageRetries" 
                stroke="#EF4444" 
                strokeWidth={2}
                dot={{ fill: '#EF4444', strokeWidth: 2, r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
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
                  Retry Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {data.insights.map((insight, index) => (
                    <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
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
                  <AlertTriangle className="h-4 w-4" />
                  Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {data.recommendations.map((recommendation, index) => (
                    <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-orange-500 rounded-full mt-2 flex-shrink-0" />
                      {recommendation}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Action Items */}
      {data.averageRetryCount > 2 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>High retry rate detected!</strong> Users are retrying recordings {data.averageRetryCount.toFixed(1)} times on average. 
            Consider reviewing the recording interface, quality validation, or providing better guidance to users.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}