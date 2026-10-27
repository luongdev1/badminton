"use server";

import { z } from "zod";
import { requireAdminContext } from "@/lib/supabase/admin-context";
import { expenseIdSchema, expenseMutationSchema, sessionInputSchema } from "@/lib/validation";
import { createPublicShareToken, hashPublicShareToken } from "@/lib/public-share-token";
import { sessionStatusAfterSave } from "@/lib/session-lifecycle";
import { getOrCreateTeamVenue } from "@/lib/supabase/venues";
import type { ActionResult } from "@/app/members/actions";

export type SessionSaveResult =
  | { ok: true; data: { id: string } }
  | { ok: false; message: string; savedId?: string; requiresConfirmation?: true };

export async function setSessionShare(input: unknown) {
  const parsed = z.object({
    session_id: z.string().uuid("Buổi đánh không hợp lệ."),
    enabled: z.boolean(),
  }).safeParse(input);
  if (!parsed.success) return { ok: false as const, message: parsed.error.issues[0]?.message ?? "Yêu cầu không hợp lệ." };

  const { supabase, team } = await requireAdminContext();
  const shareToken = parsed.data.enabled ? createPublicShareToken() : null;
  const { data, error } = await supabase
    .from("sessions")
    .update({ share_token_hash: shareToken ? hashPublicShareToken(shareToken) : null })
    .eq("team_id", team.id)
    .eq("id", parsed.data.session_id)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false as const, message: `Không thể cập nhật liên kết chia sẻ: ${error.message}` };
  if (!data) return { ok: false as const, message: "Không tìm thấy buổi đánh." };
  return { ok: true as const, token: shareToken };
}

