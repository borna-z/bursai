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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ai_response_cache: {
        Row: {
          cache_key: string
          created_at: string
          expires_at: string
          id: string
          model_used: string
          response: Json
        }
        Insert: {
          cache_key: string
          created_at?: string
          expires_at: string
          id?: string
          model_used: string
          response: Json
        }
        Update: {
          cache_key?: string
          created_at?: string
          expires_at?: string
          id?: string
          model_used?: string
          response?: Json
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      calendar_connections: {
        Row: {
          access_token: string
          calendar_id: string | null
          created_at: string | null
          id: string
          provider: string
          refresh_token: string | null
          token_expires_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          calendar_id?: string | null
          created_at?: string | null
          id?: string
          provider: string
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          calendar_id?: string | null
          created_at?: string | null
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
          description: string | null
          end_time: string | null
          id: string
          provider: string | null
          start_time: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date: string
          description?: string | null
          end_time?: string | null
          id?: string
          provider?: string | null
          start_time?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          description?: string | null
          end_time?: string | null
          id?: string
          provider?: string | null
          start_time?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      challenge_participations: {
        Row: {
          challenge_id: string
          completed: boolean
          created_at: string
          id: string
          outfit_id: string | null
          user_id: string
        }
        Insert: {
          challenge_id: string
          completed?: boolean
          created_at?: string
          id?: string
          outfit_id?: string | null
          user_id: string
        }
        Update: {
          challenge_id?: string
          completed?: boolean
          created_at?: string
          id?: string
          outfit_id?: string | null
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
          {
            foreignKeyName: "challenge_participations_outfit_id_fkey"
            columns: ["outfit_id"]
            isOneToOne: false
            referencedRelation: "outfits"
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
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          status: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          status?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          status?: string
        }
        Relationships: []
      }
      garments: {
        Row: {
          ai_analyzed_at: string | null
          ai_provider: string | null
          ai_raw: Json | null
          category: string
          color_primary: string
          color_secondary: string | null
          condition_notes: string | null
          condition_score: number | null
          created_at: string | null
          fit: string | null
          formality: number | null
          id: string
          image_path: string
          imported_via: string | null
          in_laundry: boolean | null
          last_worn_at: string | null
          material: string | null
          pattern: string | null
          purchase_currency: string | null
          purchase_price: number | null
          season_tags: string[] | null
          source_url: string | null
          subcategory: string | null
          title: string
          updated_at: string | null
          user_id: string
          wear_count: number | null
        }
        Insert: {
          ai_analyzed_at?: string | null
          ai_provider?: string | null
          ai_raw?: Json | null
          category: string
          color_primary: string
          color_secondary?: string | null
          condition_notes?: string | null
          condition_score?: number | null
          created_at?: string | null
          fit?: string | null
          formality?: number | null
          id?: string
          image_path: string
          imported_via?: string | null
          in_laundry?: boolean | null
          last_worn_at?: string | null
          material?: string | null
          pattern?: string | null
          purchase_currency?: string | null
          purchase_price?: number | null
          season_tags?: string[] | null
          source_url?: string | null
          subcategory?: string | null
          title: string
          updated_at?: string | null
          user_id: string
          wear_count?: number | null
        }
        Update: {
          ai_analyzed_at?: string | null
          ai_provider?: string | null
          ai_raw?: Json | null
          category?: string
          color_primary?: string
          color_secondary?: string | null
          condition_notes?: string | null
          condition_score?: number | null
          created_at?: string | null
          fit?: string | null
          formality?: number | null
          id?: string
          image_path?: string
          imported_via?: string | null
          in_laundry?: boolean | null
          last_worn_at?: string | null
          material?: string | null
          pattern?: string | null
          purchase_currency?: string | null
          purchase_price?: number | null
          season_tags?: string[] | null
          source_url?: string | null
          subcategory?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
          wear_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "garments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inspiration_saves: {
        Row: {
          created_at: string
          id: string
          outfit_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          outfit_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          outfit_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspiration_saves_outfit_id_fkey"
            columns: ["outfit_id"]
            isOneToOne: false
            referencedRelation: "outfits"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_events: {
        Row: {
          created_at: string
          device_type: string | null
          event_name: string
          id: string
          metadata: Json | null
          path: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          created_at?: string
          device_type?: string | null
          event_name: string
          id?: string
          metadata?: Json | null
          path?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          created_at?: string
          device_type?: string | null
          event_name?: string
          id?: string
          metadata?: Json | null
          path?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: []
      }
      marketing_leads: {
        Row: {
          created_at: string
          email: string
          id: string
          source: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          source?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          source?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: []
      }
      outfit_feedback: {
        Row: {
          ai_raw: Json | null
          color_match_score: number | null
          commentary: string | null
          created_at: string
          fit_score: number | null
          id: string
          outfit_id: string
          overall_score: number | null
          selfie_path: string
          user_id: string
        }
        Insert: {
          ai_raw?: Json | null
          color_match_score?: number | null
          commentary?: string | null
          created_at?: string
          fit_score?: number | null
          id?: string
          outfit_id: string
          overall_score?: number | null
          selfie_path: string
          user_id: string
        }
        Update: {
          ai_raw?: Json | null
          color_match_score?: number | null
          commentary?: string | null
          created_at?: string
          fit_score?: number | null
          id?: string
          outfit_id?: string
          overall_score?: number | null
          selfie_path?: string
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
          created_at: string
          id: string
          outfit_id: string
          reaction: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          outfit_id: string
          reaction: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          outfit_id?: string
          reaction?: string
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
          explanation: string | null
          feedback: string[] | null
          flatlay_image_path: string | null
          generated_at: string | null
          id: string
          occasion: string
          planned_for: string | null
          rating: number | null
          saved: boolean | null
          share_enabled: boolean | null
          style_score: Json | null
          style_vibe: string | null
          user_id: string
          weather: Json | null
          worn_at: string | null
        }
        Insert: {
          explanation?: string | null
          feedback?: string[] | null
          flatlay_image_path?: string | null
          generated_at?: string | null
          id?: string
          occasion: string
          planned_for?: string | null
          rating?: number | null
          saved?: boolean | null
          share_enabled?: boolean | null
          style_score?: Json | null
          style_vibe?: string | null
          user_id: string
          weather?: Json | null
          worn_at?: string | null
        }
        Update: {
          explanation?: string | null
          feedback?: string[] | null
          flatlay_image_path?: string | null
          generated_at?: string | null
          id?: string
          occasion?: string
          planned_for?: string | null
          rating?: number | null
          saved?: boolean | null
          share_enabled?: boolean | null
          style_score?: Json | null
          style_vibe?: string | null
          user_id?: string
          weather?: Json | null
          worn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outfits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      planned_outfits: {
        Row: {
          created_at: string | null
          date: string
          id: string
          note: string | null
          outfit_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date: string
          id?: string
          note?: string | null
          outfit_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          note?: string | null
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
          avatar_path: string | null
          body_image_path: string | null
          created_at: string | null
          display_name: string | null
          height_cm: number | null
          home_city: string | null
          ics_url: string | null
          id: string
          is_premium: boolean | null
          last_calendar_sync: string | null
          preferences: Json | null
          stripe_customer_id: string | null
          updated_at: string | null
          username: string | null
          weight_kg: number | null
        }
        Insert: {
          avatar_path?: string | null
          body_image_path?: string | null
          created_at?: string | null
          display_name?: string | null
          height_cm?: number | null
          home_city?: string | null
          ics_url?: string | null
          id: string
          is_premium?: boolean | null
          last_calendar_sync?: string | null
          preferences?: Json | null
          stripe_customer_id?: string | null
          updated_at?: string | null
          username?: string | null
          weight_kg?: number | null
        }
        Update: {
          avatar_path?: string | null
          body_image_path?: string | null
          created_at?: string | null
          display_name?: string | null
          height_cm?: number | null
          home_city?: string | null
          ics_url?: string | null
          id?: string
          is_premium?: boolean | null
          last_calendar_sync?: string | null
          preferences?: Json | null
          stripe_customer_id?: string | null
          updated_at?: string | null
          username?: string | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      stripe_events: {
        Row: {
          created_at: string | null
          error: string | null
          event_type: string
          id: string
          processed_at: string | null
          processed_ok: boolean | null
          stripe_mode: string | null
        }
        Insert: {
          created_at?: string | null
          error?: string | null
          event_type: string
          id: string
          processed_at?: string | null
          processed_ok?: boolean | null
          stripe_mode?: string | null
        }
        Update: {
          created_at?: string | null
          error?: string | null
          event_type?: string
          id?: string
          processed_at?: string | null
          processed_ok?: boolean | null
          stripe_mode?: string | null
        }
        Relationships: []
      }
      style_challenges: {
        Row: {
          created_at: string
          description: string | null
          id: string
          title: string
          week_end: string
          week_start: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          title: string
          week_end: string
          week_start: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          title?: string
          week_end?: string
          week_start?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          current_period_end: string | null
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
          current_period_end?: string | null
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
          current_period_end?: string | null
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
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          created_at: string
          garments_count: number
          id: string
          outfits_used_month: number
          period_start: string
          plan: Database["public"]["Enums"]["subscription_plan"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          garments_count?: number
          id?: string
          outfits_used_month?: number
          period_start?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          garments_count?: number
          id?: string
          outfits_used_month?: number
          period_start?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wear_logs: {
        Row: {
          created_at: string | null
          event_title: string | null
          garment_id: string
          id: string
          occasion: string | null
          outfit_id: string | null
          user_id: string
          worn_at: string
        }
        Insert: {
          created_at?: string | null
          event_title?: string | null
          garment_id: string
          id?: string
          occasion?: string | null
          outfit_id?: string | null
          user_id: string
          worn_at?: string
        }
        Update: {
          created_at?: string | null
          event_title?: string | null
          garment_id?: string
          id?: string
          occasion?: string | null
          outfit_id?: string | null
          user_id?: string
          worn_at?: string
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
          {
            foreignKeyName: "wear_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
      subscription_plan: ["free", "premium"],
    },
  },
} as const
