"use server";

import { redirect } from "next/navigation";
import { requireDatabaseAdminIdentity } from "@/lib/app-auth";

export async function activateTeam(formData: FormData) {
  const teamId = formData.get("team_id");
  if (typeof teamId !== "string") redirect("/choose-team");

  const identity = await requireDatabaseAdminIdentity();
  if (identity.user.platform_role === "super_admin") redirect("/system-admin");
  const membership = identity.teamMemberships.find((entry) => entry.team_id === teamId);
  if (!membership || membership.team.status !== "active") redirect("/choose-team");

  const { error: sessionError } = await identity.supabase
    .from("app_auth_sessions")
    .update({ active_team_id: membership.team_id })
    .eq("id", identity.session.id)
    .eq("user_id", identity.user.id)
    .is("revoked_at", null);
  if (sessionError) throw new Error(`Could not select the active team: ${sessionError.message}`);

  const { error: auditError } = await identity.supabase.from("audit_logs").insert({
    actor_app_user_id: identity.user.id,
    team_id: membership.team_id,
    action: "team.select",
    target_type: "team",
    target_id: membership.team_id,
  });
  if (auditError) throw new Error(`Could not record active team selection: ${auditError.message}`);

  redirect("/");
}
