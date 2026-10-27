"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAppPasswordHash, requireDatabaseSuperAdmin } from "@/lib/app-auth";

const usernameSchema = z.string().trim().min(3).max(64).regex(/^[A-Za-z0-9._-]+$/);
const passwordSchema = z.string().min(12).max(256);
const uuidSchema = z.string().uuid();

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function slugify(value: string) {
  const slug = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${slug || "team"}-${randomBytes(3).toString("hex")}`;
}

function ensureRpcSuccess(error: { message: string; code?: string } | null, operation: string) {
  if (error) {
    console.error(`[system-admin] ${operation} failed`, { code: error.code, message: error.message });
    redirect("/system-admin?error=operation-failed");
  }
}

export async function createTeamWithAdmin(formData: FormData) {
  const identity = await requireDatabaseSuperAdmin();
  const teamName = z.string().trim().min(1).max(120).parse(formString(formData, "team_name"));
  const username = usernameSchema.parse(formString(formData, "username")).toLowerCase();
  const password = passwordSchema.parse(formString(formData, "password"));
  const passwordHash = await createAppPasswordHash(password);
  const { error } = await identity.supabase.rpc("system_create_team_with_admin", {
    p_actor_user_id: identity.user.id,
    p_team_id: randomUUID(),
    p_team_name: teamName,
    p_team_slug: slugify(teamName),
    p_user_id: randomUUID(),
    p_username: username,
    p_password_hash: passwordHash,
  });
  ensureRpcSuccess(error, "create team and administrator");
  redirect("/system-admin?notice=team-created");
}

export async function updateTeam(formData: FormData) {
  const identity = await requireDatabaseSuperAdmin();
  const teamId = uuidSchema.parse(formString(formData, "team_id"));
  const name = z.string().trim().min(1).max(120).parse(formString(formData, "team_name"));
  const status = z.enum(["active", "locked"]).parse(formString(formData, "status"));
  const { error } = await identity.supabase.rpc("system_update_team", {
    p_actor_user_id: identity.user.id,
    p_team_id: teamId,
    p_name: name,
    p_status: status,
  });
  ensureRpcSuccess(error, "update team");
  redirect("/system-admin?notice=team-updated");
}

export async function createTeamAdmin(formData: FormData) {
  const identity = await requireDatabaseSuperAdmin();
  const teamId = uuidSchema.parse(formString(formData, "team_id"));
  const username = usernameSchema.parse(formString(formData, "username")).toLowerCase();
  const password = passwordSchema.parse(formString(formData, "password"));
  const passwordHash = await createAppPasswordHash(password);
  const { error } = await identity.supabase.rpc("system_create_team_admin", {
    p_actor_user_id: identity.user.id,
    p_team_id: teamId,
    p_user_id: randomUUID(),
    p_username: username,
    p_password_hash: passwordHash,
  });
  ensureRpcSuccess(error, "create team administrator");
  redirect("/system-admin?notice=admin-created");
}

export async function grantTeamMembership(formData: FormData) {
  const identity = await requireDatabaseSuperAdmin();
  const teamId = uuidSchema.parse(formString(formData, "team_id"));
  const userId = uuidSchema.parse(formString(formData, "user_id"));
  const { error } = await identity.supabase.rpc("system_grant_team_membership", {
    p_actor_user_id: identity.user.id,
    p_team_id: teamId,
    p_user_id: userId,
  });
  ensureRpcSuccess(error, "grant team membership");
  redirect("/system-admin?notice=membership-granted");
}

export async function resetTeamAdminPassword(formData: FormData) {
  const identity = await requireDatabaseSuperAdmin();
  const teamId = uuidSchema.parse(formString(formData, "team_id"));
  const userId = uuidSchema.parse(formString(formData, "user_id"));
  const password = passwordSchema.parse(formString(formData, "password"));
  const passwordHash = await createAppPasswordHash(password);
  const { error } = await identity.supabase.rpc("system_reset_team_admin_password", {
    p_actor_user_id: identity.user.id,
    p_team_id: teamId,
    p_user_id: userId,
    p_password_hash: passwordHash,
  });
  ensureRpcSuccess(error, "reset team administrator password");
  redirect("/system-admin?notice=password-reset");
}

export async function revokeTeamMembership(formData: FormData) {
  const identity = await requireDatabaseSuperAdmin();
  const teamId = uuidSchema.parse(formString(formData, "team_id"));
  const userId = uuidSchema.parse(formString(formData, "user_id"));
  const { error } = await identity.supabase.rpc("system_revoke_team_membership", {
    p_actor_user_id: identity.user.id,
    p_team_id: teamId,
    p_user_id: userId,
  });
  ensureRpcSuccess(error, "revoke team membership");
  redirect("/system-admin?notice=membership-revoked");
}

export async function setTeamAdminStatus(formData: FormData) {
  const identity = await requireDatabaseSuperAdmin();
  const userId = uuidSchema.parse(formString(formData, "user_id"));
  const status = z.enum(["active", "disabled"]).parse(formString(formData, "status"));
  const { error } = await identity.supabase.rpc("system_set_app_user_status", {
    p_actor_user_id: identity.user.id,
    p_user_id: userId,
    p_status: status,
  });
  ensureRpcSuccess(error, "update team administrator status");
  redirect("/system-admin?notice=account-updated");
}

export async function revokeAdminSessions(formData: FormData) {
  const identity = await requireDatabaseSuperAdmin();
  const userId = uuidSchema.parse(formString(formData, "user_id"));
  const { error } = await identity.supabase.rpc("system_revoke_user_sessions", {
    p_actor_user_id: identity.user.id,
    p_user_id: userId,
  });
  ensureRpcSuccess(error, "revoke administrator sessions");
  redirect("/system-admin?notice=sessions-revoked");
}
