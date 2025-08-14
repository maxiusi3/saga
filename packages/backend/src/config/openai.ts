import OpenAI from 'openai';

export const openaiConfig = {
  apiKey: process.env.OPENAI_API_KEY,
  organization: process.env.OPENAI_ORGANIZATION,
  project: process.env.OPENAI_PROJECT,
};

// Validate configuration
if (!openaiConfig.apiKey) {
  console.warn('OPENAI_API_KEY is not set. AI prompt generation will not work.');
}

export const openai = new OpenAI({
  apiKey: openaiConfig.apiKey,
  organization: openaiConfig.organization,
  project: openaiConfig.project,
});

// Default model configurations
export const modelConfigs = {
  promptGeneration: {
    model: 'gpt-4',
    temperature: 0.8,
    maxTokens: 200,
    topP: 1,
    frequencyPenalty: 0.2,
    presencePenalty: 0.1,
  },
  followUpQuestions: {
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 150,
    topP: 1,
    frequencyPenalty: 0.3,
    presencePenalty: 0.2,
  },
  storyAnalysis: {
    model: 'gpt-4',
    temperature: 0.3,
    maxTokens: 300,
    topP: 0.9,
    frequencyPenalty: 0.1,
    presencePenalty: 0.1,
  },
};

// System prompts for different use cases
export const systemPrompts = {
  promptGeneration: `You are an empathetic AI interviewer helping families preserve their stories through meaningful conversations.

Your role is to generate thoughtful, engaging prompts that help elderly storytellers share their life experiences with their adult children.

Guidelines:
- Create prompts that are emotionally resonant but not overwhelming
- Use warm, respectful language appropriate for elderly users
- Focus on specific memories rather than broad generalizations
- Avoid sensitive topics unless specifically requested
- Consider cultural background and personal preferences
- Make prompts accessible and easy to understand
- Encourage detailed, personal responses
- Be mindful of potential trauma or difficult memories

Generate prompts that would help preserve meaningful family stories and create connections between generations.`,

  followUpQuestions: `You are an empathetic interviewer helping families preserve their stories. 

Generate thoughtful follow-up questions based on the story content that would help the storyteller share more details or related memories. 

Guidelines:
- Questions should be specific to the content shared
- Be emotionally sensitive and respectful
- Design questions to elicit rich, detailed responses
- Appropriate for elderly storytellers
- Help explore emotions, relationships, and context
- Encourage storytelling rather than simple yes/no answers
- Be genuinely curious and caring in tone

Return only the questions, one per line, without numbering.`,

  storyAnalysis: `You are an AI assistant that analyzes personal stories to understand themes, emotions, and relationships.

Your role is to identify key elements in stories that can help generate related prompts and improve the storytelling experience.

Guidelines:
- Identify main themes and topics
- Recognize emotional content and tone
- Note relationships and people mentioned
- Understand time periods and contexts
- Respect privacy and sensitivity of personal stories
- Focus on constructive analysis for improving prompts
- Be culturally sensitive and inclusive

Provide analysis that helps create better, more personalized storytelling prompts.`,
};

// Rate limiting configuration
export const rateLimits = {
  promptGeneration: {
    requestsPerMinute: 10,
    requestsPerHour: 100,
    requestsPerDay: 500,
  },
  followUpQuestions: {
    requestsPerMinute: 15,
    requestsPerHour: 150,
    requestsPerDay: 750,
  },
};

// Error handling
export class OpenAIError extends Error {
  constructor(message: string, public code?: string, public statusCode?: number) {
    super(message);
    this.name = 'OpenAIError';
  }
}

export function handleOpenAIError(error: any): OpenAIError {
  if (error.response) {
    const { status, data } = error.response;
    return new OpenAIError(
      data.error?.message || 'OpenAI API error',
      data.error?.code,
      status
    );
  }
  
  if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
    return new OpenAIError('Unable to connect to OpenAI API', 'CONNECTION_ERROR');
  }
  
  return new OpenAIError(error.message || 'Unknown OpenAI error');
}

// Utility functions
export function validatePromptRequest(request: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!request.userId) {
    errors.push('User ID is required');
  }
  
  if (request.category && !['childhood', 'family', 'career', 'relationships', 'general'].includes(request.category)) {
    errors.push('Invalid category');
  }
  
  if (request.previousPrompts && !Array.isArray(request.previousPrompts)) {
    errors.push('Previous prompts must be an array');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

export function sanitizePromptText(text: string): string {
  // Remove any potentially harmful content
  return text
    .trim()
    .replace(/[<>]/g, '') // Remove HTML-like tags
    .replace(/\n{3,}/g, '\n\n') // Limit consecutive newlines
    .substring(0, 500); // Limit length
}