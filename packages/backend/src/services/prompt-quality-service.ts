import OpenAI from 'openai';
import { Prompt } from '../models/prompt';

interface PromptQualityScore {
  overall: number; // 0-100
  clarity: number; // 0-100
  engagement: number; // 0-100
  specificity: number; // 0-100
  culturalSensitivity: number; // 0-100
  feedback: string[];
  suggestions: string[];
}

interface PromptQualityAnalysis {
  promptId: string;
  score: PromptQualityScore;
  analyzedAt: Date;
}

class PromptQualityServiceClass {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Analyze and score a prompt's quality
   */
  async analyzePromptQuality(promptId: string): Promise<PromptQualityAnalysis> {
    try {
      const prompt = await Prompt.findById(promptId);
      if (!prompt) {
        throw new Error('Prompt not found');
      }

      const score = await this.generateQualityScore(prompt);

      return {
        promptId,
        score,
        analyzedAt: new Date(),
      };
    } catch (error) {
      console.error('Failed to analyze prompt quality:', error);
      throw error;
    }
  }

  /**
   * Batch analyze multiple prompts
   */
  async batchAnalyzePrompts(promptIds: string[]): Promise<PromptQualityAnalysis[]> {
    const analyses: PromptQualityAnalysis[] = [];

    for (const promptId of promptIds) {
      try {
        const analysis = await this.analyzePromptQuality(promptId);
        analyses.push(analysis);
      } catch (error) {
        console.error(`Failed to analyze prompt ${promptId}:`, error);
      }
    }

    return analyses;
  }

  /**
   * Get quality recommendations for improving a prompt
   */
  async getImprovementSuggestions(promptId: string): Promise<string[]> {
    try {
      const analysis = await this.analyzePromptQuality(promptId);
      return analysis.score.suggestions;
    } catch (error) {
      console.error('Failed to get improvement suggestions:', error);
      return [];
    }
  }

  /**
   * Generate quality score using AI analysis
   */
  private async generateQualityScore(prompt: Prompt): Promise<PromptQualityScore> {
    try {
      const systemPrompt = this.buildQualityAnalysisSystemPrompt();
      const userPrompt = this.buildQualityAnalysisUserPrompt(prompt);

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 800,
        response_format: { type: 'json_object' },
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        return this.getFallbackQualityScore();
      }

      const parsed = JSON.parse(response);
      return this.validateAndCleanQualityScore(parsed);
    } catch (error) {
      console.error('Failed to generate AI quality score:', error);
      return this.getFallbackQualityScore();
    }
  }  
