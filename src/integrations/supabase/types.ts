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
      announcement_reads: {
        Row: {
          announcement_id: string
          id: string
          read_at: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          id?: string
          read_at?: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_reads_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_replies: {
        Row: {
          announcement_id: string
          author_id: string
          body: string
          created_at: string
          id: string
        }
        Insert: {
          announcement_id: string
          author_id: string
          body: string
          created_at?: string
          id?: string
        }
        Update: {
          announcement_id?: string
          author_id?: string
          body?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_replies_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          author_id: string
          author_role: string | null
          body: string | null
          created_at: string
          id: string
          kind: string
          patient_id: string | null
          report_id: string | null
          resolved_at: string | null
          resolved_by: string | null
          target_professional_id: string | null
          target_role: string | null
          target_type: string
          target_unit_id: string | null
          title: string
        }
        Insert: {
          author_id: string
          author_role?: string | null
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          patient_id?: string | null
          report_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          target_professional_id?: string | null
          target_role?: string | null
          target_type?: string
          target_unit_id?: string | null
          title: string
        }
        Update: {
          author_id?: string
          author_role?: string | null
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          patient_id?: string | null
          report_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          target_professional_id?: string | null
          target_role?: string | null
          target_type?: string
          target_unit_id?: string | null
          title?: string
        }
        Relationships: []
      }
      assessment_applications: {
        Row: {
          applied_at: string
          applied_by: string | null
          assessment_id: string
          created_at: string
          id: string
          notes: string | null
          patient_id: string
          report_id: string | null
        }
        Insert: {
          applied_at?: string
          applied_by?: string | null
          assessment_id: string
          created_at?: string
          id?: string
          notes?: string | null
          patient_id: string
          report_id?: string | null
        }
        Update: {
          applied_at?: string
          applied_by?: string | null
          assessment_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          patient_id?: string
          report_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assessment_applications_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_applications_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_applications_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_items: {
        Row: {
          assessment_id: string
          created_at: string
          group_label: string | null
          id: string
          instructions: string | null
          level: string | null
          max_score: number | null
          name: string
          order_index: number
        }
        Insert: {
          assessment_id: string
          created_at?: string
          group_label?: string | null
          id?: string
          instructions?: string | null
          level?: string | null
          max_score?: number | null
          name: string
          order_index?: number
        }
        Update: {
          assessment_id?: string
          created_at?: string
          group_label?: string | null
          id?: string
          instructions?: string | null
          level?: string | null
          max_score?: number | null
          name?: string
          order_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "assessment_items_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_results: {
        Row: {
          application_id: string
          created_at: string
          id: string
          item_id: string
          observation: string | null
          score: number | null
        }
        Insert: {
          application_id: string
          created_at?: string
          id?: string
          item_id: string
          observation?: string | null
          score?: number | null
        }
        Update: {
          application_id?: string
          created_at?: string
          id?: string
          item_id?: string
          observation?: string | null
          score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assessment_results_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "assessment_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_results_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "assessment_items"
            referencedColumns: ["id"]
          },
        ]
      }
      assessments: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          reassessment_interval_months: number
          score_mode: string
          sector: string | null
          specialty_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          reassessment_interval_months?: number
          score_mode?: string
          sector?: string | null
          specialty_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          reassessment_interval_months?: number
          score_mode?: string
          sector?: string | null
          specialty_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessments_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "specialties"
            referencedColumns: ["id"]
          },
        ]
      }
      case_studies: {
        Row: {
          created_at: string
          field_label: string | null
          id: string
          last_value: number | null
          min_target: number | null
          notes: string | null
          patient_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          triggered_by_field: string | null
        }
        Insert: {
          created_at?: string
          field_label?: string | null
          id?: string
          last_value?: number | null
          min_target?: number | null
          notes?: string | null
          patient_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          triggered_by_field?: string | null
        }
        Update: {
          created_at?: string
          field_label?: string | null
          id?: string
          last_value?: number | null
          min_target?: number | null
          notes?: string | null
          patient_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          triggered_by_field?: string | null
        }
        Relationships: []
      }
      edit_audit_log: {
        Row: {
          action: string
          changed_by: string | null
          changed_by_name: string | null
          created_at: string
          entity_id: string
          entity_type: string
          field_changes: Json | null
          id: string
          parent_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          changed_by?: string | null
          changed_by_name?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          field_changes?: Json | null
          id?: string
          parent_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          changed_by?: string | null
          changed_by_name?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          field_changes?: Json | null
          id?: string
          parent_id?: string | null
          table_name?: string
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
      goals: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          metric_type: string
          name: string
          period: string
          scope: string
          specialty_id: string | null
          target_value: number
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          metric_type?: string
          name: string
          period?: string
          scope?: string
          specialty_id?: string | null
          target_value?: number
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          metric_type?: string
          name?: string
          period?: string
          scope?: string
          specialty_id?: string | null
          target_value?: number
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      operators: {
        Row: {
          admission_date: string
          cargo: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          role_title: string | null
          status: Database["public"]["Enums"]["professional_status"]
          termination_date: string | null
          unit_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admission_date?: string
          cargo?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          phone?: string | null
          role_title?: string | null
          status?: Database["public"]["Enums"]["professional_status"]
          termination_date?: string | null
          unit_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admission_date?: string
          cargo?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          role_title?: string | null
          status?: Database["public"]["Enums"]["professional_status"]
          termination_date?: string | null
          unit_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "operators_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_documents: {
        Row: {
          created_at: string
          doc_type: string
          expires_at: string | null
          id: string
          issued_date: string | null
          patient_id: string
          storage_path: string | null
          title: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          doc_type: string
          expires_at?: string | null
          id?: string
          issued_date?: string | null
          patient_id: string
          storage_path?: string | null
          title: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          doc_type?: string
          expires_at?: string | null
          id?: string
          issued_date?: string | null
          patient_id?: string
          storage_path?: string | null
          title?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_documents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          birth_date: string | null
          created_at: string
          full_name: string
          guardian_name: string | null
          guardian_phone: string | null
          id: string
          main_diagnosis: string | null
          medical_order_date: string | null
          medical_order_expires_at: string | null
          notes: string | null
          status: Database["public"]["Enums"]["patient_status"]
          sublime_entry_date: string
          termination_date: string | null
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          created_at?: string
          full_name: string
          guardian_name?: string | null
          guardian_phone?: string | null
          id?: string
          main_diagnosis?: string | null
          medical_order_date?: string | null
          medical_order_expires_at?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["patient_status"]
          sublime_entry_date?: string
          termination_date?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          created_at?: string
          full_name?: string
          guardian_name?: string | null
          guardian_phone?: string | null
          id?: string
          main_diagnosis?: string | null
          medical_order_date?: string | null
          medical_order_expires_at?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["patient_status"]
          sublime_entry_date?: string
          termination_date?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patients_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      professionals: {
        Row: {
          admission_date: string
          council_number: string | null
          council_type: string | null
          cpf: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          notes: string | null
          phone: string | null
          schedule_text: string | null
          signature_url: string | null
          specialty_id: string | null
          stamp_url: string | null
          status: Database["public"]["Enums"]["professional_status"]
          termination_date: string | null
          unit_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admission_date?: string
          council_number?: string | null
          council_type?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          notes?: string | null
          phone?: string | null
          schedule_text?: string | null
          signature_url?: string | null
          specialty_id?: string | null
          stamp_url?: string | null
          status?: Database["public"]["Enums"]["professional_status"]
          termination_date?: string | null
          unit_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admission_date?: string
          council_number?: string | null
          council_type?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string | null
          schedule_text?: string | null
          signature_url?: string | null
          specialty_id?: string | null
          stamp_url?: string | null
          status?: Database["public"]["Enums"]["professional_status"]
          termination_date?: string | null
          unit_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "professionals_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "specialties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professionals_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name: string
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      report_audit_log: {
        Row: {
          action: string
          changed_by: string | null
          changed_by_name: string | null
          created_at: string
          field_changes: Json | null
          id: string
          report_id: string
          section_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          changed_by?: string | null
          changed_by_name?: string | null
          created_at?: string
          field_changes?: Json | null
          id?: string
          report_id: string
          section_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          changed_by?: string | null
          changed_by_name?: string | null
          created_at?: string
          field_changes?: Json | null
          id?: string
          report_id?: string
          section_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      report_section_signers: {
        Row: {
          created_at: string
          id: string
          professional_id: string
          report_id: string
          section_id: string
          signature_url: string | null
          signed_at: string | null
          signed_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          professional_id: string
          report_id: string
          section_id: string
          signature_url?: string | null
          signed_at?: string | null
          signed_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          professional_id?: string
          report_id?: string
          section_id?: string
          signature_url?: string | null
          signed_at?: string | null
          signed_by?: string | null
        }
        Relationships: []
      }
      report_sections: {
        Row: {
          content: string | null
          created_at: string
          created_by: string | null
          field_values: Json
          fields: Json
          id: string
          order_index: number
          professional_id: string | null
          report_id: string
          specialty_id: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          created_by?: string | null
          field_values?: Json
          fields?: Json
          id?: string
          order_index?: number
          professional_id?: string | null
          report_id: string
          specialty_id?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          created_by?: string | null
          field_values?: Json
          fields?: Json
          id?: string
          order_index?: number
          professional_id?: string | null
          report_id?: string
          specialty_id?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_sections_professional_fk"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_sections_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_sections_specialty_fk"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "specialties"
            referencedColumns: ["id"]
          },
        ]
      }
      report_signers: {
        Row: {
          created_at: string
          id: string
          order_index: number
          professional_id: string
          report_id: string
          role_label: string | null
          signature_url: string | null
          signed_at: string | null
          signed_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          order_index?: number
          professional_id: string
          report_id: string
          role_label?: string | null
          signature_url?: string | null
          signed_at?: string | null
          signed_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          order_index?: number
          professional_id?: string
          report_id?: string
          role_label?: string | null
          signature_url?: string | null
          signed_at?: string | null
          signed_by?: string | null
        }
        Relationships: []
      }
      report_template_modules: {
        Row: {
          created_at: string
          description: string | null
          fields: Json
          id: string
          order_index: number
          requires_assessment: boolean
          specialty_id: string | null
          template_id: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          fields?: Json
          id?: string
          order_index?: number
          requires_assessment?: boolean
          specialty_id?: string | null
          template_id: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          fields?: Json
          id?: string
          order_index?: number
          requires_assessment?: boolean
          specialty_id?: string | null
          template_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_template_modules_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "specialties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_template_modules_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "report_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      report_templates: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          general_notes: string | null
          id: string
          patient_id: string
          period_end: string | null
          period_start: string | null
          status: Database["public"]["Enums"]["report_status"]
          template_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          general_notes?: string | null
          id?: string
          patient_id: string
          period_end?: string | null
          period_start?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          template_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          general_notes?: string | null
          id?: string
          patient_id?: string
          period_end?: string | null
          period_start?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          template_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_patient_fk"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "report_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      specialties: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
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
      therapy_grid: {
        Row: {
          created_at: string
          duration_minutes: number
          id: string
          integrated_note: string | null
          notes: string | null
          patient_id: string
          professional_id: string | null
          specialty_id: string
          start_time: string | null
          weekday: number | null
          weekly_frequency: number | null
        }
        Insert: {
          created_at?: string
          duration_minutes?: number
          id?: string
          integrated_note?: string | null
          notes?: string | null
          patient_id: string
          professional_id?: string | null
          specialty_id: string
          start_time?: string | null
          weekday?: number | null
          weekly_frequency?: number | null
        }
        Update: {
          created_at?: string
          duration_minutes?: number
          id?: string
          integrated_note?: string | null
          notes?: string | null
          patient_id?: string
          professional_id?: string | null
          specialty_id?: string
          start_time?: string | null
          weekday?: number | null
          weekly_frequency?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "therapy_grid_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_grid_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_grid_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "specialties"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          address: string | null
          created_at: string
          id: string
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
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
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_operator: { Args: { _user_id: string }; Returns: boolean }
      is_resp_tecnico_or_admin: { Args: { _user_id: string }; Returns: boolean }
      is_specialty_professional: {
        Args: { _specialty_id: string; _user_id: string }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role:
        | "diretoria"
        | "rt"
        | "profissional"
        | "operador"
        | "responsavel_tecnico"
        | "profissional_lideranca"
      patient_status: "ativo" | "desligado"
      professional_status: "ativo" | "desligado" | "pendente"
      report_status:
        | "rascunho"
        | "em_revisao"
        | "encaminhado_diretoria"
        | "aprovado_diretoria"
        | "assinado"
        | "liberado_pais"
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
      app_role: [
        "diretoria",
        "rt",
        "profissional",
        "operador",
        "responsavel_tecnico",
        "profissional_lideranca",
      ],
      patient_status: ["ativo", "desligado"],
      professional_status: ["ativo", "desligado", "pendente"],
      report_status: [
        "rascunho",
        "em_revisao",
        "encaminhado_diretoria",
        "aprovado_diretoria",
        "assinado",
        "liberado_pais",
      ],
    },
  },
} as const
