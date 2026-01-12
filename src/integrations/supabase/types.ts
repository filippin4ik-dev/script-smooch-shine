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
      achievements: {
        Row: {
          category: string
          condition_game: string | null
          condition_type: string
          condition_value: number
          created_at: string
          description: string
          icon: string
          id: string
          is_active: boolean
          is_hidden: boolean
          name: string
          rarity: string
          reward_amount: number
          reward_skin_id: string | null
          reward_type: string
          sort_order: number
        }
        Insert: {
          category?: string
          condition_game?: string | null
          condition_type: string
          condition_value?: number
          created_at?: string
          description: string
          icon?: string
          id?: string
          is_active?: boolean
          is_hidden?: boolean
          name: string
          rarity?: string
          reward_amount?: number
          reward_skin_id?: string | null
          reward_type?: string
          sort_order?: number
        }
        Update: {
          category?: string
          condition_game?: string | null
          condition_type?: string
          condition_value?: number
          created_at?: string
          description?: string
          icon?: string
          id?: string
          is_active?: boolean
          is_hidden?: boolean
          name?: string
          rarity?: string
          reward_amount?: number
          reward_skin_id?: string | null
          reward_type?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "achievements_reward_skin_id_fkey"
            columns: ["reward_skin_id"]
            isOneToOne: false
            referencedRelation: "skins"
            referencedColumns: ["id"]
          },
        ]
      }
      action_logs: {
        Row: {
          action_data: Json
          action_type: string
          created_at: string
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action_data?: Json
          action_type: string
          created_at?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action_data?: Json
          action_type?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      active_game_locks: {
        Row: {
          game_name: string
          game_session_id: string
          locked_at: string
          user_id: string
        }
        Insert: {
          game_name: string
          game_session_id: string
          locked_at?: string
          user_id: string
        }
        Update: {
          game_name?: string
          game_session_id?: string
          locked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "active_game_locks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "active_game_locks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      betting_tournament_results: {
        Row: {
          biggest_win: number
          id: string
          total_bets: number
          total_wins: number
          tournament_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          biggest_win?: number
          id?: string
          total_bets?: number
          total_wins?: number
          tournament_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          biggest_win?: number
          id?: string
          total_bets?: number
          total_wins?: number
          tournament_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "betting_tournament_results_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "betting_tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "betting_tournament_results_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "betting_tournament_results_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      betting_tournaments: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          end_at: string | null
          id: string
          min_bet_amount: number | null
          prize_amount: number
          prize_type: string
          start_at: string
          status: string
          title: string
          winner_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_at?: string | null
          id?: string
          min_bet_amount?: number | null
          prize_amount?: number
          prize_type?: string
          start_at?: string
          status?: string
          title: string
          winner_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_at?: string | null
          id?: string
          min_bet_amount?: number | null
          prize_amount?: number
          prize_type?: string
          start_at?: string
          status?: string
          title?: string
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "betting_tournaments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "betting_tournaments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "betting_tournaments_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "betting_tournaments_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      black_crow_access: {
        Row: {
          granted_at: string
          granted_by: string | null
          id: string
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "black_crow_access_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "black_crow_access_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "black_crow_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "black_crow_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bonus_wheels: {
        Row: {
          created_at: string
          id: string
          is_used: boolean
          reward_amount: number | null
          reward_description: string | null
          reward_type: string | null
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_used?: boolean
          reward_amount?: number | null
          reward_description?: string | null
          reward_type?: string | null
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_used?: boolean
          reward_amount?: number | null
          reward_description?: string | null
          reward_type?: string | null
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      case_items: {
        Row: {
          case_type_id: string
          chance: number
          created_at: string
          id: string
          image_url: string | null
          name: string
          price: number
          rarity: string
          skin_id: string | null
          weapon: string
        }
        Insert: {
          case_type_id: string
          chance: number
          created_at?: string
          id?: string
          image_url?: string | null
          name: string
          price: number
          rarity: string
          skin_id?: string | null
          weapon: string
        }
        Update: {
          case_type_id?: string
          chance?: number
          created_at?: string
          id?: string
          image_url?: string | null
          name?: string
          price?: number
          rarity?: string
          skin_id?: string | null
          weapon?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_items_case_type_id_fkey"
            columns: ["case_type_id"]
            isOneToOne: false
            referencedRelation: "case_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_items_skin_id_fkey"
            columns: ["skin_id"]
            isOneToOne: false
            referencedRelation: "skins"
            referencedColumns: ["id"]
          },
        ]
      }
      case_types: {
        Row: {
          color: string
          created_at: string
          icon: string
          id: string
          is_active: boolean
          name: string
          price: number
        }
        Insert: {
          color?: string
          created_at?: string
          icon?: string
          id: string
          is_active?: boolean
          name: string
          price?: number
        }
        Update: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
          price?: number
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          reply_to_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          reply_to_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          reply_to_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chicken_road_config: {
        Row: {
          created_at: string | null
          difficulty: string
          id: string
          multipliers: Json
          trap_chances: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          difficulty: string
          id?: string
          multipliers: Json
          trap_chances: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          difficulty?: string
          id?: string
          multipliers?: Json
          trap_chances?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      crash_bets: {
        Row: {
          auto_cashout: number
          bet_amount: number
          cashed_out_at: number | null
          created_at: string | null
          id: string
          is_freebet: boolean | null
          round_id: string
          status: string
          user_id: string
          win_amount: number | null
        }
        Insert: {
          auto_cashout: number
          bet_amount: number
          cashed_out_at?: number | null
          created_at?: string | null
          id?: string
          is_freebet?: boolean | null
          round_id: string
          status?: string
          user_id: string
          win_amount?: number | null
        }
        Update: {
          auto_cashout?: number
          bet_amount?: number
          cashed_out_at?: number | null
          created_at?: string | null
          id?: string
          is_freebet?: boolean | null
          round_id?: string
          status?: string
          user_id?: string
          win_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crash_bets_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "crash_rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crash_bets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crash_bets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crash_config: {
        Row: {
          betting_time_seconds: number
          chance_1_00: number
          chance_1_01_1_09: number
          chance_1_10_1_40: number
          chance_1_40_2_00: number
          chance_15_00_35_00: number
          chance_2_00_5_00: number
          chance_5_00_15_00: number
          created_at: string | null
          id: string
          max_multiplier: number
          min_multiplier: number
          updated_at: string | null
        }
        Insert: {
          betting_time_seconds?: number
          chance_1_00?: number
          chance_1_01_1_09?: number
          chance_1_10_1_40?: number
          chance_1_40_2_00?: number
          chance_15_00_35_00?: number
          chance_2_00_5_00?: number
          chance_5_00_15_00?: number
          created_at?: string | null
          id?: string
          max_multiplier?: number
          min_multiplier?: number
          updated_at?: string | null
        }
        Update: {
          betting_time_seconds?: number
          chance_1_00?: number
          chance_1_01_1_09?: number
          chance_1_10_1_40?: number
          chance_1_40_2_00?: number
          chance_15_00_35_00?: number
          chance_2_00_5_00?: number
          chance_5_00_15_00?: number
          created_at?: string | null
          id?: string
          max_multiplier?: number
          min_multiplier?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      crash_rounds: {
        Row: {
          crashed_at: string | null
          created_at: string | null
          id: string
          multiplier: number
          round_number: number
          started_at: string | null
          status: string
        }
        Insert: {
          crashed_at?: string | null
          created_at?: string | null
          id?: string
          multiplier: number
          round_number?: number
          started_at?: string | null
          status?: string
        }
        Update: {
          crashed_at?: string | null
          created_at?: string | null
          id?: string
          multiplier?: number
          round_number?: number
          started_at?: string | null
          status?: string
        }
        Relationships: []
      }
      daily_buff_wheel: {
        Row: {
          created_at: string
          id: string
          last_spin_at: string
          result_amount: number | null
          result_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_spin_at?: string
          result_amount?: number | null
          result_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_spin_at?: string
          result_amount?: number | null
          result_type?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_rewards: {
        Row: {
          created_at: string | null
          id: string
          last_claimed_at: string | null
          total_claimed: number | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_claimed_at?: string | null
          total_claimed?: number | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          last_claimed_at?: string | null
          total_claimed?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_rewards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_rewards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dice_config: {
        Row: {
          created_at: string | null
          house_edge: number
          id: string
          max_target: number
          min_target: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          house_edge?: number
          id?: string
          max_target?: number
          min_target?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          house_edge?: number
          id?: string
          max_target?: number
          min_target?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      email_accounts: {
        Row: {
          created_at: string
          display_name: string | null
          email: string
          id: string
          is_active: boolean | null
          last_used_at: string | null
          smtp_host: string
          smtp_password: string
          smtp_port: number
          smtp_user: string
          use_count: number | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email: string
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          smtp_host: string
          smtp_password: string
          smtp_port?: number
          smtp_user: string
          use_count?: number | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          smtp_host?: string
          smtp_password?: string
          smtp_port?: number
          smtp_user?: string
          use_count?: number | null
        }
        Relationships: []
      }
      game_history: {
        Row: {
          bet_amount: number
          client_seed: string | null
          created_at: string | null
          game_name: string
          game_number: number | null
          game_session_id: string | null
          id: string
          is_verified: boolean | null
          multiplier: number | null
          nonce: number | null
          server_seed_hash: string | null
          user_id: string
          win_amount: number | null
        }
        Insert: {
          bet_amount: number
          client_seed?: string | null
          created_at?: string | null
          game_name: string
          game_number?: number | null
          game_session_id?: string | null
          id?: string
          is_verified?: boolean | null
          multiplier?: number | null
          nonce?: number | null
          server_seed_hash?: string | null
          user_id: string
          win_amount?: number | null
        }
        Update: {
          bet_amount?: number
          client_seed?: string | null
          created_at?: string | null
          game_name?: string
          game_number?: number | null
          game_session_id?: string | null
          id?: string
          is_verified?: boolean | null
          multiplier?: number | null
          nonce?: number | null
          server_seed_hash?: string | null
          user_id?: string
          win_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "game_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_sessions: {
        Row: {
          bet_amount: number
          client_seed: string | null
          completed_at: string | null
          created_at: string | null
          game_name: string
          game_number: number | null
          game_state: Json | null
          id: string
          is_demo: boolean | null
          is_freebet: boolean | null
          nonce: number | null
          result: Json | null
          server_seed: string
          status: string
          user_id: string
          win_amount: number | null
        }
        Insert: {
          bet_amount: number
          client_seed?: string | null
          completed_at?: string | null
          created_at?: string | null
          game_name: string
          game_number?: number | null
          game_state?: Json | null
          id?: string
          is_demo?: boolean | null
          is_freebet?: boolean | null
          nonce?: number | null
          result?: Json | null
          server_seed: string
          status?: string
          user_id: string
          win_amount?: number | null
        }
        Update: {
          bet_amount?: number
          client_seed?: string | null
          completed_at?: string | null
          created_at?: string | null
          game_name?: string
          game_number?: number | null
          game_state?: Json | null
          id?: string
          is_demo?: boolean | null
          is_freebet?: boolean | null
          nonce?: number | null
          result?: Json | null
          server_seed?: string
          status?: string
          user_id?: string
          win_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "game_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_settings: {
        Row: {
          game_name: string
          id: string
          is_maintenance: boolean
          max_bet: number
          min_bet: number
          status: string
          updated_at: string | null
        }
        Insert: {
          game_name?: string
          id?: string
          is_maintenance?: boolean
          max_bet?: number
          min_bet?: number
          status?: string
          updated_at?: string | null
        }
        Update: {
          game_name?: string
          id?: string
          is_maintenance?: boolean
          max_bet?: number
          min_bet?: number
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      giveaway_participants: {
        Row: {
          created_at: string
          giveaway_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          giveaway_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          giveaway_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "giveaway_participants_giveaway_id_fkey"
            columns: ["giveaway_id"]
            isOneToOne: false
            referencedRelation: "giveaways"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "giveaway_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "giveaway_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      giveaway_wheel_spins: {
        Row: {
          created_at: string
          giveaway_id: string
          id: string
          result: string
          reward_amount: number | null
          reward_type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          giveaway_id: string
          id?: string
          result: string
          reward_amount?: number | null
          reward_type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          giveaway_id?: string
          id?: string
          result?: string
          reward_amount?: number | null
          reward_type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "giveaway_wheel_spins_giveaway_id_fkey"
            columns: ["giveaway_id"]
            isOneToOne: false
            referencedRelation: "giveaways"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "giveaway_wheel_spins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "giveaway_wheel_spins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      giveaways: {
        Row: {
          achievement_game: string | null
          achievement_start_at: string | null
          achievement_type: string | null
          created_at: string
          created_by: string
          description: string | null
          end_at: string | null
          finished_at: string | null
          giveaway_mode: string
          has_wheel: boolean | null
          id: string
          min_level: number | null
          participation_cost: number | null
          participation_type: string
          prize_amount: number | null
          prize_skin_id: string | null
          prize_type: string
          registration_ends_at: string | null
          status: string
          title: string
          wheel_segments: Json | null
          winner_id: string | null
        }
        Insert: {
          achievement_game?: string | null
          achievement_start_at?: string | null
          achievement_type?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          end_at?: string | null
          finished_at?: string | null
          giveaway_mode?: string
          has_wheel?: boolean | null
          id?: string
          min_level?: number | null
          participation_cost?: number | null
          participation_type?: string
          prize_amount?: number | null
          prize_skin_id?: string | null
          prize_type: string
          registration_ends_at?: string | null
          status?: string
          title: string
          wheel_segments?: Json | null
          winner_id?: string | null
        }
        Update: {
          achievement_game?: string | null
          achievement_start_at?: string | null
          achievement_type?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          end_at?: string | null
          finished_at?: string | null
          giveaway_mode?: string
          has_wheel?: boolean | null
          id?: string
          min_level?: number | null
          participation_cost?: number | null
          participation_type?: string
          prize_amount?: number | null
          prize_skin_id?: string | null
          prize_type?: string
          registration_ends_at?: string | null
          status?: string
          title?: string
          wheel_segments?: Json | null
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "giveaways_prize_skin_id_fkey"
            columns: ["prize_skin_id"]
            isOneToOne: false
            referencedRelation: "skins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "giveaways_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "giveaways_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hilo_config: {
        Row: {
          base_multiplier_increment: number
          created_at: string | null
          id: string
          max_win_multiplier: number
          updated_at: string | null
        }
        Insert: {
          base_multiplier_increment?: number
          created_at?: string | null
          id?: string
          max_win_multiplier?: number
          updated_at?: string | null
        }
        Update: {
          base_multiplier_increment?: number
          created_at?: string | null
          id?: string
          max_win_multiplier?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      image_cache: {
        Row: {
          content_type: string
          created_at: string
          data_base64: string
          key: string
          source_url: string
          updated_at: string
        }
        Insert: {
          content_type: string
          created_at?: string
          data_base64: string
          key: string
          source_url: string
          updated_at?: string
        }
        Update: {
          content_type?: string
          created_at?: string
          data_base64?: string
          key?: string
          source_url?: string
          updated_at?: string
        }
        Relationships: []
      }
      level_claims: {
        Row: {
          claimed_at: string | null
          id: string
          level: number
          user_id: string
        }
        Insert: {
          claimed_at?: string | null
          id?: string
          level: number
          user_id: string
        }
        Update: {
          claimed_at?: string | null
          id?: string
          level?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "level_claims_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "level_claims_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      level_rewards: {
        Row: {
          created_at: string | null
          id: string
          level: number
          reward_amount: number
          reward_type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          level: number
          reward_amount: number
          reward_type?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          level?: number
          reward_amount?: number
          reward_type?: string
        }
        Relationships: []
      }
      matches: {
        Row: {
          bo_format: string | null
          both_score_no_odds: number | null
          both_score_yes_odds: number | null
          created_at: string | null
          draw_odds: number | null
          exact_score_odds: Json | null
          handicap_value: number | null
          has_both_score: boolean | null
          has_draw: boolean | null
          has_handicap: boolean | null
          has_total: boolean | null
          id: string
          map1_betting_closed: boolean | null
          map1_handicaps: Json | null
          map1_over_odds: number | null
          map1_team1_odds: number | null
          map1_team1_score: number | null
          map1_team2_odds: number | null
          map1_team2_score: number | null
          map1_total_value: number | null
          map1_under_odds: number | null
          map2_betting_closed: boolean | null
          map2_handicaps: Json | null
          map2_over_odds: number | null
          map2_team1_odds: number | null
          map2_team1_score: number | null
          map2_team2_odds: number | null
          map2_team2_score: number | null
          map2_total_value: number | null
          map2_under_odds: number | null
          map3_betting_closed: boolean | null
          map3_handicaps: Json | null
          map3_over_odds: number | null
          map3_team1_odds: number | null
          map3_team1_score: number | null
          map3_team2_odds: number | null
          map3_team2_score: number | null
          map3_total_value: number | null
          map3_under_odds: number | null
          map4_betting_closed: boolean | null
          map4_handicaps: Json | null
          map4_over_odds: number | null
          map4_team1_odds: number | null
          map4_team1_score: number | null
          map4_team2_odds: number | null
          map4_team2_score: number | null
          map4_total_value: number | null
          map4_under_odds: number | null
          map5_betting_closed: boolean | null
          map5_handicaps: Json | null
          map5_over_odds: number | null
          map5_team1_odds: number | null
          map5_team1_score: number | null
          map5_team2_odds: number | null
          map5_team2_score: number | null
          map5_total_value: number | null
          map5_under_odds: number | null
          match_time: string
          over_odds: number | null
          sport: string
          status: string
          team1_handicap_odds: number | null
          team1_id: string
          team1_odds: number
          team1_score: number | null
          team2_handicap_odds: number | null
          team2_id: string
          team2_odds: number
          team2_score: number | null
          total_value: number | null
          under_odds: number | null
          updated_at: string | null
          winner: string | null
        }
        Insert: {
          bo_format?: string | null
          both_score_no_odds?: number | null
          both_score_yes_odds?: number | null
          created_at?: string | null
          draw_odds?: number | null
          exact_score_odds?: Json | null
          handicap_value?: number | null
          has_both_score?: boolean | null
          has_draw?: boolean | null
          has_handicap?: boolean | null
          has_total?: boolean | null
          id?: string
          map1_betting_closed?: boolean | null
          map1_handicaps?: Json | null
          map1_over_odds?: number | null
          map1_team1_odds?: number | null
          map1_team1_score?: number | null
          map1_team2_odds?: number | null
          map1_team2_score?: number | null
          map1_total_value?: number | null
          map1_under_odds?: number | null
          map2_betting_closed?: boolean | null
          map2_handicaps?: Json | null
          map2_over_odds?: number | null
          map2_team1_odds?: number | null
          map2_team1_score?: number | null
          map2_team2_odds?: number | null
          map2_team2_score?: number | null
          map2_total_value?: number | null
          map2_under_odds?: number | null
          map3_betting_closed?: boolean | null
          map3_handicaps?: Json | null
          map3_over_odds?: number | null
          map3_team1_odds?: number | null
          map3_team1_score?: number | null
          map3_team2_odds?: number | null
          map3_team2_score?: number | null
          map3_total_value?: number | null
          map3_under_odds?: number | null
          map4_betting_closed?: boolean | null
          map4_handicaps?: Json | null
          map4_over_odds?: number | null
          map4_team1_odds?: number | null
          map4_team1_score?: number | null
          map4_team2_odds?: number | null
          map4_team2_score?: number | null
          map4_total_value?: number | null
          map4_under_odds?: number | null
          map5_betting_closed?: boolean | null
          map5_handicaps?: Json | null
          map5_over_odds?: number | null
          map5_team1_odds?: number | null
          map5_team1_score?: number | null
          map5_team2_odds?: number | null
          map5_team2_score?: number | null
          map5_total_value?: number | null
          map5_under_odds?: number | null
          match_time: string
          over_odds?: number | null
          sport: string
          status?: string
          team1_handicap_odds?: number | null
          team1_id: string
          team1_odds?: number
          team1_score?: number | null
          team2_handicap_odds?: number | null
          team2_id: string
          team2_odds?: number
          team2_score?: number | null
          total_value?: number | null
          under_odds?: number | null
          updated_at?: string | null
          winner?: string | null
        }
        Update: {
          bo_format?: string | null
          both_score_no_odds?: number | null
          both_score_yes_odds?: number | null
          created_at?: string | null
          draw_odds?: number | null
          exact_score_odds?: Json | null
          handicap_value?: number | null
          has_both_score?: boolean | null
          has_draw?: boolean | null
          has_handicap?: boolean | null
          has_total?: boolean | null
          id?: string
          map1_betting_closed?: boolean | null
          map1_handicaps?: Json | null
          map1_over_odds?: number | null
          map1_team1_odds?: number | null
          map1_team1_score?: number | null
          map1_team2_odds?: number | null
          map1_team2_score?: number | null
          map1_total_value?: number | null
          map1_under_odds?: number | null
          map2_betting_closed?: boolean | null
          map2_handicaps?: Json | null
          map2_over_odds?: number | null
          map2_team1_odds?: number | null
          map2_team1_score?: number | null
          map2_team2_odds?: number | null
          map2_team2_score?: number | null
          map2_total_value?: number | null
          map2_under_odds?: number | null
          map3_betting_closed?: boolean | null
          map3_handicaps?: Json | null
          map3_over_odds?: number | null
          map3_team1_odds?: number | null
          map3_team1_score?: number | null
          map3_team2_odds?: number | null
          map3_team2_score?: number | null
          map3_total_value?: number | null
          map3_under_odds?: number | null
          map4_betting_closed?: boolean | null
          map4_handicaps?: Json | null
          map4_over_odds?: number | null
          map4_team1_odds?: number | null
          map4_team1_score?: number | null
          map4_team2_odds?: number | null
          map4_team2_score?: number | null
          map4_total_value?: number | null
          map4_under_odds?: number | null
          map5_betting_closed?: boolean | null
          map5_handicaps?: Json | null
          map5_over_odds?: number | null
          map5_team1_odds?: number | null
          map5_team1_score?: number | null
          map5_team2_odds?: number | null
          map5_team2_score?: number | null
          map5_total_value?: number | null
          map5_under_odds?: number | null
          match_time?: string
          over_odds?: number | null
          sport?: string
          status?: string
          team1_handicap_odds?: number | null
          team1_id?: string
          team1_odds?: number
          team1_score?: number | null
          team2_handicap_odds?: number | null
          team2_id?: string
          team2_odds?: number
          team2_score?: number | null
          total_value?: number | null
          under_odds?: number | null
          updated_at?: string | null
          winner?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_team1_id_fkey"
            columns: ["team1_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_team2_id_fkey"
            columns: ["team2_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      mines_config: {
        Row: {
          created_at: string | null
          grid_size: number
          house_edge_high: number
          house_edge_low: number
          house_edge_medium: number
          id: string
          max_mines: number
          max_multiplier: number
          min_mines: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          grid_size?: number
          house_edge_high?: number
          house_edge_low?: number
          house_edge_medium?: number
          id?: string
          max_mines?: number
          max_multiplier?: number
          min_mines?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          grid_size?: number
          house_edge_high?: number
          house_edge_low?: number
          house_edge_medium?: number
          id?: string
          max_mines?: number
          max_multiplier?: number
          min_mines?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      parlay_bet_items: {
        Row: {
          bet_type: string
          created_at: string | null
          id: string
          match_id: string
          odds: number
          original_bet_type: string | null
          original_odds: number | null
          parlay_bet_id: string
          status: string | null
        }
        Insert: {
          bet_type: string
          created_at?: string | null
          id?: string
          match_id: string
          odds: number
          original_bet_type?: string | null
          original_odds?: number | null
          parlay_bet_id: string
          status?: string | null
        }
        Update: {
          bet_type?: string
          created_at?: string | null
          id?: string
          match_id?: string
          odds?: number
          original_bet_type?: string | null
          original_odds?: number | null
          parlay_bet_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parlay_bet_items_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parlay_bet_items_parlay_bet_id_fkey"
            columns: ["parlay_bet_id"]
            isOneToOne: false
            referencedRelation: "parlay_bets"
            referencedColumns: ["id"]
          },
        ]
      }
      parlay_bets: {
        Row: {
          created_at: string | null
          id: string
          is_freebet: boolean | null
          potential_win: number
          status: string
          total_amount: number
          total_odds: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_freebet?: boolean | null
          potential_win: number
          status?: string
          total_amount: number
          total_odds: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_freebet?: boolean | null
          potential_win?: number
          status?: string
          total_amount?: number
          total_odds?: number
          user_id?: string
        }
        Relationships: []
      }
      preset_wheel_results: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          is_used: boolean | null
          preset_result: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_used?: boolean | null
          preset_result: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_used?: boolean | null
          preset_result?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "preset_wheel_results_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preset_wheel_results_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preset_wheel_results_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preset_wheel_results_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          balance: number
          betting_freebet_balance: number | null
          created_at: string | null
          demo_balance: number
          email: string | null
          email_verified_at: string | null
          freebet_balance: number | null
          gradient_color: string | null
          guaranteed_max_win: boolean | null
          id: string
          is_banned: boolean | null
          is_muted: boolean | null
          is_vip: boolean | null
          last_seen_message_at: string | null
          level: number
          profile_background: string | null
          public_id: number
          referral_code: string | null
          referred_by: string | null
          telegram_id: number
          total_losses: number | null
          total_wins: number | null
          updated_at: string | null
          username: string
          wager_progress: number | null
          wager_requirement: number | null
          xp: number
        }
        Insert: {
          avatar_url?: string | null
          balance?: number
          betting_freebet_balance?: number | null
          created_at?: string | null
          demo_balance?: number
          email?: string | null
          email_verified_at?: string | null
          freebet_balance?: number | null
          gradient_color?: string | null
          guaranteed_max_win?: boolean | null
          id?: string
          is_banned?: boolean | null
          is_muted?: boolean | null
          is_vip?: boolean | null
          last_seen_message_at?: string | null
          level?: number
          profile_background?: string | null
          public_id: number
          referral_code?: string | null
          referred_by?: string | null
          telegram_id: number
          total_losses?: number | null
          total_wins?: number | null
          updated_at?: string | null
          username?: string
          wager_progress?: number | null
          wager_requirement?: number | null
          xp?: number
        }
        Update: {
          avatar_url?: string | null
          balance?: number
          betting_freebet_balance?: number | null
          created_at?: string | null
          demo_balance?: number
          email?: string | null
          email_verified_at?: string | null
          freebet_balance?: number | null
          gradient_color?: string | null
          guaranteed_max_win?: boolean | null
          id?: string
          is_banned?: boolean | null
          is_muted?: boolean | null
          is_vip?: boolean | null
          last_seen_message_at?: string | null
          level?: number
          profile_background?: string | null
          public_id?: number
          referral_code?: string | null
          referred_by?: string | null
          telegram_id?: number
          total_losses?: number | null
          total_wins?: number | null
          updated_at?: string | null
          username?: string
          wager_progress?: number | null
          wager_requirement?: number | null
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      promocode_activations: {
        Row: {
          activated_at: string
          id: string
          promocode_id: string
          user_id: string
        }
        Insert: {
          activated_at?: string
          id?: string
          promocode_id: string
          user_id: string
        }
        Update: {
          activated_at?: string
          id?: string
          promocode_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promocode_activations_promocode_id_fkey"
            columns: ["promocode_id"]
            isOneToOne: false
            referencedRelation: "promocodes"
            referencedColumns: ["id"]
          },
        ]
      }
      promocodes: {
        Row: {
          code: string
          created_at: string
          current_uses: number
          id: string
          is_active: boolean
          max_uses: number | null
          reward_amount: number
          reward_type: string
        }
        Insert: {
          code: string
          created_at?: string
          current_uses?: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          reward_amount?: number
          reward_type: string
        }
        Update: {
          code?: string
          created_at?: string
          current_uses?: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          reward_amount?: number
          reward_type?: string
        }
        Relationships: []
      }
      referral_rewards: {
        Row: {
          claimed: boolean | null
          claimed_at: string | null
          created_at: string | null
          id: string
          referred_id: string
          referrer_id: string
          reward_amount: number
        }
        Insert: {
          claimed?: boolean | null
          claimed_at?: string | null
          created_at?: string | null
          id?: string
          referred_id: string
          referrer_id: string
          reward_amount?: number
        }
        Update: {
          claimed?: boolean | null
          claimed_at?: string | null
          created_at?: string | null
          id?: string
          referred_id?: string
          referrer_id?: string
          reward_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "referral_rewards_referred_id_fkey"
            columns: ["referred_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_rewards_referred_id_fkey"
            columns: ["referred_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_rewards_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_rewards_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      registration_wheel: {
        Row: {
          claimed_at: string
          id: string
          reward_amount: number
          reward_description: string
          reward_type: string
          user_id: string
        }
        Insert: {
          claimed_at?: string
          id?: string
          reward_amount: number
          reward_description: string
          reward_type: string
          user_id: string
        }
        Update: {
          claimed_at?: string
          id?: string
          reward_amount?: number
          reward_description?: string
          reward_type?: string
          user_id?: string
        }
        Relationships: []
      }
      roulette_config: {
        Row: {
          color_multiplier: number
          column_multiplier: number
          created_at: string | null
          dozen_multiplier: number
          id: string
          number_multiplier: number
          updated_at: string | null
        }
        Insert: {
          color_multiplier?: number
          column_multiplier?: number
          created_at?: string | null
          dozen_multiplier?: number
          id?: string
          number_multiplier?: number
          updated_at?: string | null
        }
        Update: {
          color_multiplier?: number
          column_multiplier?: number
          created_at?: string | null
          dozen_multiplier?: number
          id?: string
          number_multiplier?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      roulette_history: {
        Row: {
          color: string
          created_at: string
          id: string
          number: number
        }
        Insert: {
          color: string
          created_at?: string
          id?: string
          number: number
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          number?: number
        }
        Relationships: []
      }
      skins: {
        Row: {
          category: string
          created_at: string | null
          id: string
          image_url: string | null
          name: string
          price: number
          rarity: string
          weapon: string
        }
        Insert: {
          category: string
          created_at?: string | null
          id?: string
          image_url?: string | null
          name: string
          price?: number
          rarity: string
          weapon: string
        }
        Update: {
          category?: string
          created_at?: string | null
          id?: string
          image_url?: string | null
          name?: string
          price?: number
          rarity?: string
          weapon?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          created_at: string
          id: string
          is_admin: boolean
          message: string
          ticket_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_admin?: boolean
          message: string
          ticket_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_admin?: boolean
          message?: string
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          created_at: string
          id: string
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      system_notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          buff_duration_hours: number | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_daily: boolean
          reward_amount: number
          reward_type: string
          sort_order: number | null
          target_game: string | null
          target_value: number
          task_type: string
          title: string
          updated_at: string
        }
        Insert: {
          buff_duration_hours?: number | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_daily?: boolean
          reward_amount?: number
          reward_type: string
          sort_order?: number | null
          target_game?: string | null
          target_value?: number
          task_type: string
          title: string
          updated_at?: string
        }
        Update: {
          buff_duration_hours?: number | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_daily?: boolean
          reward_amount?: number
          reward_type?: string
          sort_order?: number | null
          target_game?: string | null
          target_value?: number
          task_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      teams: {
        Row: {
          created_at: string | null
          id: string
          logo_url: string
          name: string
          sport: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          logo_url: string
          name: string
          sport: string
        }
        Update: {
          created_at?: string | null
          id?: string
          logo_url?: string
          name?: string
          sport?: string
        }
        Relationships: []
      }
      towers_config: {
        Row: {
          columns_count: number
          created_at: string | null
          id: string
          mines_per_row: number
          multipliers: Json
          rows_count: number
          updated_at: string | null
        }
        Insert: {
          columns_count?: number
          created_at?: string | null
          id?: string
          mines_per_row?: number
          multipliers?: Json
          rows_count?: number
          updated_at?: string | null
        }
        Update: {
          columns_count?: number
          created_at?: string | null
          id?: string
          mines_per_row?: number
          multipliers?: Json
          rows_count?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string | null
          description: string | null
          id: string
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          description?: string | null
          id?: string
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string | null
          id?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_achievements: {
        Row: {
          achievement_id: string
          claimed_at: string | null
          completed_at: string | null
          created_at: string
          id: string
          is_claimed: boolean
          is_completed: boolean
          progress: number
          user_id: string
        }
        Insert: {
          achievement_id: string
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          is_claimed?: boolean
          is_completed?: boolean
          progress?: number
          user_id: string
        }
        Update: {
          achievement_id?: string
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          is_claimed?: boolean
          is_completed?: boolean
          progress?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_achievements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_achievements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_bets: {
        Row: {
          bet_amount: number
          bet_type: string
          created_at: string | null
          handicap_value: number | null
          id: string
          is_freebet: boolean | null
          match_id: string
          odds: number
          potential_win: number
          status: string
          user_id: string
        }
        Insert: {
          bet_amount: number
          bet_type: string
          created_at?: string | null
          handicap_value?: number | null
          id?: string
          is_freebet?: boolean | null
          match_id: string
          odds: number
          potential_win: number
          status?: string
          user_id: string
        }
        Update: {
          bet_amount?: number
          bet_type?: string
          created_at?: string | null
          handicap_value?: number | null
          id?: string
          is_freebet?: boolean | null
          match_id?: string
          odds?: number
          potential_win?: number
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_bets_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      user_buffs: {
        Row: {
          buff_type: string
          created_at: string
          expires_at: string
          given_by: string | null
          id: string
          user_id: string
        }
        Insert: {
          buff_type: string
          created_at?: string
          expires_at: string
          given_by?: string | null
          id?: string
          user_id: string
        }
        Update: {
          buff_type?: string
          created_at?: string
          expires_at?: string
          given_by?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_buffs_given_by_fkey"
            columns: ["given_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_buffs_given_by_fkey"
            columns: ["given_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_buffs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_buffs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_freespins: {
        Row: {
          created_at: string
          freespin_bet_amount: number | null
          freespins_count: number
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          freespin_bet_amount?: number | null
          freespins_count?: number
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          freespin_bet_amount?: number | null
          freespins_count?: number
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_game_restrictions: {
        Row: {
          created_at: string | null
          game_name: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          game_name: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          game_name?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_game_restrictions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_game_restrictions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_inventory: {
        Row: {
          id: string
          is_demo: boolean | null
          purchased_at: string | null
          purchased_price: number
          skin_id: string
          user_id: string
        }
        Insert: {
          id?: string
          is_demo?: boolean | null
          purchased_at?: string | null
          purchased_price?: number
          skin_id: string
          user_id: string
        }
        Update: {
          id?: string
          is_demo?: boolean | null
          purchased_at?: string | null
          purchased_price?: number
          skin_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_inventory_skin_id_fkey"
            columns: ["skin_id"]
            isOneToOne: false
            referencedRelation: "skins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_inventory_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_inventory_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_moderation: {
        Row: {
          ban_reason: string | null
          banned_by: string | null
          created_at: string
          id: string
          is_banned: boolean
          mute_reason: string | null
          muted_by: string | null
          muted_until: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ban_reason?: string | null
          banned_by?: string | null
          created_at?: string
          id?: string
          is_banned?: boolean
          mute_reason?: string | null
          muted_by?: string | null
          muted_until?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ban_reason?: string | null
          banned_by?: string | null
          created_at?: string
          id?: string
          is_banned?: boolean
          mute_reason?: string | null
          muted_by?: string | null
          muted_until?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_moderation_banned_by_fkey"
            columns: ["banned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_moderation_banned_by_fkey"
            columns: ["banned_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_moderation_muted_by_fkey"
            columns: ["muted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_moderation_muted_by_fkey"
            columns: ["muted_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_moderation_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_moderation_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_rate_limits: {
        Row: {
          action_count: number | null
          action_type: string
          id: string
          last_action_at: string | null
          user_id: string
        }
        Insert: {
          action_count?: number | null
          action_type: string
          id?: string
          last_action_at?: string | null
          user_id: string
        }
        Update: {
          action_count?: number | null
          action_type?: string
          id?: string
          last_action_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_rate_limits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_rate_limits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_sessions: {
        Row: {
          created_at: string | null
          device_info: string | null
          id: string
          is_active: boolean | null
          last_active_at: string | null
          session_token: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device_info?: string | null
          id?: string
          is_active?: boolean | null
          last_active_at?: string | null
          session_token: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          device_info?: string | null
          id?: string
          is_active?: boolean | null
          last_active_at?: string | null
          session_token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_task_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          is_completed: boolean
          last_reset_at: string | null
          progress: number
          task_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          is_completed?: boolean
          last_reset_at?: string | null
          progress?: number
          task_id: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          is_completed?: boolean
          last_reset_at?: string | null
          progress?: number
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_task_progress_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_task_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_task_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_codes: {
        Row: {
          code: string
          created_at: string
          email: string
          expires_at: string
          id: string
          used: boolean | null
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          used?: boolean | null
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          used?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawal_requests: {
        Row: {
          amount: number
          comment: string | null
          created_at: string | null
          id: string
          payment_details: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          comment?: string | null
          created_at?: string | null
          id?: string
          payment_details: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          comment?: string | null
          created_at?: string | null
          id?: string
          payment_details?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          gradient_color: string | null
          id: string | null
          is_vip: boolean | null
          level: number | null
          profile_background: string | null
          public_id: number | null
          total_losses: number | null
          total_wins: number | null
          username: string | null
          xp: number | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          gradient_color?: string | null
          id?: string | null
          is_vip?: boolean | null
          level?: number | null
          profile_background?: string | null
          public_id?: number | null
          total_losses?: number | null
          total_wins?: number | null
          username?: string | null
          xp?: number | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          gradient_color?: string | null
          id?: string | null
          is_vip?: boolean | null
          level?: number | null
          profile_background?: string | null
          public_id?: number | null
          total_losses?: number | null
          total_wins?: number | null
          username?: string | null
          xp?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      acquire_game_lock: {
        Args: { _game_name: string; _game_session_id: string; _user_id: string }
        Returns: Json
      }
      add_freespins: {
        Args: { _bet_amount?: number; _count: number; _user_id: string }
        Returns: {
          success: boolean
          total_spins: number
        }[]
      }
      add_streak_bonus_wins: {
        Args: { _bonus_wins: number; _giveaway_id: string; _user_id: string }
        Returns: Json
      }
      add_user_xp:
        | {
            Args: { _user_id: string; _xp_amount: number }
            Returns: {
              leveled_up: boolean
              new_level: number
              new_xp: number
              old_level: number
            }[]
          }
        | { Args: { _user_id: string; _xp_amount: number }; Returns: undefined }
      admin_add_email_account: {
        Args: {
          _admin_id: string
          _display_name?: string
          _email: string
          _smtp_host: string
          _smtp_password: string
          _smtp_port: number
          _smtp_user: string
        }
        Returns: Json
      }
      admin_add_game_restriction: {
        Args: { _admin_id: string; _game_name: string; _target_user_id: string }
        Returns: Json
      }
      admin_add_game_win: {
        Args: {
          _admin_id: string
          _bet_amount?: number
          _game_name: string
          _multiplier?: number
          _target_user_id: string
          _win_amount?: number
        }
        Returns: Json
      }
      admin_ban_user: {
        Args: {
          _admin_id: string
          _ban: boolean
          _reason?: string
          _target_user_id: string
        }
        Returns: {
          message: string
          success: boolean
        }[]
      }
      admin_create_match: {
        Args: { _admin_id: string; _match_data: Json }
        Returns: Json
      }
      admin_create_promocode: {
        Args: {
          _admin_id: string
          _code: string
          _max_uses?: number
          _reward_amount: number
          _reward_type: string
        }
        Returns: Json
      }
      admin_create_task: {
        Args: {
          _admin_id: string
          _buff_duration_hours?: number
          _description: string
          _is_daily?: boolean
          _reward_amount: number
          _reward_type: string
          _sort_order?: number
          _target_game: string
          _target_value: number
          _task_type: string
          _title: string
        }
        Returns: Json
      }
      admin_create_team: {
        Args: {
          _admin_id: string
          _logo_url: string
          _name: string
          _sport: string
        }
        Returns: Json
      }
      admin_deduct_freebet: {
        Args: {
          _admin_id: string
          _amount: number
          _freebet_type?: string
          _target_user_id: string
        }
        Returns: {
          message: string
          success: boolean
        }[]
      }
      admin_delete_email_account: {
        Args: { _admin_id: string; _email_id: string }
        Returns: Json
      }
      admin_delete_match: {
        Args: { _admin_id: string; _match_id: string }
        Returns: Json
      }
      admin_delete_match_safe: {
        Args: { _admin_id: string; _match_id: string }
        Returns: Json
      }
      admin_delete_promocode: {
        Args: { _admin_id: string; _promocode_id: string }
        Returns: Json
      }
      admin_delete_task: {
        Args: { _admin_id: string; _task_id: string }
        Returns: Json
      }
      admin_delete_team: {
        Args: { _admin_id: string; _team_id: string }
        Returns: Json
      }
      admin_finish_match: {
        Args: {
          _admin_id: string
          _map_scores?: Json
          _match_id: string
          _team1_score: number
          _team2_score: number
          _winner: string
        }
        Returns: Json
      }
      admin_get_email_accounts: { Args: { _admin_id: string }; Returns: Json }
      admin_get_withdrawal_requests: {
        Args: never
        Returns: {
          amount: number
          created_at: string
          details: string
          id: string
          method: string
          processed_at: string
          status: string
          user_id: string
          username: string
        }[]
      }
      admin_get_withdrawal_requests_v2: {
        Args: { _admin_user_id: string }
        Returns: {
          amount: number
          created_at: string
          details: string
          id: string
          method: string
          processed_at: string
          status: string
          user_id: string
          username: string
        }[]
      }
      admin_get_withdrawal_requests_v3: {
        Args: { _admin_id: string }
        Returns: {
          amount: number
          comment: string
          created_at: string
          id: string
          payment_details: string
          payment_method: string
          status: string
          updated_at: string
          user_id: string
          username: string
        }[]
      }
      admin_give_buff: {
        Args: {
          _admin_id: string
          _buff_type: string
          _duration_hours: number
          _target_user_id: string
        }
        Returns: Json
      }
      admin_give_buff_to_all: {
        Args: {
          _admin_id: string
          _buff_type?: string
          _duration_hours?: number
          _giveaway_id: string
        }
        Returns: Json
      }
      admin_give_freebet: {
        Args: {
          _admin_id: string
          _amount: number
          _description?: string
          _freebet_type?: string
          _target_user_id: string
        }
        Returns: {
          message: string
          success: boolean
        }[]
      }
      admin_give_giveaway_win: {
        Args: {
          _admin_id: string
          _giveaway_id: string
          _target_user_id: string
        }
        Returns: Json
      }
      admin_give_skin: {
        Args: { _admin_id: string; _skin_id: string; _target_user_id: string }
        Returns: Json
      }
      admin_give_wheel: {
        Args: { _admin_id: string; _count?: number; _target_user_id: string }
        Returns: {
          message: string
          success: boolean
        }[]
      }
      admin_grant_black_crow_access: {
        Args: { _admin_id: string; _target_user_id: string }
        Returns: Json
      }
      admin_list_wheel_presets: {
        Args: { p_admin_id: string; p_session_token: string }
        Returns: {
          created_at: string
          gradient_color: string
          id: string
          is_used: boolean
          is_vip: boolean
          preset_result: string
          public_id: number
          user_id: string
          username: string
        }[]
      }
      admin_modify_balance: {
        Args: {
          _admin_id: string
          _amount: number
          _reason?: string
          _target_user_id: string
        }
        Returns: {
          message: string
          success: boolean
        }[]
      }
      admin_modify_xp: {
        Args: { _admin_id: string; _target_user_id: string; _xp_amount: number }
        Returns: {
          message: string
          success: boolean
        }[]
      }
      admin_mute_user: {
        Args: {
          _admin_id: string
          _mute_seconds?: number
          _target_user_id: string
        }
        Returns: {
          message: string
          success: boolean
        }[]
      }
      admin_remove_buff: {
        Args: { _admin_id: string; _target_user_id: string }
        Returns: Json
      }
      admin_remove_game_restriction: {
        Args: { _admin_id: string; _restriction_id: string }
        Returns: Json
      }
      admin_remove_wheel_preset: {
        Args: {
          p_admin_id: string
          p_session_token: string
          p_target_user_id: string
        }
        Returns: Json
      }
      admin_revoke_black_crow_access: {
        Args: { _admin_id: string; _target_user_id: string }
        Returns: Json
      }
      admin_set_bet_status: {
        Args: { _bet_id: string; _is_parlay?: boolean; _status: string }
        Returns: Json
      }
      admin_set_match_live: {
        Args: { _admin_id: string; _match_id: string }
        Returns: Json
      }
      admin_set_parlay_item_status: {
        Args: { _item_id: string; _status: string }
        Returns: Json
      }
      admin_set_vip: {
        Args: { _is_vip: boolean; _user_id: string }
        Returns: undefined
      }
      admin_set_wheel_preset: {
        Args: {
          p_admin_id: string
          p_preset_result: string
          p_session_token: string
          p_target_user_id: string
        }
        Returns: Json
      }
      admin_toggle_game_status: {
        Args: { _admin_id: string; _game_id: string; _status: string }
        Returns: Json
      }
      admin_toggle_promocode: {
        Args: { _admin_id: string; _is_active: boolean; _promocode_id: string }
        Returns: Json
      }
      admin_toggle_task: {
        Args: { _admin_id: string; _is_active: boolean; _task_id: string }
        Returns: Json
      }
      admin_update_balance: {
        Args: { _amount: number; _user_id: string }
        Returns: undefined
      }
      admin_update_match: {
        Args: { _admin_id: string; _match_data: Json; _match_id: string }
        Returns: Json
      }
      admin_update_withdrawal_status: {
        Args: { _admin_id: string; _new_status: string; _request_id: string }
        Returns: Json
      }
      apply_referral_code: {
        Args: { _referral_code: string; _user_id: string }
        Returns: {
          message: string
          success: boolean
        }[]
      }
      approve_withdrawal_request: {
        Args: { _admin_id: string; _request_id: string }
        Returns: {
          message: string
          success: boolean
        }[]
      }
      auto_calculate_bets: {
        Args: { _match_id: string }
        Returns: {
          processed: number
        }[]
      }
      auto_calculate_parlay_bets: {
        Args: { _parlay_bet_id: string }
        Returns: {
          message: string
          success: boolean
        }[]
      }
      auto_create_crash_round: { Args: never; Returns: undefined }
      auto_finish_giveaway: { Args: { _giveaway_id: string }; Returns: Json }
      blackjack_double: { Args: { _session_id: string }; Returns: Json }
      blackjack_hit: { Args: { _session_id: string }; Returns: Json }
      blackjack_stand: { Args: { _session_id: string }; Returns: Json }
      buy_bonus: {
        Args: {
          _bonus_type: string
          _bonus_value: number
          _price: number
          _user_id: string
        }
        Returns: {
          message: string
          success: boolean
        }[]
      }
      buy_skin:
        | {
            Args: { _skin_id: string; _use_freebet?: boolean; _user_id: string }
            Returns: Json
          }
        | {
            Args: {
              _skin_id: string
              _use_demo?: boolean
              _use_freebet?: boolean
              _user_id: string
            }
            Returns: Json
          }
      calculate_all_parlay_bets: {
        Args: never
        Returns: {
          lost: number
          processed: number
          won: number
        }[]
      }
      calculate_blackjack_value: { Args: { _cards: number[] }; Returns: number }
      calculate_level: { Args: { _xp: number }; Returns: number }
      can_send_chat_message: { Args: { _user_id: string }; Returns: Json }
      cashout_balloon: {
        Args: { _session_id: string; _user_id: string }
        Returns: Json
      }
      cashout_chicken_road: { Args: { _session_id: string }; Returns: Json }
      cashout_crash_bet: {
        Args: {
          _current_multiplier: number
          _round_id: string
          _user_id: string
        }
        Returns: {
          message: string
          success: boolean
          win_amount: number
        }[]
      }
      cashout_hilo: {
        Args: { _session_id: string; _user_id: string }
        Returns: Json
      }
      cashout_mines:
        | { Args: { _session_id: string; _user_id: string }; Returns: Json }
        | {
            Args: {
              _bet_amount: number
              _multiplier: number
              _use_demo?: boolean
              _use_freebet?: boolean
              _user_id: string
            }
            Returns: Json
          }
      cashout_towers: {
        Args: { _session_id: string; _user_id: string }
        Returns: Json
      }
      check_black_crow_access: { Args: { _user_id: string }; Returns: boolean }
      check_email_for_bonus: { Args: { _user_id: string }; Returns: Json }
      check_rate_limit: {
        Args: {
          _action_type: string
          _min_interval_ms?: number
          _user_id: string
        }
        Returns: boolean
      }
      chicken_road_step: {
        Args: { _column: number; _session_id: string }
        Returns: Json
      }
      claim_achievement_reward: {
        Args: { p_achievement_id: string }
        Returns: Json
      }
      claim_freespins: { Args: { _user_id: string }; Returns: Json }
      cleanup_expired_codes: { Args: never; Returns: undefined }
      cleanup_expired_game_locks: { Args: never; Returns: number }
      cleanup_old_crash_rounds: { Args: never; Returns: undefined }
      cleanup_old_roulette_history: { Args: never; Returns: undefined }
      complete_game_session:
        | {
            Args: {
              _multiplier?: number
              _result: Json
              _session_id: string
              _win_amount: number
            }
            Returns: Json
          }
        | {
            Args: {
              _multiplier: number
              _result?: Json
              _session_id: string
              _user_id: string
              _win_amount: number
            }
            Returns: Json
          }
      create_betting_tournament: {
        Args: {
          _admin_id: string
          _description?: string
          _duration_hours?: number
          _min_bet_amount?: number
          _prize_amount?: number
          _prize_type?: string
          _title: string
        }
        Returns: Json
      }
      create_crash_round: { Args: never; Returns: Json }
      create_profile_with_username: {
        Args: {
          _first_name?: string
          _last_name?: string
          _telegram_id: number
          _username: string
        }
        Returns: {
          message: string
          profile_id: string
          success: boolean
        }[]
      }
      create_user_session: {
        Args: { p_device_info?: string; p_user_id: string }
        Returns: {
          is_new_session: boolean
          session_token: string
        }[]
      }
      create_withdrawal_request: {
        Args: {
          _amount: number
          _details: string
          _method: string
          _user_id: string
        }
        Returns: Json
      }
      delete_user_profile: { Args: { _user_id: string }; Returns: undefined }
      enforce_rate_limit: {
        Args: {
          _action_type: string
          _min_interval_ms?: number
          _user_id: string
        }
        Returns: undefined
      }
      find_game_by_number: {
        Args: { _game_number: number }
        Returns: {
          bet_amount: number
          created_at: string
          game_name: string
          game_number: number
          multiplier: number
          revealed_seed: string
          server_seed: string
          win_amount: number
        }[]
      }
      finish_betting_tournament: {
        Args: { _admin_id: string; _tournament_id: string }
        Returns: Json
      }
      finish_giveaway: {
        Args: { _admin_id: string; _giveaway_id: string; _winner_id: string }
        Returns: Json
      }
      generate_crash_point: { Args: never; Returns: number }
      generate_referral_code: { Args: never; Returns: string }
      generate_server_seed: { Args: never; Returns: string }
      generate_unique_public_id: { Args: never; Returns: number }
      generate_verification_code: { Args: never; Returns: string }
      get_betting_tournament_leaderboard: {
        Args: { _tournament_id: string }
        Returns: {
          biggest_win: number
          gradient_color: string
          is_vip: boolean
          level: number
          rank: number
          total_bets: number
          total_wins: number
          user_id: string
          username: string
        }[]
      }
      get_crash_bets_for_round: {
        Args: { _round_id: string }
        Returns: {
          auto_cashout: number
          bet_amount: number
          cashed_out_at: number
          id: string
          is_freebet: boolean
          status: string
          user_id: string
          username: string
          win_amount: number
        }[]
      }
      get_crash_state: { Args: never; Returns: Json }
      get_giveaway_leaderboard: {
        Args: { _giveaway_id: string }
        Returns: {
          buff_type: string
          gradient_color: string
          has_buff: boolean
          is_vip: boolean
          level: number
          score: number
          user_id: string
          username: string
        }[]
      }
      get_live_winners: {
        Args: { _limit?: number }
        Returns: {
          bet_amount: number
          created_at: string
          game_name: string
          gradient_color: string
          is_admin: boolean
          is_vip: boolean
          multiplier: number
          username: string
          win_amount: number
        }[]
      }
      get_my_withdrawal_requests: {
        Args: { _user_id: string }
        Returns: {
          amount: number
          created_at: string
          id: string
          method: string
          processed_at: string
          status: string
        }[]
      }
      get_or_create_profile_by_telegram: {
        Args: {
          _first_name?: string
          _last_name?: string
          _telegram_id: number
          _username: string
        }
        Returns: string
      }
      get_parlay_items: {
        Args: { _parlay_bet_id: string }
        Returns: {
          bet_type: string
          id: string
          match_id: string
          odds: number
          original_bet_type: string
          original_odds: number
          status: string
        }[]
      }
      get_player_win_streak: {
        Args: { _giveaway_id: string; _user_id: string }
        Returns: Json
      }
      get_profile_by_id: {
        Args: { _user_id: string }
        Returns: {
          avatar_url: string
          balance: number
          betting_freebet_balance: number
          created_at: string
          demo_balance: number
          email: string
          email_verified_at: string
          freebet_balance: number
          gradient_color: string
          guaranteed_max_win: boolean
          id: string
          is_banned: boolean
          is_muted: boolean
          is_vip: boolean
          level: number
          profile_background: string
          public_id: number
          referral_code: string
          referred_by: string
          telegram_id: number
          total_losses: number
          total_wins: number
          user_roles: Json
          username: string
          wager_progress: number
          wager_requirement: number
          xp: number
        }[]
      }
      get_profile_by_telegram: {
        Args: { _telegram_id: number }
        Returns: {
          balance: number
          betting_freebet_balance: number
          created_at: string
          freebet_balance: number
          gradient_color: string
          guaranteed_max_win: boolean
          id: string
          is_banned: boolean
          is_muted: boolean
          is_vip: boolean
          level: number
          public_id: number
          referral_code: string
          telegram_id: number
          total_losses: number
          total_wins: number
          username: string
          wager_progress: number
          wager_requirement: number
          xp: number
        }[]
      }
      get_profile_by_telegram_id: {
        Args: { _telegram_id: number }
        Returns: {
          avatar_url: string
          balance: number
          betting_freebet_balance: number
          created_at: string
          demo_balance: number
          email: string
          email_verified_at: string
          freebet_balance: number
          gradient_color: string
          guaranteed_max_win: boolean
          id: string
          is_banned: boolean
          is_muted: boolean
          is_vip: boolean
          level: number
          profile_background: string
          public_id: number
          referral_code: string
          referred_by: string
          telegram_id: number
          total_losses: number
          total_wins: number
          username: string
          wager_progress: number
          wager_requirement: number
          xp: number
        }[]
      }
      get_random_email_account: {
        Args: never
        Returns: {
          display_name: string
          email: string
          id: string
          smtp_host: string
          smtp_password: string
          smtp_port: number
          smtp_user: string
        }[]
      }
      get_session_game_number: {
        Args: { p_session_id: string }
        Returns: number
      }
      get_ticket_messages: {
        Args: { _ticket_id: string; _user_id: string }
        Returns: {
          created_at: string
          id: string
          is_admin: boolean
          message: string
        }[]
      }
      get_top_winners_today: {
        Args: { _limit?: number }
        Returns: {
          gradient_color: string
          is_vip: boolean
          total_winnings: number
          user_id: string
          username: string
        }[]
      }
      get_user_bets: {
        Args: { _user_id: string }
        Returns: {
          bet_amount: number
          bet_type: string
          created_at: string
          handicap_value: number
          id: string
          is_freebet: boolean
          match_id: string
          odds: number
          potential_win: number
          status: string
        }[]
      }
      get_user_bonus_wheels: {
        Args: { _user_id: string }
        Returns: {
          created_at: string
          id: string
          is_used: boolean
          reward_amount: number
          reward_description: string
          reward_type: string
          used_at: string
        }[]
      }
      get_user_buff_multiplier: { Args: { _user_id: string }; Returns: number }
      get_user_daily_reward: {
        Args: { _user_id: string }
        Returns: {
          id: string
          last_claimed_at: string
          total_claimed: number
        }[]
      }
      get_user_freespins: {
        Args: { _user_id: string }
        Returns: {
          freespin_bet_amount: number
          freespins_count: number
          id: string
        }[]
      }
      get_user_game_history: {
        Args: { _limit?: number; _user_id: string }
        Returns: {
          bet_amount: number
          created_at: string
          game_name: string
          id: string
          multiplier: number
          win_amount: number
        }[]
      }
      get_user_game_history_v2: {
        Args: { _limit?: number; _user_id: string }
        Returns: {
          bet_amount: number
          created_at: string
          game_name: string
          game_number: number
          id: string
          multiplier: number
          win_amount: number
        }[]
      }
      get_user_inventory: {
        Args: { _user_id: string }
        Returns: {
          id: string
          purchased_at: string
          purchased_price: number
          skin_category: string
          skin_id: string
          skin_image_url: string
          skin_name: string
          skin_price: number
          skin_rarity: string
          skin_weapon: string
        }[]
      }
      get_user_notifications: {
        Args: { _user_id: string }
        Returns: {
          created_at: string
          id: string
          is_read: boolean
          message: string
        }[]
      }
      get_user_parlays: {
        Args: { _user_id: string }
        Returns: {
          created_at: string
          id: string
          is_freebet: boolean
          potential_win: number
          status: string
          total_amount: number
          total_odds: number
        }[]
      }
      get_user_registration_wheel: {
        Args: { _user_id: string }
        Returns: {
          claimed_at: string
          id: string
          reward_amount: number
          reward_description: string
          reward_type: string
        }[]
      }
      get_user_support_tickets: {
        Args: { _user_id: string }
        Returns: {
          created_at: string
          id: string
          status: string
          subject: string
          updated_at: string
        }[]
      }
      get_user_tasks: {
        Args: { _user_id: string }
        Returns: {
          buff_duration_hours: number
          can_claim: boolean
          description: string
          id: string
          is_completed: boolean
          is_daily: boolean
          progress: number
          reward_amount: number
          reward_type: string
          target_game: string
          target_value: number
          task_type: string
          title: string
        }[]
      }
      get_user_transactions: {
        Args: { _user_id: string }
        Returns: {
          amount: number
          created_at: string
          description: string
          id: string
          type: string
        }[]
      }
      get_user_withdrawals: {
        Args: { _user_id: string }
        Returns: {
          amount: number
          comment: string
          created_at: string
          id: string
          payment_details: string
          status: string
          updated_at: string
        }[]
      }
      give_demo_balance: {
        Args: { _admin_id: string; _amount: number; _target_user_id: string }
        Returns: {
          amount: number
          message: string
          success: boolean
        }[]
      }
      guess_hilo: {
        Args: { _guess: string; _session_id: string; _user_id: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hash_seed: { Args: { _seed: string }; Returns: string }
      invalidate_user_session: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_email_verified: { Args: { _user_id: string }; Returns: boolean }
      is_profile_admin: { Args: { _profile_id: string }; Returns: boolean }
      join_giveaway: {
        Args: { _giveaway_id: string; _user_id: string }
        Returns: Json
      }
      lose_mines: {
        Args: { _bet_amount: number; _user_id: string }
        Returns: Json
      }
      make_first_admin: { Args: never; Returns: undefined }
      mark_email_used: { Args: { _email_id: string }; Returns: undefined }
      normalize_game_name: { Args: { _name: string }; Returns: string }
      notify_all_admins: { Args: { _message: string }; Returns: undefined }
      notify_user_action: {
        Args: { _message: string; _user_id: string }
        Returns: undefined
      }
      open_case:
        | {
            Args: {
              _case_type_id: string
              _use_freebet?: boolean
              _user_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              _case_type_id: string
              _use_demo?: boolean
              _use_freebet?: boolean
              _user_id: string
            }
            Returns: Json
          }
      place_bet:
        | {
            Args: {
              _bet_amount: number
              _bet_type: string
              _match_id: string
              _odds: number
              _use_betting_freebet?: boolean
              _user_id: string
            }
            Returns: {
              message: string
              success: boolean
            }[]
          }
        | {
            Args: {
              _bet_amount: number
              _bet_type: string
              _handicap_value?: number
              _match_id: string
              _odds: number
              _use_betting_freebet?: boolean
              _user_id: string
            }
            Returns: {
              message: string
              success: boolean
            }[]
          }
      place_crash_bet: {
        Args: {
          _auto_cashout: number
          _bet_amount: number
          _round_id: string
          _user_id: string
        }
        Returns: {
          message: string
          success: boolean
        }[]
      }
      place_parlay_bet: {
        Args: {
          _bet_amount: number
          _bet_items: Json
          _use_betting_freebet?: boolean
          _user_id: string
        }
        Returns: {
          message: string
          parlay_bet_id: string
          success: boolean
        }[]
      }
      play_balloon: {
        Args: {
          _action: string
          _bet_amount: number
          _session_id?: string
          _use_demo?: boolean
          _use_freebet?: boolean
          _user_id: string
        }
        Returns: Json
      }
      play_crypto_trading: {
        Args: {
          _bet_amount: number
          _bet_type: string
          _use_demo?: boolean
          _use_freebet?: boolean
          _user_id: string
        }
        Returns: Json
      }
      play_dice_server:
        | {
            Args: {
              _bet_amount: number
              _is_over: boolean
              _target: number
              _use_demo?: boolean
              _use_freebet?: boolean
              _user_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              _bet_amount: number
              _is_demo?: boolean
              _is_freebet?: boolean
              _prediction: string
              _target: number
              _user_id: string
            }
            Returns: Json
          }
      play_dogs_house: {
        Args: {
          _bet_amount: number
          _use_demo?: boolean
          _use_freebet?: boolean
          _user_id: string
        }
        Returns: Json
      }
      play_game:
        | {
            Args: {
              _bet_amount: number
              _game_name: string
              _multiplier?: number
              _use_freebet?: boolean
              _user_id: string
              _win_amount: number
            }
            Returns: {
              message: string
              new_balance: number
              success: boolean
            }[]
          }
        | {
            Args: {
              p_bet_amount: number
              p_game_name: string
              p_is_demo?: boolean
              p_is_freebet?: boolean
              p_multiplier?: number
              p_user_id: string
              p_win_amount: number
            }
            Returns: Json
          }
      play_hilo: {
        Args: {
          _action: string
          _bet_amount: number
          _session_id?: string
          _use_demo?: boolean
          _use_freebet?: boolean
          _user_id: string
        }
        Returns: Json
      }
      play_horse_racing: {
        Args: {
          _bet_amount: number
          _is_demo?: boolean
          _is_freebet?: boolean
          _selected_horse: number
          _user_id: string
        }
        Returns: Json
      }
      play_mines: {
        Args: {
          _bet_amount: number
          _mines_count: number
          _use_demo?: boolean
          _use_freebet?: boolean
          _user_id: string
        }
        Returns: Json
      }
      play_penalty_server: {
        Args: {
          _bet_amount: number
          _is_demo?: boolean
          _is_freebet?: boolean
          _player_choice: string
          _user_id: string
        }
        Returns: Json
      }
      play_plinko_server: {
        Args: {
          _bet_amount: number
          _use_demo?: boolean
          _use_freebet?: boolean
          _user_id: string
        }
        Returns: Json
      }
      play_roulette: {
        Args: {
          _bet_amount: number
          _bet_type: string
          _bet_value?: number
          _use_demo?: boolean
          _use_freebet?: boolean
          _user_id: string
        }
        Returns: Json
      }
      play_roulette_server: {
        Args: {
          _bet_amount: number
          _bet_type: string
          _bet_value?: number
          _is_demo?: boolean
          _is_freebet?: boolean
          _user_id: string
        }
        Returns: Json
      }
      play_sweet_bonanza: {
        Args: {
          _bet_amount: number
          _use_demo?: boolean
          _use_freebet?: boolean
          _user_id: string
        }
        Returns: Json
      }
      process_bet_referral_commission: {
        Args: { _user_id: string; _win_amount: number }
        Returns: undefined
      }
      process_crash_tick: {
        Args: { p_current_multiplier: number; p_round_id: string }
        Returns: Json
      }
      pump_balloon: {
        Args: { _session_id: string; _user_id: string }
        Returns: Json
      }
      refund_bet: { Args: { _bet_id: string }; Returns: Json }
      refund_parlay_bet: { Args: { _parlay_bet_id: string }; Returns: Json }
      refund_parlay_item: { Args: { _parlay_item_id: string }; Returns: Json }
      release_game_lock: {
        Args: { _game_session_id: string; _user_id: string }
        Returns: boolean
      }
      request_email_verification: {
        Args: { _email: string; _user_id: string }
        Returns: Json
      }
      restore_parlay_item: { Args: { _parlay_item_id: string }; Returns: Json }
      reveal_mines_cell: {
        Args: { _cell_index: number; _session_id: string; _user_id: string }
        Returns: Json
      }
      select_tower_tile: {
        Args: { _column: number; _session_id: string; _user_id: string }
        Returns: Json
      }
      sell_skin: {
        Args: { _inventory_id: string; _user_id: string }
        Returns: Json
      }
      send_system_notification: {
        Args: {
          _admin_user_id: string
          _message: string
          _target_user_id?: string
        }
        Returns: Json
      }
      set_guaranteed_max_win: {
        Args: { _enabled: boolean; _user_id: string }
        Returns: undefined
      }
      set_parlay_item_original_bet_type: {
        Args: { _bet_type: string; _item_id: string }
        Returns: Json
      }
      set_user_ban: {
        Args: { _ban_reason?: string; _is_banned: boolean; _user_id: string }
        Returns: undefined
      }
      set_user_mute: {
        Args: { _mute_seconds?: number; _user_id: string }
        Returns: undefined
      }
      spin_bonus_wheel: {
        Args: { _user_id: string; _wheel_id: string }
        Returns: {
          message: string
          reward_amount: number
          reward_description: string
          reward_type: string
          success: boolean
        }[]
      }
      spin_buff_wheel: { Args: { _user_id: string }; Returns: Json }
      spin_giveaway_wheel: {
        Args: { _giveaway_id: string; _user_id: string }
        Returns: Json
      }
      spin_registration_wheel: {
        Args: { _user_id: string }
        Returns: {
          message: string
          reward_amount: number
          reward_description: string
          reward_type: string
          success: boolean
        }[]
      }
      start_balloon_game: {
        Args: {
          _bet_amount: number
          _is_demo?: boolean
          _is_freebet?: boolean
          _user_id: string
        }
        Returns: Json
      }
      start_blackjack: {
        Args: {
          _bet_amount: number
          _is_demo?: boolean
          _is_freebet?: boolean
          _user_id: string
        }
        Returns: Json
      }
      start_chicken_road: {
        Args: {
          _bet_amount: number
          _difficulty?: string
          _is_demo?: boolean
          _is_freebet?: boolean
          _user_id: string
        }
        Returns: Json
      }
      start_crash_round: { Args: { p_round_id: string }; Returns: Json }
      start_game_session:
        | {
            Args: {
              _bet_amount: number
              _game_name: string
              _is_demo?: boolean
              _is_freebet?: boolean
              _user_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              _bet_amount: number
              _game_name: string
              _initial_state?: Json
              _is_demo?: boolean
              _is_freebet?: boolean
              _user_id: string
            }
            Returns: Json
          }
      start_hilo_game: {
        Args: {
          _bet_amount: number
          _is_demo?: boolean
          _is_freebet?: boolean
          _user_id: string
        }
        Returns: Json
      }
      start_mines_game: {
        Args: {
          _bet_amount: number
          _mines_count: number
          _use_demo?: boolean
          _use_freebet?: boolean
          _user_id: string
        }
        Returns: Json
      }
      start_towers_game: {
        Args: {
          _bet_amount: number
          _is_demo?: boolean
          _is_freebet?: boolean
          _user_id: string
        }
        Returns: Json
      }
      update_balance: {
        Args: { amount: number; user_id: string }
        Returns: undefined
      }
      update_game_stats: {
        Args: { p_user_id: string; p_won: boolean }
        Returns: undefined
      }
      update_task_progress:
        | {
            Args: {
              _amount?: number
              _game_name?: string
              _task_type: string
              _user_id: string
            }
            Returns: undefined
          }
        | {
            Args: {
              _amount?: number
              _game_name?: string
              _task_type: string
              _user_id: string
            }
            Returns: undefined
          }
      update_username: {
        Args: { _new_username: string; _user_id: string }
        Returns: {
          message: string
          success: boolean
        }[]
      }
      update_wager_progress: {
        Args: { _bet_amount: number; _user_id: string }
        Returns: undefined
      }
      upgrade_skin: {
        Args: {
          _inventory_id: string
          _target_skin_id: string
          _use_demo?: boolean
          _user_id: string
        }
        Returns: Json
      }
      use_freespin: {
        Args: { _multiplier?: number; _user_id: string; _win_amount: number }
        Returns: {
          message: string
          remaining_spins: number
          success: boolean
        }[]
      }
      validate_user_session: {
        Args: { p_session_token: string; p_user_id: string }
        Returns: boolean
      }
      verify_email_code: {
        Args: { _code: string; _user_id: string }
        Returns: Json
      }
      verify_game: { Args: { _game_session_id: string }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "user"
      game_status: "active" | "maintenance"
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
      game_status: ["active", "maintenance"],
    },
  },
} as const
