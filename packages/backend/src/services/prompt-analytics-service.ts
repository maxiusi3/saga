import { BaseModel } from '../models/base';
import { Prompt } from '../models/prompt';

interface PromptUsageMetrics {
  promptId: string;
  impressions: number;
  engagements: number;
  completions: number;
  skips: number;
  averageStoryLength: number;
  engagementRate: number;
  completionRate: number;
  skipRate: number;
  lastUsed: Date;
}

interface PromptAnalyticsReport {
  timeframe: string;
  totalPrompts: number;
  activePrompts: number;
  topPerformingPrompts: PromptUsageMetrics[];
  underperformingPrompts: PromptUsageMetrics[];
  categoryPerformance: Record<string, {
    averageEngagementRate: number;
    averageCompletionRate: number;
    averageSkipRate: number;
    promptCount: number;
  }>;
  difficultyPerformance: Record<string, {
    averageEngagementRate: number;
    averageCompletionRate: number;
    averageSkipRate: number;
    promptCount: number;
  }>;
  trends: {
    engagementTrend: number; // percentage change
    completionTrend: number;
    skipTrend: number;
  };
}

class PromptAnalyticsServiceClass {
  private db = BaseModel.db;

  /**
   * Track prompt usage
   */
  async trackPromptUsage(
    promptId: string,
    userId: string,
    action: 'impression' | 'engagement' | 'completion' | 'skip',
    metadata?: {
      storyLength?: number;
      timeSpent?: number;
      category?: string;
      difficulty?: string;
    }
  ): Promise<void> {
    try {
      await this.db('prompt_usage_analytics').insert({
        prompt_id: promptId,
        user_id: userId,
        action,
        metadata: metadata ? JSON.stringify(metadata) : null,
        created_at: new Date(),
      });
    } catch (error) {
      console.error('Failed to track prompt usage:', error);
    }
  }

