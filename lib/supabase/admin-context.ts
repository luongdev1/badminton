import "server-only";

import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AdminContext = {
  supabase: SupabaseClient<Database>;
  userId: string;
  team: {
    id: string;
    team_name: string;
    admin_user_id: string | null;
    bank_name: string | null;
    bank_code: string | null;
    bank_account_name: string | null;
    bank_account_number: string | null;
    transfer_note: string | null;
    qr_storage_path: string | null;
    created_at: string;
    updated_at: string;
  };
};

export async function requireAdminContext(): Promise<AdminContext> {
  const supabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();

  if (authError || !authData?.claims?.sub) {
    redirect("/admin/login");
  }
  const userId = authData.claims.sub;

  const { data: team, error: teamError } = await supabase
    .from("team_settings")
    .select("*")
    .eq("admin_user_id", userId)
    .maybeSingle();

  if (teamError) {
    throw new Error(`Could not load the administrator's team: ${teamError.message}`);
  }

  if (!team) {
    redirect("/admin/setup");
  }

  return { supabase, userId, team };
}
