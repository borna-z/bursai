export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      ai_rate_limits: {
        Row: {
          called_at: string | null
          created_at: string | null
          endpoint: string
          function_name: string | null
          id: string
          requests_count: number | null
          user_id: string
          window_start: string | null
        }
        Insert: {
          called_at?: string | null
          created_at?: string | null
          endpoint: string
          function_name?: string | null
          id?: string
          requests_count?: number | null
          user_id: string
          window_start?: string | null
        }
        Update: {
          called_at?: string | null
          created_at?: string | null
          endpoint?: string
          function_name?: string | null
          id?: string
          requests_count?: number | null
          user_id?: string
          window_start?: string | null
        }
        Relationships: []
      }
      ai_response_cache: {
        Row: {
          cache_key: string
          compressed: boolean | null
          created_at: string | null
          expires_at: string | null
          hit_count: number | null
          id: string
          model_used: string | null
          response: Json | null
          user_id: string | null
        }
        Insert: {
          cache_key: string
          compressed?: boolean | null
          created_at?: string | null
          expires_at?: string | null
          hit_count?: number | null
          id?: string
          model_used?: string | null
          response?: Json | null
          user_id?: string | null
        }
        Update: {
          cache_key?: string
          compressed?: boolean | null
          created_at?: string | null
          expires_at?: string | null
          hit_count?: number | null
          id?: string
          model_used?: string | null
          response?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          created_at: string | null
          event_name: string | null
          event_type: string | null
          id: string
          metadata: Json | null
          properties: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_name?: string | null
          event_type?: string | null
          id?: string
          metadata?: Json | null
          properties?: Json | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_name?: string | null
          event_type?: string | null
          id?: string
          metadata?: Json | null
          properties?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      calendar_connections: {
        Row: {
          access_token: string | null
          calendar_id: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          provider: string
          refresh_token: string | null
          token_expires_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token?: string | null
          calendar_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          provider: string
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string | null
          calendar_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          provider?: string
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          created_at: string | null
          date: string
          end_time: string | null
          external_id: string | null
          id: string
          location: string | null
          provider: string | null
          start_time: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date: string
          end_time?: string | null
          external_id?: string | null
          id?: string
          location?: string | null
          provider?: string | null
          start_time?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          end_time?: string | null
          external_id?: string | null
          id?: string
          location?: string | null
          provider?: string | null
          start_time?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      challenge_participations: {
        Row: {
          challenge_id: string | null
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          challenge_id?: string | null
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          challenge_id?: string | null
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_participations_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "style_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          mode: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          mode?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          mode?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      checkout_attempts: {
        Row: {
          created_at: string | null
          id: string
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      feedback_signals: {
        Row: {
          created_at: string | null
          garment_id: string | null
          id: string
          metadata: Json | null
          outfit_id: string | null
          signal_type: string
          user_id: string
          value: string | null
        }
        Insert: {
          created_at?: string | null
          garment_id?: string | null
          id?: string
          metadata?: Json | null
          outfit_id?: string | null
          signal_type: string
          user_id: string
          value?: string | null
        }
        Update: {
          created_at?: string | null
          garment_id?: string | null
          id?: string
          metadata?: Json | null
          outfit_id?: string | null
          signal_type?: string
          user_id?: string
          value?: string | null
        }
        Relationships: []
      }
      friendships: {
        Row: {
          created_at: string | null
          friend_id: string
          id: string
          status: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          friend_id: string
          id?: string
          status?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          friend_id?: string
          id?: string
          status?: string | null
          user_id?: string
        }
        Relationships: []
      }
      garment_pair_memory: {
        Row: {
          created_at: string | null
          garment_a_id: string | null
          garment_b_id: string | null
          garment_id_a: string | null
          garment_id_b: string | null
          id: string
          last_negative_at: string | null
          last_positive_at: string | null
          negative_count: number
          positive_count: number
          score: number | null
          times_worn_together: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          garment_a_id?: string | null
          garment_b_id?: string | null
          garment_id_a?: string | null
          garment_id_b?: string | null
          id?: string
          last_negative_at?: string | null
          last_positive_at?: string | null
          negative_count?: number
          positive_count?: number
          score?: number | null
          times_worn_together?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          garment_a_id?: string | null
          garment_b_id?: string | null
          garment_id_a?: string | null
          garment_id_b?: string | null
          id?: string
          last_negative_at?: string | null
          last_positive_at?: string | null
          negative_count?: number
          positive_count?: number
          score?: number | null
          times_worn_together?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "garment_pair_memory_garment_id_a_fkey"
            columns: ["garment_id_a"]
            isOneToOne: false
            referencedRelation: "garments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garment_pair_memory_garment_id_b_fkey"
            columns: ["garment_id_b"]
            isOneToOne: false
            referencedRelation: "garments"
            referencedColumns: ["id"]
          },
        ]
      }
      garments: {
        Row: {
          ai_analyzed_at: string | null
          ai_provider: string | null
          ai_raw: Json | null
          category: string
          color_primary: string | null
          color_secondary: string | null
          condition_notes: string | null
          condition_score: number | null
          created_at: string | null
          enrichment_status: string | null
          fit: string | null
          formality: number | null
          fts: unknown
          id: string
          image_path: string | null
          image_processed_at: string | null
          image_processing_confidence: number | null
          image_processing_error: string | null
          image_processing_provider: string | null
          image_processing_status: string
          image_processing_version: string | null
          imported_via: string | null
          in_laundry: boolean | null
          last_worn_at: string | null
          material: string | null
          occasion_tags: string[] | null
          original_image_path: string | null
          pattern: string | null
          processed_image_path: string | null
          purchase_currency: string | null
          purchase_price: number | null
          render_error: string | null
          render_presentation_used: string | null
          render_provider: string | null
          render_status: string
          rendered_at: string | null
          rendered_image_path: string | null
          season_tags: string[] | null
          secondary_image_path: string | null
          silhouette: string | null
          source_url: string | null
          style_archetype: string | null
          subcategory: string | null
          texture_intensity: number | null
          title: string
          updated_at: string | null
          user_id: string
          versatility_score: number | null
          visual_weight: number | null
          wear_count: number | null
        }
        Insert: {
          ai_analyzed_at?: string | null
          ai_provider?: string | null
          ai_raw?: Json | null
          category: string
          color_primary?: string | null
          color_secondary?: string | null
          condition_notes?: string | null
          condition_score?: number | null
          created_at?: string | null
          enrichment_status?: string | null
          fit?: string | null
          formality?: number | null
          fts?: unknown
          id?: string
          image_path?: string | null
          image_processed_at?: string | null
          image_processing_confidence?: number | null
          image_processing_error?: string | null
          image_processing_provider?: string | null
          image_processing_status?: string
          image_processing_version?: string | null
          imported_via?: string | null
          in_laundry?: boolean | null
          last_worn_at?: string | null
          material?: string | null
          occasion_tags?: string[] | null
          original_image_path?: string | null
          pattern?: string | null
          processed_image_path?: string | null
          purchase_currency?: string | null
          purchase_price?: number | null
          render_error?: string | null
          render_presentation_used?: string | null
          render_provider?: string | null
          render_status?: string
          rendered_at?: string | null
          rendered_image_path?: string | null
          season_tags?: string[] | null
          secondary_image_path?: string | null
          silhouette?: string | null
          source_url?: string | null
          style_archetype?: string | null
          subcategory?: string | null
          texture_intensity?: number | null
          title: string
          updated_at?: string | null
          user_id: string
          versatility_score?: number | null
          visual_weight?: number | null
          wear_count?: number | null
        }
        Update: {
          ai_analyzed_at?: string | null
          ai_provider?: string | null
          ai_raw?: Json | null
          category?: string
          color_primary?: string | null
          color_secondary?: string | null
          condition_notes?: string | null
          condition_score?: number | null
          created_at?: string | null
          enrichment_status?: string | null
          fit?: string | null
          formality?: number | null
          fts?: unknown
          id?: string
          image_path?: string | null
          image_processed_at?: string | null
          image_processing_confidence?: number | null
          image_processing_error?: string | null
          image_processing_provider?: string | null
          image_processing_status?: string
          image_processing_version?: string | null
          imported_via?: string | null
          in_laundry?: boolean | null
          last_worn_at?: string | null
          material?: string | null
          occasion_tags?: string[] | null
          original_image_path?: string | null
          pattern?: string | null
          processed_image_path?: string | null
          purchase_currency?: string | null
          purchase_price?: number | null
          render_error?: string | null
          render_presentation_used?: string | null
          render_provider?: string | null
          render_status?: string
          rendered_at?: string | null
          rendered_image_path?: string | null
          season_tags?: string[] | null
          secondary_image_path?: string | null
          silhouette?: string | null
          source_url?: string | null
          style_archetype?: string | null
          subcategory?: string | null
          texture_intensity?: number | null
          title?: string
          updated_at?: string | null
          user_id?: string
          versatility_score?: number | null
          visual_weight?: number | null
          wear_count?: number | null
        }
        Relationships: []
      }
      inspiration_saves: {
        Row: {
          created_at: string | null
          id: string
          image_url: string | null
          tags: string[] | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          image_url?: string | null
          tags?: string[] | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          image_url?: string | null
          tags?: string[] | null
          user_id?: string
        }
        Relationships: []
      }
      job_queue: {
        Row: {
          attempts: number
          completed_at: string | null
          created_at: string
          error: string | null
          id: string
          job_type: string
          locked_until: string | null
          max_attempts: number
          payload: Json
          priority: number
          result: Json | null
          started_at: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          job_type: string
          locked_until?: string | null
          max_attempts?: number
          payload?: Json
          priority?: number
          result?: Json | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          job_type?: string
          locked_until?: string | null
          max_attempts?: number
          payload?: Json
          priority?: number
          result?: Json | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      marketing_events: {
        Row: {
          created_at: string | null
          email: string | null
          event_name: string | null
          id: string
          properties: Json | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          event_name?: string | null
          id?: string
          properties?: Json | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          event_name?: string | null
          id?: string
          properties?: Json | null
        }
        Relationships: []
      }
      marketing_leads: {
        Row: {
          created_at: string | null
          email: string
          id: string
          source: string | null
          utm_content: string | null
          utm_medium: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          source?: string | null
          utm_content?: string | null
          utm_medium?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          source?: string | null
          utm_content?: string | null
          utm_medium?: string | null
        }
        Relationships: []
      }
      oauth_csrf: {
        Row: {
          created_at: string
          expires_at: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      outfit_feedback: {
        Row: {
          ai_raw: Json | null
          color_match_score: number | null
          commentary: string | null
          created_at: string | null
          feedback: string | null
          fit_score: number | null
          id: string
          outfit_id: string | null
          overall_score: number | null
          rating: number | null
          selfie_path: string | null
          user_id: string
        }
        Insert: {
          ai_raw?: Json | null
          color_match_score?: number | null
          commentary?: string | null
          created_at?: string | null
          feedback?: string | null
          fit_score?: number | null
          id?: string
          outfit_id?: string | null
          overall_score?: number | null
          rating?: number | null
          selfie_path?: string | null
          user_id: string
        }
        Update: {
          ai_raw?: Json | null
          color_match_score?: number | null
          commentary?: string | null
          created_at?: string | null
          feedback?: string | null
          fit_score?: number | null
          id?: string
          outfit_id?: string | null
          overall_score?: number | null
          rating?: number | null
          selfie_path?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outfit_feedback_outfit_id_fkey"
            columns: ["outfit_id"]
            isOneToOne: false
            referencedRelation: "outfits"
            referencedColumns: ["id"]
          },
        ]
      }
      outfit_items: {
        Row: {
          created_at: string | null
          garment_id: string
          id: string
          outfit_id: string
          slot: string
        }
        Insert: {
          created_at?: string | null
          garment_id: string
          id?: string
          outfit_id: string
          slot: string
        }
        Update: {
          created_at?: string | null
          garment_id?: string
          id?: string
          outfit_id?: string
          slot?: string
        }
        Relationships: [
          {
            foreignKeyName: "outfit_items_garment_id_fkey"
            columns: ["garment_id"]
            isOneToOne: false
            referencedRelation: "garments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outfit_items_outfit_id_fkey"
            columns: ["outfit_id"]
            isOneToOne: false
            referencedRelation: "outfits"
            referencedColumns: ["id"]
          },
        ]
      }
      outfit_reactions: {
        Row: {
          created_at: string | null
          id: string
          outfit_id: string | null
          reaction: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          outfit_id?: string | null
          reaction?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          outfit_id?: string | null
          reaction?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outfit_reactions_outfit_id_fkey"
            columns: ["outfit_id"]
            isOneToOne: false
            referencedRelation: "outfits"
            referencedColumns: ["id"]
          },
        ]
      }
      outfits: {
        Row: {
          confidence_level: string | null
          confidence_score: number | null
          created_at: string | null
          explanation: string | null
          family_label: string | null
          feedback: string[] | null
          flatlay_image_path: string | null
          generated_at: string | null
          id: string
          is_saved: boolean | null
          limitation_note: string | null
          occasion: string | null
          outfit_reasoning: Json | null
          planned_for: string | null
          rating: number | null
          saved: boolean | null
          share_enabled: boolean | null
          style_score: Json | null
          style_vibe: string | null
          user_id: string
          wardrobe_insights: string[] | null
          weather: Json | null
          worn_at: string | null
        }
        Insert: {
          confidence_level?: string | null
          confidence_score?: number | null
          created_at?: string | null
          explanation?: string | null
          family_label?: string | null
          feedback?: string[] | null
          flatlay_image_path?: string | null
          generated_at?: string | null
          id?: string
          is_saved?: boolean | null
          limitation_note?: string | null
          occasion?: string | null
          outfit_reasoning?: Json | null
          planned_for?: string | null
          rating?: number | null
          saved?: boolean | null
          share_enabled?: boolean | null
          style_score?: Json | null
          style_vibe?: string | null
          user_id: string
          wardrobe_insights?: string[] | null
          weather?: Json | null
          worn_at?: string | null
        }
        Update: {
          confidence_level?: string | null
          confidence_score?: number | null
          created_at?: string | null
          explanation?: string | null
          family_label?: string | null
          feedback?: string[] | null
          flatlay_image_path?: string | null
          generated_at?: string | null
          id?: string
          is_saved?: boolean | null
          limitation_note?: string | null
          occasion?: string | null
          outfit_reasoning?: Json | null
          planned_for?: string | null
          rating?: number | null
          saved?: boolean | null
          share_enabled?: boolean | null
          style_score?: Json | null
          style_vibe?: string | null
          user_id?: string
          wardrobe_insights?: string[] | null
          weather?: Json | null
          worn_at?: string | null
        }
        Relationships: []
      }
      planned_outfits: {
        Row: {
          created_at: string | null
          date: string
          id: string
          note: string | null
          occasion: string | null
          outfit_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date: string
          id?: string
          note?: string | null
          occasion?: string | null
          outfit_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          note?: string | null
          occasion?: string | null
          outfit_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planned_outfits_outfit_id_fkey"
            columns: ["outfit_id"]
            isOneToOne: false
            referencedRelation: "outfits"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          body_image_path: string | null
          created_at: string | null
          display_name: string | null
          height_cm: number | null
          home_city: string | null
          ics_url: string | null
          id: string
          is_premium: boolean | null
          last_active_at: string
          last_calendar_sync: string | null
          mannequin_presentation: string
          preferences: Json | null
          stripe_customer_id: string | null
          updated_at: string | null
          username: string | null
          weight_kg: number | null
        }
        Insert: {
          avatar_url?: string | null
          body_image_path?: string | null
          created_at?: string | null
          display_name?: string | null
          height_cm?: number | null
          home_city?: string | null
          ics_url?: string | null
          id: string
          is_premium?: boolean | null
          last_active_at?: string
          last_calendar_sync?: string | null
          mannequin_presentation?: string
          preferences?: Json | null
          stripe_customer_id?: string | null
          updated_at?: string | null
          username?: string | null
          weight_kg?: number | null
        }
        Update: {
          avatar_url?: string | null
          body_image_path?: string | null
          created_at?: string | null
          display_name?: string | null
          height_cm?: number | null
          home_city?: string | null
          ics_url?: string | null
          id?: string
          is_premium?: boolean | null
          last_active_at?: string
          last_calendar_sync?: string | null
          mannequin_presentation?: string
          preferences?: Json | null
          stripe_customer_id?: string | null
          updated_at?: string | null
          username?: string | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      public_profiles: {
        Row: {
          bio: string | null
          created_at: string | null
          id: string
          is_public: boolean | null
          username: string | null
        }
        Insert: {
          bio?: string | null
          created_at?: string | null
          id: string
          is_public?: boolean | null
          username?: string | null
        }
        Update: {
          bio?: string | null
          created_at?: string | null
          id?: string
          is_public?: boolean | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "public_profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string | null
          created_at: string | null
          endpoint: string
          id: string
          p256dh: string | null
          user_id: string
        }
        Insert: {
          auth?: string | null
          created_at?: string | null
          endpoint: string
          id?: string
          p256dh?: string | null
          user_id: string
        }
        Update: {
          auth?: string | null
          created_at?: string | null
          endpoint?: string
          id?: string
          p256dh?: string | null
          user_id?: string
        }
        Relationships: []
      }
      render_credit_transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          idempotency_key: string
          kind: string
          render_job_id: string | null
          source: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          idempotency_key: string
          kind: string
          render_job_id?: string | null
          source: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          idempotency_key?: string
          kind?: string
          render_job_id?: string | null
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      render_credits: {
        Row: {
          monthly_allowance: number
          period_end: string
          period_start: string
          reserved: number
          topup_balance: number
          trial_gift_remaining: number
          updated_at: string
          used_this_period: number
          user_id: string
        }
        Insert: {
          monthly_allowance?: number
          period_end?: string
          period_start?: string
          reserved?: number
          topup_balance?: number
          trial_gift_remaining?: number
          updated_at?: string
          used_this_period?: number
          user_id: string
        }
        Update: {
          monthly_allowance?: number
          period_end?: string
          period_start?: string
          reserved?: number
          topup_balance?: number
          trial_gift_remaining?: number
          updated_at?: string
          used_this_period?: number
          user_id?: string
        }
        Relationships: []
      }
      render_jobs: {
        Row: {
          attempts: number
          client_nonce: string
          completed_at: string | null
          created_at: string
          error: string | null
          error_class: string | null
          force: boolean
          garment_id: string
          id: string
          locked_until: string | null
          max_attempts: number
          presentation: string
          prompt_version: string
          reserve_key: string
          result_path: string | null
          source: string
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          client_nonce: string
          completed_at?: string | null
          created_at?: string
          error?: string | null
          error_class?: string | null
          force?: boolean
          garment_id: string
          id: string
          locked_until?: string | null
          max_attempts?: number
          presentation: string
          prompt_version: string
          reserve_key: string
          result_path?: string | null
          source: string
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          client_nonce?: string
          completed_at?: string | null
          created_at?: string
          error?: string | null
          error_class?: string | null
          force?: boolean
          garment_id?: string
          id?: string
          locked_until?: string | null
          max_attempts?: number
          presentation?: string
          prompt_version?: string
          reserve_key?: string
          result_path?: string | null
          source?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "render_jobs_garment_id_fkey"
            columns: ["garment_id"]
            isOneToOne: false
            referencedRelation: "garments"
            referencedColumns: ["id"]
          },
        ]
      }
      request_idempotency: {
        Row: {
          body: string
          created_at: string
          expires_at: string
          headers: Json
          key: string
          status: number
        }
        Insert: {
          body: string
          created_at?: string
          expires_at: string
          headers?: Json
          key: string
          status: number
        }
        Update: {
          body?: string
          created_at?: string
          expires_at?: string
          headers?: Json
          key?: string
          status?: number
        }
        Relationships: []
      }
      stripe_events: {
        Row: {
          data: Json | null
          id: string
          processed_at: string | null
          stripe_event_id: string
          type: string
        }
        Insert: {
          data?: Json | null
          id?: string
          processed_at?: string | null
          stripe_event_id: string
          type: string
        }
        Update: {
          data?: Json | null
          id?: string
          processed_at?: string | null
          stripe_event_id?: string
          type?: string
        }
        Relationships: []
      }
      style_challenges: {
        Row: {
          created_at: string | null
          description: string | null
          end_date: string | null
          id: string
          start_date: string | null
          title: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          start_date?: string | null
          title: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          start_date?: string | null
          title?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string | null
          current_period_end: string | null
          garments_count: number | null
          id: string
          plan: string | null
          price_id: string | null
          status: string | null
          stripe_customer_id: string | null
          stripe_mode: string | null
          stripe_subscription_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          current_period_end?: string | null
          garments_count?: number | null
          id?: string
          plan?: string | null
          price_id?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_mode?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_period_end?: string | null
          garments_count?: number | null
          id?: string
          plan?: string | null
          price_id?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_mode?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      swap_events: {
        Row: {
          created_at: string | null
          id: string
          outfit_id: string | null
          swap_mode: string | null
          swapped_in_garment_id: string | null
          swapped_out_garment_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          outfit_id?: string | null
          swap_mode?: string | null
          swapped_in_garment_id?: string | null
          swapped_out_garment_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          outfit_id?: string | null
          swap_mode?: string | null
          swapped_in_garment_id?: string | null
          swapped_out_garment_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "swap_events_outfit_id_fkey"
            columns: ["outfit_id"]
            isOneToOne: false
            referencedRelation: "outfits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "swap_events_swapped_in_garment_id_fkey"
            columns: ["swapped_in_garment_id"]
            isOneToOne: false
            referencedRelation: "garments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "swap_events_swapped_out_garment_id_fkey"
            columns: ["swapped_out_garment_id"]
            isOneToOne: false
            referencedRelation: "garments"
            referencedColumns: ["id"]
          },
        ]
      }
      travel_capsules: {
        Row: {
          capsule_items: Json
          companions: string | null
          created_at: string | null
          destination: string
          duration_days: number
          end_date: string | null
          id: string
          luggage_type: string | null
          occasions: string[] | null
          outfits: Json
          packing_list: Json
          packing_tips: string[] | null
          reasoning: string | null
          result: Json | null
          start_date: string | null
          style_preference: string | null
          total_combinations: number | null
          trip_type: string | null
          user_id: string
          weather_max: number | null
          weather_min: number | null
        }
        Insert: {
          capsule_items?: Json
          companions?: string | null
          created_at?: string | null
          destination: string
          duration_days: number
          end_date?: string | null
          id?: string
          luggage_type?: string | null
          occasions?: string[] | null
          outfits?: Json
          packing_list?: Json
          packing_tips?: string[] | null
          reasoning?: string | null
          result?: Json | null
          start_date?: string | null
          style_preference?: string | null
          total_combinations?: number | null
          trip_type?: string | null
          user_id: string
          weather_max?: number | null
          weather_min?: number | null
        }
        Update: {
          capsule_items?: Json
          companions?: string | null
          created_at?: string | null
          destination?: string
          duration_days?: number
          end_date?: string | null
          id?: string
          luggage_type?: string | null
          occasions?: string[] | null
          outfits?: Json
          packing_list?: Json
          packing_tips?: string[] | null
          reasoning?: string | null
          result?: Json | null
          start_date?: string | null
          style_preference?: string | null
          total_combinations?: number | null
          trip_type?: string | null
          user_id?: string
          weather_max?: number | null
          weather_min?: number | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      user_style_profiles: {
        Row: {
          computation_basis: number | null
          created_at: string | null
          dominant_archetype: string | null
          fit_preference: string | null
          formality_center: number | null
          id: string
          secondary_archetype: string | null
          signature_colors: Json | null
          texture_preference: string | null
          total_garments: number | null
          uniform_combos: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          computation_basis?: number | null
          created_at?: string | null
          dominant_archetype?: string | null
          fit_preference?: string | null
          formality_center?: number | null
          id?: string
          secondary_archetype?: string | null
          signature_colors?: Json | null
          texture_preference?: string | null
          total_garments?: number | null
          uniform_combos?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          computation_basis?: number | null
          created_at?: string | null
          dominant_archetype?: string | null
          fit_preference?: string | null
          formality_center?: number | null
          id?: string
          secondary_archetype?: string | null
          signature_colors?: Json | null
          texture_preference?: string | null
          total_garments?: number | null
          uniform_combos?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          created_at: string | null
          garments_count: number
          id: string
          outfits_used_month: number
          period_start: string
          plan: string | null
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          garments_count?: number
          id?: string
          outfits_used_month?: number
          period_start?: string
          plan?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          garments_count?: number
          id?: string
          outfits_used_month?: number
          period_start?: string
          plan?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wear_logs: {
        Row: {
          created_at: string | null
          event_title: string | null
          garment_id: string | null
          id: string
          occasion: string | null
          outfit_id: string | null
          user_id: string
          worn_at: string | null
        }
        Insert: {
          created_at?: string | null
          event_title?: string | null
          garment_id?: string | null
          id?: string
          occasion?: string | null
          outfit_id?: string | null
          user_id: string
          worn_at?: string | null
        }
        Update: {
          created_at?: string | null
          event_title?: string | null
          garment_id?: string | null
          id?: string
          occasion?: string | null
          outfit_id?: string | null
          user_id?: string
          worn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wear_logs_garment_id_fkey"
            columns: ["garment_id"]
            isOneToOne: false
            referencedRelation: "garments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wear_logs_outfit_id_fkey"
            columns: ["outfit_id"]
            isOneToOne: false
            referencedRelation: "outfits"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_render_job: {
        Args: { p_job_id?: string }
        Returns: {
          attempts: number
          client_nonce: string
          force: boolean
          garment_id: string
          id: string
          max_attempts: number
          presentation: string
          prompt_version: string
          reserve_key: string
          source: string
          user_id: string
        }[]
      }
      cleanup_old_jobs: { Args: never; Returns: undefined }
      consume_credit_atomic: {
        Args: { p_idempotency_key: string; p_job_id: string; p_user_id: string }
        Returns: Json
      }
      delete_garment_with_release_atomic: {
        Args: { p_garment_id: string; p_user_id: string }
        Returns: Json
      }
      grant_trial_gift_atomic: {
        Args: { p_amount: number; p_idempotency_key: string; p_user_id: string }
        Returns: Json
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      recover_stale_render_jobs: { Args: never; Returns: number }
      release_credit_atomic: {
        Args: { p_idempotency_key: string; p_job_id: string; p_user_id: string }
        Returns: Json
      }
      reserve_credit_atomic: {
        Args: { p_idempotency_key: string; p_job_id: string; p_user_id: string }
        Returns: Json
      }
      reset_expired_periods_batch: { Args: never; Returns: number }
      reset_period_if_needed: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      set_monthly_allowance_atomic: {
        Args: {
          p_allowance: number
          p_idempotency_key: string
          p_user_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      subscription_plan: "free" | "premium"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      subscription_plan: ["free", "premium"],
    },
  },
} as const
