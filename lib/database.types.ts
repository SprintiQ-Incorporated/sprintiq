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
      ai_task_events: {
        Row: {
          created_at: string | null
          error_code: string | null
          event_type: string
          id: string
          metadata: Json | null
          task_id: string
        }
        Insert: {
          created_at?: string | null
          error_code?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          task_id: string
        }
        Update: {
          created_at?: string | null
          error_code?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_task_events_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "ai_task_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_task_logs: {
        Row: {
          cost_usd: number
          created_at: string
          duration_ms: number
          error_code: string | null
          error_message: string | null
          id: string
          input_tokens: number
          model: string
          output_tokens: number
          provider: string
          queue: string
          success: boolean
          task_id: string | null
          task_type: string | null
        }
        Insert: {
          cost_usd?: number
          created_at?: string
          duration_ms?: number
          error_code?: string | null
          error_message?: string | null
          id?: string
          input_tokens?: number
          model: string
          output_tokens?: number
          provider: string
          queue: string
          success: boolean
          task_id?: string | null
          task_type?: string | null
        }
        Update: {
          cost_usd?: number
          created_at?: string
          duration_ms?: number
          error_code?: string | null
          error_message?: string | null
          id?: string
          input_tokens?: number
          model?: string
          output_tokens?: number
          provider?: string
          queue?: string
          success?: boolean
          task_id?: string | null
          task_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_task_logs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "ai_task_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_task_queue: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          error_code: string | null
          error_message: string | null
          failed_at: string | null
          id: string
          payload: Json
          qstash_message_id: string | null
          queue: string
          result: Json | null
          result_meta: Json | null
          rl_requeue_count: number
          source: string
          started_at: string | null
          status: string
          task_type: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_code?: string | null
          error_message?: string | null
          failed_at?: string | null
          id?: string
          payload?: Json
          qstash_message_id?: string | null
          queue?: string
          result?: Json | null
          result_meta?: Json | null
          rl_requeue_count?: number
          source?: string
          started_at?: string | null
          status?: string
          task_type: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_code?: string | null
          error_message?: string | null
          failed_at?: string | null
          id?: string
          payload?: Json
          qstash_message_id?: string | null
          queue?: string
          result?: Json | null
          result_meta?: Json | null
          rl_requeue_count?: number
          source?: string
          started_at?: string | null
          status?: string
          task_type?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_task_queue_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_log: {
        Row: {
          ai_model: string
          cost_usd: number
          created_at: string
          id: string
          input_tokens: number
          output_tokens: number
          route: string
          total_tokens: number
          workspace_id: string | null
        }
        Insert: {
          ai_model?: string
          cost_usd?: number
          created_at?: string
          id?: string
          input_tokens?: number
          output_tokens?: number
          route: string
          total_tokens?: number
          workspace_id?: string | null
        }
        Update: {
          ai_model?: string
          cost_usd?: number
          created_at?: string
          id?: string
          input_tokens?: number
          output_tokens?: number
          route?: string
          total_tokens?: number
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      claude_code_issues: {
        Row: {
          created_at: string | null
          description: string | null
          file_path: string | null
          id: string
          issue_type: string
          line_number: number | null
          session_id: string
          severity: string | null
          status: string | null
          subtask_id: string | null
          suggested_points: number | null
          task_id: string
          title: string
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          file_path?: string | null
          id?: string
          issue_type: string
          line_number?: number | null
          session_id: string
          severity?: string | null
          status?: string | null
          subtask_id?: string | null
          suggested_points?: number | null
          task_id: string
          title: string
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          file_path?: string | null
          id?: string
          issue_type?: string
          line_number?: number | null
          session_id?: string
          severity?: string | null
          status?: string | null
          subtask_id?: string | null
          suggested_points?: number | null
          task_id?: string
          title?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "claude_code_issues_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "claude_code_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claude_code_issues_subtask_id_fkey"
            columns: ["subtask_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claude_code_issues_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claude_code_issues_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      claude_code_sessions: {
        Row: {
          ac_met: number | null
          ac_total: number | null
          bugs_detected: number | null
          completed_at: string | null
          completion_report: Json | null
          conflict_data: Json | null
          conflict_detected: boolean
          conflict_resolution: string | null
          conflict_resolved_at: string | null
          created_at: string | null
          developer_notes: string | null
          error_message: string | null
          expires_at: string
          heartbeat_sequence: number | null
          id: string
          is_late_arrival: boolean
          last_heartbeat_at: string | null
          proposed_status: string | null
          session_metrics: Json | null
          session_token: string
          started_at: string | null
          status: string
          status_accepted: boolean | null
          subtasks_created: string[] | null
          task_context: Json
          task_id: string
          task_snapshot_at_start: Json | null
          tech_debt_detected: number | null
          updated_at: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          ac_met?: number | null
          ac_total?: number | null
          bugs_detected?: number | null
          completed_at?: string | null
          completion_report?: Json | null
          conflict_data?: Json | null
          conflict_detected?: boolean
          conflict_resolution?: string | null
          conflict_resolved_at?: string | null
          created_at?: string | null
          developer_notes?: string | null
          error_message?: string | null
          expires_at: string
          heartbeat_sequence?: number | null
          id?: string
          is_late_arrival?: boolean
          last_heartbeat_at?: string | null
          proposed_status?: string | null
          session_metrics?: Json | null
          session_token: string
          started_at?: string | null
          status?: string
          status_accepted?: boolean | null
          subtasks_created?: string[] | null
          task_context?: Json
          task_id: string
          task_snapshot_at_start?: Json | null
          tech_debt_detected?: number | null
          updated_at?: string | null
          user_id: string
          workspace_id: string
        }
        Update: {
          ac_met?: number | null
          ac_total?: number | null
          bugs_detected?: number | null
          completed_at?: string | null
          completion_report?: Json | null
          conflict_data?: Json | null
          conflict_detected?: boolean
          conflict_resolution?: string | null
          conflict_resolved_at?: string | null
          created_at?: string | null
          developer_notes?: string | null
          error_message?: string | null
          expires_at?: string
          heartbeat_sequence?: number | null
          id?: string
          is_late_arrival?: boolean
          last_heartbeat_at?: string | null
          proposed_status?: string | null
          session_metrics?: Json | null
          session_token?: string
          started_at?: string | null
          status?: string
          status_accepted?: boolean | null
          subtasks_created?: string[] | null
          task_context?: Json
          task_id?: string
          task_snapshot_at_start?: Json | null
          tech_debt_detected?: number | null
          updated_at?: string | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "claude_code_sessions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claude_code_sessions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      cli_api_keys: {
        Row: {
          client_info: Json | null
          created_at: string | null
          email: string
          expires_at: string
          id: string
          key_hash: string
          last_used_at: string | null
          revoked: boolean | null
          revoked_at: string | null
          user_id: string | null
        }
        Insert: {
          client_info?: Json | null
          created_at?: string | null
          email: string
          expires_at: string
          id?: string
          key_hash: string
          last_used_at?: string | null
          revoked?: boolean | null
          revoked_at?: string | null
          user_id?: string | null
        }
        Update: {
          client_info?: Json | null
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          key_hash?: string
          last_used_at?: string | null
          revoked?: boolean | null
          revoked_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      days: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      insights: {
        Row: {
          author: string | null
          category: string
          created_at: string | null
          deleted_at: string | null
          description: string
          featured: boolean | null
          id: string
          insight_id: string
          links: Json | null
          post_date: string
          post_image: string | null
          published: boolean | null
          read_time: string | null
          tags: string[] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          author?: string | null
          category: string
          created_at?: string | null
          deleted_at?: string | null
          description: string
          featured?: boolean | null
          id?: string
          insight_id: string
          links?: Json | null
          post_date: string
          post_image?: string | null
          published?: boolean | null
          read_time?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          author?: string | null
          category?: string
          created_at?: string | null
          deleted_at?: string | null
          description?: string
          featured?: boolean | null
          id?: string
          insight_id?: string
          links?: Json | null
          post_date?: string
          post_image?: string | null
          published?: boolean | null
          read_time?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      levels: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      mcp_auth_tokens: {
        Row: {
          created_at: string | null
          email: string
          expires_at: string
          id: string
          session_data: Json | null
          status: string
          token: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string
          expires_at: string
          id?: string
          session_data?: Json | null
          status?: string
          token: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          session_data?: Json | null
          status?: string
          token?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      personas: {
        Row: {
          auto_detected: boolean | null
          created_at: string | null
          created_by: string
          deleted_at: string | null
          description: string
          domain: string | null
          id: string
          name: string
          persona_id: string
          priority_level: string | null
          role: string | null
          tawos_patterns: Json | null
          tech_savviness: number | null
          updated_at: string | null
          usage_frequency: string | null
          workspace_id: string
        }
        Insert: {
          auto_detected?: boolean | null
          created_at?: string | null
          created_by: string
          deleted_at?: string | null
          description: string
          domain?: string | null
          id?: string
          name: string
          persona_id: string
          priority_level?: string | null
          role?: string | null
          tawos_patterns?: Json | null
          tech_savviness?: number | null
          updated_at?: string | null
          usage_frequency?: string | null
          workspace_id: string
        }
        Update: {
          auto_detected?: boolean | null
          created_at?: string | null
          created_by?: string
          deleted_at?: string | null
          description?: string
          domain?: string | null
          id?: string
          name?: string
          persona_id?: string
          priority_level?: string | null
          role?: string | null
          tawos_patterns?: Json | null
          tech_savviness?: number | null
          updated_at?: string | null
          usage_frequency?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "personas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_activity"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "personas_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      predefined_role_templates: {
        Row: {
          category: string
          created_at: string | null
          default_competencies: Json
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          default_competencies?: Json
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          default_competencies?: Json
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company: string | null
          created_at: string | null
          date_format: string | null
          email: string | null
          full_name: string | null
          id: string
          language: string | null
          role: string | null
          start_of_week: string | null
          time_format: string | null
          timezone: string | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string | null
          date_format?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          language?: string | null
          role?: string | null
          start_of_week?: string | null
          time_format?: string | null
          timezone?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string | null
          date_format?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          language?: string | null
          role?: string | null
          start_of_week?: string | null
          time_format?: string | null
          timezone?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_timezone_fkey"
            columns: ["timezone"]
            isOneToOne: false
            referencedRelation: "timezones"
            referencedColumns: ["id"]
          },
        ]
      }
      project_personas: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          persona_id: string
          project_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          persona_id: string
          project_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          persona_id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_personas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_personas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_activity"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "project_personas_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_personas_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          external_data: Json | null
          external_id: string | null
          id: string
          name: string
          project_id: string
          space_id: string | null
          type: string | null
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          external_data?: Json | null
          external_id?: string | null
          id?: string
          name: string
          project_id?: string
          space_id?: string | null
          type?: string | null
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          external_data?: Json | null
          external_id?: string | null
          id?: string
          name?: string
          project_id?: string
          space_id?: string | null
          type?: string | null
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          action_type: string
          attempt_count: number | null
          created_at: string | null
          id: string
          identifier: string
          updated_at: string | null
          window_end: string
          window_start: string
        }
        Insert: {
          action_type: string
          attempt_count?: number | null
          created_at?: string | null
          id?: string
          identifier: string
          updated_at?: string | null
          window_end: string
          window_start: string
        }
        Update: {
          action_type?: string
          attempt_count?: number | null
          created_at?: string | null
          id?: string
          identifier?: string
          updated_at?: string | null
          window_end?: string
          window_start?: string
        }
        Relationships: []
      }
      roles: {
        Row: {
          category: string | null
          core_competencies: Json | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          description: string | null
          experience: string | null
          id: string
          is_template: boolean | null
          name: string
          template_data: Json | null
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          category?: string | null
          core_competencies?: Json | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          experience?: string | null
          id?: string
          is_template?: boolean | null
          name: string
          template_data?: Json | null
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          category?: string | null
          core_competencies?: Json | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          experience?: string | null
          id?: string
          is_template?: boolean | null
          name?: string
          template_data?: Json | null
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_activity"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "roles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      security_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string | null
          event_type: string
          id: string
          ip_address: unknown
          metadata: Json | null
          resource_id: string | null
          resource_type: string | null
          status: string
          user_agent: string | null
          workspace_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string | null
          event_type: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          resource_id?: string | null
          resource_type?: string | null
          status?: string
          user_agent?: string | null
          workspace_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string | null
          event_type?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          resource_id?: string | null
          resource_type?: string | null
          status?: string
          user_agent?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_audit_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      spaces: {
        Row: {
          color: string | null
          created_at: string | null
          deleted_at: string | null
          description: string | null
          due_date: string | null
          icon: string | null
          id: string
          is_private: boolean | null
          name: string
          portfolio_metadata: Json | null
          portfolio_status: string | null
          progress: number | null
          risk_level: string | null
          space_id: string
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          icon?: string | null
          id?: string
          is_private?: boolean | null
          name: string
          portfolio_metadata?: Json | null
          portfolio_status?: string | null
          progress?: number | null
          risk_level?: string | null
          space_id?: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          icon?: string | null
          id?: string
          is_private?: boolean | null
          name?: string
          portfolio_metadata?: Json | null
          portfolio_status?: string | null
          progress?: number | null
          risk_level?: string | null
          space_id?: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "spaces_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sprint_folders: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          duration_week: number
          id: string
          name: string
          project_id: string | null
          space_id: string
          sprint_folder_id: string
          sprint_start_day_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          duration_week?: number
          id?: string
          name: string
          project_id?: string | null
          space_id: string
          sprint_folder_id?: string
          sprint_start_day_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          duration_week?: number
          id?: string
          name?: string
          project_id?: string | null
          space_id?: string
          sprint_folder_id?: string
          sprint_start_day_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sprint_folders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sprint_folders_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sprint_folders_sprint_start_day_id_fkey"
            columns: ["sprint_start_day_id"]
            isOneToOne: false
            referencedRelation: "days"
            referencedColumns: ["id"]
          },
        ]
      }
      sprint_metrics: {
        Row: {
          ai_ac_met_rate: number | null
          ai_avg_session_duration_ms: number | null
          ai_bugs_detected: number | null
          ai_points_completed: number | null
          ai_quality_score: number | null
          ai_sessions_completed: number | null
          ai_sessions_count: number | null
          ai_tech_debt_detected: number | null
          avg_cycle_time_ms: number | null
          avg_lead_time_ms: number | null
          blocked_stories: number | null
          burndown_data: Json | null
          calculated_at: string | null
          completed_points: number | null
          completed_stories: number | null
          completion_rate: number | null
          created_at: string | null
          id: string
          in_progress_stories: number | null
          on_track: boolean | null
          pending_stories: number | null
          planned_points: number | null
          space_id: string
          sprint_id: string
          team_member_ids: string[] | null
          team_size: number | null
          total_stories: number | null
          total_time_tracked_ms: number | null
          updated_at: string | null
          variance_points: number | null
          velocity: number | null
          workspace_id: string
        }
        Insert: {
          ai_ac_met_rate?: number | null
          ai_avg_session_duration_ms?: number | null
          ai_bugs_detected?: number | null
          ai_points_completed?: number | null
          ai_quality_score?: number | null
          ai_sessions_completed?: number | null
          ai_sessions_count?: number | null
          ai_tech_debt_detected?: number | null
          avg_cycle_time_ms?: number | null
          avg_lead_time_ms?: number | null
          blocked_stories?: number | null
          burndown_data?: Json | null
          calculated_at?: string | null
          completed_points?: number | null
          completed_stories?: number | null
          completion_rate?: number | null
          created_at?: string | null
          id?: string
          in_progress_stories?: number | null
          on_track?: boolean | null
          pending_stories?: number | null
          planned_points?: number | null
          space_id: string
          sprint_id: string
          team_member_ids?: string[] | null
          team_size?: number | null
          total_stories?: number | null
          total_time_tracked_ms?: number | null
          updated_at?: string | null
          variance_points?: number | null
          velocity?: number | null
          workspace_id: string
        }
        Update: {
          ai_ac_met_rate?: number | null
          ai_avg_session_duration_ms?: number | null
          ai_bugs_detected?: number | null
          ai_points_completed?: number | null
          ai_quality_score?: number | null
          ai_sessions_completed?: number | null
          ai_sessions_count?: number | null
          ai_tech_debt_detected?: number | null
          avg_cycle_time_ms?: number | null
          avg_lead_time_ms?: number | null
          blocked_stories?: number | null
          burndown_data?: Json | null
          calculated_at?: string | null
          completed_points?: number | null
          completed_stories?: number | null
          completion_rate?: number | null
          created_at?: string | null
          id?: string
          in_progress_stories?: number | null
          on_track?: boolean | null
          pending_stories?: number | null
          planned_points?: number | null
          space_id?: string
          sprint_id?: string
          team_member_ids?: string[] | null
          team_size?: number | null
          total_stories?: number | null
          total_time_tracked_ms?: number | null
          updated_at?: string | null
          variance_points?: number | null
          velocity?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sprint_metrics_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sprint_metrics_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: true
            referencedRelation: "sprints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sprint_metrics_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sprints: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          duration: number | null
          end_date: string | null
          goal: string | null
          id: string
          name: string
          project_id: string | null
          space_id: string
          sprint_folder_id: string
          sprint_id: string
          start_date: string | null
          status: string | null
          task_id: string | null
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          duration?: number | null
          end_date?: string | null
          goal?: string | null
          id?: string
          name: string
          project_id?: string | null
          space_id: string
          sprint_folder_id: string
          sprint_id?: string
          start_date?: string | null
          status?: string | null
          task_id?: string | null
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          duration?: number | null
          end_date?: string | null
          goal?: string | null
          id?: string
          name?: string
          project_id?: string | null
          space_id?: string
          sprint_folder_id?: string
          sprint_id?: string
          start_date?: string | null
          status?: string | null
          task_id?: string | null
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sprints_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sprints_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sprints_sprint_folder_id_fkey"
            columns: ["sprint_folder_id"]
            isOneToOne: false
            referencedRelation: "sprint_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sprints_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sprints_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      status_types: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      statuses: {
        Row: {
          color: string | null
          created_at: string | null
          deleted_at: string | null
          id: string
          is_default: boolean | null
          name: string
          position: number | null
          project_id: string | null
          space_id: string | null
          sprint_id: string | null
          status_id: string
          status_type_id: string | null
          type: string | null
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          position?: number | null
          project_id?: string | null
          space_id?: string | null
          sprint_id?: string | null
          status_id?: string
          status_type_id?: string | null
          type?: string | null
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          position?: number | null
          project_id?: string | null
          space_id?: string | null
          sprint_id?: string | null
          status_id?: string
          status_type_id?: string | null
          type?: string | null
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "statuses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "statuses_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "statuses_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "sprints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "statuses_status_type_id_fkey"
            columns: ["status_type_id"]
            isOneToOne: false
            referencedRelation: "status_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "statuses_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      story_generation_sessions: {
        Row: {
          ai_cost_usd: number
          ai_model: string
          ai_tokens_used: number
          anti_pattern_prevention: boolean | null
          completed_at: string | null
          complexity: string
          created_at: string | null
          error_message: string | null
          feature_description: string
          generated_stories: Json | null
          generated_story_ids: string[] | null
          generation_time_ms: number | null
          id: string
          number_of_stories: number
          priority_weights: Json
          progress: number
          progress_message: string | null
          selected_personas: Json | null
          session_id: string
          started_at: string | null
          status: string | null
          task_id: string | null
          tawos_patterns_used: Json | null
          team_members: Json | null
          team_recommendation: Json | null
          user_benefit: string | null
          user_id: string
          user_role: string | null
          user_want: string | null
          workspace_id: string
        }
        Insert: {
          ai_cost_usd?: number
          ai_model?: string
          ai_tokens_used?: number
          anti_pattern_prevention?: boolean | null
          completed_at?: string | null
          complexity: string
          created_at?: string | null
          error_message?: string | null
          feature_description: string
          generated_stories?: Json | null
          generated_story_ids?: string[] | null
          generation_time_ms?: number | null
          id?: string
          number_of_stories: number
          priority_weights: Json
          progress?: number
          progress_message?: string | null
          selected_personas?: Json | null
          session_id?: string
          started_at?: string | null
          status?: string | null
          task_id?: string | null
          tawos_patterns_used?: Json | null
          team_members?: Json | null
          team_recommendation?: Json | null
          user_benefit?: string | null
          user_id: string
          user_role?: string | null
          user_want?: string | null
          workspace_id: string
        }
        Update: {
          ai_cost_usd?: number
          ai_model?: string
          ai_tokens_used?: number
          anti_pattern_prevention?: boolean | null
          completed_at?: string | null
          complexity?: string
          created_at?: string | null
          error_message?: string | null
          feature_description?: string
          generated_stories?: Json | null
          generated_story_ids?: string[] | null
          generation_time_ms?: number | null
          id?: string
          number_of_stories?: number
          priority_weights?: Json
          progress?: number
          progress_message?: string | null
          selected_personas?: Json | null
          session_id?: string
          started_at?: string | null
          status?: string | null
          task_id?: string | null
          tawos_patterns_used?: Json | null
          team_members?: Json | null
          team_recommendation?: Json | null
          user_benefit?: string | null
          user_id?: string
          user_role?: string | null
          user_want?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_generation_sessions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "ai_task_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_generation_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_generation_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_activity"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "story_generation_sessions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          aliases: string[]
          canonical_tag_id: string | null
          color: string | null
          created_at: string | null
          deleted_at: string | null
          id: string
          name: string
          tag_id: string
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          aliases?: string[]
          canonical_tag_id?: string | null
          color?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          name: string
          tag_id?: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          aliases?: string[]
          canonical_tag_id?: string | null
          color?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          name?: string
          tag_id?: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tags_canonical_tag_id_fkey"
            columns: ["canonical_tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tags_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      task_ai_metadata: {
        Row: {
          ai_assigned: boolean
          ai_assignment_confidence: number | null
          ai_assignment_date: string | null
          ai_assignment_reasoning: string | null
          ai_generation_metadata: Json | null
          ai_priority_applied: boolean
          ai_priority_applied_at: string | null
          ai_priority_confidence: number | null
          ai_priority_reasoning: string | null
          created_at: string | null
          embedding: string | null
          generation_session_id: string | null
          task_id: string
          updated_at: string | null
        }
        Insert: {
          ai_assigned?: boolean
          ai_assignment_confidence?: number | null
          ai_assignment_date?: string | null
          ai_assignment_reasoning?: string | null
          ai_generation_metadata?: Json | null
          ai_priority_applied?: boolean
          ai_priority_applied_at?: string | null
          ai_priority_confidence?: number | null
          ai_priority_reasoning?: string | null
          created_at?: string | null
          embedding?: string | null
          generation_session_id?: string | null
          task_id: string
          updated_at?: string | null
        }
        Update: {
          ai_assigned?: boolean
          ai_assignment_confidence?: number | null
          ai_assignment_date?: string | null
          ai_assignment_reasoning?: string | null
          ai_generation_metadata?: Json | null
          ai_priority_applied?: boolean
          ai_priority_applied_at?: string | null
          ai_priority_confidence?: number | null
          ai_priority_reasoning?: string | null
          created_at?: string | null
          embedding?: string | null
          generation_session_id?: string | null
          task_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_ai_metadata_generation_session_id_fkey"
            columns: ["generation_session_id"]
            isOneToOne: false
            referencedRelation: "story_generation_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_ai_metadata_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: true
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_blocks: {
        Row: {
          affects_sprint: boolean | null
          blocked_at: string | null
          blocker_details: Json | null
          blocker_type: string | null
          created_at: string | null
          created_by: string | null
          duration_ms: number | null
          id: string
          impact_level: string | null
          reason: string
          resolution: string | null
          resolved_by: string | null
          task_id: string
          unblocked_at: string | null
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          affects_sprint?: boolean | null
          blocked_at?: string | null
          blocker_details?: Json | null
          blocker_type?: string | null
          created_at?: string | null
          created_by?: string | null
          duration_ms?: number | null
          id?: string
          impact_level?: string | null
          reason: string
          resolution?: string | null
          resolved_by?: string | null
          task_id: string
          unblocked_at?: string | null
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          affects_sprint?: boolean | null
          blocked_at?: string | null
          blocker_details?: Json | null
          blocker_type?: string | null
          created_at?: string | null
          created_by?: string | null
          duration_ms?: number | null
          id?: string
          impact_level?: string | null
          reason?: string
          resolution?: string | null
          resolved_by?: string | null
          task_id?: string
          unblocked_at?: string | null
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_blocks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_blocks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_activity"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "task_blocks_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_blocks_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "user_activity"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "task_blocks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_blocks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      task_dependencies: {
        Row: {
          confidence: number | null
          created_at: string | null
          created_by: string | null
          dependency_type: string
          id: string
          reason: string | null
          source_task_id: string
          target_task_id: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          created_by?: string | null
          dependency_type: string
          id?: string
          reason?: string | null
          source_task_id: string
          target_task_id: string
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          created_by?: string | null
          dependency_type?: string
          id?: string
          reason?: string | null
          source_task_id?: string
          target_task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_dependencies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_dependencies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_activity"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "task_dependencies_source_task_id_fkey"
            columns: ["source_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_dependencies_target_task_id_fkey"
            columns: ["target_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_personas: {
        Row: {
          persona_id: string
          task_id: string
        }
        Insert: {
          persona_id: string
          task_id: string
        }
        Update: {
          persona_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_personas_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_personas_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_status_history: {
        Row: {
          changed_at: string | null
          changed_by: string | null
          from_status_id: string | null
          from_status_name: string | null
          from_status_type: string | null
          id: string
          metadata: Json | null
          task_id: string
          time_in_status_ms: number | null
          to_status_id: string
          to_status_name: string | null
          to_status_type: string | null
          workspace_id: string
        }
        Insert: {
          changed_at?: string | null
          changed_by?: string | null
          from_status_id?: string | null
          from_status_name?: string | null
          from_status_type?: string | null
          id?: string
          metadata?: Json | null
          task_id: string
          time_in_status_ms?: number | null
          to_status_id: string
          to_status_name?: string | null
          to_status_type?: string | null
          workspace_id: string
        }
        Update: {
          changed_at?: string | null
          changed_by?: string | null
          from_status_id?: string | null
          from_status_name?: string | null
          from_status_type?: string | null
          id?: string
          metadata?: Json | null
          task_id?: string
          time_in_status_ms?: number | null
          to_status_id?: string
          to_status_name?: string | null
          to_status_type?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "user_activity"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "task_status_history_from_status_id_fkey"
            columns: ["from_status_id"]
            isOneToOne: false
            referencedRelation: "statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_status_history_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_status_history_to_status_id_fkey"
            columns: ["to_status_id"]
            isOneToOne: false
            referencedRelation: "statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_status_history_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      task_tags: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          id: string
          tag_id: string
          task_id: string
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          tag_id: string
          task_id: string
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          tag_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_tags_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          acceptance_criteria: string[] | null
          acceptance_criteria_met: boolean | null
          acceptance_criteria_met_at: string | null
          ai_generation_metadata: Json | null
          assignee_id: string | null
          backlog_position: number | null
          business_value: number | null
          complexity: number | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          dependencies: number | null
          dependency_score: number | null
          description: string | null
          due_date: string | null
          estimated_time: number | null
          executor_type: string | null
          generated_by_ai: boolean | null
          generation_session_id: string | null
          id: string
          name: string
          parent_task_id: string | null
          persona_id: string | null
          position: number | null
          priority: string | null
          project_id: string | null
          risk: number | null
          space_id: string | null
          sprint_id: string | null
          start_date: string | null
          status_id: string
          story_points: number | null
          task_id: string
          type: string | null
          updated_at: string | null
          updated_by: string | null
          user_impact: number | null
          velocity: number | null
          workspace_id: string | null
        }
        Insert: {
          acceptance_criteria?: string[] | null
          acceptance_criteria_met?: boolean | null
          acceptance_criteria_met_at?: string | null
          ai_generation_metadata?: Json | null
          assignee_id?: string | null
          backlog_position?: number | null
          business_value?: number | null
          complexity?: number | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          dependencies?: number | null
          dependency_score?: number | null
          description?: string | null
          due_date?: string | null
          estimated_time?: number | null
          executor_type?: string | null
          generated_by_ai?: boolean | null
          generation_session_id?: string | null
          id?: string
          name: string
          parent_task_id?: string | null
          persona_id?: string | null
          position?: number | null
          priority?: string | null
          project_id?: string | null
          risk?: number | null
          space_id?: string | null
          sprint_id?: string | null
          start_date?: string | null
          status_id: string
          story_points?: number | null
          task_id?: string
          type?: string | null
          updated_at?: string | null
          updated_by?: string | null
          user_impact?: number | null
          velocity?: number | null
          workspace_id?: string | null
        }
        Update: {
          acceptance_criteria?: string[] | null
          acceptance_criteria_met?: boolean | null
          acceptance_criteria_met_at?: string | null
          ai_generation_metadata?: Json | null
          assignee_id?: string | null
          backlog_position?: number | null
          business_value?: number | null
          complexity?: number | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          dependencies?: number | null
          dependency_score?: number | null
          description?: string | null
          due_date?: string | null
          estimated_time?: number | null
          executor_type?: string | null
          generated_by_ai?: boolean | null
          generation_session_id?: string | null
          id?: string
          name?: string
          parent_task_id?: string | null
          persona_id?: string | null
          position?: number | null
          priority?: string | null
          project_id?: string | null
          risk?: number | null
          space_id?: string | null
          sprint_id?: string | null
          start_date?: string | null
          status_id?: string
          story_points?: number | null
          task_id?: string
          type?: string | null
          updated_at?: string | null
          updated_by?: string | null
          user_impact?: number | null
          velocity?: number | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "user_activity"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_activity"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "tasks_generation_session_id_fkey"
            columns: ["generation_session_id"]
            isOneToOne: false
            referencedRelation: "story_generation_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "sprints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user_activity"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      tawos_retrieval_logs: {
        Row: {
          avg_similarity_score: number | null
          chunks_retrieved: number
          created_at: string
          framework_categories: Json | null
          generation_success: boolean | null
          id: string
          latency_ms: number
          max_similarity_score: number | null
          min_similarity_score: number | null
          query_text: string
          retrieval_tier: string
          session_id: string | null
          threshold_used: number
          workspace_id: string
        }
        Insert: {
          avg_similarity_score?: number | null
          chunks_retrieved?: number
          created_at?: string
          framework_categories?: Json | null
          generation_success?: boolean | null
          id?: string
          latency_ms?: number
          max_similarity_score?: number | null
          min_similarity_score?: number | null
          query_text: string
          retrieval_tier: string
          session_id?: string | null
          threshold_used: number
          workspace_id: string
        }
        Update: {
          avg_similarity_score?: number | null
          chunks_retrieved?: number
          created_at?: string
          framework_categories?: Json | null
          generation_success?: boolean | null
          id?: string
          latency_ms?: number
          max_similarity_score?: number | null
          min_similarity_score?: number | null
          query_text?: string
          retrieval_tier?: string
          session_id?: string | null
          threshold_used?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tawos_retrieval_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "story_generation_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tawos_retrieval_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      tawos_training_failures: {
        Row: {
          created_at: string
          error_code: string | null
          error_message: string
          id: string
          issue_key: string
          issue_title: string | null
          training_run_id: string
        }
        Insert: {
          created_at?: string
          error_code?: string | null
          error_message: string
          id?: string
          issue_key: string
          issue_title?: string | null
          training_run_id: string
        }
        Update: {
          created_at?: string
          error_code?: string | null
          error_message?: string
          id?: string
          issue_key?: string
          issue_title?: string | null
          training_run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tawos_training_failures_training_run_id_fkey"
            columns: ["training_run_id"]
            isOneToOne: false
            referencedRelation: "tawos_training_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      tawos_training_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          duplicate_in_db: number
          duplicate_in_file: number
          error_message: string | null
          failed: number
          id: string
          input_data: Json | null
          new_count: number
          original_filename: string | null
          processed: number
          progress_message: string | null
          result: Json | null
          source: string
          started_at: string | null
          status: string
          task_id: string | null
          total_issues: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          duplicate_in_db?: number
          duplicate_in_file?: number
          error_message?: string | null
          failed?: number
          id?: string
          input_data?: Json | null
          new_count?: number
          original_filename?: string | null
          processed?: number
          progress_message?: string | null
          result?: Json | null
          source?: string
          started_at?: string | null
          status?: string
          task_id?: string | null
          total_issues?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          duplicate_in_db?: number
          duplicate_in_file?: number
          error_message?: string | null
          failed?: number
          id?: string
          input_data?: Json | null
          new_count?: number
          original_filename?: string | null
          processed?: number
          progress_message?: string | null
          result?: Json | null
          source?: string
          started_at?: string | null
          status?: string
          task_id?: string | null
          total_issues?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tawos_training_runs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "ai_task_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tawos_training_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      tawos_user_stories: {
        Row: {
          created_at: string | null
          embedding: string | null
          id: string
          metadata: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      timezones: {
        Row: {
          abbreviation: string
          city: string
          country: string
          display_order: number | null
          id: string
          label: string
          utc_offset: number
        }
        Insert: {
          abbreviation: string
          city: string
          country: string
          display_order?: number | null
          id?: string
          label: string
          utc_offset: number
        }
        Update: {
          abbreviation?: string
          city?: string
          country?: string
          display_order?: number | null
          id?: string
          label?: string
          utc_offset?: number
        }
        Relationships: []
      }
      workspaces: {
        Row: {
          category: string
          created_at: string | null
          deleted_at: string | null
          id: string
          name: string
          owner_id: string
          purpose: string
          type: string
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          category: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          name: string
          owner_id: string
          purpose: string
          type: string
          updated_at?: string | null
          workspace_id?: string
        }
        Update: {
          category?: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          name?: string
          owner_id?: string
          purpose?: string
          type?: string
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      user_activity: {
        Row: {
          email: string | null
          last_generation_at: string | null
          last_task_at: string | null
          name: string | null
          total_story_sessions: number | null
          total_tasks: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      auth_uid_check: { Args: never; Returns: string }
      calculate_sprint_metrics: {
        Args: { p_sprint_id: string }
        Returns: {
          completed_points: number
          completed_stories: number
          completion_rate: number
          planned_points: number
          total_stories: number
          velocity: number
        }[]
      }
      create_default_statuses:
        | { Args: { workspace_id_param: string }; Returns: undefined }
        | { Args: { workspace_uuid: string }; Returns: undefined }
      create_workspace_with_defaults: {
        Args: {
          p_category?: string
          p_name: string
          p_owner_id?: string
          p_purpose?: string
          p_type?: string
          p_workspace_id?: string
        }
        Returns: Json
      }
      delete_project_cascade:
        | {
            Args: { project_id_param: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.delete_project_cascade(project_id_param => text), public.delete_project_cascade(project_id_param => uuid). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { project_id_param: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.delete_project_cascade(project_id_param => text), public.delete_project_cascade(project_id_param => uuid). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
      delete_space_cascade:
        | {
            Args: { space_id_param: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.delete_space_cascade(space_id_param => text), public.delete_space_cascade(space_id_param => uuid). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { space_id_param: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.delete_space_cascade(space_id_param => text), public.delete_space_cascade(space_id_param => uuid). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
      delete_sprint_cascade:
        | {
            Args: { sprint_id_param: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.delete_sprint_cascade(sprint_id_param => text), public.delete_sprint_cascade(sprint_id_param => uuid). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { sprint_id_param: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.delete_sprint_cascade(sprint_id_param => text), public.delete_sprint_cascade(sprint_id_param => uuid). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
      delete_sprint_folder_cascade:
        | {
            Args: { sprint_folder_id_param: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.delete_sprint_folder_cascade(sprint_folder_id_param => text), public.delete_sprint_folder_cascade(sprint_folder_id_param => uuid). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { sprint_folder_id_param: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.delete_sprint_folder_cascade(sprint_folder_id_param => text), public.delete_sprint_folder_cascade(sprint_folder_id_param => uuid). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
      generate_project_id: { Args: never; Returns: string }
      generate_space_id: { Args: never; Returns: string }
      generate_task_id: { Args: never; Returns: string }
      generate_workspace_id: { Args: never; Returns: string }
      get_active_blocks_count: {
        Args: { p_workspace_id: string }
        Returns: number
      }
      get_or_create_predefined_statuses: {
        Args: { p_space_id: string; p_workspace_id: string }
        Returns: {
          color: string
          id: string
          is_default: boolean
          name: string
          position: number
          status_id: string
          status_type_id: string
        }[]
      }
      get_project_view_data: {
        Args: { p_project_id: string; p_workspace_id: string }
        Returns: Json
      }
      get_sprint_view_data: {
        Args: { p_sprint_id: string; p_workspace_id: string }
        Returns: {
          sprint: Json
          statuses: Json
          tasks: Json
          team_members: Json
        }[]
      }
      get_workspace_analytics: {
        Args: { p_days_back?: number; p_workspace_id: string }
        Returns: {
          active_sprints: number
          average_story_points: number
          completed_tasks: number
          completion_rate: number
          recent_activity: number
          team_members_count: number
          total_tasks: number
        }[]
      }
      match_documents: {
        Args: {
          filter?: Json
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          id: string
          metadata: Json
          similarity: number
        }[]
      }
      populate_sprint_metrics_for_sprint: {
        Args: { p_sprint_id: string }
        Returns: undefined
      }
      setup_new_workspace: {
        Args: { owner_id_param: string; workspace_id_param: string }
        Returns: undefined
      }
      task_has_acceptance_criteria: {
        Args: { p_task_id: string }
        Returns: boolean
      }
      try_requeue_task: {
        Args: { p_max_requeues?: number; p_task_id: string }
        Returns: {
          new_count: number
          requeued: boolean
        }[]
      }
      update_ai_sprint_metrics: {
        Args: { p_sprint_id: string }
        Returns: undefined
      }
    }
    Enums: {
      priority_level_type: "low" | "medium" | "high" | "critical" | "urgent"
      status_type:
        | "submitted"
        | "under_review"
        | "planned"
        | "in_development"
        | "completed"
        | "rejected"
        | "reported"
        | "investigating"
        | "in_progress"
        | "resolved"
        | "closed"
        | "open"
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
      priority_level_type: ["low", "medium", "high", "critical", "urgent"],
      status_type: [
        "submitted",
        "under_review",
        "planned",
        "in_development",
        "completed",
        "rejected",
        "reported",
        "investigating",
        "in_progress",
        "resolved",
        "closed",
        "open",
      ],
    },
  },
} as const
