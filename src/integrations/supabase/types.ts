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
      allergens: {
        Row: {
          created_at: string
          id: string
          keywords: string[]
          name: string
          notes: string | null
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          keywords?: string[]
          name: string
          notes?: string | null
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          keywords?: string[]
          name?: string
          notes?: string | null
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      asl_packages: {
        Row: {
          created_at: string
          id: string
          original_pdf_path: string
          period_end: string
          period_label: string
          period_start: string
          signed_pdf_path: string | null
          signed_uploaded_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          original_pdf_path: string
          period_end: string
          period_label: string
          period_start: string
          signed_pdf_path?: string | null
          signed_uploaded_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          original_pdf_path?: string
          period_end?: string
          period_label?: string
          period_start?: string
          signed_pdf_path?: string | null
          signed_uploaded_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      assets: {
        Row: {
          asset_type: string
          cleaning_product: string | null
          created_at: string
          department_id: string | null
          id: string
          name: string
          out_of_service: boolean
          out_of_service_reason: string | null
          out_of_service_since: string | null
          target_temp_max: number | null
          target_temp_min: number | null
          user_id: string
        }
        Insert: {
          asset_type?: string
          cleaning_product?: string | null
          created_at?: string
          department_id?: string | null
          id?: string
          name: string
          out_of_service?: boolean
          out_of_service_reason?: string | null
          out_of_service_since?: string | null
          target_temp_max?: number | null
          target_temp_min?: number | null
          user_id: string
        }
        Update: {
          asset_type?: string
          cleaning_product?: string | null
          created_at?: string
          department_id?: string | null
          id?: string
          name?: string
          out_of_service?: boolean
          out_of_service_reason?: string | null
          out_of_service_since?: string | null
          target_temp_max?: number | null
          target_temp_min?: number | null
          user_id?: string
        }
        Relationships: []
      }
      blast_chillings: {
        Row: {
          asset_id: string | null
          created_at: string
          cycle_type: string
          ended_at: string | null
          id: string
          notes: string | null
          operator_id: string | null
          outcome: string
          product_id: string | null
          product_name: string
          started_at: string
          temp_end: number | null
          temp_start: number | null
          user_id: string
        }
        Insert: {
          asset_id?: string | null
          created_at?: string
          cycle_type?: string
          ended_at?: string | null
          id?: string
          notes?: string | null
          operator_id?: string | null
          outcome?: string
          product_id?: string | null
          product_name: string
          started_at?: string
          temp_end?: number | null
          temp_start?: number | null
          user_id: string
        }
        Update: {
          asset_id?: string | null
          created_at?: string
          cycle_type?: string
          ended_at?: string | null
          id?: string
          notes?: string | null
          operator_id?: string | null
          outcome?: string
          product_id?: string | null
          product_name?: string
          started_at?: string
          temp_end?: number | null
          temp_start?: number | null
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
          city: string | null
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
          city?: string | null
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
          city?: string | null
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
      consulenti_partner: {
        Row: {
          codice_partner: string
          created_at: string
          studio_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          codice_partner: string
          created_at?: string
          studio_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          codice_partner?: string
          created_at?: string
          studio_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          created_at: string
          default_shelf_life_days: number | null
          id: string
          image_url: string | null
          name: string
          scale_department_code: number | null
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_shelf_life_days?: number | null
          id?: string
          image_url?: string | null
          name: string
          scale_department_code?: number | null
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_shelf_life_days?: number | null
          id?: string
          image_url?: string | null
          name?: string
          scale_department_code?: number | null
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      holding_records: {
        Row: {
          asset_id: string | null
          created_at: string
          id: string
          mode: string
          notes: string | null
          operator_id: string | null
          outcome: string
          product_name: string
          recorded_at: string
          temperature: number | null
          user_id: string
        }
        Insert: {
          asset_id?: string | null
          created_at?: string
          id?: string
          mode?: string
          notes?: string | null
          operator_id?: string | null
          outcome?: string
          product_name: string
          recorded_at?: string
          temperature?: number | null
          user_id: string
        }
        Update: {
          asset_id?: string | null
          created_at?: string
          id?: string
          mode?: string
          notes?: string | null
          operator_id?: string | null
          outcome?: string
          product_name?: string
          recorded_at?: string
          temperature?: number | null
          user_id?: string
        }
        Relationships: []
      }
      label_rules: {
        Row: {
          created_at: string
          department_key: string
          description: string
          id: string
          params: Json
          rule_key: string
          sort_order: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          department_key: string
          description?: string
          id?: string
          params?: Json
          rule_key: string
          sort_order?: number
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          department_key?: string
          description?: string
          id?: string
          params?: Json
          rule_key?: string
          sort_order?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      label_templates: {
        Row: {
          created_at: string
          height_mm: number
          id: string
          is_default: boolean
          layout_config: Json
          name: string
          updated_at: string
          user_id: string
          width_mm: number
        }
        Insert: {
          created_at?: string
          height_mm?: number
          id?: string
          is_default?: boolean
          layout_config?: Json
          name?: string
          updated_at?: string
          user_id: string
          width_mm?: number
        }
        Update: {
          created_at?: string
          height_mm?: number
          id?: string
          is_default?: boolean
          layout_config?: Json
          name?: string
          updated_at?: string
          user_id?: string
          width_mm?: number
        }
        Relationships: []
      }
      menu_dishes: {
        Row: {
          allergen_ids: string[]
          category: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          price: number | null
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          allergen_ids?: string[]
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          price?: number | null
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          allergen_ids?: string[]
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          price?: number | null
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      non_conformities: {
        Row: {
          area: string
          asset_id: string | null
          corrective_action: string | null
          created_at: string
          description: string | null
          detected_at: string
          id: string
          operator_id: string | null
          resolved_at: string | null
          severity: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          area?: string
          asset_id?: string | null
          corrective_action?: string | null
          created_at?: string
          description?: string | null
          detected_at?: string
          id?: string
          operator_id?: string | null
          resolved_at?: string | null
          severity?: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          area?: string
          asset_id?: string | null
          corrective_action?: string | null
          created_at?: string
          description?: string | null
          detected_at?: string
          id?: string
          operator_id?: string | null
          resolved_at?: string | null
          severity?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      oil_checks: {
        Row: {
          action: string
          asset_id: string | null
          checked_at: string
          created_at: string
          fryer_name: string | null
          id: string
          notes: string | null
          operator_id: string | null
          outcome: string
          polar_compounds: number | null
          user_id: string
        }
        Insert: {
          action?: string
          asset_id?: string | null
          checked_at?: string
          created_at?: string
          fryer_name?: string | null
          id?: string
          notes?: string | null
          operator_id?: string | null
          outcome?: string
          polar_compounds?: number | null
          user_id: string
        }
        Update: {
          action?: string
          asset_id?: string | null
          checked_at?: string
          created_at?: string
          fryer_name?: string | null
          id?: string
          notes?: string | null
          operator_id?: string | null
          outcome?: string
          polar_compounds?: number | null
          user_id?: string
        }
        Relationships: []
      }
      operators: {
        Row: {
          created_at: string
          health_cert_expiry: string | null
          health_cert_reminder_days: number
          hide_in_reports: boolean
          id: string
          is_active: boolean
          is_admin: boolean
          login_handle: string
          name: string
          native_platform: string | null
          native_push_token: string | null
          pin_hash: string
          push_token: Json | null
          role: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          health_cert_expiry?: string | null
          health_cert_reminder_days?: number
          hide_in_reports?: boolean
          id?: string
          is_active?: boolean
          is_admin?: boolean
          login_handle: string
          name: string
          native_platform?: string | null
          native_push_token?: string | null
          pin_hash: string
          push_token?: Json | null
          role?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          health_cert_expiry?: string | null
          health_cert_reminder_days?: number
          hide_in_reports?: boolean
          id?: string
          is_active?: boolean
          is_admin?: boolean
          login_handle?: string
          name?: string
          native_platform?: string | null
          native_push_token?: string | null
          pin_hash?: string
          push_token?: Json | null
          role?: string | null
          user_id?: string
        }
        Relationships: []
      }
      page_views: {
        Row: {
          created_at: string
          device: string | null
          id: string
          is_native: boolean
          path: string
          referrer: string | null
          session_id: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          device?: string | null
          id?: string
          is_native?: boolean
          path: string
          referrer?: string | null
          session_id: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          device?: string | null
          id?: string
          is_native?: boolean
          path?: string
          referrer?: string | null
          session_id?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      preparations: {
        Row: {
          allergen_ids: string[]
          created_at: string
          id: string
          ingredients_text: string | null
          internal_expiry: string
          is_out_of_stock: boolean
          name: string
          notes: string | null
          operator_id: string | null
          prepared_at: string
          raw_material_ids: string[]
          storage_type: string
          user_id: string
        }
        Insert: {
          allergen_ids?: string[]
          created_at?: string
          id?: string
          ingredients_text?: string | null
          internal_expiry: string
          is_out_of_stock?: boolean
          name: string
          notes?: string | null
          operator_id?: string | null
          prepared_at?: string
          raw_material_ids?: string[]
          storage_type?: string
          user_id: string
        }
        Update: {
          allergen_ids?: string[]
          created_at?: string
          id?: string
          ingredients_text?: string | null
          internal_expiry?: string
          is_out_of_stock?: boolean
          name?: string
          notes?: string | null
          operator_id?: string | null
          prepared_at?: string
          raw_material_ids?: string[]
          storage_type?: string
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
          department_id: string | null
          expiry_date: string | null
          id: string
          internal_lot: string
          is_out_of_stock: boolean
          manual_ingredients: string | null
          meat_type: string | null
          name: string
          notes: string | null
          operator_id: string | null
          preservation_type: string
          production_date: string
          requires_blast_chilling: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          expiry_date?: string | null
          id?: string
          internal_lot: string
          is_out_of_stock?: boolean
          manual_ingredients?: string | null
          meat_type?: string | null
          name: string
          notes?: string | null
          operator_id?: string | null
          preservation_type?: string
          production_date: string
          requires_blast_chilling?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          expiry_date?: string | null
          id?: string
          internal_lot?: string
          is_out_of_stock?: boolean
          manual_ingredients?: string | null
          meat_type?: string | null
          name?: string
          notes?: string | null
          operator_id?: string | null
          preservation_type?: string
          production_date?: string
          requires_blast_chilling?: boolean
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          business_name: string | null
          consulente_id: string | null
          created_at: string
          email: string | null
          id: string
          last_seen_at: string | null
          native_platform: string | null
          native_push_token: string | null
          onboarding_completed: boolean
          push_token: Json | null
          store_id: string | null
        }
        Insert: {
          business_name?: string | null
          consulente_id?: string | null
          created_at?: string
          email?: string | null
          id: string
          last_seen_at?: string | null
          native_platform?: string | null
          native_push_token?: string | null
          onboarding_completed?: boolean
          push_token?: Json | null
          store_id?: string | null
        }
        Update: {
          business_name?: string | null
          consulente_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          last_seen_at?: string | null
          native_platform?: string | null
          native_push_token?: string | null
          onboarding_completed?: boolean
          push_token?: Json | null
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      raw_materials: {
        Row: {
          born_in: string | null
          category: string
          created_at: string
          department_id: string | null
          document_date: string | null
          document_image_url: string | null
          document_number: string | null
          expiry_date: string | null
          id: string
          ingredients: string | null
          intake_storage_mode: string | null
          intake_temp_compliant: boolean | null
          intake_temperature: number | null
          internal_lot: string
          is_out_of_stock: boolean
          meat_type: string | null
          operator_id: string | null
          origin: string | null
          product_name: string
          production_date: string | null
          quantity: string | null
          raised_in: string | null
          slaughter_mark: string | null
          slaughtered_in: string | null
          supplier_id: string | null
          supplier_lot: string | null
          supplier_name: string | null
          user_id: string
        }
        Insert: {
          born_in?: string | null
          category?: string
          created_at?: string
          department_id?: string | null
          document_date?: string | null
          document_image_url?: string | null
          document_number?: string | null
          expiry_date?: string | null
          id?: string
          ingredients?: string | null
          intake_storage_mode?: string | null
          intake_temp_compliant?: boolean | null
          intake_temperature?: number | null
          internal_lot: string
          is_out_of_stock?: boolean
          meat_type?: string | null
          operator_id?: string | null
          origin?: string | null
          product_name: string
          production_date?: string | null
          quantity?: string | null
          raised_in?: string | null
          slaughter_mark?: string | null
          slaughtered_in?: string | null
          supplier_id?: string | null
          supplier_lot?: string | null
          supplier_name?: string | null
          user_id: string
        }
        Update: {
          born_in?: string | null
          category?: string
          created_at?: string
          department_id?: string | null
          document_date?: string | null
          document_image_url?: string | null
          document_number?: string | null
          expiry_date?: string | null
          id?: string
          ingredients?: string | null
          intake_storage_mode?: string | null
          intake_temp_compliant?: boolean | null
          intake_temperature?: number | null
          internal_lot?: string
          is_out_of_stock?: boolean
          meat_type?: string | null
          operator_id?: string | null
          origin?: string | null
          product_name?: string
          production_date?: string | null
          quantity?: string | null
          raised_in?: string | null
          slaughter_mark?: string | null
          slaughtered_in?: string | null
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
      recurring_preparations: {
        Row: {
          allergen_ids: string[]
          created_at: string
          id: string
          ingredients_text: string | null
          last_used_at: string | null
          name: string
          notes: string | null
          raw_material_ids: string[]
          shelf_hours: number
          storage_type: string
          updated_at: string
          use_count: number
          user_id: string
        }
        Insert: {
          allergen_ids?: string[]
          created_at?: string
          id?: string
          ingredients_text?: string | null
          last_used_at?: string | null
          name: string
          notes?: string | null
          raw_material_ids?: string[]
          shelf_hours?: number
          storage_type?: string
          updated_at?: string
          use_count?: number
          user_id: string
        }
        Update: {
          allergen_ids?: string[]
          created_at?: string
          id?: string
          ingredients_text?: string | null
          last_used_at?: string | null
          name?: string
          notes?: string | null
          raw_material_ids?: string[]
          shelf_hours?: number
          storage_type?: string
          updated_at?: string
          use_count?: number
          user_id?: string
        }
        Relationships: []
      }
      recurring_raw_materials: {
        Row: {
          born_in: string | null
          category: string
          created_at: string
          department_id: string | null
          id: string
          ingredients: string | null
          last_used_at: string | null
          origin: string | null
          product_name: string
          quantity: string | null
          raised_in: string | null
          slaughter_mark: string | null
          slaughtered_in: string | null
          supplier_name: string | null
          updated_at: string
          use_count: number
          user_id: string
        }
        Insert: {
          born_in?: string | null
          category?: string
          created_at?: string
          department_id?: string | null
          id?: string
          ingredients?: string | null
          last_used_at?: string | null
          origin?: string | null
          product_name: string
          quantity?: string | null
          raised_in?: string | null
          slaughter_mark?: string | null
          slaughtered_in?: string | null
          supplier_name?: string | null
          updated_at?: string
          use_count?: number
          user_id: string
        }
        Update: {
          born_in?: string | null
          category?: string
          created_at?: string
          department_id?: string | null
          id?: string
          ingredients?: string | null
          last_used_at?: string | null
          origin?: string | null
          product_name?: string
          quantity?: string | null
          raised_in?: string | null
          slaughter_mark?: string | null
          slaughtered_in?: string | null
          supplier_name?: string | null
          updated_at?: string
          use_count?: number
          user_id?: string
        }
        Relationships: []
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
      scales_lotti_queue: {
        Row: {
          born_in: string | null
          created_at: string
          department_code: number | null
          id: number
          lot_code: string | null
          raised_in: string | null
          scale_slot_number: number
          slaughtered_in: string | null
          slaughterhouse_cee: string | null
          status: string
          store_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          born_in?: string | null
          created_at?: string
          department_code?: number | null
          id?: never
          lot_code?: string | null
          raised_in?: string | null
          scale_slot_number: number
          slaughtered_in?: string | null
          slaughterhouse_cee?: string | null
          status?: string
          store_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          born_in?: string | null
          created_at?: string
          department_code?: number | null
          id?: never
          lot_code?: string | null
          raised_in?: string | null
          scale_slot_number?: number
          slaughtered_in?: string | null
          slaughterhouse_cee?: string | null
          status?: string
          store_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scales_lotti_queue_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      scales_queue: {
        Row: {
          born_in: string | null
          created_at: string
          department_code: number | null
          id: number
          ingredients: string | null
          lot_number: string | null
          plu_code: string
          product_name: string | null
          raised_in: string | null
          slaughtered_in: string | null
          slaughterhouse_cee: string | null
          status: string
          store_id: string
          supplier_lot: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          born_in?: string | null
          created_at?: string
          department_code?: number | null
          id?: never
          ingredients?: string | null
          lot_number?: string | null
          plu_code: string
          product_name?: string | null
          raised_in?: string | null
          slaughtered_in?: string | null
          slaughterhouse_cee?: string | null
          status?: string
          store_id: string
          supplier_lot?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          born_in?: string | null
          created_at?: string
          department_code?: number | null
          id?: never
          ingredients?: string | null
          lot_number?: string | null
          plu_code?: string
          product_name?: string | null
          raised_in?: string | null
          slaughtered_in?: string | null
          slaughterhouse_cee?: string | null
          status?: string
          store_id?: string
          supplier_lot?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scales_queue_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          address: string | null
          created_at: string
          id: string
          name: string
          scale_api_key: string
          scale_integration_active: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          name: string
          scale_api_key?: string
          scale_integration_active?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          name?: string
          scale_api_key?: string
          scale_integration_active?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          paddle_customer_id: string
          paddle_subscription_id: string
          price_id: string
          product_id: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          paddle_customer_id: string
          paddle_subscription_id: string
          price_id: string
          product_id: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          paddle_customer_id?: string
          paddle_subscription_id?: string
          price_id?: string
          product_id?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
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
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      task_assignments: {
        Row: {
          asset_id: string
          created_at: string
          due_time: string | null
          frequency: string
          id: string
          last_notified_at: string | null
          operator_id: string
          status: string
          task_type: string
          user_id: string
        }
        Insert: {
          asset_id: string
          created_at?: string
          due_time?: string | null
          frequency?: string
          id?: string
          last_notified_at?: string | null
          operator_id: string
          status?: string
          task_type: string
          user_id: string
        }
        Update: {
          asset_id?: string
          created_at?: string
          due_time?: string | null
          frequency?: string
          id?: string
          last_notified_at?: string | null
          operator_id?: string
          status?: string
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
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      admin_overdue_tasks: { Args: { p_user_id: string }; Returns: Json }
      create_product_with_blast: {
        Args: {
          p_blast_cycle_type: string
          p_blast_notes: string
          p_department_id: string
          p_expiry_date: string
          p_internal_lot: string
          p_manual_ingredients: string
          p_meat_type: string
          p_name: string
          p_notes: string
          p_preservation_type: string
          p_production_date: string
          p_raw_material_ids: string[]
          p_requires_blast_chilling: boolean
        }
        Returns: Json
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      link_consulente_by_code: { Args: { p_code: string }; Returns: Json }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      operator_admin_get_product: {
        Args: { p_id: string; p_operator_id: string; p_pin: string }
        Returns: Json
      }
      operator_admin_get_raw_material: {
        Args: { p_id: string; p_operator_id: string; p_pin: string }
        Returns: Json
      }
      operator_admin_insert_product:
        | {
            Args: {
              p_department_id: string
              p_internal_lot: string
              p_meat_type: string
              p_name: string
              p_notes: string
              p_operator_id: string
              p_pin: string
              p_production_date: string
              p_raw_material_ids: string[]
            }
            Returns: Json
          }
        | {
            Args: {
              p_department_id: string
              p_internal_lot: string
              p_meat_type: string
              p_name: string
              p_notes: string
              p_operator_id: string
              p_pin: string
              p_preservation_type?: string
              p_production_date: string
              p_raw_material_ids: string[]
            }
            Returns: Json
          }
        | {
            Args: {
              p_blast_cycle_type?: string
              p_blast_notes?: string
              p_department_id: string
              p_expiry_date?: string
              p_internal_lot: string
              p_manual_ingredients?: string
              p_meat_type: string
              p_name: string
              p_notes: string
              p_operator_id: string
              p_pin: string
              p_preservation_type?: string
              p_production_date: string
              p_raw_material_ids: string[]
              p_requires_blast_chilling?: boolean
            }
            Returns: Json
          }
      operator_admin_insert_raw_materials: {
        Args: { p_operator_id: string; p_pin: string; p_rows: Json }
        Returns: Json
      }
      operator_admin_list: {
        Args: { p_operator_id: string; p_pin: string; p_table: string }
        Returns: Json
      }
      operator_company: { Args: { p_operator_id: string }; Returns: Json }
      operator_login: {
        Args: { p_handle: string; p_pin: string }
        Returns: Json
      }
      operator_period_status: { Args: { p_operator_id: string }; Returns: Json }
      operator_record_sanitation: {
        Args: {
          p_asset_id: string
          p_event_date?: string
          p_operator_id: string
          p_pin: string
        }
        Returns: Json
      }
      operator_record_temperature: {
        Args: {
          p_asset_id: string
          p_event_date?: string
          p_operator_id: string
          p_pin: string
          p_temperature: number
        }
        Returns: Json
      }
      operator_tasks: { Args: { p_operator_id: string }; Returns: Json }
      operator_verify_pin: {
        Args: { p_operator_id: string; p_pin: string }
        Returns: Json
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      save_operator_native_push_token: {
        Args: {
          p_native_token: string
          p_operator_id: string
          p_pin: string
          p_platform: string
        }
        Returns: Json
      }
      save_operator_push_token: {
        Args: { p_operator_id: string; p_pin: string; p_push_token: Json }
        Returns: Json
      }
      seed_allergens_for_user: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      seed_label_rules_for_user: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      slugify: { Args: { input: string }; Returns: string }
      start_local_trial: { Args: { p_env?: string }; Returns: Json }
      super_admin_overview: { Args: never; Returns: Json }
      super_admin_promote_partner: {
        Args: {
          p_codice_partner: string
          p_studio_name: string
          p_user_id: string
        }
        Returns: Json
      }
      super_admin_revoke_partner: { Args: { p_user_id: string }; Returns: Json }
      super_admin_traffic_overview: { Args: { p_days?: number }; Returns: Json }
      touch_last_seen: { Args: never; Returns: undefined }
      unaccent_safe: { Args: { input: string }; Returns: string }
    }
    Enums: {
      app_role: "platform_admin" | "super_admin" | "consulente"
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
      app_role: ["platform_admin", "super_admin", "consulente"],
    },
  },
} as const
