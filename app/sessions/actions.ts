"use server";

import { z } from "zod";
import { requireAdminContext } from "@/lib/supabase/admin-context";
import { expenseIdSchema, expenseMutationSchema, sessionInputSchema } from "@/lib/validation";
import { createPublicShareToken, hashPublicShareToken } from "@/lib/public-share-token";
import { sessionStatusAfterSave } from "@/lib/session-lifecycle";
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

  const deselectedIds = existingParticipants
    .filter((participant) => !selectedIds.has(participant.member_id) && ["invited", "confirmed"].includes(participant.status))
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

  const { supabase, team } = await requireAdminContext();
  const { session_id: sessionId, id, confirm_paid_rebalance: confirmPaidRebalance, ...expense } = parsed.data;
  const session = await supabase
    .from("sessions")
    .select("id")
    .eq("team_id", team.id)
    .eq("id", sessionId)
    .maybeSingle();

  if (session.error) return { ok: false, message: `Không thể kiểm tra buổi đánh: ${session.error.message}` };
  if (!session.data) return { ok: false, message: "Không tìm thấy buổi đánh." };

  let amountChanged = !id;
  if (id) {
    const { data: existingExpense, error: expenseReadError } = await supabase
      .from("session_expenses")
      .select("amount_vnd")
      .eq("id", id)
      .eq("session_id", sessionId)
      .eq("team_id", team.id)
      .maybeSingle();
    if (expenseReadError) return { ok: false, message: `Không thể kiểm tra khoản chi: ${expenseReadError.message}` };
    if (!existingExpense) return { ok: false, message: "Không tìm thấy khoản chi cần cập nhật." };
    amountChanged = existingExpense.amount_vnd !== expense.amount_vnd;
  }

  if (amountChanged) {
    const { data: paidPayment, error: paymentReadError } = await supabase
      .from("payments")
      .select("id")
      .eq("team_id", team.id)
      .eq("session_id", sessionId)
      .eq("status", "paid")
      .limit(1)
      .maybeSingle();
    if (paymentReadError) return { ok: false, message: `Không thể kiểm tra khoản đã thu: ${paymentReadError.message}` };
    if (paidPayment && !confirmPaidRebalance) {
      return {
        ok: false,
        requiresConfirmation: true,
        message: "Thay đổi chi phí sẽ tính lại khoản phải trả. Khoản đã xác nhận và trạng thái thanh toán sẽ được giữ nguyên; nếu đã thu vượt mức mới, không tự hoàn tiền.",
      };
    }
  }

  const query = id
    ? supabase.from("session_expenses").update(expense).eq("id", id).eq("session_id", sessionId).eq("team_id", team.id)
    : supabase.from("session_expenses").insert({ ...expense, session_id: sessionId, team_id: team.id });
  const { data, error } = await query.select("id").maybeSingle();

  if (error) return { ok: false, message: `Không thể lưu khoản chi: ${error.message}` };
  if (!data) return { ok: false, message: "Không tìm thấy khoản chi cần cập nhật." };
  return { ok: true, data: { id: data.id } };
}

export async function deleteSessionExpense(input: unknown): Promise<ExpenseDeleteResult> {
  const parsed = expenseIdSchema.extend({
    confirm_paid_rebalance: expenseMutationSchema.shape.confirm_paid_rebalance,
  }).safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Khoản chi không hợp lệ." };
  }

  const { supabase, team } = await requireAdminContext();
  const { data: paidPayment, error: paymentReadError } = await supabase
    .from("payments")
    .select("id")
    .eq("team_id", team.id)
    .eq("session_id", parsed.data.session_id)
    .eq("status", "paid")
    .limit(1)
    .maybeSingle();
  if (paymentReadError) return { ok: false, message: `Không thể kiểm tra khoản đã thu: ${paymentReadError.message}` };
  if (paidPayment && !parsed.data.confirm_paid_rebalance) {
    return {
      ok: false,
      requiresConfirmation: true,
      message: "Xóa khoản chi sẽ tính lại khoản phải trả. Khoản đã xác nhận và trạng thái thanh toán sẽ được giữ nguyên; nếu đã thu vượt mức mới, không tự hoàn tiền.",
    };
  }

  const { data, error } = await supabase
    .from("session_expenses")
    .delete()
    .eq("team_id", team.id)
    .eq("session_id", parsed.data.session_id)
    .eq("id", parsed.data.expense_id)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, message: "Không thể xóa khoản chi." };
  if (!data) return { ok: false, message: "Không tìm thấy khoản chi cần xóa." };
  return { ok: true, data: undefined };
}
