import OpenAI from 'openai';
import { ChapterSummaryModel } from '../models/chapter-summary';
import { StoryModel } from '../models/story';
import { 
  ChapterSummary, 
  ChapterSummaryGenerationRequest, 
  ChapterSummaryResponse,
  ThematicGroup,
  ChapterAnalysisResult,
  CreateChapterSummaryInput
} from '@saga/shared';

interface StoryForAnalysis {
  id: string;
  transcript?: string;
  aiPrompt?: string;
  createdAt: Date;
  title?: string;
}

class ChapterSummaryServiceClass {
  private openai: OpenAI;
  private readonly MIN_STORIES_FOR_CHAPTER = 3;
  private readonly MAX_STORIES_PER_CHAPTER = 10;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Analyze stories and suggest chapter groupings
   */
  async analyzeStoriesForChapters(projectId: string): Promise<ChapterAnalysisResult> {
    try {
      // Get all ready stories for the project
      const stories = await this.getStoriesForAnalysis(projectId);
      
      if (stories.length < this.MIN_STORIES_FOR_CHAPTER) {
        return {
          groups: [],
          suggestedChapters: [],
        };
      }

      // Group stories by themes using AI
      const groups = await this.groupStoriesByTheme(stories);
      
      // Generate chapter suggestions
      const suggestedChapters = groups
        .filter(group => group.stories.length >= this.MIN_STORIES_FOR_CHAPTER)
        .map(group => ({
          theme: group.theme,
          storyIds: group.stories.map(s => s.id),
          confidence: group.confidence,
        }));

      return {
        groups,
        suggestedChapters,
      };
    } catch (error) {
      console.error('Failed to analyze stories for chapters:', error);
      return {
        groups: [],
        suggestedChapters: [],
      };
    }
  }