export async function saveSession(input: unknown): Promise<SessionSaveResult> {
  const parsed = sessionInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Thông tin buổi đánh không hợp lệ." };
  }

  const { supabase, team } = await requireAdminContext();
  const { member_ids: memberIds, id, confirm_paid_rebalance: confirmPaidRebalance, ...sessionInput } = parsed.data;
  let venueId: string;
  try {
    venueId = await getOrCreateTeamVenue(supabase, team.id, sessionInput.venue);
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Không thể kiểm tra địa điểm/sân.",
    };
  }
  const todayInVietnam = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const { data: members, error: memberReadError } = memberIds.length
    ? await supabase.from("members").select("id,full_name,is_active").eq("team_id", team.id).in("id", memberIds)
    : { data: [], error: null };

  if (memberReadError) return { ok: false, message: "Không thể xác thực danh sách thành viên." };
  const memberById = new Map((members ?? []).map((member) => [member.id, member]));

  let existingParticipants: { id: string; member_id: string; status: string }[] = [];
  let existingSessionStatus: "scheduled" | "completed" | "cancelled" | undefined;
  if (id) {
    const [sessionResult, participantsResult] = await Promise.all([
      supabase.from("sessions").select("id,status").eq("team_id", team.id).eq("id", id).maybeSingle(),
      supabase.from("session_participants").select("id,member_id,status").eq("team_id", team.id).eq("session_id", id),
    ]);
    if (sessionResult.error || participantsResult.error) {
      return { ok: false, message: "Không thể kiểm tra buổi đánh hiện tại." };
    }
    if (!sessionResult.data) return { ok: false, message: "Không tìm thấy buổi đánh cần cập nhật." };
    existingSessionStatus = sessionResult.data.status;
    existingParticipants = participantsResult.data ?? [];
    const selectedIds = new Set(memberIds);
    const participantListChanged = existingParticipants.some((participant) => (
      participant.status !== "declined" && !selectedIds.has(participant.member_id)
    )) || memberIds.some((memberId) => !existingParticipants.some((participant) => (
      participant.member_id === memberId && participant.status !== "declined"
    )));
    if (participantListChanged) {
      const { data: paidPayment, error: paymentReadError } = await supabase
        .from("payments")
        .select("id")
        .eq("team_id", team.id)
        .eq("session_id", id)
        .eq("status", "paid")
        .limit(1)
        .maybeSingle();
      if (paymentReadError) return { ok: false, message: `Không thể kiểm tra khoản đã thu: ${paymentReadError.message}` };
      if (paidPayment && !confirmPaidRebalance) {
        return {
          ok: false,
          requiresConfirmation: true,
          message: "Thay đổi danh sách sẽ tính lại khoản phải trả. Khoản đã xác nhận và trạng thái thanh toán sẽ được giữ nguyên; nếu đã thu vượt mức mới, không tự hoàn tiền.",
        };
      }
    }
  }
  const status = sessionStatusAfterSave(sessionInput.session_date, todayInVietnam, existingSessionStatus);

  const existingByMemberId = new Map(existingParticipants.map((participant) => [participant.member_id, participant]));
  const invalidMember = memberIds.find((memberId) => {
    const member = memberById.get(memberId);
    return !member || (!member.is_active && !existingByMemberId.has(memberId));
  });
  if (invalidMember) {
    return { ok: false, message: "Danh sách có thành viên không tồn tại hoặc đã ngừng hoạt động." };
  }

  let sessionId = id;
  if (sessionId) {
    const { data, error } = await supabase
      .from("sessions")
      .update({
        ...sessionInput,
        team_id: team.id,
        venue_id: venueId,
        status,
        fee_per_member_vnd: sessionInput.fee_per_member_vnd,
        court_details: sessionInput.court_details || null,
        notes: sessionInput.notes || null,
      })
      .eq("team_id", team.id)
      .eq("id", sessionId)
      .select("id")
      .maybeSingle();

    if (error) return { ok: false, message: "Không thể cập nhật buổi đánh.", savedId: sessionId };
    if (!data) return { ok: false, message: "Không tìm thấy buổi đánh cần cập nhật." };
  } else {
    const { data, error } = await supabase
      .from("sessions")
      .insert({
        ...sessionInput,
        team_id: team.id,
        venue_id: venueId,
        status,
        fee_per_member_vnd: sessionInput.fee_per_member_vnd,
        court_details: sessionInput.court_details || null,
        notes: sessionInput.notes || null,
      })
      .select("id")
      .single();

    if (error) return { ok: false, message: "Không thể tạo buổi đánh. Vui lòng thử lại." };
    sessionId = data.id;
  }

  const selectedIds = new Set(memberIds);
  const newParticipants = memberIds
    .filter((memberId) => !existingByMemberId.has(memberId))
    .map((memberId) => {
      const member = memberById.get(memberId);
      return {
        team_id: team.id,
        session_id: sessionId,
        member_id: memberId,
        member_name_snapshot: member?.full_name ?? "",
        fee_snapshot_vnd: sessionInput.fee_per_member_vnd,
        status: "confirmed" as const,
      };
    });

  if (newParticipants.length) {
    const { error } = await supabase.from("session_participants").insert(newParticipants);
    if (error) {
      return { ok: false, message: `Buổi đánh đã được lưu nhưng chưa lưu được người tham gia: ${error.message}` };
    }
  }

  const rejoinedParticipantIds = existingParticipants
    .filter((participant) => participant.status === "declined" && selectedIds.has(participant.member_id))
    .map((participant) => participant.id);
  if (rejoinedParticipantIds.length) {
    const { error } = await supabase
      .from("session_participants")
      .update({ status: "confirmed", fee_snapshot_vnd: sessionInput.fee_per_member_vnd })
      .eq("team_id", team.id)
      .eq("session_id", sessionId)
      .in("id", rejoinedParticipantIds);
    if (error) {
      return { ok: false, message: `Buổi đánh đã được lưu nhưng chưa thể khôi phục thành viên: ${error.message}` };
    }
  }

  const deselectedIds = existingParticipants
    .filter((participant) => !selectedIds.has(participant.member_id) && participant.status !== "declined")
    .map((participant) => participant.id);
  if (deselectedIds.length) {
    const { error } = await supabase
      .from("session_participants")
      .update({ status: "declined" })
      .eq("team_id", team.id)
      .eq("session_id", sessionId)
      .in("id", deselectedIds);
    if (error) {
      return { ok: false, message: `Buổi đánh đã được lưu nhưng chưa cập nhật được danh sách tham gia: ${error.message}` };
    }
  }

  return { ok: true, data: { id: sessionId } };
}

