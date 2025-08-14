'use client';

import React, { useState } from 'react';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { StoryTimeline } from '../../../components/discovery/timeline/StoryTimeline';
import { StoryRecommendations } from '../../../components/discovery/recommendations/StoryRecommendations';
import { StorySearch } from '../../../components/search/story-search';

export default function DiscoverPage() {
  const [activeTab, setActiveTab] = useState<'timeline' | 'recommendations' | 'search'>('timeline');

  return (
    <div className="discover-page p-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Discover Stories
        </h1>
        <p className="text-gray-600">
          Explore your family's stories through timeline, recommendations, and search.
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('timeline')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'timeline'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Timeline
            </button>
            <button
              onClick={() => setActiveTab('recommendations')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'recommendations'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Recommendations
            </button>
            <button
              onClick={() => setActiveTab('search')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'search'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Search
            </button>
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'timeline' && (
          <div className="timeline-tab">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Story Timeline
              </h2>
              <p className="text-gray-600">
                Visualize your family's stories chronologically and explore them through time.
              </p>
            </div>
            <StoryTimeline className="w-full" />
          </div>
        )}

        {activeTab === 'recommendations' && (
          <div className="recommendations-tab">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Recommended Stories
              </h2>
              <p className="text-gray-600">
                Discover stories you might have missed based on your listening history and preferences.
              </p>
            </div>
            <StoryRecommendations className="w-full" />
          </div>
        )}

        {activeTab === 'search' && (
          <div className="search-tab">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Search Stories
              </h2>
              <p className="text-gray-600">
                Find specific stories using keywords, filters, and advanced search options.
              </p>
            </div>
            <StorySearch className="w-full" />
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <Card className="mt-8 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Discovery Insights
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600 mb-1">
              --
            </div>
            <div className="text-sm text-gray-600">
              Stories Discovered
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600 mb-1">
              --
            </div>
            <div className="text-sm text-gray-600">
              Bookmarked Stories
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600 mb-1">
              --
            </div>
            <div className="text-sm text-gray-600">
              Search Queries
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}