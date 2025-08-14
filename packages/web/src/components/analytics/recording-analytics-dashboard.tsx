'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { DatePicker } from '../ui/date-picker';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Smartphone,
  Headphones,
  AlertTriangle,
  Info
} from 'lucide-react';

interface RecordingAnalyticsDashboardProps {
  projectId?: string;
  className?: string;
}

interface DashboardData {
  completionMetrics: {
    totalRecordingsSessions: number;
    completedRecordings: number;
    discardedRecordings: number;
    completionRate: number;
    averageRetryCount: number;
    averageReviewDuration: number;
    averageRecordingDuration: number;
  };
  qualityMetrics: {
    totalRecordings: number;
    validRecordings: number;
    qualityIssues: {
      duration: number;
      fileSize: number;
      format: number;
      quality: number;
      corruption: number;
    };
    averageDuration: number;
    averageFileSize: number;
    mostCommonIssues: Array<{
      type: string;
      count: number;
      percentage: number;
    }>;
  };
  deviceMetrics: {
    platformDistribution: {
      ios: number;
      android: number;
    };
    deviceModels: Array<{
      model: string;
      count: number;
      completionRate: number;
    }>;
    environmentFactors: {
      headphonesUsage: number;
      backgroundNoiseDistribution: {
        low: number;
        medium: number;
        high: number;
      };
    };
  };
  insights: {
    insights: string[];
    recommendations: string[];
  };
  dateRange?: {
    start: Date;
    end: Date;
  };
  generatedAt: Date;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export function RecordingAnalyticsDashboard({ projectId, className }: RecordingAnalyticsDashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>({
    start: null,
    end: null,
  });
  const [selectedProject, setSelectedProject] = useState<string>(projectId || 'all');

  useEffect(() => {
    fetchDashboardData();
  }, [selectedProject, dateRange]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (selectedProject !== 'all') {
        params.append('projectId', selectedProject);
      }
      if (dateRange.start) {
        params.append('startDate', dateRange.start.toISOString());
      }
      if (dateRange.end) {
        params.append('endDate', dateRange.end.toISOString());
      }

      const response = await fetch(`/api/recording-analytics/dashboard?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch analytics data');
      }

      const dashboardData = await response.json();
      setData(dashboardData);
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
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-64 ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading analytics data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert className={`${className}`}>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Failed to load analytics data: {error}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchDashboardData}
            className="ml-2"
          >
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!data) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <p className="text-gray-600">No analytics data available</p>
      </div>
    );
  }

  const platformData = [
    { name: 'iOS', value: data.deviceMetrics.platformDistribution.ios, color: '#0088FE' },
    { name: 'Android', value: data.deviceMetrics.platformDistribution.android, color: '#00C49F' },
  ];

  const noiseData = [
    { name: 'Low', value: data.deviceMetrics.environmentFactors.backgroundNoiseDistribution.low },
    { name: 'Medium', value: data.deviceMetrics.environmentFactors.backgroundNoiseDistribution.medium },
    { name: 'High', value: data.deviceMetrics.environmentFactors.backgroundNoiseDistribution.high },
  ];

  const qualityRate = data.qualityMetrics.totalRecordings > 0 
    ? (data.qualityMetrics.validRecordings / data.qualityMetrics.totalRecordings) * 100 
    : 0;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Recording Analytics</h2>
          <p className="text-gray-600">
            Insights into recording behavior and quality metrics
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2">
          <DatePicker
            selected={dateRange.start}
            onSelect={(date) => setDateRange(prev => ({ ...prev, start: date }))}
            placeholderText="Start date"
          />
          <DatePicker
            selected={dateRange.end}
            onSelect={(date) => setDateRange(prev => ({ ...prev, end: date }))}
            placeholderText="End date"
          />
          <Button onClick={fetchDashboardData} variant="outline">
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.completionMetrics.completionRate.toFixed(1)}%
            </div>
            <Progress 
              value={data.completionMetrics.completionRate} 
              className="mt-2"
            />
            <p className="text-xs text-gray-600 mt-1">
              {data.completionMetrics.completedRecordings} of {data.completionMetrics.totalRecordingsSessions} sessions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quality Rate</CardTitle>
            <Badge variant={qualityRate > 80 ? "default" : qualityRate > 60 ? "secondary" : "destructive"}>
              {qualityRate.toFixed(1)}%
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.qualityMetrics.validRecordings}
            </div>
            <p className="text-xs text-gray-600">
              of {data.qualityMetrics.totalRecordings} recordings
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatDuration(data.completionMetrics.averageRecordingDuration)}
            </div>
            <p className="text-xs text-gray-600">
              per recording
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Retry Rate</CardTitle>
            {data.completionMetrics.averageRetryCount > 2 ? (
              <TrendingUp className="h-4 w-4 text-red-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-green-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.completionMetrics.averageRetryCount.toFixed(1)}
            </div>
            <p className="text-xs text-gray-600">
              retries per recording
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Insights and Recommendations */}
      {(data.insights.insights.length > 0 || data.insights.recommendations.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {data.insights.insights.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Key Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {data.insights.insights.map((insight, index) => (
                    <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                      {insight}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {data.insights.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {data.insights.recommendations.map((recommendation, index) => (
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

      {/* Detailed Analytics Tabs */}
      <Tabs defaultValue="quality" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="quality">Quality Analysis</TabsTrigger>
          <TabsTrigger value="devices">Device & Environment</TabsTrigger>
          <TabsTrigger value="behavior">User Behavior</TabsTrigger>
        </TabsList>

        <TabsContent value="quality" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Quality Issues Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(data.qualityMetrics.qualityIssues).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <span className="text-sm capitalize">{type}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-red-500 h-2 rounded-full" 
                            style={{ 
                              width: `${data.qualityMetrics.totalRecordings > 0 ? (count / data.qualityMetrics.totalRecordings) * 100 : 0}%` 
                            }}
                          />
                        </div>
                        <span className="text-sm font-medium">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recording Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Average Duration</span>
                    <span className="font-medium">
                      {formatDuration(data.qualityMetrics.averageDuration)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Average File Size</span>
                    <span className="font-medium">
                      {formatFileSize(data.qualityMetrics.averageFileSize)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total Recordings</span>
                    <span className="font-medium">
                      {data.qualityMetrics.totalRecordings}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Valid Recordings</span>
                    <span className="font-medium text-green-600">
                      {data.qualityMetrics.validRecordings}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="devices" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Platform Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={platformData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {platformData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Environment Factors</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Headphones className="h-4 w-4" />
                      <span className="text-sm">Headphones Usage</span>
                    </div>
                    <span className="font-medium">
                      {data.deviceMetrics.environmentFactors.headphonesUsage.toFixed(1)}%
                    </span>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium mb-2">Background Noise</h4>
                    <div className="space-y-2">
                      {noiseData.map((item) => (
                        <div key={item.name} className="flex items-center justify-between">
                          <span className="text-sm">{item.name}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-blue-500 h-2 rounded-full" 
                                style={{ width: `${item.value}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium">{item.value.toFixed(1)}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {data.deviceMetrics.deviceModels.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Device Models Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.deviceMetrics.deviceModels.slice(0, 10).map((device) => (
                    <div key={device.model} className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-2">
                        <Smartphone className="h-4 w-4" />
                        <span className="text-sm">{device.model}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-600">{device.count} recordings</span>
                        <Badge variant={device.completionRate > 80 ? "default" : "secondary"}>
                          {device.completionRate.toFixed(1)}% completion
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="behavior" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Recording Behavior</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total Sessions</span>
                    <span className="font-medium">
                      {data.completionMetrics.totalRecordingsSessions}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Completed</span>
                    <span className="font-medium text-green-600">
                      {data.completionMetrics.completedRecordings}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Discarded</span>
                    <span className="font-medium text-red-600">
                      {data.completionMetrics.discardedRecordings}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Average Review Time</span>
                    <span className="font-medium">
                      {formatDuration(data.completionMetrics.averageReviewDuration)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Most Common Issues</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.qualityMetrics.mostCommonIssues.slice(0, 5).map((issue, index) => (
                    <div key={issue.type} className="flex items-center justify-between">
                      <span className="text-sm">{issue.type.replace('_', ' ')}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-orange-500 h-2 rounded-full" 
                            style={{ width: `${issue.percentage}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium">{issue.percentage.toFixed(1)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Footer */}
      <div className="text-center text-sm text-gray-500">
        Last updated: {new Date(data.generatedAt).toLocaleString()}
      </div>
    </div>
  );
}