  /**
   * Get usage metrics for a specific prompt
   */
  async getPromptMetrics(promptId: string, timeframe: string = '30d'): Promise<PromptUsageMetrics> {
    try {
      const startDate = this.getStartDateForTimeframe(timeframe);
      
      const usageData = await this.db('prompt_usage_analytics')
        .where('prompt_id', promptId)
        .where('created_at', '>=', startDate);

      const impressions = usageData.filter(u => u.action === 'impression').length;
      const engagements = usageData.filter(u => u.action === 'engagement').length;
      const completions = usageData.filter(u => u.action === 'completion').length;
      const skips = usageData.filter(u => u.action === 'skip').length;

      const storyLengths = usageData
        .filter(u => u.metadata)
        .map(u => {
          try {
            const metadata = JSON.parse(u.metadata);
            return metadata.storyLength || 0;
          } catch {
            return 0;
          }
        })
        .filter(length => length > 0);

      const averageStoryLength = storyLengths.length > 0 
        ? storyLengths.reduce((sum, length) => sum + length, 0) / storyLengths.length 
        : 0;

      const lastUsedRecord = usageData.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];

      return {
        promptId,
        impressions,
        engagements,
        completions,
        skips,
        averageStoryLength,
        engagementRate: impressions > 0 ? (engagements / impressions) * 100 : 0,
        completionRate: engagements > 0 ? (completions / engagements) * 100 : 0,
        skipRate: impressions > 0 ? (skips / impressions) * 100 : 0,
        lastUsed: lastUsedRecord ? new Date(lastUsedRecord.created_at) : new Date(0),
      };
    } catch (error) {
      console.error('Failed to get prompt metrics:', error);
      return this.getEmptyMetrics(promptId);
    }
  }

  /**
   * Generate comprehensive analytics report
   */
  async generateAnalyticsReport(timeframe: string = '30d'): Promise<PromptAnalyticsReport> {
    try {
      const startDate = this.getStartDateForTimeframe(timeframe);
      const previousStartDate = this.getPreviousStartDateForTimeframe(timeframe);

      // Get all library prompts
      const allPrompts = await Prompt.findLibraryPrompts();
      const promptMetrics: PromptUsageMetrics[] = [];

      // Calculate metrics for each prompt
      for (const prompt of allPrompts) {
        const metrics = await this.getPromptMetrics(prompt.data.id, timeframe);
        promptMetrics.push(metrics);
      }

      // Sort by engagement rate for top/bottom performers
      const sortedByEngagement = [...promptMetrics].sort((a, b) => b.engagementRate - a.engagementRate);
      const topPerformingPrompts = sortedByEngagement.slice(0, 10);
      const underperformingPrompts = sortedByEngagement.slice(-10).reverse();

      // Calculate category performance
      const categoryPerformance = await this.calculateCategoryPerformance(allPrompts, promptMetrics);
      
      // Calculate difficulty performance
      const difficultyPerformance = await this.calculateDifficultyPerformance(allPrompts, promptMetrics);

      // Calculate trends
      const trends = await this.calculateTrends(timeframe, previousStartDate);

      const activePrompts = promptMetrics.filter(m => m.impressions > 0).length;

      return {
        timeframe,
        totalPrompts: allPrompts.length,
        activePrompts,
        topPerformingPrompts,
        underperformingPrompts,
        categoryPerformance,
        difficultyPerformance,
        trends,
      };
    } catch (error) {
      console.error('Failed to generate analytics report:', error);
      return this.getEmptyReport(timeframe);
    }
  } 
 /**
   * Get prompts that need attention (low performance, not used recently)
   */
  async getPromptsNeedingAttention(): Promise<{
    lowPerformance: PromptUsageMetrics[];
    notUsedRecently: PromptUsageMetrics[];
    highSkipRate: PromptUsageMetrics[];
  }> {
    try {
      const allPrompts = await Prompt.findLibraryPrompts();
      const promptMetrics: PromptUsageMetrics[] = [];

      for (const prompt of allPrompts) {
        const metrics = await this.getPromptMetrics(prompt.data.id, '30d');
        promptMetrics.push(metrics);
      }

      const lowPerformance = promptMetrics.filter(m => 
        m.impressions >= 10 && m.engagementRate < 30
      );

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const notUsedRecently = promptMetrics.filter(m => 
        m.lastUsed < thirtyDaysAgo
      );

      const highSkipRate = promptMetrics.filter(m => 
        m.impressions >= 10 && m.skipRate > 70
      );

      return {
        lowPerformance,
        notUsedRecently,
        highSkipRate,
      };
    } catch (error) {
      console.error('Failed to get prompts needing attention:', error);
      return {
        lowPerformance: [],
        notUsedRecently: [],
        highSkipRate: [],
      };
    }
  }

  /**
   * Get usage trends over time
   */
  async getUsageTrends(timeframe: string = '30d'): Promise<{
    daily: Array<{
      date: string;
      impressions: number;
      engagements: number;
      completions: number;
      skips: number;
    }>;
    weekly: Array<{
      week: string;
      impressions: number;
      engagements: number;
      completions: number;
      skips: number;
    }>;
  }> {
    try {
      const startDate = this.getStartDateForTimeframe(timeframe);
      
      const usageData = await this.db('prompt_usage_analytics')
        .where('created_at', '>=', startDate)
        .orderBy('created_at', 'asc');

      // Group by day
      const dailyData = new Map<string, any>();
      const weeklyData = new Map<string, any>();

      usageData.forEach(record => {
        const date = new Date(record.created_at);
        const dayKey = date.toISOString().split('T')[0];
        const weekKey = this.getWeekKey(date);

        // Daily aggregation
        if (!dailyData.has(dayKey)) {
          dailyData.set(dayKey, {
            date: dayKey,
            impressions: 0,
            engagements: 0,
            completions: 0,
            skips: 0,
          });
        }

        const dayStats = dailyData.get(dayKey);
        dayStats[record.action + 's']++;

        // Weekly aggregation
        if (!weeklyData.has(weekKey)) {
          weeklyData.set(weekKey, {
            week: weekKey,
            impressions: 0,
            engagements: 0,
            completions: 0,
            skips: 0,
          });
        }

        const weekStats = weeklyData.get(weekKey);
        weekStats[record.action + 's']++;
      });

      return {
        daily: Array.from(dailyData.values()),
        weekly: Array.from(weeklyData.values()),
      };
    } catch (error) {
      console.error('Failed to get usage trends:', error);
      return {
        daily: [],
        weekly: [],
      };
    }
  }

  /**
   * Calculate category performance
   */
  private async calculateCategoryPerformance(
    prompts: Prompt[], 
    metrics: PromptUsageMetrics[]
  ): Promise<Record<string, any>> {
    const categoryStats: Record<string, {
      engagementRates: number[];
      completionRates: number[];
      skipRates: number[];
      promptCount: number;
    }> = {};

    prompts.forEach((prompt, index) => {
      const category = prompt.data.category;
      const metric = metrics[index];

      if (!categoryStats[category]) {
        categoryStats[category] = {
          engagementRates: [],
          completionRates: [],
          skipRates: [],
          promptCount: 0,
        };
      }

      if (metric.impressions > 0) {
        categoryStats[category].engagementRates.push(metric.engagementRate);
        categoryStats[category].completionRates.push(metric.completionRate);
        categoryStats[category].skipRates.push(metric.skipRate);
      }
      categoryStats[category].promptCount++;
    });

    const result: Record<string, any> = {};
    Object.entries(categoryStats).forEach(([category, stats]) => {
      result[category] = {
        averageEngagementRate: this.calculateAverage(stats.engagementRates),
        averageCompletionRate: this.calculateAverage(stats.completionRates),
        averageSkipRate: this.calculateAverage(stats.skipRates),
        promptCount: stats.promptCount,
      };
    });

    return result;
  }

  /**
   * Calculate difficulty performance
   */
  private async calculateDifficultyPerformance(
    prompts: Prompt[], 
    metrics: PromptUsageMetrics[]
  ): Promise<Record<string, any>> {
    const difficultyStats: Record<string, {
      engagementRates: number[];
      completionRates: number[];
      skipRates: number[];
      promptCount: number;
    }> = {};

    prompts.forEach((prompt, index) => {
      const difficulty = prompt.data.difficulty;
      const metric = metrics[index];

      if (!difficultyStats[difficulty]) {
        difficultyStats[difficulty] = {
          engagementRates: [],
          completionRates: [],
          skipRates: [],
          promptCount: 0,
        };
      }

      if (metric.impressions > 0) {
        difficultyStats[difficulty].engagementRates.push(metric.engagementRate);
        difficultyStats[difficulty].completionRates.push(metric.completionRate);
        difficultyStats[difficulty].skipRates.push(metric.skipRate);
      }
      difficultyStats[difficulty].promptCount++;
    });

    const result: Record<string, any> = {};
    Object.entries(difficultyStats).forEach(([difficulty, stats]) => {
      result[difficulty] = {
        averageEngagementRate: this.calculateAverage(stats.engagementRates),
        averageCompletionRate: this.calculateAverage(stats.completionRates),
        averageSkipRate: this.calculateAverage(stats.skipRates),
        promptCount: stats.promptCount,
      };
    });

    return result;
  }

  /**
   * Calculate trends compared to previous period
   */
  private async calculateTrends(timeframe: string, previousStartDate: Date): Promise<any> {
    try {
      const currentStartDate = this.getStartDateForTimeframe(timeframe);
      
      // Current period metrics
      const currentData = await this.db('prompt_usage_analytics')
        .where('created_at', '>=', currentStartDate);

      // Previous period metrics
      const previousData = await this.db('prompt_usage_analytics')
        .where('created_at', '>=', previousStartDate)
        .where('created_at', '<', currentStartDate);

      const currentMetrics = this.calculatePeriodMetrics(currentData);
      const previousMetrics = this.calculatePeriodMetrics(previousData);

      return {
        engagementTrend: this.calculatePercentageChange(
          previousMetrics.engagementRate, 
          currentMetrics.engagementRate
        ),
        completionTrend: this.calculatePercentageChange(
          previousMetrics.completionRate, 
          currentMetrics.completionRate
        ),
        skipTrend: this.calculatePercentageChange(
          previousMetrics.skipRate, 
          currentMetrics.skipRate
        ),
      };
    } catch (error) {
      console.error('Failed to calculate trends:', error);
      return {
        engagementTrend: 0,
        completionTrend: 0,
        skipTrend: 0,
      };
    }
  }

  /**
   * Helper methods
   */
  private getStartDateForTimeframe(timeframe: string): Date {
    const date = new Date();
    const days = parseInt(timeframe.replace('d', ''));
    date.setDate(date.getDate() - days);
    return date;
  }

  private getPreviousStartDateForTimeframe(timeframe: string): Date {
    const date = new Date();
    const days = parseInt(timeframe.replace('d', ''));
    date.setDate(date.getDate() - (days * 2));
    return date;
  }

  private getWeekKey(date: Date): string {
    const year = date.getFullYear();
    const week = Math.ceil(((date.getTime() - new Date(year, 0, 1).getTime()) / 86400000 + 1) / 7);
    return `${year}-W${week.toString().padStart(2, '0')}`;
  }

  private calculateAverage(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
  }

  private calculatePeriodMetrics(data: any[]): any {
    const impressions = data.filter(d => d.action === 'impression').length;
    const engagements = data.filter(d => d.action === 'engagement').length;
    const completions = data.filter(d => d.action === 'completion').length;
    const skips = data.filter(d => d.action === 'skip').length;

    return {
      engagementRate: impressions > 0 ? (engagements / impressions) * 100 : 0,
      completionRate: engagements > 0 ? (completions / engagements) * 100 : 0,
      skipRate: impressions > 0 ? (skips / impressions) * 100 : 0,
    };
  }

  private calculatePercentageChange(oldValue: number, newValue: number): number {
    if (oldValue === 0) return newValue > 0 ? 100 : 0;
    return ((newValue - oldValue) / oldValue) * 100;
  }

  private getEmptyMetrics(promptId: string): PromptUsageMetrics {
    return {
      promptId,
      impressions: 0,
      engagements: 0,
      completions: 0,
      skips: 0,
      averageStoryLength: 0,
      engagementRate: 0,
      completionRate: 0,
      skipRate: 0,
      lastUsed: new Date(0),
    };
  }

  private getEmptyReport(timeframe: string): PromptAnalyticsReport {
    return {
      timeframe,
      totalPrompts: 0,
      activePrompts: 0,
      topPerformingPrompts: [],
      underperformingPrompts: [],
      categoryPerformance: {},
      difficultyPerformance: {},
      trends: {
        engagementTrend: 0,
        completionTrend: 0,
        skipTrend: 0,
      },
    };
  }
}

export const PromptAnalyticsService = new PromptAnalyticsServiceClass();