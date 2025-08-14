import { BaseService } from './base-service';
import { UserTestingFeedback, UsabilityIssue, BetaTester } from './user-acceptance-testing-service';
import { AnalyticsService } from './analytics-service';

export interface FeedbackAnalysis {
  overallMetrics: OverallMetrics;
  sentimentAnalysis: SentimentAnalysis;
  usabilityPatterns: UsabilityPattern[];
  demographicInsights: DemographicInsight[];
  prioritizedIssues: PrioritizedIssue[];
  actionableRecommendations: ActionableRecommendation[];
}

export interface OverallMetrics {
  totalFeedback: number;
  averageRating: number;
  completionRate: number;
  recommendationRate: number;
  averageSessionTime: number;
  issueFrequency: Record<string, number>;
  satisfactionTrend: number[];
}

export interface SentimentAnalysis {
  overallSentiment: 'positive' | 'neutral' | 'negative';
  sentimentScore: number; // -1 to 1
  positiveKeywords: string[];
  negativeKeywords: string[];
  emotionalIndicators: EmotionalIndicator[];
}

export interface EmotionalIndicator {
  emotion: 'frustration' | 'confusion' | 'satisfaction' | 'delight' | 'concern';
  frequency: number;
  examples: string[];
}

export interface UsabilityPattern {
  pattern: string;
  frequency: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedScenarios: string[];
  commonLocations: string[];
  suggestedFix: string;
}

export interface DemographicInsight {
  demographic: string;
  category: string; // age, tech_comfort, device_type
  averageRating: number;
  completionRate: number;
  commonIssues: string[];
  specificNeeds: string[];
}

export interface PrioritizedIssue {
  issue: UsabilityIssue;
  priority: number; // 1-10 scale
  impactScore: number;
  frequencyScore: number;
  severityScore: number;
  businessImpact: string;
  technicalComplexity: 'low' | 'medium' | 'high';
  estimatedEffort: string;
}

export interface ActionableRecommendation {
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: 'usability' | 'accessibility' | 'business' | 'technical';
  impact: string;
  effort: 'low' | 'medium' | 'high';
  timeline: string;
  successMetrics: string[];
  dependencies: string[];
}

export class UserFeedbackAnalyzer extends BaseService {
  private analyticsService: AnalyticsService;

  constructor() {
    super();
    this.analyticsService = new AnalyticsService();
  }

  /**
   * Perform comprehensive feedback analysis
   */
  async analyzeFeedback(
    feedback: UserTestingFeedback[],
    testers: BetaTester[]
  ): Promise<FeedbackAnalysis> {
    try {
      this.logger.info(`Analyzing ${feedback.length} feedback entries from ${testers.length} testers`);

      const overallMetrics = this.calculateOverallMetrics(feedback);
      const sentimentAnalysis = this.performSentimentAnalysis(feedback);
      const usabilityPatterns = this.identifyUsabilityPatterns(feedback);
      const demographicInsights = this.analyzeDemographicInsights(feedback, testers);
      const prioritizedIssues = this.prioritizeIssues(feedback);
      const actionableRecommendations = this.generateActionableRecommendations(
        feedback, 
        usabilityPatterns, 
        prioritizedIssues
      );

      // Track analysis completion
      await this.analyticsService.trackEvent('feedback_analysis_completed', {
        totalFeedback: feedback.length,
        averageRating: overallMetrics.averageRating,
        criticalIssues: prioritizedIssues.filter(i => i.issue.severity === 'critical').length,
        overallSentiment: sentimentAnalysis.overallSentiment
      });

      return {
        overallMetrics,
        sentimentAnalysis,
        usabilityPatterns,
        demographicInsights,
        prioritizedIssues,
        actionableRecommendations
      };
    } catch (error) {
      this.logger.error('Failed to analyze feedback:', error);
      throw error;
    }
  }

