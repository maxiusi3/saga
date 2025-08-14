import { BaseService } from './base-service';
import { RecordingAnalyticsService } from './recording-analytics-service';
import { RecordingMetadata, RecordingQuality } from '@saga/shared';

export interface PerformanceOptimization {
  id: string;
  type: 'audio_quality' | 'file_size' | 'duration' | 'retry_reduction' | 'device_specific';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'high' | 'medium' | 'low';
  recommendation: string;
  metrics: {
    currentValue: number;
    targetValue: number;
    improvement: number;
    unit: string;
  };
  implementation: {
    steps: string[];
    estimatedTime: string;
    resources: string[];
  };
}

export interface PerformanceReport {
  overallScore: number; // 0-100
  optimizations: PerformanceOptimization[];
  priorityActions: PerformanceOptimization[];
  quickWins: PerformanceOptimization[];
  longTermGoals: PerformanceOptimization[];
  generatedAt: Date;
}

class RecordingPerformanceOptimizerClass extends BaseService {
  /**
   * Generate performance optimization recommendations based on analytics data
   */
  async generateOptimizations(userId?: string, projectId?: string): Promise<PerformanceReport> {
    try {
      // Get analytics data
      const [completionMetrics, qualityMetrics, deviceMetrics, insights] = await Promise.all([
        RecordingAnalyticsService.getCompletionMetrics(userId, projectId),
        RecordingAnalyticsService.getQualityMetrics(userId, projectId),
        RecordingAnalyticsService.getDeviceMetrics(userId, projectId),
        RecordingAnalyticsService.getRecordingInsights(userId, projectId),
      ]);

      const optimizations: PerformanceOptimization[] = [];

      // Analyze completion rate
      if (completionMetrics.completionRate < 70) {
        optimizations.push({
          id: 'improve-completion-rate',
          type: 'retry_reduction',
          title: 'Improve Recording Completion Rate',
          description: `Current completion rate is ${completionMetrics.completionRate.toFixed(1)}%, which is below the target of 70%`,
          impact: 'high',
          effort: 'medium',
          recommendation: 'Simplify the recording interface and provide better user guidance',
          metrics: {
            currentValue: completionMetrics.completionRate,
            targetValue: 75,
            improvement: 75 - completionMetrics.completionRate,
            unit: '%'
          },
          implementation: {
            steps: [
              'Analyze user drop-off points in the recording flow',
              'Simplify the recording interface design',
              'Add progress indicators and clear instructions',
              'Implement better error handling and recovery',
              'A/B test different interface designs'
            ],
            estimatedTime: '2-3 weeks',
            resources: ['UX Designer', 'Frontend Developer', 'QA Tester']
          }
        });
      }

      // Analyze retry rate
      if (completionMetrics.averageRetryCount > 2) {
        optimizations.push({
          id: 'reduce-retry-rate',
          type: 'retry_reduction',
          title: 'Reduce Recording Retry Rate',
          description: `Users retry recordings ${completionMetrics.averageRetryCount.toFixed(1)} times on average, indicating friction in the process`,
          impact: 'high',
          effort: 'medium',
          recommendation: 'Improve recording quality validation and provide real-time feedback',
          metrics: {
            currentValue: completionMetrics.averageRetryCount,
            targetValue: 1.5,
            improvement: completionMetrics.averageRetryCount - 1.5,
            unit: 'retries'
          },
          implementation: {
            steps: [
              'Implement real-time audio quality monitoring',
              'Add visual feedback during recording',
              'Improve quality validation algorithms',
              'Provide better recording tips and guidance',
              'Add practice mode for new users'
            ],
            estimatedTime: '3-4 weeks',
            resources: ['Audio Engineer', 'Mobile Developer', 'UX Designer']
          }
        });
      }

      // Analyze quality issues
      const qualityRate = qualityMetrics.totalRecordings > 0 
        ? (qualityMetrics.validRecordings / qualityMetrics.totalRecordings) * 100 
        : 100;

      if (qualityRate < 80) {
        optimizations.push({
          id: 'improve-audio-quality',
          type: 'audio_quality',
          title: 'Improve Audio Quality',
          description: `${(100 - qualityRate).toFixed(1)}% of recordings have quality issues`,
          impact: 'high',
          effort: 'high',
          recommendation: 'Implement automatic audio enhancement and better recording guidance',
          metrics: {
            currentValue: qualityRate,
            targetValue: 85,
            improvement: 85 - qualityRate,
            unit: '%'
          },
          implementation: {
            steps: [
              'Implement noise reduction algorithms',
              'Add automatic gain control',
              'Improve microphone detection and guidance',
              'Add audio quality preview before recording',
              'Implement post-processing enhancement'
            ],
            estimatedTime: '4-6 weeks',
            resources: ['Audio Engineer', 'Mobile Developer', 'Backend Developer']
          }
        });
      }

      // Analyze file size issues
      if (qualityMetrics.averageFileSize > 10 * 1024 * 1024) { // > 10MB
        optimizations.push({
          id: 'optimize-file-size',
          type: 'file_size',
          title: 'Optimize Recording File Size',
          description: `Average file size is ${this.formatFileSize(qualityMetrics.averageFileSize)}, which may cause upload issues`,
          impact: 'medium',
          effort: 'low',
          recommendation: 'Implement better audio compression without quality loss',
          metrics: {
            currentValue: qualityMetrics.averageFileSize,
            targetValue: 5 * 1024 * 1024, // 5MB target
            improvement: qualityMetrics.averageFileSize - (5 * 1024 * 1024),
            unit: 'bytes'
          },
          implementation: {
            steps: [
              'Implement adaptive bitrate encoding',
              'Add compression options based on duration',
              'Optimize audio codec settings',
              'Add progressive upload for large files',
              'Implement client-side compression'
            ],
            estimatedTime: '1-2 weeks',
            resources: ['Mobile Developer', 'Backend Developer']
          }
        });
      }

      // Analyze duration patterns
      if (completionMetrics.averageRecordingDuration < 30000) { // < 30 seconds
        optimizations.push({
          id: 'encourage-longer-recordings',
          type: 'duration',
          title: 'Encourage Longer Recordings',
          description: `Average recording duration is ${this.formatDuration(completionMetrics.averageRecordingDuration)}, which may not capture full stories`,
          impact: 'medium',
          effort: 'low',
          recommendation: 'Improve prompts and provide gentle encouragement for more detailed stories',
          metrics: {
            currentValue: completionMetrics.averageRecordingDuration,
            targetValue: 60000, // 1 minute target
            improvement: 60000 - completionMetrics.averageRecordingDuration,
            unit: 'milliseconds'
          },
          implementation: {
            steps: [
              'Analyze and improve prompt quality',
              'Add gentle duration guidance during recording',
              'Implement follow-up question suggestions',
              'Add storytelling tips and examples',
              'Create more engaging prompt categories'
            ],
            estimatedTime: '2-3 weeks',
            resources: ['Content Writer', 'UX Designer', 'Mobile Developer']
          }
        });
      }

      // Analyze device-specific issues
      const lowPerformanceDevices = deviceMetrics.deviceModels.filter(d => d.completionRate < 60);
      if (lowPerformanceDevices.length > 0) {
        optimizations.push({
          id: 'optimize-device-performance',
          type: 'device_specific',
          title: 'Optimize for Low-Performance Devices',
          description: `${lowPerformanceDevices.length} device models have completion rates below 60%`,
          impact: 'medium',
          effort: 'high',
          recommendation: 'Implement device-specific optimizations and fallbacks',
          metrics: {
            currentValue: Math.min(...lowPerformanceDevices.map(d => d.completionRate)),
            targetValue: 70,
            improvement: 70 - Math.min(...lowPerformanceDevices.map(d => d.completionRate)),
            unit: '%'
          },
          implementation: {
            steps: [
              'Identify device-specific performance bottlenecks',
              'Implement adaptive quality settings',
              'Add device capability detection',
              'Create fallback recording modes',
              'Optimize memory usage for older devices'
            ],
            estimatedTime: '4-5 weeks',
            resources: ['Mobile Developer', 'Performance Engineer', 'QA Tester']
          }
        });
      }

      // Analyze headphone usage
      if (deviceMetrics.environmentFactors.headphonesUsage < 40) {
        optimizations.push({
          id: 'promote-headphone-usage',
          type: 'audio_quality',
          title: 'Promote Headphone Usage',
          description: `Only ${deviceMetrics.environmentFactors.headphonesUsage.toFixed(1)}% of users use headphones, which affects recording quality`,
          impact: 'low',
          effort: 'low',
          recommendation: 'Add gentle reminders and education about headphone benefits',
          metrics: {
            currentValue: deviceMetrics.environmentFactors.headphonesUsage,
            targetValue: 60,
            improvement: 60 - deviceMetrics.environmentFactors.headphonesUsage,
            unit: '%'
          },
          implementation: {
            steps: [
              'Add headphone detection and prompts',
              'Create educational content about recording quality',
              'Implement gentle reminders in the UI',
              'Add quality comparison examples',
              'Track headphone usage impact on quality'
            ],
            estimatedTime: '1 week',
            resources: ['UX Designer', 'Mobile Developer']
          }
        });
      }

      // Calculate overall performance score
      const overallScore = this.calculateOverallScore(completionMetrics, qualityMetrics, deviceMetrics);

      // Categorize optimizations
      const priorityActions = optimizations.filter(o => o.impact === 'high');
      const quickWins = optimizations.filter(o => o.effort === 'low' && o.impact !== 'low');
      const longTermGoals = optimizations.filter(o => o.effort === 'high');

      return {
        overallScore,
        optimizations,
        priorityActions,
        quickWins,
        longTermGoals,
        generatedAt: new Date(),
      };
    } catch (error) {
      console.error('Failed to generate performance optimizations:', error);
      throw new Error('Failed to generate performance optimizations');
    }
  }

