"use server";

import { requireAdminContext } from "@/lib/supabase/admin-context";
import { memberInputSchema, memberStatusSchema } from "@/lib/validation";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; message: string };

export async function createMember(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = memberInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Thông tin thành viên không hợp lệ." };
  }

  const { supabase, team } = await requireAdminContext();
  const { data, error } = await supabase
    .from("members")
    .insert({ team_id: team.id, full_name: parsed.data.full_name })
    .select("id")
    .single();

  if (error) return { ok: false, message: "Không thể thêm thành viên. Vui lòng thử lại." };
  return { ok: true, data: { id: data.id } };
}

export async function updateMember(input: unknown): Promise<ActionResult> {
  const parsed = memberInputSchema.extend({
    member_id: memberStatusSchema.shape.member_id,
  }).safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Thông tin thành viên không hợp lệ." };
  }

  const { supabase, team } = await requireAdminContext();
  const { data, error } = await supabase
    .from("members")
    .update({ full_name: parsed.data.full_name })
    .eq("team_id", team.id)
    .eq("id", parsed.data.member_id)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, message: "Không thể cập nhật thành viên. Vui lòng thử lại." };
  if (!data) return { ok: false, message: "Không tìm thấy thành viên trong đội." };
  return { ok: true, data: undefined };
}

export async function setMemberActive(input: unknown): Promise<ActionResult> {
  const parsed = memberStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Thông tin thành viên không hợp lệ." };
  }

  const { supabase, team } = await requireAdminContext();
  const { data, error } = await supabase
    .from("members")
    .update({
      is_active: parsed.data.is_active,
      archived_at: parsed.data.is_active ? null : new Date().toISOString(),
    })
    .eq("team_id", team.id)
    .eq("id", parsed.data.member_id)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, message: "Không thể cập nhật trạng thái thành viên." };
  if (!data) return { ok: false, message: "Không tìm thấy thành viên trong đội." };
  return { ok: true, data: undefined };
}
