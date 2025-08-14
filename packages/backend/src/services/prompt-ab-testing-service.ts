import { Prompt } from '../models/prompt';
import { BaseModel } from '../models/base';

interface ABTestConfig {
  id: string;
  name: string;
  description: string;
  variants: ABTestVariant[];
  trafficSplit: number[]; // e.g., [50, 50] for 50/50 split
  status: 'draft' | 'running' | 'paused' | 'completed';
  startDate?: Date;
  endDate?: Date;
  targetMetric: 'engagement' | 'completion' | 'skip_rate' | 'story_length';
  createdAt: Date;
  updatedAt: Date;
}

interface ABTestVariant {
  id: string;
  name: string;
  promptId: string;
  trafficPercentage: number;
}

interface ABTestResult {
  testId: string;
  variant: ABTestVariant;
  metrics: {
    impressions: number;
    engagements: number;
    completions: number;
    skips: number;
    averageStoryLength: number;
    engagementRate: number;
    completionRate: number;
    skipRate: number;
  };
  significance: number; // Statistical significance (0-1)
  winner?: boolean;
}

class PromptABTestingServiceClass {
  private db = BaseModel.db;

  /**
   * Create a new A/B test
   */
  async createABTest(config: Omit<ABTestConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<ABTestConfig> {
    try {
      // Validate traffic split
      const totalTraffic = config.trafficSplit.reduce((sum, split) => sum + split, 0);
      if (totalTraffic !== 100) {
        throw new Error('Traffic split must total 100%');
      }

      if (config.variants.length !== config.trafficSplit.length) {
        throw new Error('Number of variants must match traffic split array length');
      }

      // Validate that all prompt IDs exist
      for (const variant of config.variants) {
        const prompt = await Prompt.findById(variant.promptId);
        if (!prompt) {
          throw new Error(`Prompt ${variant.promptId} not found`);
        }
      }

      const testConfig: ABTestConfig = {
        ...config,
        id: this.generateTestId(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Store in database (you would create an ab_tests table)
      await this.db('ab_tests').insert({
        id: testConfig.id,
        name: testConfig.name,
        description: testConfig.description,
        variants: JSON.stringify(testConfig.variants),
        traffic_split: JSON.stringify(testConfig.trafficSplit),
        status: testConfig.status,
        start_date: testConfig.startDate,
        end_date: testConfig.endDate,
        target_metric: testConfig.targetMetric,
        created_at: testConfig.createdAt,
        updated_at: testConfig.updatedAt,
      });

      return testConfig;
    } catch (error) {
      console.error('Failed to create A/B test:', error);
      throw error;
    }
  }

  /**
   * Get a prompt variant for A/B testing
   */
  async getPromptVariant(userId: string, category?: string): Promise<{ promptId: string; testId?: string; variantId?: string }> {
    try {
      // Get active A/B tests for the category
      const activeTests = await this.getActiveTests(category);
      
      if (activeTests.length === 0) {
        // No active tests, return regular prompt
        const prompt = await this.getRegularPrompt(category);
        return { promptId: prompt.data.id };
      }

      // Select a test based on user hash (consistent assignment)
      const selectedTest = this.selectTestForUser(userId, activeTests);
      if (!selectedTest) {
        const prompt = await this.getRegularPrompt(category);
        return { promptId: prompt.data.id };
      }

      // Select variant within the test
      const variant = this.selectVariantForUser(userId, selectedTest);
      
      // Log the assignment
      await this.logTestAssignment(userId, selectedTest.id, variant.id);

      return {
        promptId: variant.promptId,
        testId: selectedTest.id,
        variantId: variant.id,
      };
    } catch (error) {
      console.error('Failed to get prompt variant:', error);
      // Fallback to regular prompt
      const prompt = await this.getRegularPrompt(category);
      return { promptId: prompt.data.id };
    }
  }

  /**
   * Record test interaction (engagement, completion, skip)
   */
  async recordTestInteraction(
    userId: string,
    testId: string,
    variantId: string,
    interaction: 'impression' | 'engagement' | 'completion' | 'skip',
    metadata?: { storyLength?: number }
  ): Promise<void> {
    try {
      await this.db('ab_test_interactions').insert({
        user_id: userId,
        test_id: testId,
        variant_id: variantId,
        interaction_type: interaction,
        metadata: metadata ? JSON.stringify(metadata) : null,
        created_at: new Date(),
      });
    } catch (error) {
      console.error('Failed to record test interaction:', error);
    }
  }

  /**
   * Get A/B test results
   */
  async getTestResults(testId: string): Promise<ABTestResult[]> {
    try {
      const test = await this.getTestById(testId);
      if (!test) {
        throw new Error('Test not found');
      }

      const results: ABTestResult[] = [];

      for (const variant of test.variants) {
        const metrics = await this.calculateVariantMetrics(testId, variant.id);
        const result: ABTestResult = {
          testId,
          variant,
          metrics,
          significance: await this.calculateStatisticalSignificance(testId, variant.id),
        };
        results.push(result);
      }

      // Determine winner
      const winner = this.determineWinner(results, test.targetMetric);
      if (winner) {
        winner.winner = true;
      }

      return results;
    } catch (error) {
      console.error('Failed to get test results:', error);
      return [];
    }
  } 
 /**
   * Get active A/B tests
   */
  private async getActiveTests(category?: string): Promise<ABTestConfig[]> {
    try {
      let query = this.db('ab_tests')
        .where('status', 'running')
        .where('start_date', '<=', new Date())
        .where(function() {
          this.whereNull('end_date').orWhere('end_date', '>', new Date());
        });

      const results = await query;
      
      return results.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        variants: JSON.parse(row.variants),
        trafficSplit: JSON.parse(row.traffic_split),
        status: row.status,
        startDate: row.start_date,
        endDate: row.end_date,
        targetMetric: row.target_metric,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    } catch (error) {
      console.error('Failed to get active tests:', error);
      return [];
    }
  }

  /**
   * Select test for user based on consistent hashing
   */
  private selectTestForUser(userId: string, tests: ABTestConfig[]): ABTestConfig | null {
    if (tests.length === 0) return null;
    
    // Use simple hash for consistent assignment
    const hash = this.hashUserId(userId);
    const testIndex = hash % tests.length;
    return tests[testIndex];
  }

  /**
   * Select variant for user within a test
   */
  private selectVariantForUser(userId: string, test: ABTestConfig): ABTestVariant {
    const hash = this.hashUserId(userId + test.id);
    const percentage = hash % 100;
    
    let cumulativePercentage = 0;
    for (let i = 0; i < test.variants.length; i++) {
      cumulativePercentage += test.trafficSplit[i];
      if (percentage < cumulativePercentage) {
        return test.variants[i];
      }
    }
    
    // Fallback to first variant
    return test.variants[0];
  }

  /**
   * Simple hash function for user ID
   */
  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Log test assignment
   */
  private async logTestAssignment(userId: string, testId: string, variantId: string): Promise<void> {
    try {
      await this.db('ab_test_assignments').insert({
        user_id: userId,
        test_id: testId,
        variant_id: variantId,
        assigned_at: new Date(),
      }).onConflict(['user_id', 'test_id']).ignore();
    } catch (error) {
      console.error('Failed to log test assignment:', error);
    }
  }

  /**
   * Get regular prompt (non-test)
   */
  private async getRegularPrompt(category?: string): Promise<Prompt> {
    const prompts = await Prompt.findLibraryPrompts({
      category: category as any,
      limit: 1,
    });
    
    if (prompts.length === 0) {
      throw new Error('No prompts available');
    }
    
    return prompts[0];
  }

  /**
   * Calculate metrics for a variant
   */
  private async calculateVariantMetrics(testId: string, variantId: string): Promise<ABTestResult['metrics']> {
    try {
      const interactions = await this.db('ab_test_interactions')
        .where('test_id', testId)
        .where('variant_id', variantId);

      const impressions = interactions.filter(i => i.interaction_type === 'impression').length;
      const engagements = interactions.filter(i => i.interaction_type === 'engagement').length;
      const completions = interactions.filter(i => i.interaction_type === 'completion').length;
      const skips = interactions.filter(i => i.interaction_type === 'skip').length;

      const storyLengths = interactions
        .filter(i => i.metadata)
        .map(i => {
          try {
            const metadata = JSON.parse(i.metadata);
            return metadata.storyLength || 0;
          } catch {
            return 0;
          }
        })
        .filter(length => length > 0);

      const averageStoryLength = storyLengths.length > 0 
        ? storyLengths.reduce((sum, length) => sum + length, 0) / storyLengths.length 
        : 0;

      return {
        impressions,
        engagements,
        completions,
        skips,
        averageStoryLength,
        engagementRate: impressions > 0 ? (engagements / impressions) * 100 : 0,
        completionRate: engagements > 0 ? (completions / engagements) * 100 : 0,
        skipRate: impressions > 0 ? (skips / impressions) * 100 : 0,
      };
    } catch (error) {
      console.error('Failed to calculate variant metrics:', error);
      return {
        impressions: 0,
        engagements: 0,
        completions: 0,
        skips: 0,
        averageStoryLength: 0,
        engagementRate: 0,
        completionRate: 0,
        skipRate: 0,
      };
    }
  }

  /**
   * Calculate statistical significance (simplified)
   */
  private async calculateStatisticalSignificance(testId: string, variantId: string): Promise<number> {
    // This is a simplified implementation
    // In production, you'd use proper statistical tests like chi-square or t-test
    try {
      const interactions = await this.db('ab_test_interactions')
        .where('test_id', testId)
        .where('variant_id', variantId);

      const sampleSize = interactions.length;
      
      // Simple significance based on sample size
      if (sampleSize < 30) return 0;
      if (sampleSize < 100) return 0.8;
      if (sampleSize < 1000) return 0.9;
      return 0.95;
    } catch (error) {
      console.error('Failed to calculate statistical significance:', error);
      return 0;
    }
  }

  /**
   * Determine winner based on target metric
   */
  private determineWinner(results: ABTestResult[], targetMetric: string): ABTestResult | null {
    if (results.length < 2) return null;

    let bestResult = results[0];
    let bestValue = this.getMetricValue(bestResult, targetMetric);

    for (let i = 1; i < results.length; i++) {
      const currentValue = this.getMetricValue(results[i], targetMetric);
      const isHigherBetter = ['engagement', 'completion', 'story_length'].includes(targetMetric);
      
      if (isHigherBetter ? currentValue > bestValue : currentValue < bestValue) {
        bestResult = results[i];
        bestValue = currentValue;
      }
    }

    // Only declare winner if statistically significant
    return bestResult.significance >= 0.9 ? bestResult : null;
  }

  /**
   * Get metric value for comparison
   */
  private getMetricValue(result: ABTestResult, targetMetric: string): number {
    switch (targetMetric) {
      case 'engagement':
        return result.metrics.engagementRate;
      case 'completion':
        return result.metrics.completionRate;
      case 'skip_rate':
        return result.metrics.skipRate;
      case 'story_length':
        return result.metrics.averageStoryLength;
      default:
        return result.metrics.engagementRate;
    }
  }

  /**
   * Get test by ID
   */
  private async getTestById(testId: string): Promise<ABTestConfig | null> {
    try {
      const row = await this.db('ab_tests').where('id', testId).first();
      if (!row) return null;

      return {
        id: row.id,
        name: row.name,
        description: row.description,
        variants: JSON.parse(row.variants),
        trafficSplit: JSON.parse(row.traffic_split),
        status: row.status,
        startDate: row.start_date,
        endDate: row.end_date,
        targetMetric: row.target_metric,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    } catch (error) {
      console.error('Failed to get test by ID:', error);
      return null;
    }
  }

  /**
   * Generate unique test ID
   */
  private generateTestId(): string {
    return `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const PromptABTestingService = new PromptABTestingServiceClass();