/**
   * Build system prompt for quality analysis
   */
  private buildQualityAnalysisSystemPrompt(): string {
    return `You are an expert at evaluating storytelling prompts for elderly users in family biography applications.

Your task is to analyze prompts and provide quality scores based on these criteria:

1. **Clarity** (0-100): How clear and easy to understand is the prompt?
2. **Engagement** (0-100): How likely is this prompt to elicit meaningful, detailed responses?
3. **Specificity** (0-100): Is the prompt specific enough to trigger concrete memories?
4. **Cultural Sensitivity** (0-100): Is the prompt respectful and inclusive of diverse backgrounds?

Guidelines for high-quality prompts:
- Use warm, respectful language appropriate for elderly users
- Focus on specific memories rather than broad generalizations
- Avoid potentially traumatic or sensitive topics
- Encourage detailed, personal responses
- Be culturally sensitive and inclusive
- Use accessible language that's easy to understand

Return a JSON object with this structure:
{
  "clarity": 85,
  "engagement": 90,
  "specificity": 75,
  "culturalSensitivity": 95,
  "overall": 86,
  "feedback": ["Positive aspects of the prompt"],
  "suggestions": ["Specific ways to improve the prompt"]
}`;
  }

  /**
   * Build user prompt for quality analysis
   */
  private buildQualityAnalysisUserPrompt(prompt: Prompt): string {
    return `Analyze this storytelling prompt for quality:

Prompt Text: "${prompt.data.text}"
Category: ${prompt.data.category}
Difficulty: ${prompt.data.difficulty}
Tags: ${prompt.getTags().join(', ')}
Follow-up Questions: ${prompt.getFollowUpQuestions().length} questions

Provide detailed quality analysis and scoring.`;
  }

  /**
   * Validate and clean quality score response
   */
  private validateAndCleanQualityScore(parsed: any): PromptQualityScore {
    const score: PromptQualityScore = {
      clarity: Math.max(0, Math.min(100, parsed.clarity || 50)),
      engagement: Math.max(0, Math.min(100, parsed.engagement || 50)),
      specificity: Math.max(0, Math.min(100, parsed.specificity || 50)),
      culturalSensitivity: Math.max(0, Math.min(100, parsed.culturalSensitivity || 50)),
      overall: 0,
      feedback: Array.isArray(parsed.feedback) ? parsed.feedback.slice(0, 5) : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 5) : [],
    };

    // Calculate overall score as weighted average
    score.overall = Math.round(
      (score.clarity * 0.2 + 
       score.engagement * 0.4 + 
       score.specificity * 0.3 + 
       score.culturalSensitivity * 0.1)
    );

    return score;
  }

  /**
   * Get fallback quality score when AI analysis fails
   */
  private getFallbackQualityScore(): PromptQualityScore {
    return {
      clarity: 70,
      engagement: 70,
      specificity: 70,
      culturalSensitivity: 80,
      overall: 72,
      feedback: ['Unable to analyze prompt quality automatically'],
      suggestions: ['Manual review recommended'],
    };
  }

  /**
   * Get quality statistics for all library prompts
   */
  async getLibraryQualityStats(): Promise<{
    averageScore: number;
    scoreDistribution: Record<string, number>;
    lowQualityPrompts: string[];
    highQualityPrompts: string[];
  }> {
    try {
      const prompts = await Prompt.findLibraryPrompts();
      const analyses: PromptQualityAnalysis[] = [];

      // Analyze a sample of prompts (to avoid rate limits)
      const sampleSize = Math.min(20, prompts.length);
      const samplePrompts = prompts.slice(0, sampleSize);

      for (const prompt of samplePrompts) {
        try {
          const analysis = await this.analyzePromptQuality(prompt.data.id);
          analyses.push(analysis);
        } catch (error) {
          console.error(`Failed to analyze prompt ${prompt.data.id}:`, error);
        }
      }

      if (analyses.length === 0) {
        return {
          averageScore: 0,
          scoreDistribution: {},
          lowQualityPrompts: [],
          highQualityPrompts: [],
        };
      }

      const scores = analyses.map(a => a.score.overall);
      const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;

      const scoreDistribution: Record<string, number> = {
        'excellent (90-100)': 0,
        'good (80-89)': 0,
        'fair (70-79)': 0,
        'poor (60-69)': 0,
        'very poor (0-59)': 0,
      };

      const lowQualityPrompts: string[] = [];
      const highQualityPrompts: string[] = [];

      analyses.forEach(analysis => {
        const score = analysis.score.overall;
        
        if (score >= 90) {
          scoreDistribution['excellent (90-100)']++;
          highQualityPrompts.push(analysis.promptId);
        } else if (score >= 80) {
          scoreDistribution['good (80-89)']++;
        } else if (score >= 70) {
          scoreDistribution['fair (70-79)']++;
        } else if (score >= 60) {
          scoreDistribution['poor (60-69)']++;
          lowQualityPrompts.push(analysis.promptId);
        } else {
          scoreDistribution['very poor (0-59)']++;
          lowQualityPrompts.push(analysis.promptId);
        }
      });

      return {
        averageScore: Math.round(averageScore),
        scoreDistribution,
        lowQualityPrompts,
        highQualityPrompts,
      };
    } catch (error) {
      console.error('Failed to get library quality stats:', error);
      return {
        averageScore: 0,
        scoreDistribution: {},
        lowQualityPrompts: [],
        highQualityPrompts: [],
      };
    }
  }
}

export const PromptQualityService = new PromptQualityServiceClass();