  /**
   * Calculate overall metrics
   */
  private calculateOverallMetrics(feedback: UserTestingFeedback[]): OverallMetrics {
    const totalFeedback = feedback.length;
    const averageRating = totalFeedback > 0 ? 
      feedback.reduce((sum, f) => sum + f.rating, 0) / totalFeedback : 0;
    const completionRate = totalFeedback > 0 ? 
      feedback.filter(f => f.completedSuccessfully).length / totalFeedback : 0;
    const recommendationRate = totalFeedback > 0 ? 
      feedback.filter(f => f.wouldRecommend).length / totalFeedback : 0;
    const averageSessionTime = totalFeedback > 0 ? 
      feedback.reduce((sum, f) => sum + f.completionTime, 0) / totalFeedback : 0;

    // Calculate issue frequency by category
    const allIssues = feedback.flatMap(f => f.usabilityIssues);
    const issueFrequency = allIssues.reduce((acc, issue) => {
      acc[issue.category] = (acc[issue.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Calculate satisfaction trend (simplified - would use time series in real implementation)
    const satisfactionTrend = feedback.map(f => f.rating);

    return {
      totalFeedback,
      averageRating,
      completionRate,
      recommendationRate,
      averageSessionTime,
      issueFrequency,
      satisfactionTrend
    };
  }

  /**
   * Perform sentiment analysis on feedback text
   */
  private performSentimentAnalysis(feedback: UserTestingFeedback[]): SentimentAnalysis {
    const allText = feedback.map(f => `${f.generalFeedback} ${f.suggestions}`).join(' ');
    
    // Simple sentiment analysis (in production, would use NLP service)
    const positiveWords = ['good', 'great', 'excellent', 'easy', 'intuitive', 'helpful', 'clear', 'smooth'];
    const negativeWords = ['bad', 'difficult', 'confusing', 'frustrating', 'slow', 'unclear', 'broken', 'hard'];
    
    const words = allText.toLowerCase().split(/\s+/);
    const positiveCount = words.filter(word => positiveWords.includes(word)).length;
    const negativeCount = words.filter(word => negativeWords.includes(word)).length;
    
    const sentimentScore = (positiveCount - negativeCount) / Math.max(words.length, 1);
    let overallSentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
    
    if (sentimentScore > 0.1) overallSentiment = 'positive';
    else if (sentimentScore < -0.1) overallSentiment = 'negative';

    // Extract emotional indicators
    const emotionalIndicators: EmotionalIndicator[] = [
      {
        emotion: 'frustration',
        frequency: words.filter(w => ['frustrating', 'annoying', 'difficult'].includes(w)).length,
        examples: feedback.filter(f => f.generalFeedback.toLowerCase().includes('frustrat')).map(f => f.generalFeedback).slice(0, 3)
      },
      {
        emotion: 'confusion',
        frequency: words.filter(w => ['confusing', 'unclear', 'lost'].includes(w)).length,
        examples: feedback.filter(f => f.generalFeedback.toLowerCase().includes('confus')).map(f => f.generalFeedback).slice(0, 3)
      },
      {
        emotion: 'satisfaction',
        frequency: words.filter(w => ['satisfied', 'happy', 'pleased'].includes(w)).length,
        examples: feedback.filter(f => f.generalFeedback.toLowerCase().includes('satisf')).map(f => f.generalFeedback).slice(0, 3)
      }
    ];

    return {
      overallSentiment,
      sentimentScore,
      positiveKeywords: positiveWords.filter(word => words.includes(word)),
      negativeKeywords: negativeWords.filter(word => words.includes(word)),
      emotionalIndicators
    };
  }

  /**
   * Identify usability patterns
   */
  private identifyUsabilityPatterns(feedback: UserTestingFeedback[]): UsabilityPattern[] {
    const allIssues = feedback.flatMap(f => f.usabilityIssues);
    const patterns: Map<string, UsabilityPattern> = new Map();

    // Group similar issues
    allIssues.forEach(issue => {
      const key = this.normalizeIssueDescription(issue.description);
      
      if (patterns.has(key)) {
        const pattern = patterns.get(key)!;
        pattern.frequency += 1;
        pattern.affectedScenarios = [...new Set([...pattern.affectedScenarios, issue.category])];
        pattern.commonLocations = [...new Set([...pattern.commonLocations, issue.location])];
        
        // Update severity to highest found
        if (this.getSeverityWeight(issue.severity) > this.getSeverityWeight(pattern.severity)) {
          pattern.severity = issue.severity;
        }
      } else {
        patterns.set(key, {
          pattern: key,
          frequency: 1,
          severity: issue.severity,
          affectedScenarios: [issue.category],
          commonLocations: [issue.location],
          suggestedFix: this.generateSuggestedFix(issue)
        });
      }
    });

    return Array.from(patterns.values())
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10); // Top 10 patterns
  }

  /**
   * Analyze demographic insights
   */
  private analyzeDemographicInsights(
    feedback: UserTestingFeedback[],
    testers: BetaTester[]
  ): DemographicInsight[] {
    const insights: DemographicInsight[] = [];

    // Group by age range
    const ageGroups = this.groupBy(testers, 'ageRange');
    Object.entries(ageGroups).forEach(([ageRange, groupTesters]) => {
      const groupFeedback = feedback.filter(f => 
        groupTesters.some(t => t.id === f.betaTesterId)
      );
      
      if (groupFeedback.length > 0) {
        insights.push({
          demographic: ageRange,
          category: 'age',
          averageRating: groupFeedback.reduce((sum, f) => sum + f.rating, 0) / groupFeedback.length,
          completionRate: groupFeedback.filter(f => f.completedSuccessfully).length / groupFeedback.length,
          commonIssues: this.extractCommonIssues(groupFeedback),
          specificNeeds: this.extractSpecificNeeds(groupFeedback, ageRange)
        });
      }
    });

    // Group by tech comfort
    const techGroups = this.groupBy(testers, 'techComfort');
    Object.entries(techGroups).forEach(([techLevel, groupTesters]) => {
      const groupFeedback = feedback.filter(f => 
        groupTesters.some(t => t.id === f.betaTesterId)
      );
      
      if (groupFeedback.length > 0) {
        insights.push({
          demographic: techLevel,
          category: 'tech_comfort',
          averageRating: groupFeedback.reduce((sum, f) => sum + f.rating, 0) / groupFeedback.length,
          completionRate: groupFeedback.filter(f => f.completedSuccessfully).length / groupFeedback.length,
          commonIssues: this.extractCommonIssues(groupFeedback),
          specificNeeds: this.extractSpecificNeeds(groupFeedback, techLevel)
        });
      }
    });

    return insights;
  }

  /**
   * Prioritize issues based on multiple factors
   */
  private prioritizeIssues(feedback: UserTestingFeedback[]): PrioritizedIssue[] {
    const allIssues = feedback.flatMap(f => f.usabilityIssues);
    const issueFrequency = new Map<string, number>();

    // Calculate frequency
    allIssues.forEach(issue => {
      const key = this.normalizeIssueDescription(issue.description);
      issueFrequency.set(key, (issueFrequency.get(key) || 0) + 1);
    });

    return allIssues.map(issue => {
      const frequency = issueFrequency.get(this.normalizeIssueDescription(issue.description)) || 1;
      const severityScore = this.getSeverityWeight(issue.severity);
      const impactScore = this.calculateImpactScore(issue, frequency);
      const frequencyScore = Math.min(frequency / allIssues.length * 10, 10);
      
      const priority = Math.round((severityScore * 0.4 + impactScore * 0.4 + frequencyScore * 0.2));

      return {
        issue,
        priority,
        impactScore,
        frequencyScore,
        severityScore,
        businessImpact: this.assessBusinessImpact(issue),
        technicalComplexity: this.assessTechnicalComplexity(issue),
        estimatedEffort: this.estimateEffort(issue)
      };
    })
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 20); // Top 20 prioritized issues
  }

  /**
   * Generate actionable recommendations
   */
  private generateActionableRecommendations(
    feedback: UserTestingFeedback[],
    patterns: UsabilityPattern[],
    prioritizedIssues: PrioritizedIssue[]
  ): ActionableRecommendation[] {
    const recommendations: ActionableRecommendation[] = [];

    // Critical issues recommendations
    const criticalIssues = prioritizedIssues.filter(i => i.issue.severity === 'critical');
    if (criticalIssues.length > 0) {
      recommendations.push({
        title: 'Address Critical Usability Issues',
        description: `Fix ${criticalIssues.length} critical issues that prevent task completion`,
        priority: 'critical',
        category: 'usability',
        impact: 'Prevents user frustration and task abandonment',
        effort: 'high',
        timeline: 'Immediate (before launch)',
        successMetrics: ['Zero critical issues in follow-up testing', 'Improved task completion rate'],
        dependencies: ['Development team availability', 'QA testing resources']
      });
    }

    // Accessibility recommendations
    const accessibilityIssues = prioritizedIssues.filter(i => i.issue.category === 'accessibility');
    if (accessibilityIssues.length > 0) {
      recommendations.push({
        title: 'Improve Accessibility Compliance',
        description: `Address ${accessibilityIssues.length} accessibility issues to meet WCAG 2.1 AA standards`,
        priority: 'high',
        category: 'accessibility',
        impact: 'Ensures platform is usable by users with disabilities',
        effort: 'medium',
        timeline: '2-3 weeks',
        successMetrics: ['WCAG 2.1 AA compliance', 'Positive feedback from accessibility users'],
        dependencies: ['Accessibility audit', 'Screen reader testing']
      });
    }

    // Pattern-based recommendations
    const topPatterns = patterns.slice(0, 3);
    topPatterns.forEach(pattern => {
      recommendations.push({
        title: `Fix Common ${pattern.pattern} Issues`,
        description: `Address recurring pattern affecting ${pattern.frequency} users`,
        priority: pattern.severity === 'critical' ? 'critical' : 'high',
        category: 'usability',
        impact: `Improves experience for ${pattern.frequency} users`,
        effort: 'medium',
        timeline: '1-2 weeks',
        successMetrics: ['Reduced issue frequency', 'Improved user satisfaction'],
        dependencies: ['Root cause analysis', 'Design review']
      });
    });

    // Business model recommendations
    const lowRatings = feedback.filter(f => f.rating < 3).length;
    if (lowRatings > feedback.length * 0.2) {
      recommendations.push({
        title: 'Clarify Value Proposition',
        description: 'Improve communication of pricing and package benefits',
        priority: 'high',
        category: 'business',
        impact: 'Increases user understanding and purchase conversion',
        effort: 'low',
        timeline: '1 week',
        successMetrics: ['Improved user ratings', 'Better pricing feedback'],
        dependencies: ['Marketing team input', 'Content updates']
      });
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  // Helper methods
  private normalizeIssueDescription(description: string): string {
    return description.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(' ')
      .filter(word => word.length > 3)
      .slice(0, 3)
      .join(' ');
  }

  private getSeverityWeight(severity: string): number {
    const weights = { critical: 10, high: 7, medium: 4, low: 1 };
    return weights[severity as keyof typeof weights] || 1;
  }

  private calculateImpactScore(issue: UsabilityIssue, frequency: number): number {
    let score = frequency * 2; // Base frequency impact
    
    // Adjust based on category
    if (issue.category === 'functionality') score += 3;
    if (issue.category === 'accessibility') score += 2;
    if (issue.category === 'navigation') score += 2;
    
    return Math.min(score, 10);
  }

  private assessBusinessImpact(issue: UsabilityIssue): string {
    if (issue.severity === 'critical') {
      return 'High - May prevent user adoption and cause negative reviews';
    }
    if (issue.category === 'functionality') {
      return 'Medium - Affects core user workflows and satisfaction';
    }
    return 'Low - Minor impact on user experience';
  }

  private assessTechnicalComplexity(issue: UsabilityIssue): 'low' | 'medium' | 'high' {
    if (issue.category === 'accessibility') return 'medium';
    if (issue.category === 'performance') return 'high';
    if (issue.category === 'content') return 'low';
    return 'medium';
  }

  private estimateEffort(issue: UsabilityIssue): string {
    const complexity = this.assessTechnicalComplexity(issue);
    const severity = issue.severity;
    
    if (complexity === 'high' || severity === 'critical') {
      return '1-2 weeks';
    }
    if (complexity === 'medium') {
      return '3-5 days';
    }
    return '1-2 days';
  }

  private generateSuggestedFix(issue: UsabilityIssue): string {
    if (issue.category === 'navigation') {
      return 'Improve navigation clarity and add visual indicators';
    }
    if (issue.category === 'accessibility') {
      return 'Add proper ARIA labels and keyboard navigation support';
    }
    if (issue.category === 'performance') {
      return 'Optimize loading times and add progress indicators';
    }
    return 'Review and improve based on user feedback';
  }

  private groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
    return array.reduce((groups, item) => {
      const value = String(item[key]);
      groups[value] = groups[value] || [];
      groups[value].push(item);
      return groups;
    }, {} as Record<string, T[]>);
  }

  private extractCommonIssues(feedback: UserTestingFeedback[]): string[] {
    const allIssues = feedback.flatMap(f => f.usabilityIssues);
    const issueFrequency = new Map<string, number>();

    allIssues.forEach(issue => {
      const key = issue.category;
      issueFrequency.set(key, (issueFrequency.get(key) || 0) + 1);
    });

    return Array.from(issueFrequency.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([category]) => category);
  }

  private extractSpecificNeeds(feedback: UserTestingFeedback[], demographic: string): string[] {
    const needs: string[] = [];
    
    if (demographic.includes('75+')) {
      needs.push('Larger font sizes', 'Simplified navigation', 'Clear instructions');
    }
    if (demographic === 'low') {
      needs.push('More guidance', 'Simplified interface', 'Better help documentation');
    }
    
    return needs;
  }
}