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
    if (score >= 0.8) return { level: 'Excellent', color: 'text-success-foreground', bgColor: 'bg-success/10' };
    if (score >= 0.6) return { level: 'Good', color: 'text-info-foreground', bgColor: 'bg-info/10' };
    if (score >= 0.4) return { level: 'Fair', color: 'text-warning-foreground', bgColor: 'bg-warning/10' };
    return { level: 'Needs Improvement', color: 'text-destructive-foreground', bgColor: 'bg-destructive/10' };
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
      <div className="w-16 bg-muted rounded-full h-2">
        <div 
          className={`h-2 rounded-full transition-all duration-300 ${
            qualityScore >= 0.8 ? 'bg-success' :
            qualityScore >= 0.6 ? 'bg-info' :
            qualityScore >= 0.4 ? 'bg-warning' : 'bg-destructive'
          }`.replace('text-success', 'text-success-foreground').replace('bg-success/10', 'bg-success/10').replace('text-info', 'text-info-foreground').replace('bg-info/10', 'bg-info/10').replace('text-warning', 'text-warning-foreground').replace('bg-warning/10', 'bg-warning/10').replace('text-destructive', 'text-destructive-foreground').replace('bg-destructive/10', 'bg-destructive/10')}
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
                    ? 'bg-success/10 text-success-foreground' 
                    : 'bg-muted text-muted-foreground'
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