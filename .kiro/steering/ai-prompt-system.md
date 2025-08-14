#
 AI Prompt System Implementation Guide

## Overview

The Saga AI Prompt System is designed to guide storytellers through a structured narrative journey using chapter-based progression and intelligent prompt delivery. The system balances automated AI-generated prompts with user-generated follow-up questions to create meaningful storytelling experiences.

## Core Concepts

### Chapter-Based Progression
- **Structured Journey**: Prompts are organized into thematic chapters (e.g., "Childhood Memories", "Young Adulthood")
- **Linear Progression**: System serves prompts sequentially through chapters
- **MVP Target**: 50-75 open-ended, positive prompts organized across 5-7 chapters
- **Chapter Completion**: System generates summary cards when thematic blocks are complete

### Priority System
- **User Follow-ups Override AI**: Facilitator questions always take precedence over system prompts
- **Queue Management**: System maintains separate queues for AI prompts and user questions
- **Context Preservation**: Follow-up questions maintain connection to original stories

## Technical Architecture

### Database Schema
```sql
-- Core prompt library
CREATE TABLE prompts (
    id UUID PRIMARY KEY,
    chapter_id UUID REFERENCES chapters(id),
    text TEXT NOT NULL,
    audio_url TEXT,
    order_index INTEGER,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Chapter organization
CREATE TABLE chapters (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    order_index INTEGER,
    is_active BOOLEAN DEFAULT true
);

-- User-generated prompts (follow-ups)
CREATE TABLE user_prompts (
    id UUID PRIMARY KEY,
    project_id UUID REFERENCES projects(id),
    created_by UUID REFERENCES users(id),
    parent_story_id UUID REFERENCES stories(id),
    text TEXT NOT NULL,
    priority INTEGER DEFAULT 1, -- Higher priority = served first
    is_delivered BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Project prompt state
CREATE TABLE project_prompt_state (
    project_id UUID PRIMARY KEY REFERENCES projects(id),
    current_chapter_id UUID REFERENCES chapters(id),
    current_prompt_index INTEGER DEFAULT 0,
    last_prompt_delivered_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### Service Layer Implementation
```typescript
class AIPromptService {
  async getNextPrompt(projectId: string): Promise<Prompt> {
    // 1. Check for pending user follow-ups (highest priority)
    const userPrompt = await this.getPendingUserPrompt(projectId);
    if (userPrompt) {
      return this.markAsDelivered(userPrompt);
    }
    
    // 2. Get next AI prompt from current chapter
    const aiPrompt = await this.getNextAIPrompt(projectId);
    if (aiPrompt) {
      await this.updateProjectState(projectId, aiPrompt);
      return aiPrompt;
    }
    
    // 3. Advance to next chapter if current is complete
    return await this.advanceToNextChapter(projectId);
  }
  
  async createUserPrompt(
    projectId: string, 
    createdBy: string, 
    parentStoryId: string, 
    text: string
  ): Promise<UserPrompt> {
    return await this.userPromptRepository.create({
      projectId,
      createdBy,
      parentStoryId,
      text,
      priority: 1 // User prompts get highest priority
    });
  }
  