  /**
   * Calculate overall performance score based on metrics
   */
  private calculateOverallScore(completionMetrics: any, qualityMetrics: any, deviceMetrics: any): number {
    let score = 0;
    let maxScore = 0;

    // Completion rate (30% weight)
    const completionScore = Math.min(completionMetrics.completionRate, 100);
    score += completionScore * 0.3;
    maxScore += 100 * 0.3;

    // Quality rate (25% weight)
    const qualityRate = qualityMetrics.totalRecordings > 0 
      ? (qualityMetrics.validRecordings / qualityMetrics.totalRecordings) * 100 
      : 100;
    score += qualityRate * 0.25;
    maxScore += 100 * 0.25;

    // Retry rate (20% weight) - inverse scoring
    const retryScore = Math.max(0, 100 - (completionMetrics.averageRetryCount * 25));
    score += retryScore * 0.2;
    maxScore += 100 * 0.2;

    // Duration appropriateness (15% weight)
    const durationScore = this.calculateDurationScore(completionMetrics.averageRecordingDuration);
    score += durationScore * 0.15;
    maxScore += 100 * 0.15;

    // Device compatibility (10% weight)
    const deviceScore = this.calculateDeviceScore(deviceMetrics);
    score += deviceScore * 0.1;
    maxScore += 100 * 0.1;

    return Math.round((score / maxScore) * 100);
  }

  private calculateDurationScore(averageDuration: number): number {
    // Optimal range: 30 seconds to 5 minutes
    if (averageDuration >= 30000 && averageDuration <= 300000) {
      return 100;
    } else if (averageDuration < 30000) {
      // Penalize short recordings
      return Math.max(0, (averageDuration / 30000) * 100);
    } else {
      // Penalize very long recordings less severely
      return Math.max(50, 100 - ((averageDuration - 300000) / 300000) * 50);
    }
  }

  private calculateDeviceScore(deviceMetrics: any): number {
    if (deviceMetrics.deviceModels.length === 0) return 100;
    
    const averageCompletionRate = deviceMetrics.deviceModels.reduce(
      (sum: number, device: any) => sum + device.completionRate, 0
    ) / deviceMetrics.deviceModels.length;
    
    return Math.min(100, averageCompletionRate);
  }
}

export const RecordingPerformanceOptimizer = new RecordingPerformanceOptimizerClass();