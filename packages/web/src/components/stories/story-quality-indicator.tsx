'use client';

import React from 'react';

interface StoryQualityIndicatorProps {
  qualityScore: number;
  factors: {
    hasTranscript: boolean;
    hasPhoto: boolean;
    hasInteractions: boolean;
    optimalDuration: boolean;
    recentActivity: boolean;
  };
  showDetails?: boolean;
}

export const StoryQualityIndicator: React.FC<StoryQualityIndicatorProps> = ({
  qualityScore,
  factors,
  showDetails = false
}) => {
  const getQualityLevel = (score: number): { level: string; color: string; bgColor: string } => {
    if (score >= 0.8) return { level: 'Excellent', color: 'text-green-600', bgColor: 'bg-green-100' };
    if (score >= 0.6) return { level: 'Good', color: 'text-blue-600', bgColor: 'bg-blue-100' };
    if (score >= 0.4) return { level: 'Fair', color: 'text-yellow-600', bgColor: 'bg-yellow-100' };
    return { level: 'Needs Improvement', color: 'text-red-600', bgColor: 'bg-red-100' };
  };

  const quality = getQualityLevel(qualityScore);
  const percentage = Math.round(qualityScore * 100);

  const factorLabels = {
    hasTranscript: 'Has Transcript',
    hasPhoto: 'Has Photo',
    hasInteractions: 'Has Interactions',
    optimalDuration: 'Optimal Duration',
    recentActivity: 'Recent Activity'
  };

  return (
    <div className="inline-flex items-center space-x-2">
      {/* Quality Badge */}
      <div className={`px-2 py-1 rounded-full text-xs font-medium ${quality.color} ${quality.bgColor}`}>
        {quality.level} ({percentage}%)
      </div>

      {/* Quality Bar */}
      <div className="w-16 bg-gray-200 rounded-full h-2">
        <div 
          className={`h-2 rounded-full transition-all duration-300 ${
            qualityScore >= 0.8 ? 'bg-green-500' :
            qualityScore >= 0.6 ? 'bg-blue-500' :
            qualityScore >= 0.4 ? 'bg-yellow-500' : 'bg-red-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Detailed Factors */}
      {showDetails && (
        <div className="ml-4">
          <div className="flex flex-wrap gap-1">
            {Object.entries(factors).map(([key, value]) => (
              <span
                key={key}
                className={`text-xs px-2 py-1 rounded ${
                  value 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-gray-100 text-gray-500'
                }`}
                title={factorLabels[key as keyof typeof factorLabels]}
              >
                {value ? '✓' : '○'} {factorLabels[key as keyof typeof factorLabels]}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};