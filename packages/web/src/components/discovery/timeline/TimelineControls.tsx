'use client';

import React, { useState } from 'react';
import { Card } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';

interface TimelineFilters {
  startDate?: string;
  endDate?: string;
  categories?: string[];
  tags?: string[];
  facilitators?: string[];
  projectId?: string;
}

interface TimelineControlsProps {
  filters: TimelineFilters;
  onFilterChange: (filters: Partial<TimelineFilters>) => void;
  categories: Array<{ name: string; count: number; color: string }>;
  facilitators: Array<{ id: string; name: string; count: number }>;
  viewMode: 'horizontal' | 'vertical';
  onViewModeChange: (mode: 'horizontal' | 'vertical') => void;
}

export function TimelineControls({
  filters,
  onFilterChange,
  categories,
  facilitators,
  viewMode,
  onViewModeChange
}: TimelineControlsProps) {
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const handleDateRangeChange = (type: 'start' | 'end', value: string) => {
    onFilterChange({
      [type === 'start' ? 'startDate' : 'endDate']: value
    });
  };

  const handleCategoryToggle = (categoryName: string) => {
    const isSelected = filters.categories?.includes(categoryName);
    const newCategories = isSelected
      ? filters.categories?.filter(c => c !== categoryName)
      : [...(filters.categories || []), categoryName];
    onFilterChange({ categories: newCategories });
  };

  const handleFacilitatorToggle = (facilitatorId: string) => {
    const isSelected = filters.facilitators?.includes(facilitatorId);
    const newFacilitators = isSelected
      ? filters.facilitators?.filter(f => f !== facilitatorId)
      : [...(filters.facilitators || []), facilitatorId];
    onFilterChange({ facilitators: newFacilitators });
  };

  const clearAllFilters = () => {
    onFilterChange({
      startDate: undefined,
      endDate: undefined,
      categories: undefined,
      tags: undefined,
      facilitators: undefined
    });
  };

  const hasActiveFilters = !!(
    filters.startDate ||
    filters.endDate ||
    filters.categories?.length ||
    filters.tags?.length ||
    filters.facilitators?.length
  );

  return (
    <Card className="timeline-controls p-4 mb-6">
      <div className="flex flex-wrap items-center gap-4 mb-4">
        {/* View Mode Toggle */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">View:</span>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <Button
              variant={viewMode === 'horizontal' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onViewModeChange('horizontal')}
              className="rounded-none"
            >
              Horizontal
            </Button>
            <Button
              variant={viewMode === 'vertical' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onViewModeChange('vertical')}
              className="rounded-none"
            >
              Vertical
            </Button>
          </div>
        </div>

        {/* Quick Date Filters */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Quick filters:</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const lastMonth = new Date();
              lastMonth.setMonth(lastMonth.getMonth() - 1);
              onFilterChange({
                startDate: lastMonth.toISOString().split('T')[0],
                endDate: new Date().toISOString().split('T')[0]
              });
            }}
          >
            Last Month
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const lastYear = new Date();
              lastYear.setFullYear(lastYear.getFullYear() - 1);
              onFilterChange({
                startDate: lastYear.toISOString().split('T')[0],
                endDate: new Date().toISOString().split('T')[0]
              });
            }}
          >
            Last Year
          </Button>
        </div>

        {/* Advanced Filters Toggle */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
        >
          {showAdvancedFilters ? 'Hide' : 'Show'} Filters
        </Button>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={clearAllFilters}
            className="text-red-600 border-red-200 hover:bg-red-50"
          >
            Clear All
          </Button>
        )}
      </div>

      {/* Advanced Filters */}
      {showAdvancedFilters && (
        <div className="border-t pt-4 space-y-4">
          {/* Date Range */}
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-sm font-medium text-gray-700">Date Range:</span>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={filters.startDate || ''}
                onChange={(e) => handleDateRangeChange('start', e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded text-sm"
                placeholder="Start date"
              />
              <span className="text-gray-500">to</span>
              <input
                type="date"
                value={filters.endDate || ''}
                onChange={(e) => handleDateRangeChange('end', e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded text-sm"
                placeholder="End date"
              />
            </div>
          </div>

          {/* Categories */}
          {categories.length > 0 && (
            <div className="space-y-2">
              <span className="text-sm font-medium text-gray-700">Categories:</span>
              <div className="flex flex-wrap gap-2">
                {categories.map(category => (
                  <Badge
                    key={category.name}
                    variant={filters.categories?.includes(category.name) ? 'default' : 'outline'}
                    className="cursor-pointer hover:bg-gray-50"
                    style={{
                      borderColor: category.color,
                      backgroundColor: filters.categories?.includes(category.name) ? category.color : 'transparent',
                      color: filters.categories?.includes(category.name) ? 'white' : category.color
                    }}
                    onClick={() => handleCategoryToggle(category.name)}
                  >
                    {category.name} ({category.count})
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Facilitators */}
          {facilitators.length > 0 && (
            <div className="space-y-2">
              <span className="text-sm font-medium text-gray-700">Facilitators:</span>
              <div className="flex flex-wrap gap-2">
                {facilitators.map(facilitator => (
                  <Badge
                    key={facilitator.id}
                    variant={filters.facilitators?.includes(facilitator.id) ? 'default' : 'outline'}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => handleFacilitatorToggle(facilitator.id)}
                  >
                    {facilitator.name} ({facilitator.count})
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="border-t pt-4 mt-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Active filters:</span>
            
            {filters.startDate && (
              <Badge variant="secondary" className="text-xs">
                From: {new Date(filters.startDate).toLocaleDateString()}
                <button
                  onClick={() => onFilterChange({ startDate: undefined })}
                  className="ml-1 hover:text-red-600"
                >
                  ×
                </button>
              </Badge>
            )}
            
            {filters.endDate && (
              <Badge variant="secondary" className="text-xs">
                To: {new Date(filters.endDate).toLocaleDateString()}
                <button
                  onClick={() => onFilterChange({ endDate: undefined })}
                  className="ml-1 hover:text-red-600"
                >
                  ×
                </button>
              </Badge>
            )}
            
            {filters.categories?.map(category => (
              <Badge key={category} variant="secondary" className="text-xs">
                {category}
                <button
                  onClick={() => handleCategoryToggle(category)}
                  className="ml-1 hover:text-red-600"
                >
                  ×
                </button>
              </Badge>
            ))}
            
            {filters.facilitators?.map(facilitatorId => {
              const facilitator = facilitators.find(f => f.id === facilitatorId);
              return facilitator ? (
                <Badge key={facilitatorId} variant="secondary" className="text-xs">
                  {facilitator.name}
                  <button
                    onClick={() => handleFacilitatorToggle(facilitatorId)}
                    className="ml-1 hover:text-red-600"
                  >
                    ×
                  </button>
                </Badge>
              ) : null;
            })}
          </div>
        </div>
      )}
    </Card>
  );
}