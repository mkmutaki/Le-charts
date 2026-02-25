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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      scheduled_albums: {
        Row: {
          id: string
          spotify_album_id: string
          album_name: string
          artist_name: string
          artwork_url: string
          track_count: number
          scheduled_date: string
          status: 'pending' | 'current' | 'completed'
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          spotify_album_id: string
          album_name: string
          artist_name: string
          artwork_url: string
          track_count: number
          scheduled_date: string
          status?: 'pending' | 'current' | 'completed'
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          spotify_album_id?: string
          album_name?: string
          artist_name?: string
          artwork_url?: string
          track_count?: number
          scheduled_date?: string
          status?: 'pending' | 'current' | 'completed'
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_albums_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_album_tracks: {
        Row: {
          id: string
          scheduled_album_id: string
          spotify_track_id: string
          track_name: string
          artist_name: string
          track_number: number
          duration_ms: number | null
          artwork_url: string | null
          preview_url: string | null
          spotify_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          scheduled_album_id: string
          spotify_track_id: string
          track_name: string
          artist_name: string
          track_number: number
          duration_ms?: number | null
          artwork_url?: string | null
          preview_url?: string | null
          spotify_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          scheduled_album_id?: string
          spotify_track_id?: string
          track_name?: string
          artist_name?: string
          track_number?: number
          duration_ms?: number | null
          artwork_url?: string | null
          preview_url?: string | null
          spotify_url?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_album_tracks_scheduled_album_id_fkey"
            columns: ["scheduled_album_id"]
            isOneToOne: false
            referencedRelation: "scheduled_albums"
            referencedColumns: ["id"]
          },
        ]
      }
      song_votes: {
        Row: {
          device_id: string
          id: number
          ip_address: string | null
          vote_date: string | null
          voted_at: string | null
          scheduled_date: string | null
          scheduled_track_id: string | null
        }
        Insert: {
          device_id: string
          id?: number
          ip_address?: string | null
          vote_date?: string | null
          voted_at?: string | null
          scheduled_date?: string | null
          scheduled_track_id?: string | null
        }
        Update: {
          device_id?: string
          id?: number
          ip_address?: string | null
          vote_date?: string | null
          voted_at?: string | null
          scheduled_date?: string | null
          scheduled_track_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "song_votes_scheduled_track_id_fkey"
            columns: ["scheduled_track_id"]
            isOneToOne: false
            referencedRelation: "scheduled_album_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          is_admin: boolean
          user_id: string
        }
        Insert: {
          id?: string
          is_admin: boolean
          user_id: string
        }
        Update: {
          id?: string
          is_admin?: boolean
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_album_for_date: {
        Args: { target_date: string }
        Returns: Json | null
      }
      get_public_url: {
        Args: { bucket: string; path: string }
        Returns: string
      }
      get_scheduled_track_votes: {
        Args: { p_scheduled_date: string }
        Returns: {
          track_id: string
          vote_count: number
        }[]
      }
      is_admin: {
        Args: { id: string }
        Returns: boolean
      }
      reset_all_votes: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