export async function closeSession(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ session_id: z.string().uuid("Buổi đánh không hợp lệ.") }).safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Buổi đánh không hợp lệ." };

  const { supabase, team } = await requireAdminContext();
  const { data, error } = await supabase
    .from("sessions")
    .update({ status: "completed" })
    .eq("team_id", team.id)
    .eq("id", parsed.data.session_id)
    .eq("status", "scheduled")
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, message: `Không thể đóng buổi đánh: ${error.message}` };
  if (data) return { ok: true, data: undefined };

  const { data: session, error: readError } = await supabase
    .from("sessions")
    .select("status")
    .eq("team_id", team.id)
    .eq("id", parsed.data.session_id)
    .maybeSingle();
  if (readError) return { ok: false, message: `Không thể kiểm tra buổi đánh: ${readError.message}` };
  if (!session) return { ok: false, message: "Không tìm thấy buổi đánh." };
  if (session.status === "completed") return { ok: true, data: undefined };
  return { ok: false, message: "Buổi đã bị hủy nên không thể đóng." };
}

export type ExpenseSaveResult =
  | ActionResult<{ id: string }>
  | { ok: false; requiresConfirmation: true; message: string };

export type ExpenseDeleteResult =
  | ActionResult
  | { ok: false; requiresConfirmation: true; message: string };

export async function createSessionExpense(input: unknown): Promise<ExpenseSaveResult> {
  const parsed = expenseMutationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Khoản chi không hợp lệ." };
  }

  const { supabase, team, userId } = await requireAdminContext();
  const { data, error } = await supabase.rpc("save_session_expense", {
    p_team_id: team.id,
    p_session_id: parsed.data.session_id,
    p_expense_id: parsed.data.id ?? null,
    p_description: parsed.data.description,
    p_category: parsed.data.category,
    p_amount_vnd: parsed.data.amount_vnd,
    p_member_ids: parsed.data.participant_ids,
    p_confirm_paid_rebalance: parsed.data.confirm_paid_rebalance ?? false,
    p_actor_app_user_id: userId,
  });

  if (error) return { ok: false, message: `Không thể lưu khoản chi: ${error.message}` };
  const result = z.object({
    ok: z.boolean(),
    code: z.string().optional(),
    message: z.string().optional(),
    expense_id: z.string().uuid().optional(),
  }).safeParse(data);
  if (!result.success) return { ok: false, message: "Phản hồi lưu khoản chi không hợp lệ." };
  if (result.data.code === "confirmation_required") {
    return {
      ok: false,
      requiresConfirmation: true,
      message: result.data.message ?? "Thay đổi sẽ tính lại khoản phải trả nhưng giữ nguyên lịch sử thu.",
    };
  }
  if (!result.data.ok || !result.data.expense_id) {
    return { ok: false, message: expenseErrorMessage(result.data.code) };
  }
  return { ok: true, data: { id: result.data.expense_id } };
}

export async function deleteSessionExpense(input: unknown): Promise<ExpenseDeleteResult> {
  const parsed = expenseIdSchema.extend({
    confirm_paid_rebalance: expenseMutationSchema.shape.confirm_paid_rebalance,
  }).safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Khoản chi không hợp lệ." };
  }

  const { supabase, team, userId } = await requireAdminContext();
  const { data, error } = await supabase.rpc("delete_session_expense", {
    p_team_id: team.id,
    p_session_id: parsed.data.session_id,
    p_expense_id: parsed.data.expense_id,
    p_confirm_paid_rebalance: parsed.data.confirm_paid_rebalance ?? false,
    p_actor_app_user_id: userId,
  });

  if (error) return { ok: false, message: `Không thể xóa khoản chi: ${error.message}` };
  const result = z.object({
    ok: z.boolean(),
    code: z.string().optional(),
    message: z.string().optional(),
  }).safeParse(data);
  if (!result.success) return { ok: false, message: "Phản hồi xóa khoản chi không hợp lệ." };
  if (result.data.code === "confirmation_required") {
    return {
      ok: false,
      requiresConfirmation: true,
      message: result.data.message ?? "Xóa khoản chi sẽ tính lại khoản phải trả nhưng giữ nguyên lịch sử thu.",
    };
  }
  if (!result.data.ok) return { ok: false, message: expenseErrorMessage(result.data.code) };
  return { ok: true, data: undefined };
}

function expenseErrorMessage(code?: string) {
  switch (code) {
    case "session_not_found": return "Không tìm thấy buổi đánh.";
    case "expense_not_found": return "Không tìm thấy khoản chi.";
    case "invalid_participants": return "Một hoặc nhiều thành viên không còn tham gia buổi đánh này.";
    case "duplicate_members": return "Danh sách người chia khoản chi bị trùng.";
    case "invalid_expense": return "Thông tin khoản chi không hợp lệ.";
    default: return "Không thể lưu thay đổi khoản chi.";
  }
}
