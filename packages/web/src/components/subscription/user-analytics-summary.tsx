'use client';

import React from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { 
  TrendingUp, 
  Users, 
  Mic, 
  MessageSquare, 
  DollarSign,
  Award,
  BarChart3,
  ArrowRight,
  Calendar
} from 'lucide-react';

export interface UserAnalyticsSummary {
  totalProjects: number;
  activeSubscriptions: number;
  totalStoriesRecorded: number;
  totalInteractions: number;
  totalInvestment: number;
  averageEngagement: number;
  topPerformingProject: {
    id: string;
    name: string;
    storiesCount: number;
    engagementRate: number;
  };
  currency: string;
  monthlyTrends: {
    storiesGrowth: number;
    interactionsGrowth: number;
    engagementGrowth: number;
  };
  upcomingRenewals: {
    count: number;
    nextRenewalDate: Date;
    totalValue: number;
  };
}

interface UserAnalyticsSummaryProps {
  summary: UserAnalyticsSummary;
  onViewProject: (projectId: string) => void;
  onViewAllAnalytics: () => void;
  onManageSubscriptions: () => void;
  className?: string;
}

export function UserAnalyticsSummary({
  summary,
  onViewProject,
  onViewAllAnalytics,
  onManageSubscriptions,
  className = ''
}: UserAnalyticsSummaryProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: summary.currency.toUpperCase()
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric'
    }).format(date);
  };

  const getTrendColor = (value: number) => {
    if (value > 0) return 'text-green-600';
    if (value < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const getTrendIcon = (value: number) => {
    if (value > 0) return <TrendingUp className="h-4 w-4 text-green-600" />;
    return <BarChart3 className="h-4 w-4 text-gray-600" />;
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Your Storytelling Journey</h2>
          <p className="text-gray-600">Analytics across all your family projects</p>
        </div>
        <Button onClick={onViewAllAnalytics} variant="outline" size="sm">
          <BarChart3 className="h-4 w-4 mr-2" />
          View All Analytics
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{summary.totalProjects}</div>
          <div className="text-sm text-gray-600 flex items-center justify-center mt-1">
            <Users className="h-4 w-4 mr-1" />
            Total Projects
          </div>
        </Card>
        
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{summary.totalStoriesRecorded}</div>
          <div className="text-sm text-gray-600 flex items-center justify-center mt-1">
            <Mic className="h-4 w-4 mr-1" />
            Stories Recorded
          </div>
          <div className="flex items-center justify-center mt-1">
            {getTrendIcon(summary.monthlyTrends.storiesGrowth)}
            <span className={`text-xs ml-1 ${getTrendColor(summary.monthlyTrends.storiesGrowth)}`}>
              {summary.monthlyTrends.storiesGrowth > 0 ? '+' : ''}{summary.monthlyTrends.storiesGrowth}%
            </span>
          </div>
        </Card>
        
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-purple-600">{summary.totalInteractions}</div>
          <div className="text-sm text-gray-600 flex items-center justify-center mt-1">
            <MessageSquare className="h-4 w-4 mr-1" />
            Family Interactions
          </div>
          <div className="flex items-center justify-center mt-1">
            {getTrendIcon(summary.monthlyTrends.interactionsGrowth)}
            <span className={`text-xs ml-1 ${getTrendColor(summary.monthlyTrends.interactionsGrowth)}`}>
              {summary.monthlyTrends.interactionsGrowth > 0 ? '+' : ''}{summary.monthlyTrends.interactionsGrowth}%
            </span>
          </div>
        </Card>
        
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-orange-600">
            {formatCurrency(summary.totalInvestment)}
          </div>
          <div className="text-sm text-gray-600 flex items-center justify-center mt-1">
            <DollarSign className="h-4 w-4 mr-1" />
            Total Investment
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Performing Project */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Award className="h-5 w-5 mr-2 text-yellow-500" />
              Top Performing Project
            </h3>
            <Button
              onClick={() => onViewProject(summary.topPerformingProject.id)}
              variant="ghost"
              size="sm"
            >
              View Project
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
          
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-gray-900">{summary.topPerformingProject.name}</h4>
              <p className="text-sm text-gray-600">
                {summary.topPerformingProject.storiesCount} stories recorded
              </p>
            </div>
            
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">Engagement Rate</span>
                <span className="font-medium">{Math.round(summary.topPerformingProject.engagementRate)}%</span>
              </div>
              <Progress 
                value={summary.topPerformingProject.engagementRate} 
                className="h-2"
                indicatorClassName="bg-yellow-500"
              />
            </div>
            
            <div className="p-3 bg-yellow-50 rounded-lg">
              <p className="text-sm text-yellow-800">
                🎉 This project has the highest family engagement rate across all your projects!
              </p>
            </div>
          </div>
        </Card>

        {/* Subscription Overview */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Calendar className="h-5 w-5 mr-2 text-blue-500" />
              Subscription Overview
            </h3>
            <Button
              onClick={onManageSubscriptions}
              variant="ghost"
              size="sm"
            >
              Manage All
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-xl font-bold text-green-600">{summary.activeSubscriptions}</div>
                <div className="text-sm text-green-800">Active</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-xl font-bold text-blue-600">{summary.totalProjects - summary.activeSubscriptions}</div>
                <div className="text-sm text-blue-800">Archived</div>
              </div>
            </div>
            
            {summary.upcomingRenewals.count > 0 && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-yellow-900">Upcoming Renewals</span>
                  <Badge variant="secondary">{summary.upcomingRenewals.count}</Badge>
                </div>
                <div className="text-sm text-yellow-800">
                  Next renewal: {formatDate(summary.upcomingRenewals.nextRenewalDate)}
                </div>
                <div className="text-sm text-yellow-800">
                  Total value: {formatCurrency(summary.upcomingRenewals.totalValue)}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Overall Engagement */}
        <Card className="p-6 lg:col-span-2">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Overall Family Engagement</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">
                {Math.round(summary.averageEngagement)}%
              </div>
              <div className="text-sm text-gray-600 mb-3">Average Engagement</div>
              <Progress 
                value={summary.averageEngagement} 
                className="h-3"
                indicatorClassName="bg-blue-500"
              />
              <div className="flex items-center justify-center mt-2">
                {getTrendIcon(summary.monthlyTrends.engagementGrowth)}
                <span className={`text-sm ml-1 ${getTrendColor(summary.monthlyTrends.engagementGrowth)}`}>
                  {summary.monthlyTrends.engagementGrowth > 0 ? '+' : ''}{summary.monthlyTrends.engagementGrowth}% this month
                </span>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Stories per Project</span>
                <span className="font-medium">
                  {Math.round(summary.totalStoriesRecorded / summary.totalProjects)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Interactions per Story</span>
                <span className="font-medium">
                  {Math.round(summary.totalInteractions / summary.totalStoriesRecorded)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Investment per Story</span>
                <span className="font-medium">
                  {formatCurrency(summary.totalInvestment / summary.totalStoriesRecorded)}
                </span>
              </div>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900 text-sm">Quick Actions</h4>
              <Button variant="outline" size="sm" className="w-full justify-start">
                <BarChart3 className="h-4 w-4 mr-2" />
                View Detailed Analytics
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start">
                <Award className="h-4 w-4 mr-2" />
                Share Achievements
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start">
                <TrendingUp className="h-4 w-4 mr-2" />
                Get Engagement Tips
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Insights */}
      <Card className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">💡 Personalized Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-medium text-blue-900 mb-2">Great Progress!</h4>
            <p className="text-sm text-blue-800">
              Your family has recorded {summary.totalStoriesRecorded} stories across {summary.totalProjects} projects. 
              That's an amazing collection of memories!
            </p>
          </div>
          <div>
            <h4 className="font-medium text-purple-900 mb-2">Keep the Momentum</h4>
            <p className="text-sm text-purple-800">
              With {summary.totalInteractions} family interactions, you're building strong connections 
              through storytelling. Consider inviting more family members to join the conversation.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default UserAnalyticsSummary;