export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type CreatedAtFields = {
  created_at: string;
};

type TimestampFields = CreatedAtFields & {
  updated_at: string;
};

type TableShape<Row, Insert, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      teams: TableShape<
        TimestampFields & {
          id: string;
          name: string;
          slug: string;
          status: "active" | "locked";
        },
        Partial<TimestampFields> & {
          id?: string;
          name: string;
          slug: string;
          status?: "active" | "locked";
        }
      >;
      app_users: TableShape<
        TimestampFields & {
          id: string;
          username: string;
          password_hash: string;
          platform_role: "user" | "super_admin";
          status: "active" | "disabled";
        },
        Partial<TimestampFields> & {
          id?: string;
          username: string;
          password_hash: string;
          platform_role?: "user" | "super_admin";
          status?: "active" | "disabled";
        }
      >;
      team_memberships: TableShape<
        {
          user_id: string;
          team_id: string;
          role: "team_admin";
          status: "active" | "revoked";
          created_by: string | null;
          created_at: string;
          revoked_at: string | null;
        },
        {
          user_id: string;
          team_id: string;
          role?: "team_admin";
          status?: "active" | "revoked";
          created_by?: string | null;
          created_at?: string;
          revoked_at?: string | null;
        }
      >;
      app_auth_sessions: TableShape<
        {
          id: string;
          token_hash: string;
          user_id: string;
          active_team_id: string | null;
          expires_at: string;
          revoked_at: string | null;
          created_at: string;
          last_seen_at: string;
        },
        {
          id?: string;
          token_hash: string;
          user_id: string;
          active_team_id?: string | null;
          expires_at: string;
          revoked_at?: string | null;
          created_at?: string;
          last_seen_at?: string;
        }
      >;
      audit_logs: TableShape<
        {
          id: string;
          actor_app_user_id: string | null;
          team_id: string | null;
          action: string;
          target_type: string;
          target_id: string | null;
          created_at: string;
        },
        {
          id?: string;
          actor_app_user_id?: string | null;
          team_id?: string | null;
          action: string;
          target_type: string;
          target_id?: string | null;
          created_at?: string;
        }
      >;
      team_settings: TableShape<
        TimestampFields & {
          id: string;
          team_name: string;
          admin_user_id: string | null;
          bank_name: string | null;
          bank_code: string | null;
          bank_account_name: string | null;
          bank_account_number: string | null;
          transfer_note: string | null;
          qr_storage_path: string | null;
        },
        Partial<TimestampFields> & {
          id?: string;
          team_name: string;
          admin_user_id?: string | null;
          bank_name?: string | null;
          bank_code?: string | null;
          bank_account_name?: string | null;
          bank_account_number?: string | null;
          transfer_note?: string | null;
          qr_storage_path?: string | null;
        }
      >;
      members: TableShape<
        TimestampFields & {
          id: string;
          team_id: string;
          full_name: string;
          phone: string | null;
          role: "manager" | "member";
          is_active: boolean;
          archived_at: string | null;
        },
        Partial<TimestampFields> & {
          id?: string;
          team_id: string;
          full_name: string;
          phone?: string | null;
          role?: "manager" | "member";
          is_active?: boolean;
          archived_at?: string | null;
        }
      >;
      sessions: TableShape<
        TimestampFields & {
          id: string;
          team_id: string;
          venue_id: string;
          title: string;
          session_date: string;
          starts_at: string;
          ends_at: string;
          venue: string;
          court_details: string | null;
          status: "scheduled" | "completed" | "cancelled";
          fee_per_member_vnd: number;
          notes: string | null;
          share_token_hash: string | null;
        },
        Partial<TimestampFields> & {
          id?: string;
          team_id: string;
          venue_id?: string;
          title: string;
          session_date: string;
          starts_at: string;
          ends_at: string;
          venue: string;
          court_details?: string | null;
          status?: "scheduled" | "completed" | "cancelled";
          fee_per_member_vnd?: number;
          notes?: string | null;
          share_token_hash?: string | null;
        }
      >;
      session_participants: TableShape<
        TimestampFields & {
          id: string;
          team_id: string;
          session_id: string;
          member_id: string;
          member_name_snapshot: string;
          fee_snapshot_vnd: number;
          status: "invited" | "confirmed" | "declined" | "attended" | "absent";
        },
        Partial<TimestampFields> & {
          id?: string;
          team_id: string;
          session_id: string;
          member_id: string;
          member_name_snapshot: string;
          fee_snapshot_vnd: number;
          status?: "invited" | "confirmed" | "declined" | "attended" | "absent";
        }
      >;
      session_expenses: TableShape<
        TimestampFields & {
          id: string;
          team_id: string;
          session_id: string;
          description: string;
          category: "court" | "shuttlecock" | "equipment" | "other";
          amount_vnd: number;
          incurred_at: string;
          allocation_mode: "equal" | "custom";
        },
        {
          id?: string;
          team_id: string;
          session_id: string;
          description: string;
          category?: "court" | "shuttlecock" | "equipment" | "other";
          amount_vnd: number;
          incurred_at?: string;
          allocation_mode?: "equal" | "custom";
          created_at?: string;
          updated_at?: string;
        }
      >;
      team_venues: TableShape<
        TimestampFields & {
          id: string;
          team_id: string;
          name: string;
          name_key: string;
          qr_storage_path: string | null;
        },
        Partial<TimestampFields> & {
          id?: string;
          team_id: string;
          name: string;
          qr_storage_path?: string | null;
        }
      >;
      session_expense_allocations: TableShape<
        {
          team_id: string;
          session_id: string;
          expense_id: string;
          member_id: string;
          amount_vnd: number;
          created_at: string;
        },
        {
          team_id: string;
          session_id: string;
          expense_id: string;
          member_id: string;
          amount_vnd: number;
          created_at?: string;
        }
      >;
      session_expense_allocation_audit_logs: TableShape<
        {
          id: string;
          team_id: string;
          session_id: string;
          expense_id: string | null;
          actor_app_user_id: string | null;
          event_type: "legacy_backfill" | "created" | "updated" | "deleted";
          description: string;
          amount_vnd: number;
          allocation_mode: "equal" | "custom";
          allocations: Json;
          created_at: string;
        },
        {
          id?: string;
          team_id: string;
          session_id: string;
          expense_id?: string | null;
          actor_app_user_id?: string | null;
          event_type: "legacy_backfill" | "created" | "updated" | "deleted";
          description: string;
          amount_vnd: number;
          allocation_mode: "equal" | "custom";
          allocations: Json;
          created_at?: string;
        }
      >;
      payments: TableShape<
        TimestampFields & {
          id: string;
          team_id: string;
          session_id: string;
          member_id: string;
          participant_id: string;
          amount_vnd: number;
          amount_due_vnd: number;
          status: "pending" | "paid" | "waived" | "refunded";
          paid_at: string | null;
          reference: string | null;
        },
        Partial<TimestampFields> & {
          id?: string;
          team_id: string;
          session_id: string;
          member_id: string;
          participant_id: string;
          amount_vnd: number;
          amount_due_vnd?: number;
          status?: "pending" | "paid" | "waived" | "refunded";
          paid_at?: string | null;
          reference?: string | null;
        }
      >;
      payment_audit_logs: TableShape<
        CreatedAtFields & {
          id: string;
          team_id: string;
          payment_id: string;
          event_type: "INSERT" | "UPDATE";
          actor_id: string | null;
          actor_source: "admin" | "public_link" | "system";
          old_status: "pending" | "paid" | "waived" | "refunded" | null;
          new_status: "pending" | "paid" | "waived" | "refunded";
          old_amount_vnd: number | null;
          new_amount_vnd: number;
        },
        {
          id?: string;
          team_id: string;
          payment_id: string;
          event_type: "INSERT" | "UPDATE";
          actor_id?: string | null;
          actor_source?: "admin" | "public_link" | "system";
          old_status?: "pending" | "paid" | "waived" | "refunded" | null;
          new_status: "pending" | "paid" | "waived" | "refunded";
          old_amount_vnd?: number | null;
          new_amount_vnd: number;
          created_at?: string;
        }
      >;
    };
    Views: { [_ in never]: never };
    Functions: {
      bootstrap_initial_super_admin: {
        Args: {
          p_super_admin_user_id: string;
          p_super_admin_username: string;
          p_super_admin_password_hash: string;
          p_legacy_team_id: string | null;
          p_legacy_username: string | null;
          p_legacy_password_hash: string | null;
        };
        Returns: undefined;
      };
      system_create_team_with_admin: {
        Args: {
          p_actor_user_id: string;
          p_team_id: string;
          p_team_name: string;
          p_team_slug: string;
          p_user_id: string;
          p_username: string;
          p_password_hash: string;
        };
        Returns: Json;
      };
      system_update_team: {
        Args: { p_actor_user_id: string; p_team_id: string; p_name: string; p_status: string };
        Returns: undefined;
      };
      system_create_team_admin: {
        Args: {
          p_actor_user_id: string;
          p_team_id: string;
          p_user_id: string;
          p_username: string;
          p_password_hash: string;
        };
        Returns: undefined;
      };
      system_grant_team_membership: {
        Args: { p_actor_user_id: string; p_team_id: string; p_user_id: string };
        Returns: undefined;
      };
      system_reset_team_admin_password: {
        Args: { p_actor_user_id: string; p_team_id: string; p_user_id: string; p_password_hash: string };
        Returns: undefined;
      };
      system_revoke_team_membership: {
        Args: { p_actor_user_id: string; p_team_id: string; p_user_id: string };
        Returns: undefined;
      };
      system_set_app_user_status: {
        Args: { p_actor_user_id: string; p_user_id: string; p_status: string };
        Returns: undefined;
      };
      system_revoke_user_sessions: {
        Args: { p_actor_user_id: string; p_user_id: string };
        Returns: undefined;
      };
      save_session_expense: {
        Args: {
          p_team_id: string;
          p_session_id: string;
          p_expense_id: string | null;
          p_description: string;
          p_category: string;
          p_amount_vnd: number;
          p_member_ids: string[];
          p_confirm_paid_rebalance: boolean;
          p_actor_app_user_id: string | null;
        };
        Returns: Json;
      };
      delete_session_expense: {
        Args: {
          p_team_id: string;
          p_session_id: string;
          p_expense_id: string;
          p_confirm_paid_rebalance: boolean;
          p_actor_app_user_id: string | null;
        };
        Returns: Json;
      };
      consume_admin_login_attempt: {
        Args: { p_key_hash: string };
        Returns: Json;
      };
      clear_admin_login_attempts: {
        Args: { p_key_hash: string };
        Returns: undefined;
      };
      get_public_session_share: {
        Args: { p_token_hash: string };
        Returns: Json;
      };
      confirm_public_payment: {
        Args: { p_token_hash: string; p_payment_id: string; p_paid: boolean };
        Returns: Json;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
