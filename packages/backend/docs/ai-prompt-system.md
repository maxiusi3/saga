# AI Prompt Generation System

This document describes the AI-powered prompt generation system that creates personalized storytelling prompts for elderly users.

## Overview

The AI Prompt System combines a curated library of high-quality prompts with AI-generated personalized prompts to create engaging storytelling experiences. The system uses OpenAI's GPT-4 to generate contextually relevant prompts based on user preferences, previous stories, and cultural background.

## Architecture

### Components

1. **AIPromptService** - Core service for prompt generation and management
2. **Prompt Model** - Database model for storing prompts
3. **UserPrompt Model** - Tracks user interactions with prompts
4. **PromptController** - API endpoints for prompt operations
5. **Prompt Library** - Curated collection of high-quality prompts

### Database Schema

#### Prompts Table
```sql
CREATE TABLE prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text TEXT NOT NULL,
  audio_url VARCHAR(255),
  category prompt_category NOT NULL,
  difficulty prompt_difficulty NOT NULL,
  follow_up_questions JSON,
  tags JSON,
  personalized_for UUID REFERENCES users(id),
  is_library_prompt BOOLEAN DEFAULT false,
  template_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### User Prompts Table
```sql
CREATE TABLE user_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  prompt_id UUID NOT NULL REFERENCES prompts(id),
  status prompt_status NOT NULL,
  skip_reason TEXT,
  story_id UUID REFERENCES stories(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, prompt_id)
);
```

## API Endpoints

### GET /api/prompts/daily
Get the daily prompt for a user.

**Response:**
```json
{
  "id": "prompt-123",
  "text": "Tell me about your favorite childhood memory.",
  "category": "childhood",
  "difficulty": "easy",
  "followUpQuestions": [
    "Who else was there with you?",
    "How did that make you feel?"
  ],
  "tags": ["memory", "emotion"],
  "createdAt": "2024-01-15T10:00:00Z"
}
```

### POST /api/prompts/personalized
Generate a personalized prompt using AI.

**Request:**
```json
{
  "category": "family",
  "previousPrompts": ["prompt-1", "prompt-2"],
  "userPreferences": {
    "topics": ["traditions", "holidays"],
    "avoidTopics": ["illness", "death"],
    "culturalBackground": "Italian-American",
    "ageRange": "75-85"
  },
  "storyContext": {
    "recentStories": [...],
    "themes": ["family", "cooking"]
  }
}
```

### GET /api/prompts/category/:category
Get a prompt from a specific category.

**Parameters:**
- `category`: childhood, family, career, relationships, general
- `difficulty` (query): easy, medium, hard
- `exclude` (query): comma-separated list of prompt IDs to exclude

### GET /api/prompts/related/:storyId
Get prompts related to a specific story.

**Parameters:**
- `count` (query): number of prompts to return (default: 3)

### POST /api/prompts/:promptId/used
Mark a prompt as used by the user.

### POST /api/prompts/:promptId/skip
Mark a prompt as skipped with optional reason.

**Request:**
```json
{
  "reason": "Too personal"
}
```

### POST /api/prompts/:promptId/customize
Customize a prompt based on user preferences.

**Request:**
```json
{
  "tone": "warm",
  "complexity": "detailed",
  "focus": "emotions",
  "culturalContext": "Italian-American",
  "personalTriggers": ["cooking", "family gatherings"]
}
```

**Response:**
```json
{
  "id": "customized-prompt-123",
  "text": "Tell me about a cherished family cooking tradition that brings warmth to your heart. What made those moments in the kitchen so special?",
  "category": "family",
  "difficulty": "medium",
  "tags": ["customized", "cooking", "family"],
  "personalizedFor": "user-123",
  "createdAt": "2024-01-15T10:00:00Z"
}
```

### GET /api/prompts/preferences/customization
Get user's prompt customization preferences.

### POST /api/prompts/preferences/customization
Save user's prompt customization preferences.

**Request:**
```json
{
  "tone": "warm",
  "complexity": "simple",
  "focus": "emotions"
}
```

## Prompt Generation Process

### 1. Context Building
The system builds user context from:
- User profile (age, cultural background)
- Recent stories and themes
- Previous prompt interactions
- User preferences and topics to avoid

### 2. AI Generation
Using OpenAI GPT-4 with carefully crafted system prompts:

```typescript
const systemPrompt = `You are an empathetic AI interviewer helping families preserve their stories through meaningful conversations.

Your role is to generate thoughtful, engaging prompts that help elderly storytellers share their life experiences with their adult children.

Guidelines:
- Create prompts that are emotionally resonant but not overwhelming
- Use warm, respectful language appropriate for elderly users
- Focus on specific memories rather than broad generalizations
- Avoid sensitive topics unless specifically requested
- Consider cultural background and personal preferences
- Make prompts accessible and easy to understand

Generate a single, specific prompt that would help this person share a meaningful memory.`;
```

### 3. Quality Assurance
Generated prompts are:
- Validated for appropriate length (10-200 characters)
- Checked for question format
- Categorized automatically
- Assigned difficulty levels
- Enhanced with follow-up questions

### 4. Caching and Optimization
- Prompts are cached to avoid redundant API calls
- Daily prompts are cached per user per day
- Rate limiting prevents API abuse

## Prompt Library

### Categories

1. **Childhood** - Early memories, school, play, family life
2. **Family** - Parents, siblings, traditions, relationships
3. **Career** - Work experiences, achievements, challenges
4. **Relationships** - Friends, romance, marriage, social life
5. **General** - Life lessons, historical events, wisdom

### Difficulty Levels

- **Easy** - Simple, positive memories that are easy to recall
- **Medium** - More complex topics requiring reflection
- **Hard** - Challenging or potentially emotional topics

### Quality Standards

All library prompts must:
- Be culturally sensitive and inclusive
- Use clear, accessible language
- Focus on specific rather than general memories
- Include 2-3 relevant follow-up questions
- Be tagged with relevant themes
- Be tested with real users

## Follow-up Question Generation

The system automatically generates contextual follow-up questions based on story content:

```typescript
const followUpPrompt = `Generate 2-3 thoughtful follow-up questions based on the story content that would help the storyteller share more details or related memories.

Guidelines:
- Questions should be specific to the content shared
- Be emotionally sensitive and respectful
- Design questions to elicit rich, detailed responses
- Appropriate for elderly storytellers
- Help explore emotions, relationships, and context

Return only the questions, one per line.`;
```

## Configuration

### Environment Variables

```bash
# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key
OPENAI_ORGANIZATION=your-org-id  # Optional
OPENAI_PROJECT=your-project-id   # Optional