  /**
   * Generate a chapter summary for a group of stories
   */
  async generateChapterSummary(request: ChapterSummaryGenerationRequest): Promise<ChapterSummaryResponse> {
    try {
      const systemPrompt = this.buildChapterSummarySystemPrompt();
      const userPrompt = this.buildChapterSummaryUserPrompt(request);

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 800,
        response_format: { type: 'json_object' },
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('Failed to generate chapter summary');
      }

      const parsedResponse = JSON.parse(response) as ChapterSummaryResponse;
      
      // Validate and clean the response
      return this.validateAndCleanSummaryResponse(parsedResponse);
    } catch (error) {
      console.error('Failed to generate chapter summary:', error);
      return this.getFallbackChapterSummary(request);
    }
  }

  /**
   * Create a new chapter summary
   */
  async createChapterSummary(input: CreateChapterSummaryInput): Promise<ChapterSummary> {
    try {
      // Get the stories for this chapter
      const stories = await this.getStoriesByIds(input.storyIds);
      
      if (stories.length === 0) {
        throw new Error('No valid stories found for chapter creation');
      }

      // Generate the chapter summary using AI
      const generationRequest: ChapterSummaryGenerationRequest = {
        projectId: input.projectId,
        stories: stories.map(story => ({
          id: story.id,
          transcript: story.transcript,
          aiPrompt: story.aiPrompt,
          createdAt: story.createdAt,
          title: story.title,
        })),
        theme: input.theme,
      };

      const summaryResponse = await this.generateChapterSummary(generationRequest);

      // Create the chapter summary in the database
      const chapterSummary = await ChapterSummaryModel.create({
        project_id: input.projectId,
        title: input.title || summaryResponse.title,
        description: summaryResponse.description,
        theme: summaryResponse.theme,
        story_ids: input.storyIds,
        key_highlights: summaryResponse.keyHighlights,
        timeframe: summaryResponse.timeframe,
        emotional_tone: summaryResponse.emotionalTone,
        status: 'ready',
      });

      return chapterSummary;
    } catch (error) {
      console.error('Failed to create chapter summary:', error);
      throw error;
    }
  }

  /**
   * Auto-generate chapter summaries for a project
   */
  async autoGenerateChapters(projectId: string): Promise<ChapterSummary[]> {
    try {
      const analysis = await this.analyzeStoriesForChapters(projectId);
      const createdChapters: ChapterSummary[] = [];

      for (const suggestion of analysis.suggestedChapters) {
        // Check if stories are already in a chapter
        const alreadyInChapter = await ChapterSummaryModel.areStoriesInChapter(
          projectId, 
          suggestion.storyIds
        );

        if (!alreadyInChapter) {
          try {
            const chapter = await this.createChapterSummary({
              projectId,
              storyIds: suggestion.storyIds,
              theme: suggestion.theme,
            });
            createdChapters.push(chapter);
          } catch (error) {
            console.error(`Failed to create chapter for theme ${suggestion.theme}:`, error);
          }
        }
      }

      return createdChapters;
    } catch (error) {
      console.error('Failed to auto-generate chapters:', error);
      return [];
    }
  }

  /**
   * Get chapter summaries for a project
   */
  async getChapterSummariesByProject(projectId: string): Promise<ChapterSummary[]> {
    return ChapterSummaryModel.findByProject(projectId);
  }

  /**
   * Get a specific chapter summary with stories
   */
  async getChapterSummaryWithStories(chapterId: string): Promise<(ChapterSummary & { stories: any[] }) | null> {
    const chapter = await ChapterSummaryModel.findById(chapterId);
    if (!chapter) return null;

    const stories = await this.getStoriesByIds(chapter.storyIds);
    
    return {
      ...chapter,
      stories,
    };
  }

  /**
   * Update chapter summary
   */
  async updateChapterSummary(
    chapterId: string, 
    updates: {
      title?: string;
      description?: string;
      keyHighlights?: string[];
    }
  ): Promise<ChapterSummary | null> {
    return ChapterSummaryModel.updateById(chapterId, updates);
  }

  /**
   * Delete chapter summary
   */
  async deleteChapterSummary(chapterId: string): Promise<boolean> {
    return ChapterSummaryModel.deleteById(chapterId);
  }

  /**
   * Get stories for analysis
   */
  private async getStoriesForAnalysis(projectId: string): Promise<StoryForAnalysis[]> {
    const stories = await StoryModel.query()
      .where('project_id', projectId)
      .where('status', 'ready')
      .whereNotNull('transcript')
      .orderBy('created_at', 'asc');

    return stories.map(story => ({
      id: story.id,
      transcript: story.transcript,
      aiPrompt: story.ai_prompt,
      createdAt: story.created_at,
      title: story.title,
    }));
  }

  /**
   * Get stories by IDs
   */
  private async getStoriesByIds(storyIds: string[]): Promise<any[]> {
    return StoryModel.query()
      .whereIn('id', storyIds)
      .where('status', 'ready')
      .orderBy('created_at', 'asc');
  }

  /**
   * Group stories by theme using AI
   */
  private async groupStoriesByTheme(stories: StoryForAnalysis[]): Promise<ThematicGroup[]> {
    try {
      const systemPrompt = `You are an expert at analyzing family stories and identifying thematic connections. 
      Your task is to group related stories into thematic clusters that would make meaningful chapters in a family biography.

      Guidelines:
      - Look for common themes, time periods, people, places, or life events
      - Each group should have 3-10 stories for optimal chapter length
      - Themes should be emotionally resonant and meaningful to families
      - Consider chronological progression when relevant
      - Avoid overly broad or overly narrow themes

      Return a JSON object with this structure:
      {
        "groups": [
          {
            "theme": "descriptive theme name",
            "storyIds": ["story1", "story2", ...],
            "confidence": 0.8,
            "keywords": ["keyword1", "keyword2", ...]
          }
        ]
      }`;

      const storyData = stories.map(story => ({
        id: story.id,
        content: story.transcript || story.aiPrompt || '',
        date: story.createdAt.toISOString(),
        title: story.title || 'Untitled Story',
      }));

      const userPrompt = `Analyze these family stories and group them into thematic chapters:

${JSON.stringify(storyData, null, 2)}

Group these stories into meaningful thematic chapters.`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.6,
        max_tokens: 1500,
        response_format: { type: 'json_object' },
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        return this.getFallbackGroups(stories);
      }

      const parsed = JSON.parse(response);
      
      return parsed.groups.map((group: any) => ({
        theme: group.theme,
        stories: stories.filter(story => group.storyIds.includes(story.id)),
        confidence: group.confidence || 0.5,
        keywords: group.keywords || [],
      }));
    } catch (error) {
      console.error('Failed to group stories by theme:', error);
      return this.getFallbackGroups(stories);
    }
  }

  /**
   * Build system prompt for chapter summary generation
   */
  private buildChapterSummarySystemPrompt(): string {
    return `You are an expert family biographer who creates meaningful chapter summaries for family story collections.

Your task is to analyze a group of related family stories and create a compelling chapter summary that:
- Captures the essence and emotional core of the stories
- Highlights key moments and insights
- Provides context and meaning for family members
- Uses warm, respectful language appropriate for all ages
- Creates a sense of narrative flow and connection

Return a JSON object with this exact structure:
{
  "title": "Chapter title (3-8 words)",
  "description": "Rich paragraph describing the chapter's content and significance (100-200 words)",
  "theme": "Single word or short phrase theme",
  "keyHighlights": ["3-5 key moments or insights from the stories"],
  "timeframe": {
    "start": "approximate start period (optional)",
    "end": "approximate end period (optional)"
  },
  "emotionalTone": "positive|neutral|reflective|bittersweet"
}`;
  }

  /**
   * Build user prompt for chapter summary generation
   */
  private buildChapterSummaryUserPrompt(request: ChapterSummaryGenerationRequest): string {
    const storyContents = request.stories.map(story => {
      const content = story.transcript || story.aiPrompt || '';
      const title = story.title || 'Untitled Story';
      const date = story.createdAt.toISOString().split('T')[0];
      
      return `Story: ${title} (${date})
Content: ${content.substring(0, 500)}${content.length > 500 ? '...' : ''}`;
    }).join('\n\n');

    let prompt = `Create a chapter summary for these related family stories:

${storyContents}

Number of stories: ${request.stories.length}`;

    if (request.theme) {
      prompt += `\nSuggested theme: ${request.theme}`;
    }

    prompt += '\n\nGenerate a meaningful chapter summary that captures the essence of these stories.';

    return prompt;
  }

  /**
   * Validate and clean summary response
   */
  private validateAndCleanSummaryResponse(response: any): ChapterSummaryResponse {
    return {
      title: response.title || 'Family Stories',
      description: response.description || 'A collection of meaningful family memories.',
      theme: response.theme || 'memories',
      keyHighlights: Array.isArray(response.keyHighlights) 
        ? response.keyHighlights.slice(0, 5) 
        : ['Shared family memories'],
      timeframe: response.timeframe || undefined,
      emotionalTone: ['positive', 'neutral', 'reflective', 'bittersweet'].includes(response.emotionalTone)
        ? response.emotionalTone
        : 'neutral',
    };
  }

  /**
   * Get fallback chapter summary when AI generation fails
   */
  private getFallbackChapterSummary(request: ChapterSummaryGenerationRequest): ChapterSummaryResponse {
    const storyCount = request.stories.length;
    const theme = request.theme || 'memories';
    
    return {
      title: `${theme.charAt(0).toUpperCase() + theme.slice(1)} Stories`,
      description: `A collection of ${storyCount} meaningful family stories that share common themes and experiences. These stories offer insights into important moments and relationships that have shaped our family's journey.`,
      theme,
      keyHighlights: [
        'Shared family experiences',
        'Important life moments',
        'Personal insights and reflections',
      ],
      emotionalTone: 'reflective',
    };
  }

  /**
   * Get fallback story groups when AI analysis fails
   */
  private getFallbackGroups(stories: StoryForAnalysis[]): ThematicGroup[] {
    // Simple chronological grouping as fallback
    const groups: ThematicGroup[] = [];
    const storiesPerGroup = Math.max(this.MIN_STORIES_FOR_CHAPTER, Math.ceil(stories.length / 3));
    
    for (let i = 0; i < stories.length; i += storiesPerGroup) {
      const groupStories = stories.slice(i, i + storiesPerGroup);
      if (groupStories.length >= this.MIN_STORIES_FOR_CHAPTER) {
        groups.push({
          theme: `Chapter ${Math.floor(i / storiesPerGroup) + 1}`,
          stories: groupStories,
          confidence: 0.5,
          keywords: ['family', 'memories'],
        });
      }
    }

    return groups;
  }
}

export const ChapterSummaryService = new ChapterSummaryServiceClass();