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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      contracts: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          customer_id: string
          down_payment: number
          end_date: string
          id: string
          interest_rate: number
          machine_id: string
          monthly_payment: number | null
          months: number
          note: string | null
          payment_type: Database["public"]["Enums"]["payment_type"]
          start_date: string
          status: Database["public"]["Enums"]["contract_status"]
          total_value: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          down_payment?: number
          end_date: string
          id?: string
          interest_rate?: number
          machine_id: string
          monthly_payment?: number | null
          months: number
          note?: string | null
          payment_type?: Database["public"]["Enums"]["payment_type"]
          start_date?: string
          status?: Database["public"]["Enums"]["contract_status"]
          total_value: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          down_payment?: number
          end_date?: string
          id?: string
          interest_rate?: number
          machine_id?: string
          monthly_payment?: number | null
          months?: number
          note?: string | null
          payment_type?: Database["public"]["Enums"]["payment_type"]
          start_date?: string
          status?: Database["public"]["Enums"]["contract_status"]
          total_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          code: string
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          name: string
          note: string | null
          payment_type: Database["public"]["Enums"]["payment_type"]
          phone: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name: string
          note?: string | null
          payment_type?: Database["public"]["Enums"]["payment_type"]
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string
          note?: string | null
          payment_type?: Database["public"]["Enums"]["payment_type"]
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      machines: {
        Row: {
          brand: string | null
          code: string
          counter_current: number
          counter_start: number
          counter_updated_at: string | null
          created_at: string
          id: string
          name: string
          note: string | null
          price: number
          serial_number: string | null
          updated_at: string
          warranty_copies: number
          warranty_months: number
          warranty_start_date: string | null
        }
        Insert: {
          brand?: string | null
          code: string
          counter_current?: number
          counter_start?: number
          counter_updated_at?: string | null
          created_at?: string
          id?: string
          name: string
          note?: string | null
          price?: number
          serial_number?: string | null
          updated_at?: string
          warranty_copies?: number
          warranty_months?: number
          warranty_start_date?: string | null
        }
        Update: {
          brand?: string | null
          code?: string
          counter_current?: number
          counter_start?: number
          counter_updated_at?: string | null
          created_at?: string
          id?: string
          name?: string
          note?: string | null
          price?: number
          serial_number?: string | null
          updated_at?: string
          warranty_copies?: number
          warranty_months?: number
          warranty_start_date?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          code: string
          collector_id: string | null
          collector_name: string | null
          contract_id: string
          created_at: string
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          note: string | null
          paid_at: string
        }
        Insert: {
          amount: number
          code: string
          collector_id?: string | null
          collector_name?: string | null
          contract_id: string
          created_at?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          note?: string | null
          paid_at?: string
        }
        Update: {
          amount?: number
          code?: string
          collector_id?: string | null
          collector_name?: string | null
          contract_id?: string
          created_at?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          note?: string | null
          paid_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contract_summaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
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
      contract_summaries: {
        Row: {
          code: string | null
          created_at: string | null
          customer_id: string | null
          customer_name: string | null
          customer_payment_type:
            | Database["public"]["Enums"]["payment_type"]
            | null
          customer_phone: string | null
          down_payment: number | null
          end_date: string | null
          id: string | null
          interest_rate: number | null
          last_payment_date: string | null
          machine_code: string | null
          machine_id: string | null
          machine_name: string | null
          monthly_payment: number | null
          months: number | null
          note: string | null
          payment_type: Database["public"]["Enums"]["payment_type"] | null
          payments_count: number | null
          payments_total: number | null
          remaining: number | null
          start_date: string | null
          status: Database["public"]["Enums"]["contract_status"] | null
          total_paid: number | null
          total_value: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      my_customer_ids: { Args: never; Returns: string[] }
    }
    Enums: {
      app_role: "admin" | "staff" | "customer"
      contract_status: "dang_tra_gop" | "da_hoan_thanh" | "qua_han"
      payment_method: "tien_mat" | "chuyen_khoan"
      payment_type: "tra_gop" | "tra_thang"
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
      app_role: ["admin", "staff", "customer"],
      contract_status: ["dang_tra_gop", "da_hoan_thanh", "qua_han"],
      payment_method: ["tien_mat", "chuyen_khoan"],
      payment_type: ["tra_gop", "tra_thang"],
    },
  },
} as const
