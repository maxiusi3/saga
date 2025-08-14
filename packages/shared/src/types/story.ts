export interface Story {
  id: string;
  project_id: string;
  facilitator_id: string;
  storyteller_id: string;
  prompt_id?: string;
  user_prompt_id?: string;
  chapter_id?: string;
  title?: string;
  transcript: string;
  original_transcript?: string;
  audio_url: string;
  audio_duration?: number; // in seconds
  status: 'draft' | 'published';
  created_at: Date;
  updated_at: Date;
}

export interface StoryWithContext {
  story: Story;
  prompt?: {
    id: string;
    text: string;
    chapter_id?: string;
  };
  user_prompt?: {
    id: string;
    text: string;
    created_by: string;
  };
  chapter?: {
    id: string;
    name: string;
    order_index: number;
  };
  facilitator: {
    id: string;
    name: string;
    email?: string;
  };
  storyteller: {
    id: string;
    name: string;
    email?: string;
  };
}

export interface CreateStoryRequest {
  project_id: string;
  prompt_id?: string;
  user_prompt_id?: string;
  title?: string;
  transcript: string;
  audio_file: File;
}

export interface UpdateStoryRequest {
  title?: string;
  transcript?: string;
  status?: 'draft' | 'published';
}

export interface StoryFilter {
  project_id?: string;
  chapter_id?: string;
  facilitator_id?: string;
  storyteller_id?: string;
  status?: 'draft' | 'published';
  date_from?: Date;
  date_to?: Date;
}

export interface StoryStats {
  total_count: number;
  total_duration: number;
  by_chapter: Record<string, number>;
  by_month: Record<string, number>;
}