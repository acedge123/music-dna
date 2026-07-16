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
          role: string
          session_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          session_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
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
      choices: {
        Row: {
          chosen_song_id: string
          created_at: string
          id: string
          ms_to_decide: number | null
          pairing_id: string
          rejected_song_id: string | null
          session_id: string
        }
        Insert: {
          chosen_song_id: string
          created_at?: string
          id?: string
          ms_to_decide?: number | null
          pairing_id: string
          rejected_song_id?: string | null
          session_id: string
        }
        Update: {
          chosen_song_id?: string
          created_at?: string
          id?: string
          ms_to_decide?: number | null
          pairing_id?: string
          rejected_song_id?: string | null
          session_id?: string
        }
        Relationships: [
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
          user_id: string
          variant: string
        }
        Insert: {
          assigned_at?: string
          experiment_key: string
          id?: string
          user_id: string
          variant: string
        }
        Update: {
          assigned_at?: string
          experiment_key?: string
          id?: string
          user_id?: string
          variant?: string
        }
        Relationships: []
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
      pairings: {
        Row: {
          active: boolean
          created_at: string
          diagnostic_weight: number
          difficulty: number | null
          expected_split: string | null
          hypothesis: string | null
          id: string
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
            referencedRelation: "songs"
            referencedColumns: ["id"]
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
          rating: number | null
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
          rating?: number | null
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
          rating?: number | null
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
      sessions: {
        Row: {
          archetype_flag_reason: string | null
          archetype_flagged: boolean
          archetype_id: string | null
          archetype_margin: number | null
          archetype_score: number | null
          archetype_top3: Json
          completed_at: string | null
          created_at: string
          id: string
          interpretation: string | null
          is_public: boolean
          lane: string
          lane_confidence: number
          probe_candidate_lanes: string[]
          probe_state: Json
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
          completed_at?: string | null
          created_at?: string
          id?: string
          interpretation?: string | null
          is_public?: boolean
          lane?: string
          lane_confidence?: number
          probe_candidate_lanes?: string[]
          probe_state?: Json
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
          completed_at?: string | null
          created_at?: string
          id?: string
          interpretation?: string | null
          is_public?: boolean
          lane?: string
          lane_confidence?: number
          probe_candidate_lanes?: string[]
          probe_state?: Json
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
      pairings_with_songs: {
        Row: {
          active: boolean | null
          created_at: string | null
          diagnostic_weight: number | null
          difficulty: number | null
          expected_split: string | null
          hypothesis: string | null
          id: string | null
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
            referencedRelation: "songs"
            referencedColumns: ["id"]
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
        Insert: {
          created_at?: string | null
          is_final?: never
          margin?: never
          round_number?: never
          session_id?: string | null
          winner_archetype_id?: never
          winner_fit?: never
        }
        Update: {
          created_at?: string | null
          is_final?: never
          margin?: never
          round_number?: never
          session_id?: string | null
          winner_archetype_id?: never
          winner_fit?: never
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
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
      app_role: ["admin", "user"],
    },
  },
} as const
