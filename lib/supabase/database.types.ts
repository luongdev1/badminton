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
        },
        {
          id?: string;
          team_id: string;
          session_id: string;
          description: string;
          category?: "court" | "shuttlecock" | "equipment" | "other";
          amount_vnd: number;
          incurred_at?: string;
          created_at?: string;
          updated_at?: string;
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
