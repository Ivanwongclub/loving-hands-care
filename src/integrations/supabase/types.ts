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
      alert_escalations: {
        Row: {
          alert_id: string
          channel: Database["public"]["Enums"]["notification_channel"] | null
          escalated_at: string
          from_level: number
          id: string
          notified_staff: string[] | null
          reason: string
          to_level: number
        }
        Insert: {
          alert_id: string
          channel?: Database["public"]["Enums"]["notification_channel"] | null
          escalated_at?: string
          from_level: number
          id?: string
          notified_staff?: string[] | null
          reason: string
          to_level: number
        }
        Update: {
          alert_id?: string
          channel?: Database["public"]["Enums"]["notification_channel"] | null
          escalated_at?: string
          from_level?: number
          id?: string
          notified_staff?: string[] | null
          reason?: string
          to_level?: number
        }
        Relationships: [
          {
            foreignKeyName: "alert_escalations_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          assigned_at: string | null
          assigned_to: string | null
          branch_id: string
          created_at: string
          escalation_level: number
          id: string
          last_escalated_at: string | null
          resident_id: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: Database["public"]["Enums"]["alert_severity"]
          source: Database["public"]["Enums"]["alert_source"]
          source_ref_id: string | null
          source_ref_table: string | null
          status: Database["public"]["Enums"]["alert_status"]
          triggered_at: string
          type: string
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          assigned_at?: string | null
          assigned_to?: string | null
          branch_id: string
          created_at?: string
          escalation_level?: number
          id?: string
          last_escalated_at?: string | null
          resident_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity: Database["public"]["Enums"]["alert_severity"]
          source: Database["public"]["Enums"]["alert_source"]
          source_ref_id?: string | null
          source_ref_table?: string | null
          status?: Database["public"]["Enums"]["alert_status"]
          triggered_at?: string
          type: string
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          assigned_at?: string | null
          assigned_to?: string | null
          branch_id?: string
          created_at?: string
          escalation_level?: number
          id?: string
          last_escalated_at?: string | null
          resident_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          source?: Database["public"]["Enums"]["alert_source"]
          source_ref_id?: string | null
          source_ref_table?: string | null
          status?: Database["public"]["Enums"]["alert_status"]
          triggered_at?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_forms: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          name_zh: string | null
          schema: Json
          updated_at: string
          version: number
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          name_zh?: string | null
          schema: Json
          updated_at?: string
          version?: number
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          name_zh?: string | null
          schema?: Json
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "assessment_forms_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_forms_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      assessments: {
        Row: {
          branch_id: string
          completed_at: string
          completed_by: string
          form_id: string
          form_version: number
          id: string
          notes: string | null
          resident_id: string
          responses: Json
          score: number | null
        }
        Insert: {
          branch_id: string
          completed_at?: string
          completed_by: string
          form_id: string
          form_version: number
          id?: string
          notes?: string | null
          resident_id: string
          responses: Json
          score?: number | null
        }
        Update: {
          branch_id?: string
          completed_at?: string
          completed_by?: string
          form_id?: string
          form_version?: number
          id?: string
          notes?: string | null
          resident_id?: string
          responses?: Json
          score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assessments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "assessment_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_events: {
        Row: {
          branch_id: string
          created_at: string
          enrollment_id: string
          event_time: string
          event_type: Database["public"]["Enums"]["attendance_event_type"]
          id: string
          is_manual: boolean
          manual_reason: string | null
          operator_type: Database["public"]["Enums"]["attendance_operator_type"]
          staff_id: string | null
          synced_at: string | null
        }
        Insert: {
          branch_id: string
          created_at?: string
          enrollment_id: string
          event_time: string
          event_type: Database["public"]["Enums"]["attendance_event_type"]
          id?: string
          is_manual?: boolean
          manual_reason?: string | null
          operator_type: Database["public"]["Enums"]["attendance_operator_type"]
          staff_id?: string | null
          synced_at?: string | null
        }
        Update: {
          branch_id?: string
          created_at?: string
          enrollment_id?: string
          event_time?: string
          event_type?: Database["public"]["Enums"]["attendance_event_type"]
          id?: string
          is_manual?: boolean
          manual_reason?: string | null
          operator_type?: Database["public"]["Enums"]["attendance_operator_type"]
          staff_id?: string | null
          synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_events_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_events_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "dcu_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_events_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_sessions: {
        Row: {
          branch_id: string
          check_in_at: string | null
          check_in_event_id: string | null
          check_out_at: string | null
          check_out_event_id: string | null
          created_at: string
          duration_minutes: number | null
          enrollment_id: string
          id: string
          session_date: string
          status: string
          swd_flagged: boolean
          updated_at: string
        }
        Insert: {
          branch_id: string
          check_in_at?: string | null
          check_in_event_id?: string | null
          check_out_at?: string | null
          check_out_event_id?: string | null
          created_at?: string
          duration_minutes?: number | null
          enrollment_id: string
          id?: string
          session_date: string
          status?: string
          swd_flagged?: boolean
          updated_at?: string
        }
        Update: {
          branch_id?: string
          check_in_at?: string | null
          check_in_event_id?: string | null
          check_out_at?: string | null
          check_out_event_id?: string | null
          created_at?: string
          duration_minutes?: number | null
          enrollment_id?: string
          id?: string
          session_date?: string
          status?: string
          swd_flagged?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_sessions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_check_in_event_id_fkey"
            columns: ["check_in_event_id"]
            isOneToOne: false
            referencedRelation: "attendance_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_check_out_event_id_fkey"
            columns: ["check_out_event_id"]
            isOneToOne: false
            referencedRelation: "attendance_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "dcu_enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: string | null
          after_state: Json | null
          before_state: Json | null
          branch_id: string | null
          category: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          ip_address: unknown
          metadata: Json | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: string | null
          after_state?: Json | null
          before_state?: Json | null
          branch_id?: string | null
          category?: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: string | null
          after_state?: Json | null
          before_state?: Json | null
          branch_id?: string | null
          category?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      backup_log: {
        Row: {
          backup_type: string
          checksum: string | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          file_path: string | null
          file_size_bytes: number | null
          id: string
          provider: string | null
          started_at: string
          status: string
          triggered_by: string
        }
        Insert: {
          backup_type: string
          checksum?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          file_path?: string | null
          file_size_bytes?: number | null
          id?: string
          provider?: string | null
          started_at?: string
          status: string
          triggered_by?: string
        }
        Update: {
          backup_type?: string
          checksum?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          file_path?: string | null
          file_size_bytes?: number | null
          id?: string
          provider?: string | null
          started_at?: string
          status?: string
          triggered_by?: string
        }
        Relationships: []
      }
      bed_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string
          bed_id: string
          branch_id: string
          id: string
          reason: string | null
          resident_id: string
          vacated_at: string | null
        }
        Insert: {
          assigned_at?: string
          assigned_by: string
          bed_id: string
          branch_id: string
          id?: string
          reason?: string | null
          resident_id: string
          vacated_at?: string | null
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          bed_id?: string
          branch_id?: string
          id?: string
          reason?: string | null
          resident_id?: string
          vacated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bed_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bed_assignments_bed_id_fkey"
            columns: ["bed_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bed_assignments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bed_assignments_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string
          address_zh: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          name_zh: string
          notification_config: Json
          operating_hours: Json | null
          phone: string | null
          sla_config: Json
          swd_code: string
          system_config: Json
          type: Database["public"]["Enums"]["branch_type"]
          updated_at: string
        }
        Insert: {
          address: string
          address_zh?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          name_zh: string
          notification_config?: Json
          operating_hours?: Json | null
          phone?: string | null
          sla_config?: Json
          swd_code: string
          system_config?: Json
          type: Database["public"]["Enums"]["branch_type"]
          updated_at?: string
        }
        Update: {
          address?: string
          address_zh?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          name_zh?: string
          notification_config?: Json
          operating_hours?: Json | null
          phone?: string | null
          sla_config?: Json
          swd_code?: string
          system_config?: Json
          type?: Database["public"]["Enums"]["branch_type"]
          updated_at?: string
        }
        Relationships: []
      }
      dcu_enrollments: {
        Row: {
          branch_id: string
          created_at: string
          days_per_week: number | null
          end_date: string | null
          id: string
          qr_code_uuid: string
          resident_id: string
          start_date: string
          status: Database["public"]["Enums"]["enrollment_status"]
          transport_notes: string | null
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          days_per_week?: number | null
          end_date?: string | null
          id?: string
          qr_code_uuid?: string
          resident_id: string
          start_date: string
          status?: Database["public"]["Enums"]["enrollment_status"]
          transport_notes?: string | null
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          days_per_week?: number | null
          end_date?: string | null
          id?: string
          qr_code_uuid?: string
          resident_id?: string
          start_date?: string
          status?: Database["public"]["Enums"]["enrollment_status"]
          transport_notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dcu_enrollments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dcu_enrollments_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
      }
      emar_records: {
        Row: {
          administered_at: string | null
          administered_by: string | null
          alert_triggered: boolean
          barcode_scanned: string | null
          barcode_verified: boolean
          branch_id: string
          created_at: string
          due_at: string
          hold_reason: string | null
          id: string
          notes: string | null
          order_id: string
          override_by: string | null
          prn_indication: string | null
          prn_outcome_notes: string | null
          refusal_reason: string | null
          resident_id: string
          shift_pin_verified: boolean
          status: Database["public"]["Enums"]["emar_status"]
          supervisor_override: boolean
        }
        Insert: {
          administered_at?: string | null
          administered_by?: string | null
          alert_triggered?: boolean
          barcode_scanned?: string | null
          barcode_verified?: boolean
          branch_id: string
          created_at?: string
          due_at: string
          hold_reason?: string | null
          id?: string
          notes?: string | null
          order_id: string
          override_by?: string | null
          prn_indication?: string | null
          prn_outcome_notes?: string | null
          refusal_reason?: string | null
          resident_id: string
          shift_pin_verified?: boolean
          status?: Database["public"]["Enums"]["emar_status"]
          supervisor_override?: boolean
        }
        Update: {
          administered_at?: string | null
          administered_by?: string | null
          alert_triggered?: boolean
          barcode_scanned?: string | null
          barcode_verified?: boolean
          branch_id?: string
          created_at?: string
          due_at?: string
          hold_reason?: string | null
          id?: string
          notes?: string | null
          order_id?: string
          override_by?: string | null
          prn_indication?: string | null
          prn_outcome_notes?: string | null
          refusal_reason?: string | null
          resident_id?: string
          shift_pin_verified?: boolean
          status?: Database["public"]["Enums"]["emar_status"]
          supervisor_override?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "emar_records_administered_by_fkey"
            columns: ["administered_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emar_records_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emar_records_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "medication_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emar_records_override_by_fkey"
            columns: ["override_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emar_records_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
      }
      escalation_rules: {
        Row: {
          alert_severity: Database["public"]["Enums"]["alert_severity"]
          branch_id: string
          channels: string[]
          created_at: string
          delay_minutes: number
          id: string
          is_active: boolean
          level: number
          notify_roles: string[]
          updated_at: string
        }
        Insert: {
          alert_severity: Database["public"]["Enums"]["alert_severity"]
          branch_id: string
          channels: string[]
          created_at?: string
          delay_minutes?: number
          id?: string
          is_active?: boolean
          level: number
          notify_roles: string[]
          updated_at?: string
        }
        Update: {
          alert_severity?: Database["public"]["Enums"]["alert_severity"]
          branch_id?: string
          channels?: string[]
          created_at?: string
          delay_minutes?: number
          id?: string
          is_active?: boolean
          level?: number
          notify_roles?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "escalation_rules_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      family_notification_log: {
        Row: {
          attendance_event_id: string
          channel: Database["public"]["Enums"]["notification_channel"]
          contact_id: string
          created_at: string
          delivered_at: string | null
          error_message: string | null
          failed_at: string | null
          id: string
          message_body: string
          message_template: string
          recipient_phone: string
          retry_count: number
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_status"]
        }
        Insert: {
          attendance_event_id: string
          channel: Database["public"]["Enums"]["notification_channel"]
          contact_id: string
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          failed_at?: string | null
          id?: string
          message_body: string
          message_template: string
          recipient_phone: string
          retry_count?: number
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
        }
        Update: {
          attendance_event_id?: string
          channel?: Database["public"]["Enums"]["notification_channel"]
          contact_id?: string
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          failed_at?: string | null
          id?: string
          message_body?: string
          message_template?: string
          recipient_phone?: string
          retry_count?: number
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
        }
        Relationships: [
          {
            foreignKeyName: "family_notification_log_attendance_event_id_fkey"
            columns: ["attendance_event_id"]
            isOneToOne: false
            referencedRelation: "attendance_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_notification_log_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "resident_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_reports: {
        Row: {
          branch_id: string
          checksum: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          file_name: string
          generated_at: string
          generated_by: string
          id: string
          notes: string | null
          period_end: string
          period_start: string
          report_type: string
          storage_path: string
        }
        Insert: {
          branch_id: string
          checksum?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          file_name: string
          generated_at?: string
          generated_by: string
          id?: string
          notes?: string | null
          period_end: string
          period_start: string
          report_type: string
          storage_path: string
        }
        Update: {
          branch_id?: string
          checksum?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          file_name?: string
          generated_at?: string
          generated_by?: string
          id?: string
          notes?: string | null
          period_end?: string
          period_start?: string
          report_type?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_reports_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_reports_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_reports_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      icps: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          authored_by: string
          branch_id: string
          content: Json
          created_at: string
          id: string
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          resident_id: string
          status: Database["public"]["Enums"]["icp_status"]
          submitted_at: string | null
          updated_at: string
          version: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          authored_by: string
          branch_id: string
          content?: Json
          created_at?: string
          id?: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          resident_id: string
          status?: Database["public"]["Enums"]["icp_status"]
          submitted_at?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          authored_by?: string
          branch_id?: string
          content?: Json
          created_at?: string
          id?: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          resident_id?: string
          status?: Database["public"]["Enums"]["icp_status"]
          submitted_at?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "icps_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "icps_authored_by_fkey"
            columns: ["authored_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "icps_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "icps_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "icps_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_followups: {
        Row: {
          action: string
          assigned_to: string | null
          branch_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          due_at: string
          id: string
          incident_id: string
          notes: string | null
        }
        Insert: {
          action: string
          assigned_to?: string | null
          branch_id: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          due_at: string
          id?: string
          incident_id: string
          notes?: string | null
        }
        Update: {
          action?: string
          assigned_to?: string | null
          branch_id?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          due_at?: string
          id?: string
          incident_id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incident_followups_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_followups_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_followups_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_followups_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          branch_id: string
          closed_at: string | null
          closed_by: string | null
          closure_notes: string | null
          created_at: string
          description: string
          follow_up_due_at: string | null
          id: string
          immediate_action: string | null
          incident_ref: string
          location_id: string | null
          occurred_at: string
          reporter_id: string
          resident_id: string
          severity: Database["public"]["Enums"]["incident_severity"]
          status: Database["public"]["Enums"]["incident_status"]
          type: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          closed_at?: string | null
          closed_by?: string | null
          closure_notes?: string | null
          created_at?: string
          description: string
          follow_up_due_at?: string | null
          id?: string
          immediate_action?: string | null
          incident_ref: string
          location_id?: string | null
          occurred_at: string
          reporter_id: string
          resident_id: string
          severity: Database["public"]["Enums"]["incident_severity"]
          status?: Database["public"]["Enums"]["incident_status"]
          type: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          closed_at?: string | null
          closed_by?: string | null
          closure_notes?: string | null
          created_at?: string
          description?: string
          follow_up_due_at?: string | null
          id?: string
          immediate_action?: string | null
          incident_ref?: string
          location_id?: string | null
          occurred_at?: string
          reporter_id?: string
          resident_id?: string
          severity?: Database["public"]["Enums"]["incident_severity"]
          status?: Database["public"]["Enums"]["incident_status"]
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidents_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
      }
      iot_devices: {
        Row: {
          branch_id: string
          config: Json | null
          created_at: string
          device_type: string
          id: string
          last_heartbeat: string | null
          location_id: string | null
          model: string | null
          protocol: string | null
          serial_number: string | null
          status: string
          vendor: string | null
        }
        Insert: {
          branch_id: string
          config?: Json | null
          created_at?: string
          device_type: string
          id?: string
          last_heartbeat?: string | null
          location_id?: string | null
          model?: string | null
          protocol?: string | null
          serial_number?: string | null
          status?: string
          vendor?: string | null
        }
        Update: {
          branch_id?: string
          config?: Json | null
          created_at?: string
          device_type?: string
          id?: string
          last_heartbeat?: string | null
          location_id?: string | null
          model?: string | null
          protocol?: string | null
          serial_number?: string | null
          status?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "iot_devices_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iot_devices_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          branch_id: string
          capacity: number | null
          code: string
          created_at: string
          id: string
          name: string
          name_zh: string | null
          notes: string | null
          parent_id: string | null
          status: Database["public"]["Enums"]["location_status"]
          type: Database["public"]["Enums"]["location_type"]
          updated_at: string
        }
        Insert: {
          branch_id: string
          capacity?: number | null
          code: string
          created_at?: string
          id?: string
          name: string
          name_zh?: string | null
          notes?: string | null
          parent_id?: string | null
          status?: Database["public"]["Enums"]["location_status"]
          type: Database["public"]["Enums"]["location_type"]
          updated_at?: string
        }
        Update: {
          branch_id?: string
          capacity?: number | null
          code?: string
          created_at?: string
          id?: string
          name?: string
          name_zh?: string | null
          notes?: string | null
          parent_id?: string | null
          status?: Database["public"]["Enums"]["location_status"]
          type?: Database["public"]["Enums"]["location_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locations_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      medication_orders: {
        Row: {
          barcode: string | null
          branch_id: string
          created_at: string
          dose: string
          drug_name: string
          drug_name_zh: string | null
          end_date: string | null
          frequency: string
          id: string
          is_prn: boolean
          notes: string | null
          ordered_by: string
          prn_indication: string | null
          resident_id: string
          route: string
          schedule: Json | null
          start_date: string
          status: Database["public"]["Enums"]["med_order_status"]
          stop_reason: string | null
          stopped_at: string | null
          stopped_by: string | null
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          branch_id: string
          created_at?: string
          dose: string
          drug_name: string
          drug_name_zh?: string | null
          end_date?: string | null
          frequency: string
          id?: string
          is_prn?: boolean
          notes?: string | null
          ordered_by: string
          prn_indication?: string | null
          resident_id: string
          route: string
          schedule?: Json | null
          start_date: string
          status?: Database["public"]["Enums"]["med_order_status"]
          stop_reason?: string | null
          stopped_at?: string | null
          stopped_by?: string | null
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          branch_id?: string
          created_at?: string
          dose?: string
          drug_name?: string
          drug_name_zh?: string | null
          end_date?: string | null
          frequency?: string
          id?: string
          is_prn?: boolean
          notes?: string | null
          ordered_by?: string
          prn_indication?: string | null
          resident_id?: string
          route?: string
          schedule?: Json | null
          start_date?: string
          status?: Database["public"]["Enums"]["med_order_status"]
          stop_reason?: string | null
          stopped_at?: string | null
          stopped_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medication_orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medication_orders_ordered_by_fkey"
            columns: ["ordered_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medication_orders_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medication_orders_stopped_by_fkey"
            columns: ["stopped_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_log: {
        Row: {
          attempt_count: number
          branch_id: string
          channel: string
          created_at: string
          delivered_at: string | null
          event_type: string
          failure_reason: string | null
          id: string
          message_preview: string | null
          provider_ref: string | null
          recipient_masked: string
          resident_id: string | null
          sent_at: string | null
          status: string
        }
        Insert: {
          attempt_count?: number
          branch_id: string
          channel: string
          created_at?: string
          delivered_at?: string | null
          event_type: string
          failure_reason?: string | null
          id?: string
          message_preview?: string | null
          provider_ref?: string | null
          recipient_masked: string
          resident_id?: string | null
          sent_at?: string | null
          status: string
        }
        Update: {
          attempt_count?: number
          branch_id?: string
          channel?: string
          created_at?: string
          delivered_at?: string | null
          event_type?: string
          failure_reason?: string | null
          id?: string
          message_preview?: string | null
          provider_ref?: string | null
          recipient_masked?: string
          resident_id?: string | null
          sent_at?: string | null
          status?: string
        }
        Relationships: []
      }
      notification_queue: {
        Row: {
          attempt_count: number
          branch_id: string
          channel: string
          created_at: string
          event_type: string
          expires_at: string
          id: string
          last_error: string | null
          max_attempts: number
          message: string
          next_attempt_at: string
          recipient_email: string | null
          recipient_phone: string | null
          resident_id: string | null
          status: string
          template_id: string | null
        }
        Insert: {
          attempt_count?: number
          branch_id: string
          channel?: string
          created_at?: string
          event_type: string
          expires_at?: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          message: string
          next_attempt_at?: string
          recipient_email?: string | null
          recipient_phone?: string | null
          resident_id?: string | null
          status?: string
          template_id?: string | null
        }
        Update: {
          attempt_count?: number
          branch_id?: string
          channel?: string
          created_at?: string
          event_type?: string
          expires_at?: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          message?: string
          next_attempt_at?: string
          recipient_email?: string | null
          recipient_phone?: string | null
          resident_id?: string | null
          status?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_queue_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_queue_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_queue_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "notification_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_templates: {
        Row: {
          body: string
          branch_id: string | null
          channel: string
          created_at: string
          event_type: string
          id: string
          is_active: boolean
          is_system_default: boolean
          language: string
          subject: string | null
          updated_at: string
          variables: string[]
        }
        Insert: {
          body: string
          branch_id?: string | null
          channel: string
          created_at?: string
          event_type: string
          id?: string
          is_active?: boolean
          is_system_default?: boolean
          language?: string
          subject?: string | null
          updated_at?: string
          variables?: string[]
        }
        Update: {
          body?: string
          branch_id?: string | null
          channel?: string
          created_at?: string
          event_type?: string
          id?: string
          is_active?: boolean
          is_system_default?: boolean
          language?: string
          subject?: string | null
          updated_at?: string
          variables?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "notification_templates_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      resident_contacts: {
        Row: {
          consent_notifications: boolean
          created_at: string
          deleted_at: string | null
          email: string | null
          id: string
          is_emergency: boolean
          is_primary: boolean
          name: string
          name_zh: string | null
          notes: string | null
          phone_sms: string | null
          phone_whatsapp: string | null
          relationship: string
          resident_id: string
        }
        Insert: {
          consent_notifications?: boolean
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          is_emergency?: boolean
          is_primary?: boolean
          name: string
          name_zh?: string | null
          notes?: string | null
          phone_sms?: string | null
          phone_whatsapp?: string | null
          relationship: string
          resident_id: string
        }
        Update: {
          consent_notifications?: boolean
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          is_emergency?: boolean
          is_primary?: boolean
          name?: string
          name_zh?: string | null
          notes?: string | null
          phone_sms?: string | null
          phone_whatsapp?: string | null
          relationship?: string
          resident_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resident_contacts_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
      }
      resident_documents: {
        Row: {
          branch_id: string
          document_type: string
          file_name: string
          id: string
          notes: string | null
          resident_id: string
          storage_path: string
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          branch_id: string
          document_type: string
          file_name: string
          id?: string
          notes?: string | null
          resident_id: string
          storage_path: string
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          branch_id?: string
          document_type?: string
          file_name?: string
          id?: string
          notes?: string | null
          resident_id?: string
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "resident_documents_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resident_documents_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resident_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      residents: {
        Row: {
          admission_date: string
          advance_directive_on_file: boolean
          advance_directive_uploaded_at: string | null
          allergies: Json | null
          bed_id: string | null
          branch_id: string
          consents: Json
          created_at: string
          deleted_at: string | null
          dietary_requirements: Json | null
          discharge_date: string | null
          do_not_share_family: boolean
          dob: string
          gender: Database["public"]["Enums"]["gender_type"]
          hkid_hash: string
          id: string
          language_preference: string | null
          lpoa_holder_name: string | null
          lpoa_holder_phone: string | null
          lpoa_holder_relationship: string | null
          medical_history: Json | null
          name: string
          name_zh: string
          notes: string | null
          photo_declined: boolean
          photo_storage_path: string | null
          photo_updated_at: string | null
          preferred_name: string | null
          resuscitation_status: string
          resuscitation_status_updated_at: string | null
          resuscitation_status_updated_by: string | null
          risk_level: Database["public"]["Enums"]["risk_level"] | null
          status: Database["public"]["Enums"]["resident_status"]
          updated_at: string
          wandering_risk_assessed_at: string | null
          wandering_risk_assessed_by: string | null
          wandering_risk_level: string
          wandering_risk_notes: string | null
        }
        Insert: {
          admission_date: string
          advance_directive_on_file?: boolean
          advance_directive_uploaded_at?: string | null
          allergies?: Json | null
          bed_id?: string | null
          branch_id: string
          consents?: Json
          created_at?: string
          deleted_at?: string | null
          dietary_requirements?: Json | null
          discharge_date?: string | null
          do_not_share_family?: boolean
          dob: string
          gender: Database["public"]["Enums"]["gender_type"]
          hkid_hash: string
          id?: string
          language_preference?: string | null
          lpoa_holder_name?: string | null
          lpoa_holder_phone?: string | null
          lpoa_holder_relationship?: string | null
          medical_history?: Json | null
          name: string
          name_zh: string
          notes?: string | null
          photo_declined?: boolean
          photo_storage_path?: string | null
          photo_updated_at?: string | null
          preferred_name?: string | null
          resuscitation_status?: string
          resuscitation_status_updated_at?: string | null
          resuscitation_status_updated_by?: string | null
          risk_level?: Database["public"]["Enums"]["risk_level"] | null
          status?: Database["public"]["Enums"]["resident_status"]
          updated_at?: string
          wandering_risk_assessed_at?: string | null
          wandering_risk_assessed_by?: string | null
          wandering_risk_level?: string
          wandering_risk_notes?: string | null
        }
        Update: {
          admission_date?: string
          advance_directive_on_file?: boolean
          advance_directive_uploaded_at?: string | null
          allergies?: Json | null
          bed_id?: string | null
          branch_id?: string
          consents?: Json
          created_at?: string
          deleted_at?: string | null
          dietary_requirements?: Json | null
          discharge_date?: string | null
          do_not_share_family?: boolean
          dob?: string
          gender?: Database["public"]["Enums"]["gender_type"]
          hkid_hash?: string
          id?: string
          language_preference?: string | null
          lpoa_holder_name?: string | null
          lpoa_holder_phone?: string | null
          lpoa_holder_relationship?: string | null
          medical_history?: Json | null
          name?: string
          name_zh?: string
          notes?: string | null
          photo_declined?: boolean
          photo_storage_path?: string | null
          photo_updated_at?: string | null
          preferred_name?: string | null
          resuscitation_status?: string
          resuscitation_status_updated_at?: string | null
          resuscitation_status_updated_by?: string | null
          risk_level?: Database["public"]["Enums"]["risk_level"] | null
          status?: Database["public"]["Enums"]["resident_status"]
          updated_at?: string
          wandering_risk_assessed_at?: string | null
          wandering_risk_assessed_by?: string | null
          wandering_risk_level?: string
          wandering_risk_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "residents_bed_id_fkey"
            columns: ["bed_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "residents_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "residents_resuscitation_status_updated_by_fkey"
            columns: ["resuscitation_status_updated_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      restraint_observations: {
        Row: {
          circulation_normal: boolean
          created_at: string
          id: string
          in_use: boolean
          notes: string | null
          observed_at: string
          observed_by_staff_id: string | null
          released_for_minutes: number | null
          resident_response: string | null
          restraint_record_id: string
          skin_condition: string
        }
        Insert: {
          circulation_normal?: boolean
          created_at?: string
          id?: string
          in_use: boolean
          notes?: string | null
          observed_at: string
          observed_by_staff_id?: string | null
          released_for_minutes?: number | null
          resident_response?: string | null
          restraint_record_id: string
          skin_condition?: string
        }
        Update: {
          circulation_normal?: boolean
          created_at?: string
          id?: string
          in_use?: boolean
          notes?: string | null
          observed_at?: string
          observed_by_staff_id?: string | null
          released_for_minutes?: number | null
          resident_response?: string | null
          restraint_record_id?: string
          skin_condition?: string
        }
        Relationships: [
          {
            foreignKeyName: "restraint_observations_observed_by_staff_id_fkey"
            columns: ["observed_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restraint_observations_restraint_record_id_fkey"
            columns: ["restraint_record_id"]
            isOneToOne: false
            referencedRelation: "restraint_records"
            referencedColumns: ["id"]
          },
        ]
      }
      restraint_records: {
        Row: {
          alternatives_tried: string
          assessment_by_role: string
          assessment_by_staff_id: string | null
          assessment_date: string
          branch_id: string
          consent_by: string | null
          consent_date: string | null
          consent_document_path: string | null
          consent_obtained: boolean
          consent_signatory_name: string | null
          contributing_factors: string
          created_at: string
          created_by_staff_id: string | null
          discontinued_by_staff_id: string | null
          discontinued_date: string | null
          discontinued_reason: string | null
          doctor_name: string | null
          doctor_order_date: string | null
          doctor_order_required: boolean
          duration_per_day_minutes: number | null
          end_date: string | null
          id: string
          last_reviewed_at: string | null
          last_reviewed_by_staff_id: string | null
          least_restraint_principle: boolean
          notes: string | null
          resident_id: string
          restraint_specification: string | null
          restraint_type: string
          review_due_date: string
          risk_to_others: boolean
          risk_to_self: boolean
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          alternatives_tried: string
          assessment_by_role: string
          assessment_by_staff_id?: string | null
          assessment_date: string
          branch_id: string
          consent_by?: string | null
          consent_date?: string | null
          consent_document_path?: string | null
          consent_obtained?: boolean
          consent_signatory_name?: string | null
          contributing_factors: string
          created_at?: string
          created_by_staff_id?: string | null
          discontinued_by_staff_id?: string | null
          discontinued_date?: string | null
          discontinued_reason?: string | null
          doctor_name?: string | null
          doctor_order_date?: string | null
          doctor_order_required?: boolean
          duration_per_day_minutes?: number | null
          end_date?: string | null
          id?: string
          last_reviewed_at?: string | null
          last_reviewed_by_staff_id?: string | null
          least_restraint_principle?: boolean
          notes?: string | null
          resident_id: string
          restraint_specification?: string | null
          restraint_type: string
          review_due_date: string
          risk_to_others?: boolean
          risk_to_self?: boolean
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          alternatives_tried?: string
          assessment_by_role?: string
          assessment_by_staff_id?: string | null
          assessment_date?: string
          branch_id?: string
          consent_by?: string | null
          consent_date?: string | null
          consent_document_path?: string | null
          consent_obtained?: boolean
          consent_signatory_name?: string | null
          contributing_factors?: string
          created_at?: string
          created_by_staff_id?: string | null
          discontinued_by_staff_id?: string | null
          discontinued_date?: string | null
          discontinued_reason?: string | null
          doctor_name?: string | null
          doctor_order_date?: string | null
          doctor_order_required?: boolean
          duration_per_day_minutes?: number | null
          end_date?: string | null
          id?: string
          last_reviewed_at?: string | null
          last_reviewed_by_staff_id?: string | null
          least_restraint_principle?: boolean
          notes?: string | null
          resident_id?: string
          restraint_specification?: string | null
          restraint_type?: string
          review_due_date?: string
          risk_to_others?: boolean
          risk_to_self?: boolean
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restraint_records_assessment_by_staff_id_fkey"
            columns: ["assessment_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restraint_records_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restraint_records_created_by_staff_id_fkey"
            columns: ["created_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restraint_records_discontinued_by_staff_id_fkey"
            columns: ["discontinued_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restraint_records_last_reviewed_by_staff_id_fkey"
            columns: ["last_reviewed_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restraint_records_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          branch_ids: string[]
          created_at: string
          deleted_at: string | null
          email: string
          id: string
          is_shared_device: boolean
          name: string
          name_zh: string | null
          phone: string | null
          pin_failed_attempts: number
          pin_hash: string | null
          pin_locked_at: string | null
          role: Database["public"]["Enums"]["staff_role"]
          status: Database["public"]["Enums"]["staff_status"]
          supabase_auth_id: string | null
          updated_at: string
        }
        Insert: {
          branch_ids?: string[]
          created_at?: string
          deleted_at?: string | null
          email: string
          id?: string
          is_shared_device?: boolean
          name: string
          name_zh?: string | null
          phone?: string | null
          pin_failed_attempts?: number
          pin_hash?: string | null
          pin_locked_at?: string | null
          role: Database["public"]["Enums"]["staff_role"]
          status?: Database["public"]["Enums"]["staff_status"]
          supabase_auth_id?: string | null
          updated_at?: string
        }
        Update: {
          branch_ids?: string[]
          created_at?: string
          deleted_at?: string | null
          email?: string
          id?: string
          is_shared_device?: boolean
          name?: string
          name_zh?: string | null
          phone?: string | null
          pin_failed_attempts?: number
          pin_hash?: string | null
          pin_locked_at?: string | null
          role?: Database["public"]["Enums"]["staff_role"]
          status?: Database["public"]["Enums"]["staff_status"]
          supabase_auth_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      system_errors: {
        Row: {
          branch_id: string | null
          context: Json | null
          created_at: string
          error_code: string | null
          error_message: string
          id: string
          resolved: boolean
          resolved_at: string | null
          source: string
          stack_trace: string | null
        }
        Insert: {
          branch_id?: string | null
          context?: Json | null
          created_at?: string
          error_code?: string | null
          error_message: string
          id?: string
          resolved?: boolean
          resolved_at?: string | null
          source: string
          stack_trace?: string | null
        }
        Update: {
          branch_id?: string | null
          context?: Json | null
          created_at?: string
          error_code?: string | null
          error_message?: string
          id?: string
          resolved?: boolean
          resolved_at?: string | null
          source?: string
          stack_trace?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_errors_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      system_job_runs: {
        Row: {
          created_at: string
          duration_ms: number | null
          ended_at: string | null
          id: string
          job_name: string
          message: string | null
          started_at: string
          status: string
          triggered_by: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          ended_at?: string | null
          id?: string
          job_name: string
          message?: string | null
          started_at?: string
          status?: string
          triggered_by?: string
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          ended_at?: string | null
          id?: string
          job_name?: string
          message?: string | null
          started_at?: string
          status?: string
          triggered_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_job_runs_job_name_fkey"
            columns: ["job_name"]
            isOneToOne: false
            referencedRelation: "system_jobs"
            referencedColumns: ["job_name"]
          },
        ]
      }
      system_jobs: {
        Row: {
          created_at: string
          cron_command: string
          description: string | null
          display_name: string
          display_name_zh: string
          fail_count: number
          id: string
          is_enabled: boolean
          is_schedule_editable: boolean
          job_name: string
          last_run_at: string | null
          last_run_message: string | null
          last_run_ms: number | null
          last_run_status: string | null
          min_interval_minutes: number | null
          run_count: number
          schedule_hkt_label: string
          schedule_hkt_label_zh: string
          schedule_utc: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          cron_command?: string
          description?: string | null
          display_name: string
          display_name_zh: string
          fail_count?: number
          id?: string
          is_enabled?: boolean
          is_schedule_editable?: boolean
          job_name: string
          last_run_at?: string | null
          last_run_message?: string | null
          last_run_ms?: number | null
          last_run_status?: string | null
          min_interval_minutes?: number | null
          run_count?: number
          schedule_hkt_label: string
          schedule_hkt_label_zh: string
          schedule_utc: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          cron_command?: string
          description?: string | null
          display_name?: string
          display_name_zh?: string
          fail_count?: number
          id?: string
          is_enabled?: boolean
          is_schedule_editable?: boolean
          job_name?: string
          last_run_at?: string | null
          last_run_message?: string | null
          last_run_ms?: number | null
          last_run_status?: string | null
          min_interval_minutes?: number | null
          run_count?: number
          schedule_hkt_label?: string
          schedule_hkt_label_zh?: string
          schedule_utc?: string
          updated_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assigned_to: string | null
          branch_id: string
          completed_at: string | null
          completed_by: string | null
          completion_notes: string | null
          created_at: string
          description: string | null
          due_at: string
          escalation_level: number
          icp_id: string | null
          id: string
          resident_id: string
          status: Database["public"]["Enums"]["task_status"]
          title: string
          type: Database["public"]["Enums"]["task_type"]
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          branch_id: string
          completed_at?: string | null
          completed_by?: string | null
          completion_notes?: string | null
          created_at?: string
          description?: string | null
          due_at: string
          escalation_level?: number
          icp_id?: string | null
          id?: string
          resident_id: string
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          type: Database["public"]["Enums"]["task_type"]
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          branch_id?: string
          completed_at?: string | null
          completed_by?: string | null
          completion_notes?: string | null
          created_at?: string
          description?: string | null
          due_at?: string
          escalation_level?: number
          icp_id?: string | null
          id?: string
          resident_id?: string
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          type?: Database["public"]["Enums"]["task_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_icp_id_fkey"
            columns: ["icp_id"]
            isOneToOne: false
            referencedRelation: "icps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
      }
      vaccination_records: {
        Row: {
          administered_by_doctor: string | null
          administered_by_staff_id: string | null
          administered_date: string
          adverse_reaction: boolean
          adverse_reaction_notes: string | null
          batch_number: string
          branch_id: string
          consent_by: string | null
          consent_date: string | null
          consent_obtained: boolean
          created_at: string
          created_by_staff_id: string | null
          expiry_relevant_date: string | null
          id: string
          injection_site: string | null
          next_dose_due_date: string | null
          notes: string | null
          resident_id: string
          updated_at: string
          vaccine_brand: string | null
          vaccine_type: string
        }
        Insert: {
          administered_by_doctor?: string | null
          administered_by_staff_id?: string | null
          administered_date: string
          adverse_reaction?: boolean
          adverse_reaction_notes?: string | null
          batch_number: string
          branch_id: string
          consent_by?: string | null
          consent_date?: string | null
          consent_obtained?: boolean
          created_at?: string
          created_by_staff_id?: string | null
          expiry_relevant_date?: string | null
          id?: string
          injection_site?: string | null
          next_dose_due_date?: string | null
          notes?: string | null
          resident_id: string
          updated_at?: string
          vaccine_brand?: string | null
          vaccine_type: string
        }
        Update: {
          administered_by_doctor?: string | null
          administered_by_staff_id?: string | null
          administered_date?: string
          adverse_reaction?: boolean
          adverse_reaction_notes?: string | null
          batch_number?: string
          branch_id?: string
          consent_by?: string | null
          consent_date?: string | null
          consent_obtained?: boolean
          created_at?: string
          created_by_staff_id?: string | null
          expiry_relevant_date?: string | null
          id?: string
          injection_site?: string | null
          next_dose_due_date?: string | null
          notes?: string | null
          resident_id?: string
          updated_at?: string
          vaccine_brand?: string | null
          vaccine_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "vaccination_records_administered_by_staff_id_fkey"
            columns: ["administered_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vaccination_records_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vaccination_records_created_by_staff_id_fkey"
            columns: ["created_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vaccination_records_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
      }
      vitals: {
        Row: {
          alert_triggered: boolean
          branch_id: string
          created_at: string
          device_id: string | null
          id: string
          is_abnormal: boolean
          notes: string | null
          readings: Json
          recorded_at: string
          recorded_by: string
          resident_id: string
        }
        Insert: {
          alert_triggered?: boolean
          branch_id: string
          created_at?: string
          device_id?: string | null
          id?: string
          is_abnormal?: boolean
          notes?: string | null
          readings: Json
          recorded_at?: string
          recorded_by: string
          resident_id: string
        }
        Update: {
          alert_triggered?: boolean
          branch_id?: string
          created_at?: string
          device_id?: string | null
          id?: string
          is_abnormal?: boolean
          notes?: string | null
          readings?: Json
          recorded_at?: string
          recorded_by?: string
          resident_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vitals_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vitals_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vitals_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
      }
      vitals_thresholds: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          resident_id: string
          set_by: string
          thresholds: Json
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          resident_id: string
          set_by: string
          thresholds: Json
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          resident_id?: string
          set_by?: string
          thresholds?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vitals_thresholds_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vitals_thresholds_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: true
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vitals_thresholds_set_by_fkey"
            columns: ["set_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      wound_entries: {
        Row: {
          appearance: string | null
          assessed_at: string
          assessed_by: string
          branch_id: string
          created_at: string
          exudate: string | null
          id: string
          notes: string | null
          photo_path: string | null
          size_cm: Json | null
          status: Database["public"]["Enums"]["wound_status"]
          treatment: string | null
          wound_id: string
        }
        Insert: {
          appearance?: string | null
          assessed_at?: string
          assessed_by: string
          branch_id: string
          created_at?: string
          exudate?: string | null
          id?: string
          notes?: string | null
          photo_path?: string | null
          size_cm?: Json | null
          status: Database["public"]["Enums"]["wound_status"]
          treatment?: string | null
          wound_id: string
        }
        Update: {
          appearance?: string | null
          assessed_at?: string
          assessed_by?: string
          branch_id?: string
          created_at?: string
          exudate?: string | null
          id?: string
          notes?: string | null
          photo_path?: string | null
          size_cm?: Json | null
          status?: Database["public"]["Enums"]["wound_status"]
          treatment?: string | null
          wound_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wound_entries_assessed_by_fkey"
            columns: ["assessed_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wound_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wound_entries_wound_id_fkey"
            columns: ["wound_id"]
            isOneToOne: false
            referencedRelation: "wounds"
            referencedColumns: ["id"]
          },
        ]
      }
      wounds: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string
          first_noted_at: string
          healed_at: string | null
          id: string
          location_desc: string
          resident_id: string
          stage: string | null
          status: Database["public"]["Enums"]["wound_status"]
          wound_type: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by: string
          first_noted_at: string
          healed_at?: string | null
          id?: string
          location_desc: string
          resident_id: string
          stage?: string | null
          status?: Database["public"]["Enums"]["wound_status"]
          wound_type: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string
          first_noted_at?: string
          healed_at?: string | null
          id?: string
          location_desc?: string
          resident_id?: string
          stage?: string | null
          status?: Database["public"]["Enums"]["wound_status"]
          wound_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "wounds_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wounds_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wounds_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auth_staff: {
        Args: never
        Returns: {
          branch_ids: string[]
          created_at: string
          deleted_at: string | null
          email: string
          id: string
          is_shared_device: boolean
          name: string
          name_zh: string | null
          phone: string | null
          pin_failed_attempts: number
          pin_hash: string | null
          pin_locked_at: string | null
          role: Database["public"]["Enums"]["staff_role"]
          status: Database["public"]["Enums"]["staff_status"]
          supabase_auth_id: string | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "staff"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      can_access_resident_document: {
        Args: { object_name: string }
        Returns: boolean
      }
      has_branch_access: { Args: { p_branch_id: string }; Returns: boolean }
      increment_system_job_counter: {
        Args: { p_job_name: string; p_success: boolean }
        Returns: undefined
      }
      reschedule_job: {
        Args: { p_command: string; p_job_name: string; p_schedule: string }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      alert_severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
      alert_source: "MANUAL" | "VITALS" | "INCIDENT" | "SYSTEM" | "IOT"
      alert_status:
        | "OPEN"
        | "ACKNOWLEDGED"
        | "ASSIGNED"
        | "RESOLVED"
        | "DISMISSED"
      attendance_event_type:
        | "CHECK_IN"
        | "CHECK_OUT"
        | "ABSENT"
        | "MANUAL_CORRECTION"
      attendance_operator_type: "KIOSK" | "STAFF_MANUAL" | "SYSTEM"
      branch_type: "CARE_HOME" | "DCU" | "HOUSING" | "REHABILITATION"
      emar_status:
        | "DUE"
        | "ADMINISTERED"
        | "REFUSED"
        | "HELD"
        | "LATE"
        | "MISSED"
      enrollment_status: "ACTIVE" | "SUSPENDED" | "DISCHARGED"
      gender_type: "M" | "F" | "OTHER"
      icp_status:
        | "DRAFT"
        | "PENDING_APPROVAL"
        | "ACTIVE"
        | "SUPERSEDED"
        | "REJECTED"
      incident_severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
      incident_status: "OPEN" | "UNDER_REVIEW" | "CLOSED"
      location_status: "AVAILABLE" | "OCCUPIED" | "OUT_OF_SERVICE" | "RESERVED"
      location_type: "BUILDING" | "FLOOR" | "ROOM" | "BED" | "ZONE"
      med_order_status: "ACTIVE" | "STOPPED" | "COMPLETED" | "ON_HOLD"
      notification_channel: "WHATSAPP" | "SMS" | "PUSH" | "EMAIL"
      notification_status:
        | "QUEUED"
        | "SENT"
        | "DELIVERED"
        | "FAILED"
        | "RETRYING"
      resident_status: "ADMITTED" | "DISCHARGED" | "LOA" | "DECEASED"
      resuscitation_status: "FULL_RESUSCITATION" | "DNACPR" | "AD_LIMITED"
      risk_level: "LOW" | "MEDIUM" | "HIGH"
      staff_role:
        | "SYSTEM_ADMIN"
        | "BRANCH_ADMIN"
        | "SENIOR_NURSE"
        | "NURSE"
        | "CAREGIVER"
        | "DCU_WORKER"
        | "FINANCE"
        | "FAMILY"
      staff_status: "ACTIVE" | "INACTIVE" | "SUSPENDED"
      task_status:
        | "PENDING"
        | "IN_PROGRESS"
        | "COMPLETED"
        | "OVERDUE"
        | "CANCELLED"
      task_type:
        | "ADL"
        | "VITALS"
        | "MEDICATION_PREP"
        | "WOUND_CARE"
        | "REPOSITIONING"
        | "ASSESSMENT"
        | "FOLLOW_UP"
        | "OTHER"
      wound_status: "OPEN" | "HEALING" | "HEALED" | "DETERIORATING"
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
      alert_severity: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      alert_source: ["MANUAL", "VITALS", "INCIDENT", "SYSTEM", "IOT"],
      alert_status: [
        "OPEN",
        "ACKNOWLEDGED",
        "ASSIGNED",
        "RESOLVED",
        "DISMISSED",
      ],
      attendance_event_type: [
        "CHECK_IN",
        "CHECK_OUT",
        "ABSENT",
        "MANUAL_CORRECTION",
      ],
      attendance_operator_type: ["KIOSK", "STAFF_MANUAL", "SYSTEM"],
      branch_type: ["CARE_HOME", "DCU", "HOUSING", "REHABILITATION"],
      emar_status: ["DUE", "ADMINISTERED", "REFUSED", "HELD", "LATE", "MISSED"],
      enrollment_status: ["ACTIVE", "SUSPENDED", "DISCHARGED"],
      gender_type: ["M", "F", "OTHER"],
      icp_status: [
        "DRAFT",
        "PENDING_APPROVAL",
        "ACTIVE",
        "SUPERSEDED",
        "REJECTED",
      ],
      incident_severity: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      incident_status: ["OPEN", "UNDER_REVIEW", "CLOSED"],
      location_status: ["AVAILABLE", "OCCUPIED", "OUT_OF_SERVICE", "RESERVED"],
      location_type: ["BUILDING", "FLOOR", "ROOM", "BED", "ZONE"],
      med_order_status: ["ACTIVE", "STOPPED", "COMPLETED", "ON_HOLD"],
      notification_channel: ["WHATSAPP", "SMS", "PUSH", "EMAIL"],
      notification_status: [
        "QUEUED",
        "SENT",
        "DELIVERED",
        "FAILED",
        "RETRYING",
      ],
      resident_status: ["ADMITTED", "DISCHARGED", "LOA", "DECEASED"],
      resuscitation_status: ["FULL_RESUSCITATION", "DNACPR", "AD_LIMITED"],
      risk_level: ["LOW", "MEDIUM", "HIGH"],
      staff_role: [
        "SYSTEM_ADMIN",
        "BRANCH_ADMIN",
        "SENIOR_NURSE",
        "NURSE",
        "CAREGIVER",
        "DCU_WORKER",
        "FINANCE",
        "FAMILY",
      ],
      staff_status: ["ACTIVE", "INACTIVE", "SUSPENDED"],
      task_status: [
        "PENDING",
        "IN_PROGRESS",
        "COMPLETED",
        "OVERDUE",
        "CANCELLED",
      ],
      task_type: [
        "ADL",
        "VITALS",
        "MEDICATION_PREP",
        "WOUND_CARE",
        "REPOSITIONING",
        "ASSESSMENT",
        "FOLLOW_UP",
        "OTHER",
      ],
      wound_status: ["OPEN", "HEALING", "HEALED", "DETERIORATING"],
    },
  },
} as const
