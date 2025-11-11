export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
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
      story_images: {
        Row: {
          id: string
          story_id: string
          transcript_id: string | null
          storage_path: string
          file_name: string
          file_size: number
          mime_type: string
          width: number | null
          height: number | null
          order_index: number
          is_primary: boolean
          source_type: 'transcript' | 'comment'
          source_interaction_id: string | null
          uploaded_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          story_id: string
          transcript_id?: string | null
          storage_path: string
          file_name: string
          file_size: number
          mime_type: string
          width?: number | null
          height?: number | null
          order_index?: number
          is_primary?: boolean
          source_type: 'transcript' | 'comment'
          source_interaction_id?: string | null
          uploaded_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          story_id?: string
          transcript_id?: string | null
          storage_path?: string
          file_name?: string
          file_size?: number
          mime_type?: string
          width?: number | null
          height?: number | null
          order_index?: number
          is_primary?: boolean
          source_type?: 'transcript' | 'comment'
          source_interaction_id?: string | null
          uploaded_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      interaction_images: {
        Row: {
          id: string
          interaction_id: string
          storage_path: string
          file_name: string
          file_size: number
          mime_type: string
          width: number | null
          height: number | null
          order_index: number
          uploaded_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          interaction_id: string
          storage_path: string
          file_name: string
          file_size: number
          mime_type: string
          width?: number | null
          height?: number | null
          order_index?: number
          uploaded_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          interaction_id?: string
          storage_path?: string
          file_name?: string
          file_size?: number
          mime_type?: string
          width?: number | null
          height?: number | null
          order_index?: number
          uploaded_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      story_transcripts: {
        Row: {
          id: string
          story_id: string
          audio_url: string | null
          audio_duration: number | null
          transcript: string
          sequence_number: number
          recorded_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          story_id: string
          audio_url?: string | null
          audio_duration?: number | null
          transcript: string
          sequence_number: number
          recorded_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          story_id?: string
          audio_url?: string | null
          audio_duration?: number | null
          transcript?: string
          sequence_number?: number
          recorded_at?: string
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