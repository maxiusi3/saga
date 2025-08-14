'use client';

import React, { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '../../../../../../components/ui/card';
import { Button } from '../../../../../../components/ui/button';
import { Loading } from '../../../../../../components/ui/loading';
import { SubscriptionAnalyticsDashboard } from '../../../../../../components/subscription/subscription-analytics-dashboard';
import { useSubscriptionAnalytics, useAnalyticsTracking } from '../../../../../../hooks/use-subscription-analytics';
import { useSubscription } from '../../../../../../hooks/use-subscription';
import { ArrowLeft, BarChart3, AlertTriangle } from 'lucide-react';

export default function SubscriptionAnalyticsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const { subscription, loading: subscriptionLoading } = useSubscription({ projectId });
  
  const {
    analytics,
    loading: analyticsLoading,
    error: analyticsError,
    refresh,
    updateFilters,
    exportReport,
    getDetailedMetrics
  } = useSubscriptionAnalytics({ 
    projectId, 
    autoRefresh: true,
    refreshInterval: 300000 // 5 minutes
  });

  const { trackSubscriptionEvent } = useAnalyticsTracking();

  const loading = subscriptionLoading || analyticsLoading;
  const projectName = subscription?.projectName || 'Project';

  // Track page view
  useEffect(() => {
    if (projectId) {
      trackSubscriptionEvent('viewed_analytics', projectId);
    }
  }, [projectId, trackSubscriptionEvent]);

  const handleExportReport = async () => {
    try {
      await exportReport('pdf');
      trackSubscriptionEvent('exported_report', projectId, { format: 'pdf' });
    } catch (error) {
      console.error('Failed to export report:', error);
    }
  };

  const handleViewDetails = async (metric: string) => {
    try {
      const detailedData = await getDetailedMetrics(metric);
      trackSubscriptionEvent('viewed_details', projectId, { metric });
      
      // Could open a modal or navigate to detailed view
      console.log('Detailed metrics for', metric, detailedData);
    } catch (error) {
      console.error('Failed to get detailed metrics:', error);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center space-x-4 mb-8">
          <Button
            onClick={() => router.back()}
            variant="outline"
            size="sm"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
            <p className="text-gray-600">{projectName}</p>
          </div>
        </div>
        <Loading />
      </div>
    );
  }

  if (analyticsError) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center space-x-4 mb-8">
          <Button
            onClick={() => router.back()}
            variant="outline"
            size="sm"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
            <p className="text-gray-600">{projectName}</p>
          </div>
        </div>
        
        <Card className="p-6 text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Unable to Load Analytics</h3>
          <p className="text-red-600 mb-4">{analyticsError}</p>
          <div className="flex justify-center space-x-3">
            <Button onClick={refresh} variant="outline">
              Try Again
            </Button>
            <Button onClick={() => router.back()}>
              Go Back
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center space-x-4 mb-8">
          <Button
            onClick={() => router.back()}
            variant="outline"
            size="sm"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
            <p className="text-gray-600">{projectName}</p>
          </div>
        </div>
        
        <Card className="p-8 text-center">
          <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Analytics Data</h3>
          <p className="text-gray-600 mb-4">
            Analytics data will appear here once your family starts using the project.
          </p>
          <Button onClick={() => router.push(`/dashboard/projects/${projectId}`)}>
            View Project
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <Button
            onClick={() => router.back()}
            variant="outline"
            size="sm"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Subscription Analytics</h1>
            <p className="text-gray-600">{projectName}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <Button
            onClick={() => router.push(`/dashboard/projects/${projectId}/subscription`)}
            variant="outline"
          >
            Manage Subscription
          </Button>
        </div>
      </div>

      {/* Analytics Dashboard */}
      <SubscriptionAnalyticsDashboard
        analytics={analytics}
        projectName={projectName}
        onExportReport={handleExportReport}
        onViewDetails={handleViewDetails}
      />

      {/* Quick Actions */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <h3 className="font-semibold text-gray-900 mb-2">Need Help?</h3>
          <p className="text-sm text-gray-600 mb-3">
            Learn how to interpret your analytics and improve engagement.
          </p>
          <Button variant="outline" size="sm" className="w-full">
            View Guide
          </Button>
        </Card>
        
        <Card className="p-4">
          <h3 className="font-semibold text-gray-900 mb-2">Share Insights</h3>
          <p className="text-sm text-gray-600 mb-3">
            Share your project's progress with family members.
          </p>
          <Button variant="outline" size="sm" className="w-full">
            Share Report
          </Button>
        </Card>
        
        <Card className="p-4">
          <h3 className="font-semibold text-gray-900 mb-2">Optimize Usage</h3>
          <p className="text-sm text-gray-600 mb-3">
            Get personalized tips to maximize your subscription value.
          </p>
          <Button variant="outline" size="sm" className="w-full">
            Get Tips
          </Button>
        </Card>
      </div>

      {/* Data Refresh Info */}
      <div className="mt-6 text-center text-sm text-gray-500">
        Analytics data is updated every 5 minutes. Last updated: {new Date().toLocaleTimeString()}
      </div>
    </div>
  );
}