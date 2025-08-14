'use client';

import React from 'react';

interface CompletionData {
  totalPrompts: number;
  answeredPrompts: number;
  completionRate: number;
  chapterProgress: Array<{
    chapterId: string;
    chapterName: string;
    totalPrompts: number;
    answeredPrompts: number;
    completionRate: number;
  }>;
}

interface StoryCompletionTrackerProps {
  projectId: string;
  completionData: CompletionData;
}

export const StoryCompletionTracker: React.FC<StoryCompletionTrackerProps> = ({
  projectId,
  completionData
}) => {
  const overallPercentage = Math.round(completionData.completionRate * 100);

  const getProgressColor = (rate: number): string => {
    if (rate >= 0.8) return 'bg-green-500';
    if (rate >= 0.6) return 'bg-blue-500';
    if (rate >= 0.4) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getProgressTextColor = (rate: number): string => {
    if (rate >= 0.8) return 'text-green-600';
    if (rate >= 0.6) return 'text-blue-600';
    if (rate >= 0.4) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Story Completion Progress</h3>
        <div className={`text-2xl font-bold ${getProgressTextColor(completionData.completionRate)}`}>
          {overallPercentage}%
        </div>
      </div>

      {/* Overall Progress */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Overall Progress</span>
          <span>{completionData.answeredPrompts} of {completionData.totalPrompts} prompts</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div 
            className={`h-3 rounded-full transition-all duration-500 ${getProgressColor(completionData.completionRate)}`}
            style={{ width: `${overallPercentage}%` }}
          />
        </div>
      </div>

      {/* Chapter Breakdown */}
      <div>
        <h4 className="font-medium text-gray-900 mb-4">Chapter Progress</h4>
        <div className="space-y-4">
          {completionData.chapterProgress.map(chapter => {
            const chapterPercentage = Math.round(chapter.completionRate * 100);
            
            return (
              <div key={chapter.chapterId} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="font-medium text-gray-800">{chapter.chapterName}</h5>
                  <span className={`text-sm font-semibold ${getProgressTextColor(chapter.completionRate)}`}>
                    {chapterPercentage}%
                  </span>
                </div>
                
                <div className="flex justify-between text-xs text-gray-500 mb-2">
                  <span>{chapter.answeredPrompts} answered</span>
                  <span>{chapter.totalPrompts} total prompts</span>
                </div>
                
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(chapter.completionRate)}`}
                    style={{ width: `${chapterPercentage}%` }}
                  />
                </div>
                
                {/* Progress indicators */}
                <div className="flex justify-between mt-2">
                  <div className="flex space-x-1">
                    {Array.from({ length: Math.min(10, chapter.totalPrompts) }).map((_, index) => {
                      const isAnswered = index < (chapter.answeredPrompts / chapter.totalPrompts) * 10;
                      return (
                        <div
                          key={index}
                          className={`w-2 h-2 rounded-full ${
                            isAnswered ? getProgressColor(chapter.completionRate) : 'bg-gray-300'
                          }`}
                        />
                      );
                    })}
                    {chapter.totalPrompts > 10 && (
                      <span className="text-xs text-gray-400 ml-1">
                        +{chapter.totalPrompts - 10} more
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Completion Insights */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h5 className="font-medium text-gray-800 mb-2">Insights</h5>
        <div className="text-sm text-gray-600 space-y-1">
          {completionData.completionRate >= 0.8 && (
            <p>🎉 Excellent progress! You're doing great at capturing family stories.</p>
          )}
          {completionData.completionRate >= 0.6 && completionData.completionRate < 0.8 && (
            <p>👍 Good progress! Keep encouraging story sharing to reach more milestones.</p>
          )}
          {completionData.completionRate >= 0.4 && completionData.completionRate < 0.6 && (
            <p>📈 Making steady progress. Consider focusing on chapters with fewer stories.</p>
          )}
          {completionData.completionRate < 0.4 && (
            <p>🌱 Just getting started! Every story shared is a precious memory preserved.</p>
          )}
          
          {/* Chapter-specific insights */}
          {completionData.chapterProgress.length > 0 && (
            <>
              {(() => {
                const mostComplete = completionData.chapterProgress.reduce((prev, current) => 
                  prev.completionRate > current.completionRate ? prev : current
                );
                const leastComplete = completionData.chapterProgress.reduce((prev, current) => 
                  prev.completionRate < current.completionRate ? prev : current
                );
                
                return (
                  <div className="mt-2 space-y-1">
                    <p>
                      <strong>{mostComplete.chapterName}</strong> is your most complete chapter 
                      ({Math.round(mostComplete.completionRate * 100)}%).
                    </p>
                    {leastComplete.completionRate < 0.3 && (
                      <p>
                        Consider exploring <strong>{leastComplete.chapterName}</strong> for new story opportunities.
                      </p>
                    )}
                  </div>
                );
              })()}
            </>
          )}
        </div>
      </div>
    </div>
  );
};