# Rate Limiting
OPENAI_REQUESTS_PER_MINUTE=10
OPENAI_REQUESTS_PER_HOUR=100
OPENAI_REQUESTS_PER_DAY=500
```

### Model Configuration

```typescript
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
  },
};
```

## Management Tools

### CLI Commands

```bash
# List prompts in library
npm run prompts:list

# Add new prompt
npm run prompts:add -- --text "Your prompt text" --category childhood --difficulty easy

# Show statistics
npm run prompts:stats

# Validate all prompts
npm run prompts:validate

# Test AI generation
npm run prompts:test -- --user user-123 --category family
```

### Database Seeding

```bash
# Seed initial prompt library
npm run db:seed
```

## Monitoring and Analytics

### Key Metrics

1. **Prompt Usage**
   - Daily active prompts
   - Category preferences
   - Skip rates by category/difficulty
   - User engagement patterns

2. **AI Generation**
   - API response times
   - Generation success rates
   - Cost per prompt generated
   - Quality feedback scores

3. **User Behavior**
   - Prompt completion rates
   - Follow-up question engagement
   - Story length correlation with prompt type

### Error Handling

The system gracefully handles:
- OpenAI API failures (fallback to library prompts)
- Rate limiting (queuing and retry logic)
- Invalid responses (content filtering)
- Network issues (caching and offline support)

## Best Practices

### For Prompt Creation

1. **Be Specific** - Focus on particular moments rather than general topics
2. **Use Sensory Details** - Encourage descriptions of sights, sounds, smells
3. **Consider Emotions** - Help users explore feelings and reactions
4. **Respect Boundaries** - Avoid potentially traumatic or sensitive topics
5. **Cultural Sensitivity** - Consider diverse backgrounds and experiences

### For AI Generation

1. **Context is Key** - Provide rich user context for better personalization
2. **Iterate and Improve** - Use user feedback to refine system prompts
3. **Monitor Quality** - Regularly review generated prompts for appropriateness
4. **Cost Management** - Implement proper caching and rate limiting
5. **Fallback Strategy** - Always have library prompts as backup

## Troubleshooting

### Common Issues

1. **API Rate Limits**
   - Implement exponential backoff
   - Use caching to reduce API calls
   - Consider upgrading OpenAI plan

2. **Poor Quality Prompts**
   - Review and refine system prompts
   - Add more context to generation requests
   - Implement quality scoring and filtering

3. **Cultural Insensitivity**
   - Expand cultural context in user profiles
   - Add cultural sensitivity guidelines to system prompts
   - Implement content review processes

4. **Low Engagement**
   - Analyze skip reasons and patterns
   - A/B test different prompt styles
   - Gather user feedback on prompt preferences

## Prompt Customization

### Customization Options

The system supports personalizing prompts based on user preferences:

1. **Tone Adjustment**
   - `formal` - Professional, respectful language
   - `casual` - Relaxed, conversational style
   - `warm` - Emotionally supportive and caring
   - `professional` - Business-like but friendly

2. **Complexity Levels**
   - `simple` - Straightforward, easy-to-understand prompts
   - `detailed` - More elaborate prompts with context
   - `comprehensive` - In-depth prompts with multiple aspects

3. **Focus Areas**
   - `emotions` - Emphasize feelings and emotional responses
   - `facts` - Focus on concrete details and events
   - `relationships` - Highlight interpersonal connections
   - `timeline` - Emphasize chronological aspects

4. **Cultural Context**
   - Incorporate cultural background and traditions
   - Use culturally appropriate references and examples

5. **Personal Triggers**
   - Include specific topics or themes meaningful to the user
   - Avoid sensitive subjects based on user preferences

### Implementation

```typescript
const customizations = {
  tone: 'warm',
  complexity: 'detailed',
  focus: 'emotions',
  culturalContext: 'Italian-American',
  personalTriggers: ['cooking', 'family gatherings']
};

const customizedPrompt = await AIPromptService.customizePrompt(
  'original-prompt-id',
  'user-123',
  customizations
);
```

## Future Enhancements

1. **Voice Integration** - Generate audio versions of prompts ✅ *Implemented*
2. **Visual Prompts** - Include relevant images or photos
3. **Adaptive Difficulty** - Automatically adjust based on user responses
4. **Multilingual Support** - Generate prompts in multiple languages
5. **Collaborative Prompts** - Allow family members to suggest prompts
6. **Seasonal Themes** - Generate prompts based on holidays or seasons
7. **Memory Triggers** - Use historical events or cultural references
8. **Emotional Intelligence** - Detect and respond to emotional content in stories
9. **Prompt Customization** - Personalize prompts based on user preferences ✅ *Implemented*