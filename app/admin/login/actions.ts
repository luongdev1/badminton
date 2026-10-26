"use server";

import { redirect } from "next/navigation";
import { adminEmailSchema } from "@/lib/validation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LoginResult = { ok: true } | { ok: false; message: string };

export async function signOutAdmin() {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(`Could not sign out administrator: ${error.message}`);
  redirect("/admin/login");
}

export async function requestAdminMagicLink(input: unknown): Promise<LoginResult> {
  const parsed = adminEmailSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Địa chỉ email không hợp lệ." };
  }

  const supabase = await createSupabaseServerClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (!siteUrl) {
    return { ok: false, message: "Thiếu NEXT_PUBLIC_SITE_URL để tạo liên kết đăng nhập." };
  }

  let emailRedirectTo: string;
  try {
    const baseUrl = new URL(siteUrl);
    if (baseUrl.protocol !== "http:" && baseUrl.protocol !== "https:") {
      return { ok: false, message: "NEXT_PUBLIC_SITE_URL phải bắt đầu bằng http:// hoặc https://." };
    }
    emailRedirectTo = new URL("/auth/callback?next=/", baseUrl).toString();
  } catch {
    return { ok: false, message: "NEXT_PUBLIC_SITE_URL không phải là URL hợp lệ." };
  }

  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo,
    },
  });

  if (error) {
    return {
      ok: false,
      message: `Supabase không gửi được liên kết: ${error.message} (HTTP ${error.status}). Kiểm tra Authentication → Logs trong Supabase.`,
    };
  }

  return { ok: true };
}
