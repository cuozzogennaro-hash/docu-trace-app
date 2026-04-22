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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      assets: {
        Row: {
          asset_type: string
          cleaning_product: string | null
          created_at: string
          id: string
          name: string
          target_temp_max: number | null
          target_temp_min: number | null
          user_id: string
        }
        Insert: {
          asset_type?: string
          cleaning_product?: string | null
          created_at?: string
          id?: string
          name: string
          target_temp_max?: number | null
          target_temp_min?: number | null
          user_id: string
        }
        Update: {
          asset_type?: string
          cleaning_product?: string | null
          created_at?: string
          id?: string
          name?: string
          target_temp_max?: number | null
          target_temp_min?: number | null
          user_id?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          contact: string | null
          created_at: string
          id: string
          name: string
          user_id: string
          vat: string | null
        }
        Insert: {
          contact?: string | null
          created_at?: string
          id?: string
          name: string
          user_id: string
          vat?: string | null
        }
        Update: {
          contact?: string | null
          created_at?: string
          id?: string
          name?: string
          user_id?: string
          vat?: string | null
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          address: string | null
          business_name: string | null
          created_at: string
          email: string | null
          id: string
          logo_url: string | null
          phone: string | null
          updated_at: string
          user_id: string
          vat: string | null
        }
        Insert: {
          address?: string | null
          business_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
          vat?: string | null
        }
        Update: {
          address?: string | null
          business_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
          vat?: string | null
        }
        Relationships: []
      }
      operators: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          login_handle: string
          name: string
          pin_hash: string
          role: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          login_handle: string
          name: string
          pin_hash: string
          role?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          login_handle?: string
          name?: string
          pin_hash?: string
          role?: string | null
          user_id?: string
        }
        Relationships: []
      }
      product_ingredients: {
        Row: {
          id: string
          product_id: string
          raw_material_id: string
          user_id: string
        }
        Insert: {
          id?: string
          product_id: string
          raw_material_id: string
          user_id: string
        }
        Update: {
          id?: string
          product_id?: string
          raw_material_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_ingredients_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_ingredients_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          id: string
          internal_lot: string
          name: string
          notes: string | null
          operator_id: string | null
          production_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          internal_lot: string
          name: string
          notes?: string | null
          operator_id?: string | null
          production_date: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          internal_lot?: string
          name?: string
          notes?: string | null
          operator_id?: string | null
          production_date?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          business_name: string | null
          created_at: string
          email: string | null
          id: string
        }
        Insert: {
          business_name?: string | null
          created_at?: string
          email?: string | null
          id: string
        }
        Update: {
          business_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
        }
        Relationships: []
      }
      raw_materials: {
        Row: {
          created_at: string
          document_date: string | null
          document_image_url: string | null
          document_number: string | null
          expiry_date: string | null
          id: string
          internal_lot: string
          is_out_of_stock: boolean
          operator_id: string | null
          product_name: string
          quantity: string | null
          supplier_id: string | null
          supplier_lot: string | null
          supplier_name: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          document_date?: string | null
          document_image_url?: string | null
          document_number?: string | null
          expiry_date?: string | null
          id?: string
          internal_lot: string
          is_out_of_stock?: boolean
          operator_id?: string | null
          product_name: string
          quantity?: string | null
          supplier_id?: string | null
          supplier_lot?: string | null
          supplier_name?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          document_date?: string | null
          document_image_url?: string | null
          document_number?: string | null
          expiry_date?: string | null
          id?: string
          internal_lot?: string
          is_out_of_stock?: boolean
          operator_id?: string | null
          product_name?: string
          quantity?: string | null
          supplier_id?: string | null
          supplier_lot?: string | null
          supplier_name?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "raw_materials_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          client_id: string
          created_at: string
          document_number: string | null
          id: string
          notes: string | null
          product_id: string
          quantity: string | null
          sale_date: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          document_number?: string | null
          id?: string
          notes?: string | null
          product_id: string
          quantity?: string | null
          sale_date: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          document_number?: string | null
          id?: string
          notes?: string | null
          product_id?: string
          quantity?: string | null
          sale_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      sanitations: {
        Row: {
          asset_id: string
          event_date: string
          id: string
          notes: string | null
          operator: string | null
          operator_id: string | null
          product_used: string | null
          recorded_at: string
          user_id: string
        }
        Insert: {
          asset_id: string
          event_date: string
          id?: string
          notes?: string | null
          operator?: string | null
          operator_id?: string | null
          product_used?: string | null
          recorded_at?: string
          user_id: string
        }
        Update: {
          asset_id?: string
          event_date?: string
          id?: string
          notes?: string | null
          operator?: string | null
          operator_id?: string | null
          product_used?: string | null
          recorded_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sanitations_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
          vat: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id: string
          vat?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
          vat?: string | null
        }
        Relationships: []
      }
      task_assignments: {
        Row: {
          asset_id: string
          created_at: string
          frequency: string
          id: string
          operator_id: string
          task_type: string
          user_id: string
        }
        Insert: {
          asset_id: string
          created_at?: string
          frequency?: string
          id?: string
          operator_id: string
          task_type: string
          user_id: string
        }
        Update: {
          asset_id?: string
          created_at?: string
          frequency?: string
          id?: string
          operator_id?: string
          task_type?: string
          user_id?: string
        }
        Relationships: []
      }
      temperatures: {
        Row: {
          asset_id: string
          event_date: string
          id: string
          notes: string | null
          operator: string | null
          operator_id: string | null
          recorded_at: string
          temperature: number
          user_id: string
        }
        Insert: {
          asset_id: string
          event_date: string
          id?: string
          notes?: string | null
          operator?: string | null
          operator_id?: string | null
          recorded_at?: string
          temperature: number
          user_id: string
        }
        Update: {
          asset_id?: string
          event_date?: string
          id?: string
          notes?: string | null
          operator?: string | null
          operator_id?: string | null
          recorded_at?: string
          temperature?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "temperatures_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      operator_login: {
        Args: { p_handle: string; p_pin: string }
        Returns: Json
      }
      slugify: { Args: { input: string }; Returns: string }
      unaccent_safe: { Args: { input: string }; Returns: string }
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
