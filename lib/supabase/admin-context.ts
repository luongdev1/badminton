import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type AdminContext = {
  supabase: SupabaseClient<Database>;
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
  const cookieStore = await cookies();
  const sessionIsValid = await verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!sessionIsValid) redirect("/login");

  const supabase = createSupabaseAdminClient();
  const { data: teams, error: teamError } = await supabase
    .from("team_settings")
    .select("*")
    .limit(2);

  if (teamError) {
    throw new Error(`Could not load the administrator team: ${teamError.message}`);
  }

  if (!teams?.length) redirect("/admin/setup");
  if (teams.length > 1) throw new Error("Shared administrator credentials require exactly one configured team.");
  const team = teams[0];

  if (!team) {
    redirect("/admin/setup");
  }

  return { supabase, team };
}
