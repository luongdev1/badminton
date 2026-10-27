import "server-only";

import { createHash, randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-session";

const scrypt = promisify(nodeScrypt);
const PASSWORD_HASH_LENGTH = 64;
export const APP_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

export type AppUserRow = Database["public"]["Tables"]["app_users"]["Row"];
export type AppSessionRow = Database["public"]["Tables"]["app_auth_sessions"]["Row"];

export type DatabaseAdminIdentity = {
  supabase: SupabaseClient<Database>;
  user: Pick<AppUserRow, "id" | "username" | "platform_role" | "status">;
  session: AppSessionRow;
  teamMemberships: {
    team_id: string;
    role: "team_admin";
    team: { id: string; name: string; status: "active" | "locked" };
  }[];
};

export function hashAppSessionToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export async function verifyAppPassword(password: string, encodedHash: string) {
  const [algorithm, saltText, hashText, extra] = encodedHash.split("$");
  if (algorithm !== "scrypt" || !saltText || !hashText || extra !== undefined) {
    throw new Error("Stored password hash has an invalid format.");
  }

  const salt = Buffer.from(saltText, "base64url");
  const expectedHash = Buffer.from(hashText, "base64url");
  if (salt.length < 16 || expectedHash.length !== PASSWORD_HASH_LENGTH) {
    throw new Error("Stored password hash has an invalid salt or digest length.");
  }

  const actualHash = await scrypt(password, salt, PASSWORD_HASH_LENGTH) as Buffer;
  return timingSafeEqual(actualHash, expectedHash);
}

export async function createAppPasswordHash(password: string) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, PASSWORD_HASH_LENGTH) as Buffer;
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export async function createDatabaseAdminSession(
  supabase: SupabaseClient<Database>,
  userId: string,
  activeTeamId: string | null,
) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + APP_SESSION_MAX_AGE_SECONDS * 1000).toISOString();
  const { data, error } = await supabase
    .from("app_auth_sessions")
    .insert({
      token_hash: hashAppSessionToken(token),
      user_id: userId,
      active_team_id: activeTeamId,
      expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Could not create database session: ${error.message}`);
  return { token, sessionId: data.id };
}

export async function setAdminSessionCookie(token: string, maxAge = APP_SESSION_MAX_AGE_SECONDS) {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge,
  });
}

export async function clearAdminSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE);
}

export async function resolveDatabaseAdminIdentity(token: string): Promise<DatabaseAdminIdentity | null> {
  const supabase = createSupabaseAdminClient();
  const { data: session, error: sessionError } = await supabase
    .from("app_auth_sessions")
    .select("*")
    .eq("token_hash", hashAppSessionToken(token))
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (sessionError) throw new Error(`Could not validate administrator session: ${sessionError.message}`);
  if (!session) return null;

  const { data: user, error: userError } = await supabase
    .from("app_users")
    .select("id,username,platform_role,status")
    .eq("id", session.user_id)
    .maybeSingle();

  if (userError) throw new Error(`Could not validate administrator account: ${userError.message}`);
  if (!user || user.status !== "active") return null;

  const { data: memberships, error: membershipsError } = await supabase
    .from("team_memberships")
    .select("team_id,role")
    .eq("user_id", user.id)
    .eq("status", "active");

  if (membershipsError) throw new Error(`Could not validate team membership: ${membershipsError.message}`);
  const membershipRows = memberships ?? [];
  const teamIds = membershipRows.map((membership) => membership.team_id);
  const { data: teams, error: teamsError } = teamIds.length
    ? await supabase.from("teams").select("id,name,status").in("id", teamIds).eq("status", "active")
    : { data: [], error: null };
  if (teamsError) throw new Error(`Could not validate team status: ${teamsError.message}`);
  const activeTeams = new Map((teams ?? []).map((team) => [team.id, team]));
  const teamMemberships = membershipRows.flatMap((membership) => {
    const team = activeTeams.get(membership.team_id);
    if (!team) return [];
    return [{
      team_id: membership.team_id,
      role: membership.role,
      team: { id: team.id, name: team.name, status: team.status },
    }];
  });

  const { error: lastSeenError } = await supabase
    .from("app_auth_sessions")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", session.id)
    .is("revoked_at", null);
  if (lastSeenError) throw new Error(`Could not update administrator session activity: ${lastSeenError.message}`);

  return {
    supabase,
    user,
    session,
    teamMemberships,
  };
}

export async function requireDatabaseSuperAdmin() {
  const identity = await requireDatabaseAdminIdentity();
  if (identity.user.platform_role !== "super_admin") redirect("/admin");
  return identity;
}

export async function requireDatabaseAdminIdentity() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) redirect("/login");

  const identity = await resolveDatabaseAdminIdentity(token);
  if (!identity) redirect("/login");
  return identity;
}

export async function requireDatabaseTeamAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;

  const identity = await resolveDatabaseAdminIdentity(token);
  if (!identity || identity.user.platform_role === "super_admin") return null;

  const activeTeam = identity.teamMemberships.find((membership) => (
    membership.team_id === identity.session.active_team_id
  ));
  if (!activeTeam) {
    if (identity.teamMemberships.length > 1) redirect("/choose-team");
    if (identity.teamMemberships.length === 1) {
      const membership = identity.teamMemberships[0];
      if (membership) {
        const { error } = await identity.supabase
          .from("app_auth_sessions")
          .update({ active_team_id: membership.team_id })
          .eq("id", identity.session.id)
          .is("revoked_at", null);
        if (error) throw new Error(`Could not select the administrator team: ${error.message}`);
        return { ...identity, activeTeam: membership };
      }
    }
    return null;
  }
  return { ...identity, activeTeam };
}

export async function resolveLegacyAdminSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!await verifyAdminSessionToken(token)) return null;
  return createSupabaseAdminClient();
}
