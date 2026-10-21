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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      bookings: {
        Row: {
          booking_code: string
          cancelled_at: string | null
          created_at: string
          fare_total: number
          from_name: string
          from_stop_id: string | null
          id: string
          legs: Json
          option_type: string
          passengers: number
          status: string
          to_name: string
          to_stop_id: string | null
          travel_at: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          booking_code: string
          cancelled_at?: string | null
          created_at?: string
          fare_total: number
          from_name: string
          from_stop_id?: string | null
          id?: string
          legs?: Json
          option_type: string
          passengers?: number
          status?: string
          to_name: string
          to_stop_id?: string | null
          travel_at: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          booking_code?: string
          cancelled_at?: string | null
          created_at?: string
          fare_total?: number
          from_name?: string
          from_stop_id?: string | null
          id?: string
          legs?: Json
          option_type?: string
          passengers?: number
          status?: string
          to_name?: string
          to_stop_id?: string | null
          travel_at?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_from_stop_id_fkey"
            columns: ["from_stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_to_stop_id_fkey"
            columns: ["to_stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
        ]
      }
      buses: {
        Row: {
          bus_number: string
          bus_type: string
          capacity: number
          created_at: string
          driver_name: string
          id: string
          is_accessible: boolean
          route_id: string | null
          status: string
        }
        Insert: {
          bus_number: string
          bus_type?: string
          capacity?: number
          created_at?: string
          driver_name?: string
          id?: string
          is_accessible?: boolean
          route_id?: string | null
          status?: string
        }
        Update: {
          bus_number?: string
          bus_type?: string
          capacity?: number
          created_at?: string
          driver_name?: string
          id?: string
          is_accessible?: boolean
          route_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "buses_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          from_stop_id: string
          id: string
          label: string
          to_stop_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          from_stop_id: string
          id?: string
          label?: string
          to_stop_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          from_stop_id?: string
          id?: string
          label?: string
          to_stop_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_from_stop_id_fkey"
            columns: ["from_stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_to_stop_id_fkey"
            columns: ["to_stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          booking_id: string
          created_at: string
          id: string
          mode: string
          status: string
          transaction_ref: string
          user_id: string
        }
        Insert: {
          amount: number
          booking_id: string
          created_at?: string
          id?: string
          mode?: string
          status: string
          transaction_ref: string
          user_id: string
        }
        Update: {
          amount?: number
          booking_id?: string
          created_at?: string
          id?: string
          mode?: string
          status?: string
          transaction_ref?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          needs_accessible: boolean
          preferred_language: string
        }
        Insert: {
          created_at?: string
          email?: string
          full_name?: string
          id: string
          needs_accessible?: boolean
          preferred_language?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          needs_accessible?: boolean
          preferred_language?: string
        }
        Relationships: []
      }
      recent_searches: {
        Row: {
          created_at: string
          from_stop_id: string
          id: string
          to_stop_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          from_stop_id: string
          id?: string
          to_stop_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          from_stop_id?: string
          id?: string
          to_stop_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recent_searches_from_stop_id_fkey"
            columns: ["from_stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recent_searches_to_stop_id_fkey"
            columns: ["to_stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
        ]
      }
      route_stops: {
        Row: {
          id: string
          route_id: string
          stop_id: string
          stop_order: number
        }
        Insert: {
          id?: string
          route_id: string
          stop_id: string
          stop_order: number
        }
        Update: {
          id?: string
          route_id?: string
          stop_id?: string
          stop_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "route_stops_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_stops_stop_id_fkey"
            columns: ["stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
        ]
      }
      routes: {
        Row: {
          avg_speed_kmph: number
          base_fare: number
          color: string
          created_at: string
          fare_per_km: number
          first_departure: string
          frequency_min: number
          id: string
          is_active: boolean
          last_departure: string
          name: string
          route_number: string
        }
        Insert: {
          avg_speed_kmph?: number
          base_fare?: number
          color?: string
          created_at?: string
          fare_per_km?: number
          first_departure?: string
          frequency_min?: number
          id?: string
          is_active?: boolean
          last_departure?: string
          name: string
          route_number: string
        }
        Update: {
          avg_speed_kmph?: number
          base_fare?: number
          color?: string
          created_at?: string
          fare_per_km?: number
          first_departure?: string
          frequency_min?: number
          id?: string
          is_active?: boolean
          last_departure?: string
          name?: string
          route_number?: string
        }
        Relationships: []
      }
      stops: {
        Row: {
          area: string
          created_at: string
          id: string
          latitude: number
          longitude: number
          name: string
        }
        Insert: {
          area?: string
          created_at?: string
          id?: string
          latitude: number
          longitude: number
          name: string
        }
        Update: {
          area?: string
          created_at?: string
          id?: string
          latitude?: number
          longitude?: number
          name?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
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
      set_route_stops: {
        Args: { _route_id: string; _stop_ids: string[] }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user" | "passenger" | "driver" | "operator"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "user", "passenger", "driver", "operator"],
    },
  },
} as const
