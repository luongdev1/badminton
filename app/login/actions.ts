"use server";

import { createHash } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ADMIN_SESSION_COOKIE, ADMIN_SESSION_MAX_AGE_SECONDS, createAdminSessionToken } from "@/lib/admin-session";
import { verifyAdminCredentials } from "@/lib/admin-credentials";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { adminLoginSchema } from "@/lib/validation";

export type AdminLoginResult = { ok: true } | { ok: false; message: string };

const rateLimitResultSchema = z.object({
  allowed: z.boolean(),
  retry_after_seconds: z.number().int().nonnegative(),
}).strict();

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
  } catch {
    return { ok: false, message: "Chưa cấu hình đầy đủ thông tin xác thực phía server." };
  }

  const { data: rateLimitData, error: rateLimitError } = await supabase.rpc("consume_admin_login_attempt", {
    p_key_hash: keyHash,
  });
  if (rateLimitError) {
    return { ok: false, message: "Không thể kiểm tra giới hạn đăng nhập. Hãy thử lại sau." };
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

  let credentialsMatch: boolean;
  try {
    credentialsMatch = await verifyAdminCredentials(parsed.data.username, parsed.data.password);
  } catch {
    return { ok: false, message: "Cấu hình đăng nhập quản trị trên server chưa hợp lệ." };
  }
  if (!credentialsMatch) return { ok: false, message: "Tên đăng nhập hoặc mật khẩu không đúng." };

  const { error: clearError } = await supabase.rpc("clear_admin_login_attempts", { p_key_hash: keyHash });
  if (clearError) {
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
  return { ok: true };
}

export async function signOutAdmin() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE);
  redirect("/login");
}
