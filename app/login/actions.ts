"use server";

import { createHash } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ADMIN_SESSION_COOKIE, ADMIN_SESSION_MAX_AGE_SECONDS, createAdminSessionToken } from "@/lib/admin-session";
import { verifyAdminCredentials } from "@/lib/admin-credentials";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  APP_SESSION_MAX_AGE_SECONDS,
  createDatabaseAdminSession,
  hashAppSessionToken,
  setAdminSessionCookie,
  verifyAppPassword,
} from "@/lib/app-auth";
import { adminLoginSchema } from "@/lib/validation";

export type AdminLoginResult = { ok: true; redirectTo: string } | { ok: false; message: string };

const rateLimitResultSchema = z.object({
  allowed: z.boolean(),
  retry_after_seconds: z.number().int().nonnegative(),
}).strict();

function logSupabaseLoginError(operation: string, error: { code?: string; message?: string }) {
  console.error(`[admin-login] Supabase ${operation} failed`, {
    code: error.code,
    message: error.message,
  });
}

export async function loginAdmin(input: unknown): Promise<AdminLoginResult> {
  const parsed = adminLoginSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Thông tin đăng nhập không hợp lệ." };
  }

  const requestHeaders = headers();
  const clientIp = requestHeaders.get("x-real-ip")
    ?? requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? "unknown";
  const keyHash = createHash("sha256").update(clientIp, "utf8").digest("hex");

  let supabase;
  try {
    supabase = createSupabaseAdminClient();
  } catch (error) {
    console.error(
      "[admin-login] Could not create Supabase admin client",
      error instanceof Error ? error.message : "Unknown error",
    );
    return { ok: false, message: "Chưa cấu hình đầy đủ thông tin xác thực phía server." };
  }

  const { data: rateLimitData, error: rateLimitError } = await supabase.rpc("consume_admin_login_attempt", {
    p_key_hash: keyHash,
  });
  if (rateLimitError) {
    logSupabaseLoginError("consume_admin_login_attempt", rateLimitError);
    return {
      ok: false,
      message: "Không thể kiểm tra giới hạn đăng nhập. Hãy kiểm tra cấu hình Supabase và migration đăng nhập.",
    };
  }
  const rateLimit = rateLimitResultSchema.safeParse(rateLimitData);
  if (!rateLimit.success) {
    return { ok: false, message: "Phản hồi giới hạn đăng nhập không hợp lệ." };
  }
  if (!rateLimit.data.allowed) {
    return {
      ok: false,
      message: `Đăng nhập tạm khóa. Vui lòng thử lại sau ${Math.ceil(rateLimit.data.retry_after_seconds / 60)} phút.`,
    };
  }

  if (process.env.ADMIN_AUTH_MODE === "database") {
    const username = parsed.data.username.trim().toLowerCase();
    const { data: user, error: userError } = await supabase
      .from("app_users")
      .select("id,username,password_hash,platform_role,status")
      .eq("username", username)
      .maybeSingle();

    if (userError) {
      console.error("[admin-login] Database account lookup failed", {
        code: userError.code,
        message: userError.message,
      });
      return { ok: false, message: "Không thể kiểm tra tài khoản quản trị. Hãy thử lại sau." };
    }

    if (!user || user.status !== "active") {
      return { ok: false, message: "Tên đăng nhập hoặc mật khẩu không đúng." };
    }

    let passwordMatches: boolean;
    try {
      passwordMatches = await verifyAppPassword(parsed.data.password, user.password_hash);
    } catch (error) {
      console.error(
        "[admin-login] Stored password hash is invalid",
        error instanceof Error ? error.message : "Unknown error",
      );
      return { ok: false, message: "Cấu hình tài khoản quản trị trong cơ sở dữ liệu chưa hợp lệ." };
    }
    if (!passwordMatches) return { ok: false, message: "Tên đăng nhập hoặc mật khẩu không đúng." };

    const { data: memberships, error: membershipError } = await supabase
      .from("team_memberships")
      .select("team_id")
      .eq("user_id", user.id)
      .eq("status", "active");
    if (membershipError) {
      console.error("[admin-login] Membership lookup failed", {
        code: membershipError.code,
        message: membershipError.message,
      });
      return { ok: false, message: "Không thể kiểm tra quyền quản trị. Hãy thử lại sau." };
    }

    const teamIds = [...new Set((memberships ?? []).map((membership) => membership.team_id))];
    const { data: activeTeams, error: teamError } = teamIds.length
      ? await supabase.from("teams").select("id").in("id", teamIds).eq("status", "active")
      : { data: [], error: null };
    if (teamError) {
      console.error("[admin-login] Team status lookup failed", {
        code: teamError.code,
        message: teamError.message,
      });
      return { ok: false, message: "Không thể kiểm tra trạng thái đội. Hãy thử lại sau." };
    }

    const activeTeamIds = new Set((activeTeams ?? []).map((team) => team.id));
    const availableTeamIds = teamIds.filter((teamId) => activeTeamIds.has(teamId));
    if (user.platform_role === "user" && availableTeamIds.length === 0) {
      return { ok: false, message: "Tài khoản chưa được gán vào đội đang hoạt động. Hãy liên hệ Super Admin." };
    }
    const activeTeamId = user.platform_role === "user" && availableTeamIds.length === 1
      ? availableTeamIds[0] ?? null
      : null;

    let session: Awaited<ReturnType<typeof createDatabaseAdminSession>>;
    try {
      session = await createDatabaseAdminSession(supabase, user.id, activeTeamId);
    } catch (error) {
      console.error(
        "[admin-login] Could not create database session",
        error instanceof Error ? error.message : "Unknown error",
      );
      return { ok: false, message: "Không thể tạo phiên đăng nhập. Hãy thử lại sau." };
    }

    const { error: auditError } = await supabase.from("audit_logs").insert({
      actor_app_user_id: user.id,
      team_id: activeTeamId,
      action: "auth.login",
      target_type: "app_user",
      target_id: user.id,
    });
    if (auditError) {
      await supabase
        .from("app_auth_sessions")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", session.sessionId)
        .is("revoked_at", null);
      console.error("[admin-login] Could not record successful sign-in", {
        code: auditError.code,
        message: auditError.message,
      });
      return { ok: false, message: "Không thể ghi nhận phiên đăng nhập an toàn." };
    }

    const { error: clearError } = await supabase.rpc("clear_admin_login_attempts", { p_key_hash: keyHash });
    if (clearError) {
      logSupabaseLoginError("clear_admin_login_attempts", clearError);
      await supabase
        .from("app_auth_sessions")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", session.sessionId)
        .is("revoked_at", null);
      return { ok: false, message: "Không thể hoàn tất đăng nhập an toàn. Hãy thử lại sau." };
    }

    await setAdminSessionCookie(session.token, APP_SESSION_MAX_AGE_SECONDS);
    const redirectTo = user.platform_role === "super_admin"
      ? "/system-admin"
      : availableTeamIds.length > 1
        ? "/choose-team"
        : "/admin";
    return { ok: true, redirectTo };
  }

  let credentialsMatch: boolean;
  try {
    credentialsMatch = await verifyAdminCredentials(parsed.data.username, parsed.data.password);
  } catch {
    return { ok: false, message: "Cấu hình đăng nhập quản trị trên server chưa hợp lệ." };
  }
  if (!credentialsMatch) return { ok: false, message: "Tên đăng nhập hoặc mật khẩu không đúng." };

  const { error: clearError } = await supabase.rpc("clear_admin_login_attempts", { p_key_hash: keyHash });
  if (clearError) {
    logSupabaseLoginError("clear_admin_login_attempts", clearError);
    return { ok: false, message: "Không thể hoàn tất đăng nhập an toàn. Hãy thử lại sau." };
  }

  let token: string;
  try {
    token = await createAdminSessionToken();
  } catch {
    return { ok: false, message: "Cấu hình khóa phiên quản trị trên server chưa hợp lệ." };
  }
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  });
  return { ok: true, redirectTo: "/admin" };
}

export async function signOutAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (token && /^[A-Za-z0-9_-]{43}$/.test(token)) {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("app_auth_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("token_hash", hashAppSessionToken(token))
      .is("revoked_at", null);
    if (error) throw new Error(`Could not revoke administrator session: ${error.message}`);
  }
  cookieStore.delete(ADMIN_SESSION_COOKIE);
  redirect("/login");
}
