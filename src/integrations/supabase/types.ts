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
      archetypes: {
        Row: {
          commentary_keywords: string[]
          confidence_thresholds: Json
          core_question: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          signature_axes: Json
          signature_signals: string[]
          signature_tradeoffs: Json
          tagline: string | null
          updated_at: string
        }
        Insert: {
          commentary_keywords?: string[]
          confidence_thresholds?: Json
          core_question?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          signature_axes?: Json
          signature_signals?: string[]
          signature_tradeoffs?: Json
          tagline?: string | null
          updated_at?: string
        }
        Update: {
          commentary_keywords?: string[]
          confidence_thresholds?: Json
          core_question?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          signature_axes?: Json
          signature_signals?: string[]
          signature_tradeoffs?: Json
          tagline?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      axes: {
        Row: {
          analyst_label: string | null
          created_at: string
          high_pole: string
          id: string
          key: string
          low_pole: string
          sort_order: number
          tradeoff_sentence: string | null
          updated_at: string
        }
        Insert: {
          analyst_label?: string | null
          created_at?: string
          high_pole: string
          id?: string
          key: string
          low_pole: string
          sort_order?: number
          tradeoff_sentence?: string | null
          updated_at?: string
        }
        Update: {
          analyst_label?: string | null
          created_at?: string
          high_pole?: string
          id?: string
          key?: string
          low_pole?: string
          sort_order?: number
          tradeoff_sentence?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          mutation_id: string | null
          role: string
          session_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          mutation_id?: string | null
          role: string
          session_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          mutation_id?: string | null
          role?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_turns: {
        Row: {
          assistant_message_id: string | null
          lease_token: string
          lease_until: string
          message: string
          mutation_id: string
          reply: string | null
          result_version: number | null
          session_id: string
          user_id: string
          user_message_id: string
        }
        Insert: {
          assistant_message_id?: string | null
          lease_token: string
          lease_until: string
          message: string
          mutation_id: string
          reply?: string | null
          result_version?: number | null
          session_id: string
          user_id: string
          user_message_id: string
        }
        Update: {
          assistant_message_id?: string | null
          lease_token?: string
          lease_until?: string
          message?: string
          mutation_id?: string
          reply?: string | null
          result_version?: number | null
          session_id?: string
          user_id?: string
          user_message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_turns_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      choices: {
        Row: {
          chosen_song_id: string
          created_at: string
          evidence: Json | null
          id: string
          ms_to_decide: number | null
          mutation_id: string | null
          pairing_id: string
          rejected_song_id: string | null
          response: Json | null
          routing_context: Json | null
          session_id: string
        }
        Insert: {
          chosen_song_id: string
          created_at?: string
          evidence?: Json | null
          id?: string
          ms_to_decide?: number | null
          mutation_id?: string | null
          pairing_id: string
          rejected_song_id?: string | null
          response?: Json | null
          routing_context?: Json | null
          session_id: string
        }
        Update: {
          chosen_song_id?: string
          created_at?: string
          evidence?: Json | null
          id?: string
          ms_to_decide?: number | null
          mutation_id?: string | null
          pairing_id?: string
          rejected_song_id?: string | null
          response?: Json | null
          routing_context?: Json | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "choices_chosen_song_id_fkey"
            columns: ["chosen_song_id"]
            isOneToOne: false
            referencedRelation: "pairing_recognition"
            referencedColumns: ["song_a_id"]
          },
          {
            foreignKeyName: "choices_chosen_song_id_fkey"
            columns: ["chosen_song_id"]
            isOneToOne: false
            referencedRelation: "pairing_recognition"
            referencedColumns: ["song_b_id"]
          },
          {
            foreignKeyName: "choices_chosen_song_id_fkey"
            columns: ["chosen_song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "choices_pairing_id_fkey"
            columns: ["pairing_id"]
            isOneToOne: false
            referencedRelation: "pairing_recognition"
            referencedColumns: ["pairing_id"]
          },
          {
            foreignKeyName: "choices_pairing_id_fkey"
            columns: ["pairing_id"]
            isOneToOne: false
            referencedRelation: "pairings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "choices_pairing_id_fkey"
            columns: ["pairing_id"]
            isOneToOne: false
            referencedRelation: "pairings_with_songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "choices_rejected_song_id_fkey"
            columns: ["rejected_song_id"]
            isOneToOne: false
            referencedRelation: "pairing_recognition"
            referencedColumns: ["song_a_id"]
          },
          {
            foreignKeyName: "choices_rejected_song_id_fkey"
            columns: ["rejected_song_id"]
            isOneToOne: false
            referencedRelation: "pairing_recognition"
            referencedColumns: ["song_b_id"]
          },
          {
            foreignKeyName: "choices_rejected_song_id_fkey"
            columns: ["rejected_song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "choices_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      critic_profile: {
        Row: {
          bluntness: number
          created_at: string
          forbidden_moves: string[]
          move_tally: Json
          patience: number
          playfulness: number
          provocation_appetite: number
          turns_observed: number
          updated_at: string
          user_id: string
        }
        Insert: {
          bluntness?: number
          created_at?: string
          forbidden_moves?: string[]
          move_tally?: Json
          patience?: number
          playfulness?: number
          provocation_appetite?: number
          turns_observed?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          bluntness?: number
          created_at?: string
          forbidden_moves?: string[]
          move_tally?: Json
          patience?: number
          playfulness?: number
          provocation_appetite?: number
          turns_observed?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      critic_quality_attempts: {
        Row: {
          attempt_key: string
          calls: Json
          created_at: string
          decision_trace: Json | null
          evidence_context: Json
          id: string
          output_fingerprint: string
          output_text: string
          rejection_reason: string | null
          result_version: number | null
          review_checks: Json | null
          reviewer_version: string
          session_id: string
          stage: string
          status: string
          updated_at: string
          user_id: string
          writer_version: string
        }
        Insert: {
          attempt_key: string
          calls?: Json
          created_at?: string
          decision_trace?: Json | null
          evidence_context: Json
          id?: string
          output_fingerprint: string
          output_text: string
          rejection_reason?: string | null
          result_version?: number | null
          review_checks?: Json | null
          reviewer_version: string
          session_id: string
          stage: string
          status: string
          updated_at?: string
          user_id: string
          writer_version: string
        }
        Update: {
          attempt_key?: string
          calls?: Json
          created_at?: string
          decision_trace?: Json | null
          evidence_context?: Json
          id?: string
          output_fingerprint?: string
          output_text?: string
          rejection_reason?: string | null
          result_version?: number | null
          review_checks?: Json | null
          reviewer_version?: string
          session_id?: string
          stage?: string
          status?: string
          updated_at?: string
          user_id?: string
          writer_version?: string
        }
        Relationships: [
          {
            foreignKeyName: "critic_quality_attempts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      critic_quality_reviews: {
        Row: {
          attempt_id: string
          conversational_relevance: number | null
          created_at: string
          entertainment: number | null
          evaluator_type: string
          id: string
          inference_accuracy: number | null
          musical_specificity: number | null
          prose_originality: number | null
          reviewer_id: string
          rubric_version: string
          updated_at: string
        }
        Insert: {
          attempt_id: string
          conversational_relevance?: number | null
          created_at?: string
          entertainment?: number | null
          evaluator_type?: string
          id?: string
          inference_accuracy?: number | null
          musical_specificity?: number | null
          prose_originality?: number | null
          reviewer_id: string
          rubric_version?: string
          updated_at?: string
        }
        Update: {
          attempt_id?: string
          conversational_relevance?: number | null
          created_at?: string
          entertainment?: number | null
          evaluator_type?: string
          id?: string
          inference_accuracy?: number | null
          musical_specificity?: number | null
          prose_originality?: number | null
          reviewer_id?: string
          rubric_version?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "critic_quality_reviews_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "critic_quality_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      critic_reaction_exposures: {
        Row: {
          pool_id: string
          session_id: string | null
          shown_at: string
          user_id: string
        }
        Insert: {
          pool_id: string
          session_id?: string | null
          shown_at?: string
          user_id: string
        }
        Update: {
          pool_id?: string
          session_id?: string | null
          shown_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "critic_reaction_exposures_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "critic_reaction_pool"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "critic_reaction_exposures_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      critic_reaction_pool: {
        Row: {
          chosen_song_id: string
          created_at: string
          evidence_fingerprint: string
          id: string
          pairing_id: string
          retired_reason: string | null
          reviewer_version: string
          source: string
          stage: string
          status: string
          text: string
          updated_at: string
          writer_version: string
        }
        Insert: {
          chosen_song_id: string
          created_at?: string
          evidence_fingerprint: string
          id?: string
          pairing_id: string
          retired_reason?: string | null
          reviewer_version: string
          source: string
          stage?: string
          status?: string
          text: string
          updated_at?: string
          writer_version: string
        }
        Update: {
          chosen_song_id?: string
          created_at?: string
          evidence_fingerprint?: string
          id?: string
          pairing_id?: string
          retired_reason?: string | null
          reviewer_version?: string
          source?: string
          stage?: string
          status?: string
          text?: string
          updated_at?: string
          writer_version?: string
        }
        Relationships: [
          {
            foreignKeyName: "critic_reaction_pool_chosen_song_id_fkey"
            columns: ["chosen_song_id"]
            isOneToOne: false
            referencedRelation: "pairing_recognition"
            referencedColumns: ["song_a_id"]
          },
          {
            foreignKeyName: "critic_reaction_pool_chosen_song_id_fkey"
            columns: ["chosen_song_id"]
            isOneToOne: false
            referencedRelation: "pairing_recognition"
            referencedColumns: ["song_b_id"]
          },
          {
            foreignKeyName: "critic_reaction_pool_chosen_song_id_fkey"
            columns: ["chosen_song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "critic_reaction_pool_pairing_id_fkey"
            columns: ["pairing_id"]
            isOneToOne: false
            referencedRelation: "pairing_recognition"
            referencedColumns: ["pairing_id"]
          },
          {
            foreignKeyName: "critic_reaction_pool_pairing_id_fkey"
            columns: ["pairing_id"]
            isOneToOne: false
            referencedRelation: "pairings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "critic_reaction_pool_pairing_id_fkey"
            columns: ["pairing_id"]
            isOneToOne: false
            referencedRelation: "pairings_with_songs"
            referencedColumns: ["id"]
          },
        ]
      }
      critic_session_verdicts: {
        Row: {
          created_at: string
          id: string
          keep_talking: string
          reason: string | null
          reviewer_id: string
          rubric_version: string
          session_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          keep_talking: string
          reason?: string | null
          reviewer_id: string
          rubric_version: string
          session_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          keep_talking?: string
          reason?: string | null
          reviewer_id?: string
          rubric_version?: string
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "critic_session_verdicts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      decade_opening_prompts: {
        Row: {
          created_at: string
          decade: string
          id: string
          is_active: boolean
          position: number
          text: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          decade: string
          id?: string
          is_active?: boolean
          position: number
          text: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          decade?: string
          id?: string
          is_active?: boolean
          position?: number
          text?: string
          updated_at?: string
        }
        Relationships: []
      }
      event_log: {
        Row: {
          choice_id: string | null
          client: string | null
          created_at: string
          event_type: string
          experiment_key: string | null
          id: string
          pairing_id: string | null
          props: Json
          response_time_ms: number | null
          session_id: string | null
          user_id: string | null
          variant: string | null
        }
        Insert: {
          choice_id?: string | null
          client?: string | null
          created_at?: string
          event_type: string
          experiment_key?: string | null
          id?: string
          pairing_id?: string | null
          props?: Json
          response_time_ms?: number | null
          session_id?: string | null
          user_id?: string | null
          variant?: string | null
        }
        Update: {
          choice_id?: string | null
          client?: string | null
          created_at?: string
          event_type?: string
          experiment_key?: string | null
          id?: string
          pairing_id?: string | null
          props?: Json
          response_time_ms?: number | null
          session_id?: string | null
          user_id?: string | null
          variant?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_log_choice_id_fkey"
            columns: ["choice_id"]
            isOneToOne: false
            referencedRelation: "choices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_log_pairing_id_fkey"
            columns: ["pairing_id"]
            isOneToOne: false
            referencedRelation: "pairing_recognition"
            referencedColumns: ["pairing_id"]
          },
          {
            foreignKeyName: "event_log_pairing_id_fkey"
            columns: ["pairing_id"]
            isOneToOne: false
            referencedRelation: "pairings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_log_pairing_id_fkey"
            columns: ["pairing_id"]
            isOneToOne: false
            referencedRelation: "pairings_with_songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_log_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      experiment_assignments: {
        Row: {
          assigned_at: string
          experiment_key: string
          id: string
          pilot: Json | null
          user_id: string
          variant: string
        }
        Insert: {
          assigned_at?: string
          experiment_key: string
          id?: string
          pilot?: Json | null
          user_id: string
          variant: string
        }
        Update: {
          assigned_at?: string
          experiment_key?: string
          id?: string
          pilot?: Json | null
          user_id?: string
          variant?: string
        }
        Relationships: []
      }
      interview_qa_sessions: {
        Row: {
          created_at: string
          created_by: string
          purpose: string
          session_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          purpose: string
          session_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          purpose?: string
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "interview_qa_sessions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      llm_calls: {
        Row: {
          confidence: number | null
          created_at: string
          error_message: string | null
          id: string
          input_summary: Json | null
          latency_ms: number | null
          model: string
          narrative: string | null
          output: Json | null
          prompt_version: string
          role: string
          session_id: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          error_message?: string | null
          id?: string
          input_summary?: Json | null
          latency_ms?: number | null
          model: string
          narrative?: string | null
          output?: Json | null
          prompt_version: string
          role: string
          session_id?: string | null
          status: string
          user_id?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string
          error_message?: string | null
          id?: string
          input_summary?: Json | null
          latency_ms?: number | null
          model?: string
          narrative?: string | null
          output?: Json | null
          prompt_version?: string
          role?: string
          session_id?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "llm_calls_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      musicdna_export_scopes: {
        Row: {
          approved_by: string | null
          capture_enabled: boolean
          dispatch_enabled: boolean
          environment: string
          expires_at: string
          observed_from: string
          policy_version: string
          receiver_tenant_id: string | null
          source_key: string
        }
        Insert: {
          approved_by?: string | null
          capture_enabled?: boolean
          dispatch_enabled?: boolean
          environment: string
          expires_at: string
          observed_from: string
          policy_version?: string
          receiver_tenant_id?: string | null
          source_key: string
        }
        Update: {
          approved_by?: string | null
          capture_enabled?: boolean
          dispatch_enabled?: boolean
          environment?: string
          expires_at?: string
          observed_from?: string
          policy_version?: string
          receiver_tenant_id?: string | null
          source_key?: string
        }
        Relationships: []
      }
      musicdna_export_withdrawals: {
        Row: {
          attempts: number
          completed_at: string | null
          deletion_id: string
          environment: string
          last_failure: string | null
          purged_count: number | null
          reason: string
          receiver_tenant_id: string | null
          requested_at: string
          source_key: string
          subject_hash: string
          subject_ref: string | null
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          deletion_id: string
          environment: string
          last_failure?: string | null
          purged_count?: number | null
          reason: string
          receiver_tenant_id?: string | null
          requested_at?: string
          source_key: string
          subject_hash: string
          subject_ref?: string | null
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          deletion_id?: string
          environment?: string
          last_failure?: string | null
          purged_count?: number | null
          reason?: string
          receiver_tenant_id?: string | null
          requested_at?: string
          source_key?: string
          subject_hash?: string
          subject_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "musicdna_export_withdrawals_source_key_environment_fkey"
            columns: ["source_key", "environment"]
            isOneToOne: false
            referencedRelation: "musicdna_export_scopes"
            referencedColumns: ["source_key", "environment"]
          },
        ]
      }
      musicdna_learning_dispatch_halts: {
        Row: {
          cleared_at: string | null
          cleared_by: string | null
          environment: string
          id: string
          raised_at: string
          reason: string
          source_key: string
        }
        Insert: {
          cleared_at?: string | null
          cleared_by?: string | null
          environment: string
          id?: string
          raised_at?: string
          reason: string
          source_key: string
        }
        Update: {
          cleared_at?: string | null
          cleared_by?: string | null
          environment?: string
          id?: string
          raised_at?: string
          reason?: string
          source_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "musicdna_learning_dispatch_halts_source_key_environment_fkey"
            columns: ["source_key", "environment"]
            isOneToOne: false
            referencedRelation: "musicdna_export_scopes"
            referencedColumns: ["source_key", "environment"]
          },
        ]
      }
      musicdna_learning_dispatch_jobs: {
        Row: {
          attempts: number
          claims: number
          completed_at: string | null
          created_at: string
          environment: string
          kind: string
          last_attempt_at: string | null
          last_failure: string | null
          lease_started_at: string | null
          lease_token: string | null
          lease_until: string | null
          next_attempt_at: string
          receipt_id: string | null
          receiver_tenant_id: string | null
          replay_count: number
          source_key: string
          state: string
          work_id: string
        }
        Insert: {
          attempts?: number
          claims?: number
          completed_at?: string | null
          created_at?: string
          environment: string
          kind: string
          last_attempt_at?: string | null
          last_failure?: string | null
          lease_started_at?: string | null
          lease_token?: string | null
          lease_until?: string | null
          next_attempt_at?: string
          receipt_id?: string | null
          receiver_tenant_id?: string | null
          replay_count?: number
          source_key: string
          state?: string
          work_id: string
        }
        Update: {
          attempts?: number
          claims?: number
          completed_at?: string | null
          created_at?: string
          environment?: string
          kind?: string
          last_attempt_at?: string | null
          last_failure?: string | null
          lease_started_at?: string | null
          lease_token?: string | null
          lease_until?: string | null
          next_attempt_at?: string
          receipt_id?: string | null
          receiver_tenant_id?: string | null
          replay_count?: number
          source_key?: string
          state?: string
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "musicdna_learning_dispatch_jobs_source_key_environment_fkey"
            columns: ["source_key", "environment"]
            isOneToOne: false
            referencedRelation: "musicdna_export_scopes"
            referencedColumns: ["source_key", "environment"]
          },
        ]
      }
      musicdna_learning_dispatch_rates: {
        Row: {
          cooldown_until: string | null
          environment: string
          failures: number
          next_request_at: string
          source_key: string
        }
        Insert: {
          cooldown_until?: string | null
          environment: string
          failures?: number
          next_request_at?: string
          source_key: string
        }
        Update: {
          cooldown_until?: string | null
          environment?: string
          failures?: number
          next_request_at?: string
          source_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "musicdna_learning_dispatch_rates_source_key_environment_fkey"
            columns: ["source_key", "environment"]
            isOneToOne: true
            referencedRelation: "musicdna_export_scopes"
            referencedColumns: ["source_key", "environment"]
          },
        ]
      }
      musicdna_learning_enrollments: {
        Row: {
          approved_by: string | null
          data_class: string
          decision_ref: string
          enrolled_at: string
          environment: string
          owner_user_id: string
          receiver_tenant_id: string
          result_fingerprint: string
          result_id: string
          result_ref: string
          session_id: string
          source_key: string
          subject_ref: string
        }
        Insert: {
          approved_by?: string | null
          data_class?: string
          decision_ref: string
          enrolled_at?: string
          environment: string
          owner_user_id: string
          receiver_tenant_id: string
          result_fingerprint: string
          result_id: string
          result_ref: string
          session_id: string
          source_key: string
          subject_ref: string
        }
        Update: {
          approved_by?: string | null
          data_class?: string
          decision_ref?: string
          enrolled_at?: string
          environment?: string
          owner_user_id?: string
          receiver_tenant_id?: string
          result_fingerprint?: string
          result_id?: string
          result_ref?: string
          session_id?: string
          source_key?: string
          subject_ref?: string
        }
        Relationships: [
          {
            foreignKeyName: "musicdna_learning_enrollments_result_id_fkey"
            columns: ["result_id"]
            isOneToOne: true
            referencedRelation: "session_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "musicdna_learning_enrollments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "musicdna_learning_enrollments_source_key_environment_fkey"
            columns: ["source_key", "environment"]
            isOneToOne: false
            referencedRelation: "musicdna_export_scopes"
            referencedColumns: ["source_key", "environment"]
          },
        ]
      }
      musicdna_learning_outbox: {
        Row: {
          canonical_envelope: string | null
          created_at: string
          environment: string
          feedback_id: string
          observation_id: string
          observed_at: string
          payload_fingerprint: string | null
          projection: Json | null
          reason: string | null
          receiver_tenant_id: string
          result_id: string
          source_key: string
          state: string
          subject_hash: string
        }
        Insert: {
          canonical_envelope?: string | null
          created_at?: string
          environment: string
          feedback_id: string
          observation_id?: string
          observed_at: string
          payload_fingerprint?: string | null
          projection?: Json | null
          reason?: string | null
          receiver_tenant_id: string
          result_id: string
          source_key: string
          state: string
          subject_hash: string
        }
        Update: {
          canonical_envelope?: string | null
          created_at?: string
          environment?: string
          feedback_id?: string
          observation_id?: string
          observed_at?: string
          payload_fingerprint?: string | null
          projection?: Json | null
          reason?: string | null
          receiver_tenant_id?: string
          result_id?: string
          source_key?: string
          state?: string
          subject_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "musicdna_learning_outbox_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: true
            referencedRelation: "result_feedback"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "musicdna_learning_outbox_result_id_fkey"
            columns: ["result_id"]
            isOneToOne: false
            referencedRelation: "musicdna_learning_enrollments"
            referencedColumns: ["result_id"]
          },
          {
            foreignKeyName: "musicdna_learning_outbox_source_key_environment_fkey"
            columns: ["source_key", "environment"]
            isOneToOne: false
            referencedRelation: "musicdna_export_scopes"
            referencedColumns: ["source_key", "environment"]
          },
        ]
      }
      musicdna_learning_worker_callers: {
        Row: {
          enabled: boolean
          environment: string
          last_claim_at: string | null
          source_key: string
          token_hash: string
          valid_until: string
        }
        Insert: {
          enabled?: boolean
          environment: string
          last_claim_at?: string | null
          source_key: string
          token_hash: string
          valid_until: string
        }
        Update: {
          enabled?: boolean
          environment?: string
          last_claim_at?: string | null
          source_key?: string
          token_hash?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "musicdna_learning_worker_callers_source_key_environment_fkey"
            columns: ["source_key", "environment"]
            isOneToOne: true
            referencedRelation: "musicdna_export_scopes"
            referencedColumns: ["source_key", "environment"]
          },
        ]
      }
      musicdna_learning_worker_status: {
        Row: {
          attention: boolean
          delivered: number
          environment: string
          finished_at: string | null
          last_success_at: string | null
          run_id: string
          source_key: string
          started_at: string
          state: string
        }
        Insert: {
          attention?: boolean
          delivered?: number
          environment: string
          finished_at?: string | null
          last_success_at?: string | null
          run_id: string
          source_key: string
          started_at?: string
          state: string
        }
        Update: {
          attention?: boolean
          delivered?: number
          environment?: string
          finished_at?: string | null
          last_success_at?: string | null
          run_id?: string
          source_key?: string
          started_at?: string
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "musicdna_learning_worker_status_source_key_environment_fkey"
            columns: ["source_key", "environment"]
            isOneToOne: true
            referencedRelation: "musicdna_export_scopes"
            referencedColumns: ["source_key", "environment"]
          },
        ]
      }
      musicdna_real_qa_consents: {
        Row: {
          approved_by: string
          consent_ref: string
          consented_at: string
          environment: string
          expires_at: string
          policy_version: string
          receiver_tenant_id: string
          source_key: string
          subject_ref: string
          user_id: string
        }
        Insert: {
          approved_by: string
          consent_ref: string
          consented_at: string
          environment?: string
          expires_at: string
          policy_version?: string
          receiver_tenant_id: string
          source_key?: string
          subject_ref: string
          user_id: string
        }
        Update: {
          approved_by?: string
          consent_ref?: string
          consented_at?: string
          environment?: string
          expires_at?: string
          policy_version?: string
          receiver_tenant_id?: string
          source_key?: string
          subject_ref?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "musicdna_real_qa_consents_source_key_environment_fkey"
            columns: ["source_key", "environment"]
            isOneToOne: false
            referencedRelation: "musicdna_export_scopes"
            referencedColumns: ["source_key", "environment"]
          },
        ]
      }
      onboarding_openers: {
        Row: {
          created_at: string
          cta: string
          eyebrow: string
          headline: string
          id: string
          is_active: boolean
          slot_labels: Json
          sub: string | null
          updated_at: string
          variant_key: string
          weight: number
        }
        Insert: {
          created_at?: string
          cta?: string
          eyebrow?: string
          headline: string
          id?: string
          is_active?: boolean
          slot_labels: Json
          sub?: string | null
          updated_at?: string
          variant_key: string
          weight?: number
        }
        Update: {
          created_at?: string
          cta?: string
          eyebrow?: string
          headline?: string
          id?: string
          is_active?: boolean
          slot_labels?: Json
          sub?: string | null
          updated_at?: string
          variant_key?: string
          weight?: number
        }
        Relationships: []
      }
      pairing_exposures: {
        Row: {
          catalog_revision: string
          client: string | null
          created_at: string
          id: string
          lane: string
          offer_key: string
          pairing_id: string
          reported_shown_at: string | null
          served_at: string
          session_id: string
          songs: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          catalog_revision: string
          client?: string | null
          created_at?: string
          id?: string
          lane: string
          offer_key: string
          pairing_id: string
          reported_shown_at?: string | null
          served_at?: string
          session_id: string
          songs: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          catalog_revision?: string
          client?: string | null
          created_at?: string
          id?: string
          lane?: string
          offer_key?: string
          pairing_id?: string
          reported_shown_at?: string | null
          served_at?: string
          session_id?: string
          songs?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pairing_exposures_pairing_id_fkey"
            columns: ["pairing_id"]
            isOneToOne: false
            referencedRelation: "pairing_recognition"
            referencedColumns: ["pairing_id"]
          },
          {
            foreignKeyName: "pairing_exposures_pairing_id_fkey"
            columns: ["pairing_id"]
            isOneToOne: false
            referencedRelation: "pairings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pairing_exposures_pairing_id_fkey"
            columns: ["pairing_id"]
            isOneToOne: false
            referencedRelation: "pairings_with_songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pairing_exposures_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      pairings: {
        Row: {
          active: boolean
          created_at: string
          diagnostic_weight: number
          difficulty: number | null
          expected_split: string | null
          hypothesis: string | null
          id: string
          is_bootstrap: boolean
          lane: string
          song_a_id: string
          song_b_id: string
          tests: string[]
          updated_at: string
          user_facing_tradeoff: string | null
          why_good: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          diagnostic_weight?: number
          difficulty?: number | null
          expected_split?: string | null
          hypothesis?: string | null
          id?: string
          is_bootstrap?: boolean
          lane?: string
          song_a_id: string
          song_b_id: string
          tests?: string[]
          updated_at?: string
          user_facing_tradeoff?: string | null
          why_good?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          diagnostic_weight?: number
          difficulty?: number | null
          expected_split?: string | null
          hypothesis?: string | null
          id?: string
          is_bootstrap?: boolean
          lane?: string
          song_a_id?: string
          song_b_id?: string
          tests?: string[]
          updated_at?: string
          user_facing_tradeoff?: string | null
          why_good?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pairings_song_a_id_fkey"
            columns: ["song_a_id"]
            isOneToOne: false
            referencedRelation: "pairing_recognition"
            referencedColumns: ["song_a_id"]
          },
          {
            foreignKeyName: "pairings_song_a_id_fkey"
            columns: ["song_a_id"]
            isOneToOne: false
            referencedRelation: "pairing_recognition"
            referencedColumns: ["song_b_id"]
          },
          {
            foreignKeyName: "pairings_song_a_id_fkey"
            columns: ["song_a_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pairings_song_b_id_fkey"
            columns: ["song_b_id"]
            isOneToOne: false
            referencedRelation: "pairing_recognition"
            referencedColumns: ["song_a_id"]
          },
          {
            foreignKeyName: "pairings_song_b_id_fkey"
            columns: ["song_b_id"]
            isOneToOne: false
            referencedRelation: "pairing_recognition"
            referencedColumns: ["song_b_id"]
          },
          {
            foreignKeyName: "pairings_song_b_id_fkey"
            columns: ["song_b_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      prepared_reads: {
        Row: {
          answered: number
          chosen_song_id: string
          consumed_at: string | null
          fingerprint: string | null
          finished_at: string | null
          outcome: string | null
          pairing_id: string
          payload: Json | null
          requested_at: string | null
          session_id: string
          started_at: string
          status: string
          user_id: string
          wait_ms: number | null
        }
        Insert: {
          answered: number
          chosen_song_id: string
          consumed_at?: string | null
          fingerprint?: string | null
          finished_at?: string | null
          outcome?: string | null
          pairing_id: string
          payload?: Json | null
          requested_at?: string | null
          session_id: string
          started_at?: string
          status?: string
          user_id: string
          wait_ms?: number | null
        }
        Update: {
          answered?: number
          chosen_song_id?: string
          consumed_at?: string | null
          fingerprint?: string | null
          finished_at?: string | null
          outcome?: string | null
          pairing_id?: string
          payload?: Json | null
          requested_at?: string | null
          session_id?: string
          started_at?: string
          status?: string
          user_id?: string
          wait_ms?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "prepared_reads_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          opening_analysis_json: Json
          opening_hypothesis: string | null
          opening_lane: string | null
          opening_lane_confidence: number | null
          opening_songs: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          opening_analysis_json?: Json
          opening_hypothesis?: string | null
          opening_lane?: string | null
          opening_lane_confidence?: number | null
          opening_songs?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          opening_analysis_json?: Json
          opening_hypothesis?: string | null
          opening_lane?: string | null
          opening_lane_confidence?: number | null
          opening_songs?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      result_feedback: {
        Row: {
          accuracy: string | null
          comment: string | null
          created_at: string
          id: string
          least_accurate_sentence: string | null
          most_accurate_sentence: string | null
          mutation_id: string | null
          rating: number | null
          result_version: number | null
          session_id: string
          target: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          accuracy?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          least_accurate_sentence?: string | null
          most_accurate_sentence?: string | null
          mutation_id?: string | null
          rating?: number | null
          result_version?: number | null
          session_id: string
          target?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          accuracy?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          least_accurate_sentence?: string | null
          most_accurate_sentence?: string | null
          mutation_id?: string | null
          rating?: number | null
          result_version?: number | null
          session_id?: string
          target?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "result_feedback_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_reactions: {
        Row: {
          client: string
          created_at: string
          id: string
          kind: string
          mutation_id: string | null
          pairing_id: string | null
          session_id: string
          user_id: string
        }
        Insert: {
          client: string
          created_at?: string
          id?: string
          kind: string
          mutation_id?: string | null
          pairing_id?: string | null
          session_id: string
          user_id: string
        }
        Update: {
          client?: string
          created_at?: string
          id?: string
          kind?: string
          mutation_id?: string | null
          pairing_id?: string | null
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_reactions_pairing_id_fkey"
            columns: ["pairing_id"]
            isOneToOne: false
            referencedRelation: "pairing_recognition"
            referencedColumns: ["pairing_id"]
          },
          {
            foreignKeyName: "session_reactions_pairing_id_fkey"
            columns: ["pairing_id"]
            isOneToOne: false
            referencedRelation: "pairings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_reactions_pairing_id_fkey"
            columns: ["pairing_id"]
            isOneToOne: false
            referencedRelation: "pairings_with_songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_reactions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_reasoning: {
        Row: {
          allowed_claims: Json
          blocked_claims: Json
          counterarguments: Json
          created_at: string
          evidence_thresholds: Json
          id: string
          narrative: string | null
          observations: Json
          patterns: Json
          session_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          allowed_claims?: Json
          blocked_claims?: Json
          counterarguments?: Json
          created_at?: string
          evidence_thresholds?: Json
          id?: string
          narrative?: string | null
          observations?: Json
          patterns?: Json
          session_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          allowed_claims?: Json
          blocked_claims?: Json
          counterarguments?: Json
          created_at?: string
          evidence_thresholds?: Json
          id?: string
          narrative?: string | null
          observations?: Json
          patterns?: Json
          session_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_reasoning_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_results: {
        Row: {
          base_version: number | null
          content: Json
          created_at: string
          engine_version: string
          evidence: Json
          id: string
          ledger_version: string
          policy_version: string
          routing_context: Json | null
          self_report: Json
          session_id: string
          source: string
          user_id: string
          version: number
        }
        Insert: {
          base_version?: number | null
          content?: Json
          created_at?: string
          engine_version: string
          evidence?: Json
          id?: string
          ledger_version: string
          policy_version: string
          routing_context?: Json | null
          self_report?: Json
          session_id: string
          source?: string
          user_id: string
          version: number
        }
        Update: {
          base_version?: number | null
          content?: Json
          created_at?: string
          engine_version?: string
          evidence?: Json
          id?: string
          ledger_version?: string
          policy_version?: string
          routing_context?: Json | null
          self_report?: Json
          session_id?: string
          source?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "session_results_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          archetype_flag_reason: string | null
          archetype_flagged: boolean
          archetype_id: string | null
          archetype_margin: number | null
          archetype_score: number | null
          archetype_top3: Json
          bootstrap_choices_json: Json
          completed_at: string | null
          created_at: string
          decade: number | null
          id: string
          interpretation: string | null
          is_public: boolean
          lane: string
          lane_confidence: number
          mode: string
          parent_session_id: string | null
          probe_candidate_lanes: string[]
          probe_state: Json
          published_read: Json | null
          routing_assignment: Json | null
          share_token: string | null
          started_at: string
          updated_at: string
          user_id: string
          vector: Json
        }
        Insert: {
          archetype_flag_reason?: string | null
          archetype_flagged?: boolean
          archetype_id?: string | null
          archetype_margin?: number | null
          archetype_score?: number | null
          archetype_top3?: Json
          bootstrap_choices_json?: Json
          completed_at?: string | null
          created_at?: string
          decade?: number | null
          id?: string
          interpretation?: string | null
          is_public?: boolean
          lane?: string
          lane_confidence?: number
          mode?: string
          parent_session_id?: string | null
          probe_candidate_lanes?: string[]
          probe_state?: Json
          published_read?: Json | null
          routing_assignment?: Json | null
          share_token?: string | null
          started_at?: string
          updated_at?: string
          user_id: string
          vector?: Json
        }
        Update: {
          archetype_flag_reason?: string | null
          archetype_flagged?: boolean
          archetype_id?: string | null
          archetype_margin?: number | null
          archetype_score?: number | null
          archetype_top3?: Json
          bootstrap_choices_json?: Json
          completed_at?: string | null
          created_at?: string
          decade?: number | null
          id?: string
          interpretation?: string | null
          is_public?: boolean
          lane?: string
          lane_confidence?: number
          mode?: string
          parent_session_id?: string | null
          probe_candidate_lanes?: string[]
          probe_state?: Json
          published_read?: Json | null
          routing_assignment?: Json | null
          share_token?: string | null
          started_at?: string
          updated_at?: string
          user_id?: string
          vector?: Json
        }
        Relationships: [
          {
            foreignKeyName: "sessions_archetype_id_fkey"
            columns: ["archetype_id"]
            isOneToOne: false
            referencedRelation: "archetypes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_parent_session_id_fkey"
            columns: ["parent_session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      song_artwork: {
        Row: {
          attribution: string | null
          candidate_image_url: string | null
          checked_at: string | null
          created_at: string
          display_enabled: boolean
          image_url: string | null
          match_score: number | null
          match_status: string
          recording_mbid: string | null
          release_artist: string | null
          release_date: string | null
          release_mbid: string | null
          release_title: string | null
          rights_reference: string | null
          rights_status: string
          song_id: string
          source: string
          updated_at: string
        }
        Insert: {
          attribution?: string | null
          candidate_image_url?: string | null
          checked_at?: string | null
          created_at?: string
          display_enabled?: boolean
          image_url?: string | null
          match_score?: number | null
          match_status?: string
          recording_mbid?: string | null
          release_artist?: string | null
          release_date?: string | null
          release_mbid?: string | null
          release_title?: string | null
          rights_reference?: string | null
          rights_status?: string
          song_id: string
          source?: string
          updated_at?: string
        }
        Update: {
          attribution?: string | null
          candidate_image_url?: string | null
          checked_at?: string | null
          created_at?: string
          display_enabled?: boolean
          image_url?: string | null
          match_score?: number | null
          match_status?: string
          recording_mbid?: string | null
          release_artist?: string | null
          release_date?: string | null
          release_mbid?: string | null
          release_title?: string | null
          rights_reference?: string | null
          rights_status?: string
          song_id?: string
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "song_artwork_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: true
            referencedRelation: "pairing_recognition"
            referencedColumns: ["song_a_id"]
          },
          {
            foreignKeyName: "song_artwork_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: true
            referencedRelation: "pairing_recognition"
            referencedColumns: ["song_b_id"]
          },
          {
            foreignKeyName: "song_artwork_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: true
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      song_axes: {
        Row: {
          axis_id: string
          created_at: string
          id: string
          pole: string
          song_id: string
          strength: number
          updated_at: string
        }
        Insert: {
          axis_id: string
          created_at?: string
          id?: string
          pole?: string
          song_id: string
          strength?: number
          updated_at?: string
        }
        Update: {
          axis_id?: string
          created_at?: string
          id?: string
          pole?: string
          song_id?: string
          strength?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "song_axes_axis_id_fkey"
            columns: ["axis_id"]
            isOneToOne: false
            referencedRelation: "axes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "song_axes_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "pairing_recognition"
            referencedColumns: ["song_a_id"]
          },
          {
            foreignKeyName: "song_axes_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "pairing_recognition"
            referencedColumns: ["song_b_id"]
          },
          {
            foreignKeyName: "song_axes_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      song_facts: {
        Row: {
          check_note: string | null
          confidence: number
          created_at: string
          drafted_by: string
          id: string
          kind: string
          reviewed_at: string | null
          reviewed_by: string | null
          song_id: string
          source_title: string | null
          source_url: string | null
          status: string
          text: string
          updated_at: string
          version: number
        }
        Insert: {
          check_note?: string | null
          confidence?: number
          created_at?: string
          drafted_by?: string
          id?: string
          kind: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          song_id: string
          source_title?: string | null
          source_url?: string | null
          status?: string
          text: string
          updated_at?: string
          version?: number
        }
        Update: {
          check_note?: string | null
          confidence?: number
          created_at?: string
          drafted_by?: string
          id?: string
          kind?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          song_id?: string
          source_title?: string | null
          source_url?: string | null
          status?: string
          text?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "song_facts_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "pairing_recognition"
            referencedColumns: ["song_a_id"]
          },
          {
            foreignKeyName: "song_facts_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "pairing_recognition"
            referencedColumns: ["song_b_id"]
          },
          {
            foreignKeyName: "song_facts_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      songs: {
        Row: {
          active: boolean
          archetype_signals: string[]
          artist: string
          atmosphere: number
          canon_score: number | null
          community: number
          confidence: number | null
          created_at: string
          cross_genre_mapping: number | null
          curator_count: number
          diagnostic_power: number
          diagnostic_power_confidence: number
          id: string
          identity_signaling: number | null
          immersion: number | null
          lane: string
          longevity: number | null
          movement: number
          pairing_density: number | null
          perspective: number | null
          polarization: number | null
          primary_dimensions: string[]
          primary_lane: string
          rationale: string | null
          routing_power: number | null
          scale: number | null
          scored_at: string | null
          scoring_provenance: Json | null
          scoring_version: string | null
          sub_lane: string | null
          subculture: string[]
          tension: number | null
          texture: number | null
          title: string
          tradeoff_richness: number | null
          transformation: number
          updated_at: string
          year: number | null
        }
        Insert: {
          active?: boolean
          archetype_signals?: string[]
          artist: string
          atmosphere?: number
          canon_score?: number | null
          community?: number
          confidence?: number | null
          created_at?: string
          cross_genre_mapping?: number | null
          curator_count?: number
          diagnostic_power?: number
          diagnostic_power_confidence?: number
          id?: string
          identity_signaling?: number | null
          immersion?: number | null
          lane: string
          longevity?: number | null
          movement?: number
          pairing_density?: number | null
          perspective?: number | null
          polarization?: number | null
          primary_dimensions?: string[]
          primary_lane?: string
          rationale?: string | null
          routing_power?: number | null
          scale?: number | null
          scored_at?: string | null
          scoring_provenance?: Json | null
          scoring_version?: string | null
          sub_lane?: string | null
          subculture?: string[]
          tension?: number | null
          texture?: number | null
          title: string
          tradeoff_richness?: number | null
          transformation?: number
          updated_at?: string
          year?: number | null
        }
        Update: {
          active?: boolean
          archetype_signals?: string[]
          artist?: string
          atmosphere?: number
          canon_score?: number | null
          community?: number
          confidence?: number | null
          created_at?: string
          cross_genre_mapping?: number | null
          curator_count?: number
          diagnostic_power?: number
          diagnostic_power_confidence?: number
          id?: string
          identity_signaling?: number | null
          immersion?: number | null
          lane?: string
          longevity?: number | null
          movement?: number
          pairing_density?: number | null
          perspective?: number | null
          polarization?: number | null
          primary_dimensions?: string[]
          primary_lane?: string
          rationale?: string | null
          routing_power?: number | null
          scale?: number | null
          scored_at?: string | null
          scoring_provenance?: Json | null
          scoring_version?: string | null
          sub_lane?: string | null
          subculture?: string[]
          tension?: number | null
          texture?: number | null
          title?: string
          tradeoff_richness?: number | null
          transformation?: number
          updated_at?: string
          year?: number | null
        }
        Relationships: []
      }
      subcultures: {
        Row: {
          created_at: string
          family: string
          label: string
          notes: string | null
          slug: string
        }
        Insert: {
          created_at?: string
          family: string
          label: string
          notes?: string | null
          slug: string
        }
        Update: {
          created_at?: string
          family?: string
          label?: string
          notes?: string | null
          slug?: string
        }
        Relationships: []
      }
      test_runs: {
        Row: {
          choices_log: Json
          created_at: string
          current_pairing_id: string | null
          current_pairing_payload: Json | null
          id: string
          opener_payload: Json | null
          opener_songs: string[] | null
          pairing_count: number
          pairings_used: number
          persona_id: string
          report: Json | null
          session_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          choices_log?: Json
          created_at?: string
          current_pairing_id?: string | null
          current_pairing_payload?: Json | null
          id?: string
          opener_payload?: Json | null
          opener_songs?: string[] | null
          pairing_count?: number
          pairings_used?: number
          persona_id: string
          report?: Json | null
          session_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          choices_log?: Json
          created_at?: string
          current_pairing_id?: string | null
          current_pairing_payload?: Json | null
          id?: string
          opener_payload?: Json | null
          opener_songs?: string[] | null
          pairing_count?: number
          pairings_used?: number
          persona_id?: string
          report?: Json | null
          session_id?: string | null
          updated_at?: string
          user_id?: string
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
          role?: Database["public"]["Enums"]["app_role"]
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
      pairing_recognition: {
        Row: {
          active: boolean | null
          avg_canon: number | null
          avg_year: number | null
          cross_subculture: boolean | null
          diagnostic_weight: number | null
          era_bucket: string | null
          era_span_years: number | null
          is_bootstrap: boolean | null
          lane: string | null
          min_canon: number | null
          pairing_id: string | null
          recognition_score: number | null
          shared_subculture_slugs: string[] | null
          shared_subcultures: number | null
          song_a_canon: number | null
          song_a_id: string | null
          song_a_year: number | null
          song_b_canon: number | null
          song_b_id: string | null
          song_b_year: number | null
        }
        Relationships: []
      }
      pairings_with_songs: {
        Row: {
          active: boolean | null
          created_at: string | null
          diagnostic_weight: number | null
          difficulty: number | null
          expected_split: string | null
          hypothesis: string | null
          id: string | null
          is_bootstrap: boolean | null
          lane: string | null
          song_a_artist: string | null
          song_a_id: string | null
          song_a_primary_lane: string | null
          song_a_title: string | null
          song_a_year: number | null
          song_b_artist: string | null
          song_b_id: string | null
          song_b_primary_lane: string | null
          song_b_title: string | null
          song_b_year: number | null
          tests: string[] | null
          updated_at: string | null
          user_facing_tradeoff: string | null
          why_good: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pairings_song_a_id_fkey"
            columns: ["song_a_id"]
            isOneToOne: false
            referencedRelation: "pairing_recognition"
            referencedColumns: ["song_a_id"]
          },
          {
            foreignKeyName: "pairings_song_a_id_fkey"
            columns: ["song_a_id"]
            isOneToOne: false
            referencedRelation: "pairing_recognition"
            referencedColumns: ["song_b_id"]
          },
          {
            foreignKeyName: "pairings_song_a_id_fkey"
            columns: ["song_a_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pairings_song_b_id_fkey"
            columns: ["song_b_id"]
            isOneToOne: false
            referencedRelation: "pairing_recognition"
            referencedColumns: ["song_a_id"]
          },
          {
            foreignKeyName: "pairings_song_b_id_fkey"
            columns: ["song_b_id"]
            isOneToOne: false
            referencedRelation: "pairing_recognition"
            referencedColumns: ["song_b_id"]
          },
          {
            foreignKeyName: "pairings_song_b_id_fkey"
            columns: ["song_b_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      v_axis_independence: {
        Row: {
          distinct_supporting_axes: number | null
          session_id: string | null
          total_supports: number | null
          winner_archetype_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_log_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      v_contradiction_load: {
        Row: {
          negative_contribution: number | null
          positive_contribution: number | null
          session_id: string | null
          winner_archetype_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_log_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      v_human_agreement: {
        Row: {
          accuracy: string | null
          is_residual: boolean | null
          least_accurate_sentence: string | null
          margin: number | null
          most_accurate_sentence: string | null
          session_id: string | null
          winner_fit: number | null
        }
        Relationships: [
          {
            foreignKeyName: "result_feedback_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      v_residual_rate: {
        Row: {
          created_at: string | null
          is_residual: boolean | null
          margin: number | null
          session_id: string | null
          winner_fit: number | null
        }
        Relationships: [
          {
            foreignKeyName: "event_log_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      v_session_stability: {
        Row: {
          created_at: string | null
          is_final: boolean | null
          margin: number | null
          round_number: number | null
          session_id: string | null
          winner_archetype_id: string | null
          winner_fit: number | null
        }
        Relationships: [
          {
            foreignKeyName: "event_log_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      assign_musicdna_routing_experiment: {
        Args: { p_design: Json; p_owner_id: string; p_session_id: string }
        Returns: Json
      }
      begin_chat_turn: {
        Args: { p_message: string; p_mutation_id: string; p_session_id: string }
        Returns: Json
      }
      begin_musicdna_learning_send: {
        Args: {
          p_environment: string
          p_kind: string
          p_lease_token: string
          p_source: string
          p_work_id: string
        }
        Returns: Json
      }
      claim_musicdna_learning_dispatch: {
        Args: { p_environment: string; p_source: string }
        Returns: Json
      }
      claim_musicdna_learning_worker: {
        Args: { p_token_hash: string }
        Returns: Json
      }
      complete_chat_turn: {
        Args: {
          p_lease_token: string
          p_mutation_id: string
          p_refinement: Json
          p_reply: string
          p_session_id: string
        }
        Returns: Json
      }
      create_interview_qa: {
        Args: {
          p_candidates: Json
          p_confidence: number
          p_lane: string
          p_owner: string
          p_vector: Json
        }
        Returns: string
      }
      enroll_musicdna_pilot_participant: {
        Args: {
          p_approval_ref: string
          p_consent_ref: string
          p_consented_at: string
          p_design: Json
          p_owner_id: string
        }
        Returns: Json
      }
      enroll_musicdna_real_qa: {
        Args: {
          p_approved_by: string
          p_consent: string
          p_consented_at: string
          p_expires_at: string
          p_subject_ref: string
          p_user: string
        }
        Returns: undefined
      }
      exclude_musicdna_learning_capture: {
        Args: { p_observation_id: string }
        Returns: Json
      }
      finish_musicdna_learning_dispatch: {
        Args: {
          p_environment: string
          p_failure?: string
          p_kind: string
          p_lease_token: string
          p_outcome: string
          p_receipt?: Json
          p_retry_after_seconds?: number
          p_source: string
          p_work_id: string
        }
        Returns: Json
      }
      finish_musicdna_learning_withdrawal: {
        Args: {
          p_completed_at: string
          p_deletion_id: string
          p_environment: string
          p_failure?: string
          p_purged_count: number
          p_source: string
        }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      inspect_musicdna_learning_dispatch: {
        Args: { p_environment: string; p_source: string; p_work_id: string }
        Returns: Json
      }
      lookup_published_read: { Args: { p_token: string }; Returns: Json }
      materialize_musicdna_learning_observation: {
        Args: { p_canonical_envelope: string; p_observation_id: string }
        Returns: Json
      }
      musicdna_learning_dispatch_status: {
        Args: { p_environment: string; p_source: string }
        Returns: Json
      }
      musicdna_learning_export_allowed: {
        Args: {
          p_environment: string
          p_observed_at: string
          p_source: string
          p_subject_ref: string
        }
        Returns: boolean
      }
      prepare_musicdna_pilot_session: {
        Args: {
          p_owner_id: string
          p_policy_version: string
          p_session_id: string
        }
        Returns: Json
      }
      publish_saved_read: {
        Args: { p_publish: boolean; p_session_id: string; p_version?: number }
        Returns: Json
      }
      purge_completed_musicdna_learning_withdrawals: {
        Args: { p_limit?: number }
        Returns: number
      }
      purge_musicdna_learning_dispatch: {
        Args: { p_limit?: number }
        Returns: number
      }
      purge_musicdna_learning_outbox: {
        Args: { p_limit?: number }
        Returns: Json
      }
      read_musicdna_pilot_cohort: {
        Args: { p_as_of: string; p_experiment_id: string }
        Returns: Json
      }
      read_musicdna_routing_outcome: {
        Args: { p_result_id: string }
        Returns: Json
      }
      record_choice_atomic: {
        Args: {
          p_chosen_song_id: string
          p_evidence?: Json
          p_ms_to_decide: number
          p_mutation_id: string
          p_pairing_id: string
          p_prior_vector: Json
          p_rejected_song_id: string
          p_response: Json
          p_session_id: string
          p_update: Json
        }
        Returns: string
      }
      record_musicdna_learning_worker_run: {
        Args: {
          p_attention?: boolean
          p_delivered?: number
          p_run_id: string
          p_state: string
        }
        Returns: undefined
      }
      release_chat_turn: {
        Args: {
          p_lease_token: string
          p_mutation_id: string
          p_session_id: string
        }
        Returns: undefined
      }
      request_musicdna_learning_withdrawal: {
        Args: {
          p_deletion_id: string
          p_environment: string
          p_reason: string
          p_source: string
          p_subject_ref: string
        }
        Returns: Json
      }
      save_result_feedback: {
        Args: { p_payload: Json; p_session_id: string }
        Returns: Json
      }
      withdraw_musicdna_pilot_participant: {
        Args: { p_experiment_id: string; p_owner_id: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
