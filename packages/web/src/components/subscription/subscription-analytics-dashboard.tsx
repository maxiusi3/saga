'use client';

import React, { useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { 
  TrendingUp, 
  TrendingDown,
  Calendar,
  Users,
  Mic,
  MessageSquare,
  Clock,
  Target,
  Award,
  BarChart3,
  PieChart,
  Activity,
  Download,
  Filter
} from 'lucide-react';

export interface SubscriptionAnalytics {
  period: {
    start: Date;
    end: Date;
    daysRemaining: number;
    utilizationPercentage: number;
  };
  usage: {
    storiesRecorded: {
      current: number;
      previous: number;
      trend: 'up' | 'down' | 'stable';
      weeklyAverage: number;
    };
    interactionsCreated: {
      current: number;
      previous: number;
      trend: 'up' | 'down' | 'stable';
      weeklyAverage: number;
    };
    facilitatorsActive: {
      current: number;
      total: number;
      engagementRate: number;
    };
    storytellersActive: {
      current: number;
      total: number;
      engagementRate: number;
    };
  };
  engagement: {
    averageStoryLength: number; // in minutes
    responseTime: number; // average hours to respond to stories
    chapterProgress: {
      completed: number;
      total: number;
      currentChapter: string;
    };
    peakActivityDays: string[];
    peakActivityHours: number[];
  };
  milestones: {
    id: string;
    title: string;
    description: string;
    achieved: boolean;
    achievedDate?: Date;
    progress?: number;
    target?: number;
  }[];
  insights: {
    type: 'positive' | 'neutral' | 'suggestion';
    title: string;
    description: string;
    actionable?: boolean;
    actionText?: string;
  }[];
  valueMetrics: {
    totalInvestment: number;
    costPerStory: number;
    costPerInteraction: number;
    projectedValue: number;
    currency: string;
  };
}

interface SubscriptionAnalyticsDashboardProps {
  analytics: SubscriptionAnalytics;
  projectName: string;
  onExportReport: () => void;
  onViewDetails: (metric: string) => void;
  className?: string;
}

export function SubscriptionAnalyticsDashboard({
  analytics,
  projectName,
  onExportReport,
  onViewDetails,
  className = ''
}: SubscriptionAnalyticsDashboardProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'all'>('month');

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: analytics.valueMetrics.currency.toUpperCase()
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric'
    }).format(date);
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      default:
        return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  const getTrendColor = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return 'text-green-600';
      case 'down':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Subscription Analytics</h2>
          <p className="text-gray-600">{projectName}</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value as any)}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="week">Last Week</option>
              <option value="month">Last Month</option>
              <option value="all">All Time</option>
            </select>
          </div>
          <Button onClick={onExportReport} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Subscription Overview */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Subscription Overview</h3>
          <Badge variant="default">
            {analytics.period.daysRemaining} days remaining
          </Badge>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {analytics.period.utilizationPercentage}%
            </div>
            <div className="text-sm text-gray-600">Utilization</div>
            <Progress 
              value={analytics.period.utilizationPercentage} 
              className="mt-2 h-2"
              indicatorClassName="bg-blue-500"
            />
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {analytics.usage.storiesRecorded.current}
            </div>
            <div className="text-sm text-gray-600 flex items-center justify-center">
              <Mic className="h-4 w-4 mr-1" />
              Stories This Period
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {analytics.usage.interactionsCreated.current}
            </div>
            <div className="text-sm text-gray-600 flex items-center justify-center">
              <MessageSquare className="h-4 w-4 mr-1" />
              Interactions
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">
              {Math.round(analytics.engagement.averageStoryLength)}m
            </div>
            <div className="text-sm text-gray-600 flex items-center justify-center">
              <Clock className="h-4 w-4 mr-1" />
              Avg Story Length
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Usage Trends */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <BarChart3 className="h-5 w-5 mr-2 text-gray-600" />
              Usage Trends
            </h3>
            <Button 
              onClick={() => onViewDetails('usage')} 
              variant="ghost" 
              size="sm"
            >
              View Details
            </Button>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Mic className="h-5 w-5 text-blue-600" />
                <div>
                  <div className="font-medium text-gray-900">Stories Recorded</div>
                  <div className="text-sm text-gray-600">
                    {analytics.usage.storiesRecorded.weeklyAverage}/week average
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {getTrendIcon(analytics.usage.storiesRecorded.trend)}
                <span className={`font-medium ${getTrendColor(analytics.usage.storiesRecorded.trend)}`}>
                  {analytics.usage.storiesRecorded.current}
                </span>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <MessageSquare className="h-5 w-5 text-green-600" />
                <div>
                  <div className="font-medium text-gray-900">Family Interactions</div>
                  <div className="text-sm text-gray-600">
                    {analytics.usage.interactionsCreated.weeklyAverage}/week average
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {getTrendIcon(analytics.usage.interactionsCreated.trend)}
                <span className={`font-medium ${getTrendColor(analytics.usage.interactionsCreated.trend)}`}>
                  {analytics.usage.interactionsCreated.current}
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* Engagement Metrics */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Users className="h-5 w-5 mr-2 text-gray-600" />
              Family Engagement
            </h3>
            <Button 
              onClick={() => onViewDetails('engagement')} 
              variant="ghost" 
              size="sm"
            >
              View Details
            </Button>
          </div>
          
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">Facilitators Active</span>
                <span className="font-medium">
                  {analytics.usage.facilitatorsActive.current} / {analytics.usage.facilitatorsActive.total}
                </span>
              </div>
              <Progress 
                value={analytics.usage.facilitatorsActive.engagementRate} 
                className="h-2"
                indicatorClassName="bg-blue-500"
              />
            </div>
            
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">Storytellers Active</span>
                <span className="font-medium">
                  {analytics.usage.storytellersActive.current} / {analytics.usage.storytellersActive.total}
                </span>
              </div>
              <Progress 
                value={analytics.usage.storytellersActive.engagementRate} 
                className="h-2"
                indicatorClassName="bg-green-500"
              />
            </div>
            
            <div className="pt-2 border-t border-gray-200">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Avg Response Time</span>
                <span className="font-medium text-blue-600">
                  {Math.round(analytics.engagement.responseTime)}h
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* Chapter Progress */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Target className="h-5 w-5 mr-2 text-gray-600" />
              Chapter Progress
            </h3>
            <Button 
              onClick={() => onViewDetails('chapters')} 
              variant="ghost" 
              size="sm"
            >
              View Details
            </Button>
          </div>
          
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">Chapters Completed</span>
                <span className="font-medium">
                  {analytics.engagement.chapterProgress.completed} / {analytics.engagement.chapterProgress.total}
                </span>
              </div>
              <Progress 
                value={(analytics.engagement.chapterProgress.completed / analytics.engagement.chapterProgress.total) * 100} 
                className="h-3"
                indicatorClassName="bg-purple-500"
              />
            </div>
            
            <div className="p-3 bg-purple-50 rounded-lg">
              <div className="text-sm font-medium text-purple-900">Current Chapter</div>
              <div className="text-sm text-purple-800 mt-1">
                {analytics.engagement.chapterProgress.currentChapter}
              </div>
            </div>
          </div>
        </Card>

        {/* Value Metrics */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <PieChart className="h-5 w-5 mr-2 text-gray-600" />
              Value Analysis
            </h3>
            <Button 
              onClick={() => onViewDetails('value')} 
              variant="ghost" 
              size="sm"
            >
              View Details
            </Button>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Investment</span>
              <span className="font-medium text-gray-900">
                {formatCurrency(analytics.valueMetrics.totalInvestment)}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-600">Cost per Story</span>
              <span className="font-medium text-blue-600">
                {formatCurrency(analytics.valueMetrics.costPerStory)}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-600">Cost per Interaction</span>
              <span className="font-medium text-green-600">
                {formatCurrency(analytics.valueMetrics.costPerInteraction)}
              </span>
            </div>
            
            <div className="pt-2 border-t border-gray-200">
              <div className="flex justify-between">
                <span className="text-gray-600">Projected Value</span>
                <span className="font-medium text-purple-600">
                  {formatCurrency(analytics.valueMetrics.projectedValue)}
                </span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Milestones */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Award className="h-5 w-5 mr-2 text-gray-600" />
            Milestones & Achievements
          </h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {analytics.milestones.map((milestone) => (
            <div
              key={milestone.id}
              className={`p-4 rounded-lg border-2 ${
                milestone.achieved
                  ? 'bg-green-50 border-green-200'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <h4 className={`font-medium ${
                  milestone.achieved ? 'text-green-900' : 'text-gray-900'
                }`}>
                  {milestone.title}
                </h4>
                {milestone.achieved && (
                  <Award className="h-5 w-5 text-green-600" />
                )}
              </div>
              
              <p className={`text-sm mb-3 ${
                milestone.achieved ? 'text-green-800' : 'text-gray-600'
              }`}>
                {milestone.description}
              </p>
              
              {milestone.achieved ? (
                <div className="text-xs text-green-700">
                  Achieved {milestone.achievedDate && formatDate(milestone.achievedDate)}
                </div>
              ) : milestone.progress !== undefined && milestone.target && (
                <div>
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span>Progress</span>
                    <span>{milestone.progress} / {milestone.target}</span>
                  </div>
                  <Progress 
                    value={(milestone.progress / milestone.target) * 100} 
                    className="h-2"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Insights & Recommendations */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Insights & Recommendations</h3>
        
        <div className="space-y-3">
          {analytics.insights.map((insight, index) => (
            <div
              key={index}
              className={`p-4 rounded-lg border ${
                insight.type === 'positive'
                  ? 'bg-green-50 border-green-200'
                  : insight.type === 'suggestion'
                  ? 'bg-blue-50 border-blue-200'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className={`font-medium mb-1 ${
                    insight.type === 'positive'
                      ? 'text-green-900'
                      : insight.type === 'suggestion'
                      ? 'text-blue-900'
                      : 'text-gray-900'
                  }`}>
                    {insight.title}
                  </h4>
                  <p className={`text-sm ${
                    insight.type === 'positive'
                      ? 'text-green-800'
                      : insight.type === 'suggestion'
                      ? 'text-blue-800'
                      : 'text-gray-600'
                  }`}>
                    {insight.description}
                  </p>
                </div>
                
                {insight.actionable && insight.actionText && (
                  <Button
                    variant="outline"
                    size="sm"
                    className={`ml-4 ${
                      insight.type === 'suggestion'
                        ? 'text-blue-700 border-blue-300 hover:bg-blue-100'
                        : ''
                    }`}
                  >
                    {insight.actionText}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export default SubscriptionAnalyticsDashboard;