  async generateChapterSummary(projectId: string, chapterId: string): Promise<ChapterSummary> {
    const stories = await this.getStoriesForChapter(projectId, chapterId);
    const summary = await this.openAIService.generateSummary(stories);
    return await this.chapterSummaryRepository.create({
      projectId,
      chapterId,
      summary,
      storyCount: stories.length
    });
  }
}
```

## Prompt Content Strategy

### Chapter Structure (MVP)
1. **Chapter 1: Early Life & Family** (10-12 prompts)
   - Childhood memories, family traditions, early influences
2. **Chapter 2: Education & Growth** (8-10 prompts)
   - School experiences, learning moments, formative relationships
3. **Chapter 3: Career & Purpose** (10-12 prompts)
   - Work life, achievements, challenges, professional relationships
4. **Chapter 4: Love & Relationships** (8-10 prompts)
   - Romantic relationships, friendships, family building
5. **Chapter 5: Life Lessons & Wisdom** (10-12 prompts)
   - Reflections, advice, values, life philosophy
6. **Chapter 6: Legacy & Future** (6-8 prompts)
   - What they want to be remembered for, hopes for family

### Prompt Characteristics
- **Open-ended**: Encourage storytelling rather than yes/no answers
- **Positive tone**: Focus on meaningful, uplifting experiences
- **Specific yet flexible**: Concrete enough to spark memories, broad enough for interpretation
- **Culturally sensitive**: Avoid assumptions about family structures or life paths

### Example Prompts
```typescript
const samplePrompts = [
  {
    chapter: "Early Life & Family",
    text: "Tell me about a family tradition that was special to you growing up.",
    audioText: "I'd love to hear about a family tradition that was special to you growing up."
  },
  {
    chapter: "Career & Purpose", 
    text: "Describe a moment at work when you felt most proud of what you accomplished.",
    audioText: "Can you describe a moment at work when you felt most proud of what you accomplished?"
  }
];
```

## Audio Integration

### Text-to-Speech (TTS)
- **Voice Selection**: Warm, conversational tone appropriate for older adults
- **Speed Control**: Adjustable playback speed for accessibility
- **Caching Strategy**: Pre-generate audio for all prompts to reduce latency
- **Fallback**: Always provide text version if audio fails

### Implementation
```typescript
class TTSService {
  async generatePromptAudio(promptText: string): Promise<string> {
    const audioBuffer = await this.openAIService.generateSpeech({
      input: promptText,
      voice: 'alloy', // Warm, conversational voice
      model: 'tts-1',
      speed: 0.9 // Slightly slower for clarity
    });
    
    const audioUrl = await this.storageService.uploadAudio(audioBuffer);
    return audioUrl;
  }
}
```

## User Experience Patterns

### Mobile App (Storyteller)
- **Prompt Display**: Large, readable text with play button for audio
- **Visual Hierarchy**: Prompt text prominent, secondary information subtle
- **Loading States**: Smooth transitions while fetching next prompt
- **Accessibility**: WCAG 2.1 AA compliance with screen reader support

### Web Dashboard (Facilitator)
- **Follow-up Creation**: Simple form to add questions linked to specific stories
- **Prompt Preview**: See upcoming prompts in current chapter
- **Progress Tracking**: Visual indicator of chapter completion
- **Prompt Management**: Ability to skip or customize prompts (future feature)

## Analytics & Optimization

### Key Metrics
- **Prompt Engagement Rate**: % of prompts that result in recorded stories
- **Chapter Completion Rate**: % of users who complete each chapter
- **Follow-up Effectiveness**: Stories generated from user vs. AI prompts
- **Audio vs. Text Usage**: Preference patterns for prompt consumption

### A/B Testing Framework
- **Prompt Variations**: Test different phrasings for same concepts
- **Chapter Ordering**: Experiment with different narrative progressions
- **Timing**: Optimal intervals between prompt deliveries

## Content Management

### Prompt Library Management
```typescript
class PromptLibraryService {
  async addPrompt(chapterId: string, promptData: CreatePromptData): Promise<Prompt> {
    const prompt = await this.promptRepository.create({
      ...promptData,
      chapterId,
      orderIndex: await this.getNextOrderIndex(chapterId)
    });
    
    // Generate audio version
    const audioUrl = await this.ttsService.generatePromptAudio(prompt.text);
    await this.promptRepository.update(prompt.id, { audioUrl });
    
    return prompt;
  }
  
  async reorderChapterPrompts(chapterId: string, newOrder: string[]): Promise<void> {
    for (let i = 0; i < newOrder.length; i++) {
      await this.promptRepository.update(newOrder[i], { orderIndex: i });
    }
  }
}
```

### Localization Support (Future)
- **Multi-language Prompts**: Support for different languages
- **Cultural Adaptation**: Prompts adapted for different cultural contexts
- **Voice Selection**: Language-appropriate TTS voices

## Error Handling & Resilience

### Prompt Delivery Failures
- **Retry Logic**: Automatic retry for failed prompt fetches
- **Fallback Prompts**: Generic prompts if specific ones fail to load
- **Graceful Degradation**: Text-only mode if audio generation fails

### Data Consistency
- **State Synchronization**: Ensure prompt state stays consistent across devices
- **Conflict Resolution**: Handle cases where multiple facilitators add prompts simultaneously
- **Backup Strategies**: Regular backups of prompt state and user-generated content

## Testing Strategy

### Unit Tests
- Prompt selection logic
- Chapter progression algorithms
- Priority queue management
- Audio generation and caching

### Integration Tests
- End-to-end prompt delivery flow
- User prompt creation and prioritization
- Chapter completion and summary generation
- Cross-platform synchronization

### Content Testing
- Prompt effectiveness measurement
- Cultural sensitivity review
- Accessibility compliance verification
- Audio quality assessment