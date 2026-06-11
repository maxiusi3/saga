export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

type AnySupabaseTable = {
  Row: any
  Insert: any
  Update: any
  Relationships?: any[]
}

export interface Database {
  public: {
    Tables: {
      [key: string]: AnySupabaseTable
      user_profiles: {
        Row: {
          id: string
          name: string | null
          email: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          name?: string | null
          email?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string | null
          email?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      user_resource_wallets: {
        Row: {
          id: string
          user_id: string
          project_vouchers: number
          facilitator_seats: number
          storyteller_seats: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          project_vouchers?: number
          facilitator_seats?: number
          storyteller_seats?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          project_vouchers?: number
          facilitator_seats?: number
          storyteller_seats?: number
          created_at?: string
          updated_at?: string
        }
      }
      projects: {
        Row: {
          id: string
          name: string
          description: string | null
          facilitator_id: string
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          facilitator_id: string
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          facilitator_id?: string
          status?: string
          created_at?: string
          updated_at?: string
        }
      }
      project_roles: {
        Row: {
          id: string
          project_id: string
          user_id: string
          role: string
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          user_id: string
          role: string
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          user_id?: string
          role?: string
          status?: string
          created_at?: string
        }
      }
      stories: {
        Row: {
          id: string
          project_id: string
          user_id: string
          title: string | null
          audio_url: string | null
          transcript: string | null
          photo_url: string | null
          chapter_id: string | null
          prompt_id: string | null
          duration: number | null
          file_size: number | null
          stt_metadata: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          user_id: string
          title?: string | null
          audio_url?: string | null
          transcript?: string | null
          photo_url?: string | null
          chapter_id?: string | null
          prompt_id?: string | null
          duration?: number | null
          file_size?: number | null
          stt_metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          user_id?: string
          title?: string | null
          audio_url?: string | null
          transcript?: string | null
          photo_url?: string | null
          chapter_id?: string | null
          prompt_id?: string | null
          duration?: number | null
          file_size?: number | null
          stt_metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      chapters: {
        Row: {
          id: string
          name: string
          description: string | null
          order_index: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          order_index: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          order_index?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      prompts: {
        Row: {
          id: string
          chapter_id: string | null
          text: string
          audio_url: string | null
          order_index: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          chapter_id?: string | null
          text: string
          audio_url?: string | null
          order_index: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          chapter_id?: string | null
          text?: string
          audio_url?: string | null
          order_index?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      interactions: {
        Row: {
          id: string
          story_id: string
          user_id: string
          type: string
          content: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          story_id: string
          user_id: string
          type: string
          content: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          story_id?: string
          user_id?: string
          type?: string
          content?: string
          created_at?: string
          updated_at?: string
        }
      }
      agent_runs: {
        Row: {
          id: string
          agent_type: string
          status: string
          project_id: string | null
          story_id: string | null
          interview_session_id: string | null
          content_hash: string | null
          input: Json
          output: Json | null
          model: string | null
          error: string | null
          started_at: string
          completed_at: string | null
          created_by: string
        }
        Insert: {
          id?: string
          agent_type: string
          status?: string
          project_id?: string | null
          story_id?: string | null
          interview_session_id?: string | null
          content_hash?: string | null
          input?: Json
          output?: Json | null
          model?: string | null
          error?: string | null
          started_at?: string
          completed_at?: string | null
          created_by: string
        }
        Update: {
          id?: string
          agent_type?: string
          status?: string
          project_id?: string | null
          story_id?: string | null
          interview_session_id?: string | null
          content_hash?: string | null
          input?: Json
          output?: Json | null
          model?: string | null
          error?: string | null
          started_at?: string
          completed_at?: string | null
          created_by?: string
        }
      }
      interview_sessions: {
        Row: {
          id: string
          project_id: string
          storyteller_id: string
          prompt_text: string | null
          recording_mode: string
          intervention_level: string
          status: string
          started_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          project_id: string
          storyteller_id: string
          prompt_text?: string | null
          recording_mode: string
          intervention_level: string
          status?: string
          started_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          project_id?: string
          storyteller_id?: string
          prompt_text?: string | null
          recording_mode?: string
          intervention_level?: string
          status?: string
          started_at?: string
          completed_at?: string | null
        }
      }
      interview_events: {
        Row: {
          id: string
          interview_session_id: string
          project_id: string
          storyteller_id: string
          event_kind: string
          intervention_level: string
          trigger_reason: string
          prompt_text: string
          transcript_window: string | null
          transcript_start_offset: number | null
          transcript_end_offset: number | null
          accepted: boolean | null
          created_at: string
        }
        Insert: {
          id?: string
          interview_session_id: string
          project_id: string
          storyteller_id: string
          event_kind: string
          intervention_level: string
          trigger_reason: string
          prompt_text: string
          transcript_window?: string | null
          transcript_start_offset?: number | null
          transcript_end_offset?: number | null
          accepted?: boolean | null
          created_at?: string
        }
        Update: {
          id?: string
          interview_session_id?: string
          project_id?: string
          storyteller_id?: string
          event_kind?: string
          intervention_level?: string
          trigger_reason?: string
          prompt_text?: string
          transcript_window?: string | null
          transcript_start_offset?: number | null
          transcript_end_offset?: number | null
          accepted?: boolean | null
          created_at?: string
        }
      }
      agent_artifacts: {
        Row: {
          id: string
          agent_run_id: string
          project_id: string
          story_id: string | null
          artifact_type: string
          payload: Json
          source_refs: Json
          review_status: string
          confidence: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          agent_run_id: string
          project_id: string
          story_id?: string | null
          artifact_type: string
          payload?: Json
          source_refs?: Json
          review_status?: string
          confidence?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          agent_run_id?: string
          project_id?: string
          story_id?: string | null
          artifact_type?: string
          payload?: Json
          source_refs?: Json
          review_status?: string
          confidence?: number
          created_at?: string
          updated_at?: string
        }
      }
      story_elements: {
        Row: {
          id: string
          project_id: string
          story_id: string
          agent_run_id: string
          element_type: string
          value: string
          normalized_value: string | null
          source_quote: string
          source_start_offset: number | null
          source_end_offset: number | null
          confidence: number
          review_status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          story_id: string
          agent_run_id: string
          element_type: string
          value: string
          normalized_value?: string | null
          source_quote: string
          source_start_offset?: number | null
          source_end_offset?: number | null
          confidence?: number
          review_status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          story_id?: string
          agent_run_id?: string
          element_type?: string
          value?: string
          normalized_value?: string | null
          source_quote?: string
          source_start_offset?: number | null
          source_end_offset?: number | null
          confidence?: number
          review_status?: string
          created_at?: string
          updated_at?: string
        }
      }
      subscriptions: {
        Row: {
          id: string
          project_id: string
          user_id: string
          status: string
          current_period_start: string
          current_period_end: string | null
          stripe_subscription_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          user_id: string
          status?: string
          current_period_start?: string
          current_period_end?: string | null
          stripe_subscription_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          user_id?: string
          status?: string
          current_period_start?: string
          current_period_end?: string | null
          stripe_subscription_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
