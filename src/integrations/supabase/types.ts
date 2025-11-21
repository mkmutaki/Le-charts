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
      LeSongs: {
        Row: {
          album_id: string | null
          album_name: string | null
          artist: string | null
          cover_url: string | null
          created_at: string
          id: number
          itunes_track_id: string | null
          song_name: string | null
          song_url: string | null
          track_duration_ms: number | null
          track_number: number | null
          updated_at: string | null
          votes: number | null
        }
        Insert: {
          album_id?: string | null
          album_name?: string | null
          artist?: string | null
          cover_url?: string | null
          created_at?: string
          id?: number
          itunes_track_id?: string | null
          song_name?: string | null
          song_url?: string | null
          track_duration_ms?: number | null
          track_number?: number | null
          updated_at?: string | null
          votes?: number | null
        }
        Update: {
          album_id?: string | null
          album_name?: string | null
          artist?: string | null
          cover_url?: string | null
          created_at?: string
          id?: number
          itunes_track_id?: string | null
          song_name?: string | null
          song_url?: string | null
          track_duration_ms?: number | null
          track_number?: number | null
          updated_at?: string | null
          votes?: number | null
        }
        Relationships: []
      }
      puzzle_settings: {
        Row: {
          album_artist: string | null
          album_title: string | null
          created_at: string
          current_album_cover_url: string
          id: string
          updated_at: string
        }
        Insert: {
          album_artist?: string | null
          album_title?: string | null
          created_at?: string
          current_album_cover_url: string
          id?: string
          updated_at?: string
        }
        Update: {
          album_artist?: string | null
          album_title?: string | null
          created_at?: string
          current_album_cover_url?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      song_votes: {
        Row: {
          device_id: string
          id: number
          ip_address: string | null
          song_id: number
          vote_date: string | null
          voted_at: string | null
        }
        Insert: {
          device_id: string
          id?: number
          ip_address?: string | null
          song_id: number
          vote_date?: string | null
          voted_at?: string | null
        }
        Update: {
          device_id?: string
          id?: number
          ip_address?: string | null
          song_id?: number
          vote_date?: string | null
          voted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "song_votes_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "LeSongs"
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
      decrement: {
        Args: { x: number }
        Returns: number
      }
      get_public_url: {
        Args: { bucket: string; path: string }
        Returns: string
      }
      get_song_votes: {
        Args: Record<PropertyKey, never>
        Returns: {
          song_id: number
          user_id: string
        }[]
      }
      is_admin: {
        Args: { id: string } | { user_id: string }
        Returns: boolean
      }
      reset_all_votes: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      vote_for_song: {
        Args: { p_song_id: number; p_user_id: string }
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
