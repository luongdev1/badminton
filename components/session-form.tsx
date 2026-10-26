"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertTriangle, ArrowLeft, UsersRound } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { saveSession } from "@/app/sessions/actions";
import { sessionInputSchema } from "@/lib/validation";
import type { MemberRow, SessionRow } from "@/lib/supabase/data";

const inputClass = "mt-2 h-12 w-full rounded-xl border border-line bg-white px-3.5 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-brand focus:ring-2 focus:ring-emerald-100";

type ParticipantOption = { member_id: string; status: string; member_name_snapshot: string };

export function SessionForm({
  initial,
  members,
  participants = [],
  confirmedPaymentsCount = 0,
}: {
  initial?: SessionRow;
  members: MemberRow[];
  participants?: ParticipantOption[];
  confirmedPaymentsCount?: number;
}) {
  const router = useRouter();
  const editing = Boolean(initial);
  const [selectedIds, setSelectedIds] = useState(() => participants.filter((item) => item.status !== "declined").map((item) => item.member_id));
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [pending, startTransition] = useTransition();
  const memberIds = new Set(members.map((member) => member.id));
  const historicalParticipants = participants.filter((participant) => !memberIds.has(participant.member_id) && participant.status !== "declined");
  const options = [
    ...members.filter((member) => member.is_active || selectedIds.includes(member.id)),
    ...historicalParticipants.map((participant) => ({
      id: participant.member_id,
      full_name: participant.member_name_snapshot,
      is_active: false,
    })),
  ];

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const currentParticipantIds = participants.filter((item) => item.status !== "declined").map((item) => item.member_id);
    const removedIds = currentParticipantIds.filter((id) => !selectedIds.includes(id));
    if (removedIds.length && !window.confirm(`Bỏ ${removedIds.length} thành viên khỏi danh sách tham gia? Lịch sử tham gia cũ vẫn được giữ.`)) return;
    const formData = new FormData(event.currentTarget);
    const parsed = sessionInputSchema.safeParse({
      id: initial?.id,
      title: formData.get("title"),
      session_date: formData.get("session_date"),
      starts_at: formData.get("starts_at"),
      ends_at: formData.get("ends_at"),
      venue: formData.get("venue"),
      court_details: formData.get("court_details"),
      fee_per_member_vnd: Number(formData.get("fee_per_member_vnd")),
      notes: formData.get("notes"),
      member_ids: selectedIds,
    });

    if (!parsed.success) {
      setIsError(true);
      setMessage(parsed.error.issues[0]?.message ?? "Vui lòng kiểm tra thông tin buổi đánh.");
      return;
    }

    setMessage("");
    startTransition(async () => {
      let result = await saveSession(parsed.data);
      if (!result.ok && result.requiresConfirmation) {
        if (!window.confirm(result.message)) return;
        result = await saveSession({ ...parsed.data, confirm_paid_rebalance: true });
      }
      if (!result.ok) {
        setIsError(true);
        setMessage(result.message);
        if (result.savedId) router.refresh();
        return;
      }
      router.push(`/sessions/${result.data.id}`);
      router.refresh();
    });
  }

  return (
    <Card className="max-w-3xl p-5 sm:p-8">
      {message && <div role={isError ? "alert" : "status"} className="mb-5 rounded-xl bg-rose-50 p-3 text-sm leading-5 text-rose-800">{message}</div>}
      {confirmedPaymentsCount > 0 && <div className="mb-5 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-5 text-amber-900"><AlertTriangle className="mt-0.5 shrink-0" size={18} /><p>Có {confirmedPaymentsCount} khoản đã xác nhận. Nếu thay đổi người tham gia, hệ thống tính lại khoản phải trả nhưng giữ nguyên trạng thái và số tiền đã thu; phần thu vượt mức mới không tự động hoàn.</p></div>}
      <form onSubmit={submit} className="space-y-5">
        <div><label htmlFor="title" className="text-sm font-semibold text-ink">Tên buổi đánh <span className="text-rose-600">*</span></label><input required id="title" name="title" maxLength={120} defaultValue={initial?.title} placeholder="Ví dụ: Giao lưu cuối tuần" className={inputClass} /></div>
        <div className="grid gap-5 sm:grid-cols-3">
          <div><label htmlFor="session_date" className="text-sm font-semibold text-ink">Ngày chơi <span className="text-rose-600">*</span></label><input required id="session_date" name="session_date" type="date" defaultValue={initial?.session_date} className={inputClass} /></div>
          <div><label htmlFor="starts_at" className="text-sm font-semibold text-ink">Bắt đầu <span className="text-rose-600">*</span></label><input required id="starts_at" name="starts_at" type="time" defaultValue={initial?.starts_at.slice(0, 5)} className={inputClass} /></div>
          <div><label htmlFor="ends_at" className="text-sm font-semibold text-ink">Kết thúc <span className="text-rose-600">*</span></label><input required id="ends_at" name="ends_at" type="time" defaultValue={initial?.ends_at.slice(0, 5)} className={inputClass} /></div>
        </div>
        <div><label htmlFor="venue" className="text-sm font-semibold text-ink">Tên sân / địa điểm <span className="text-rose-600">*</span></label><input required id="venue" name="venue" maxLength={200} defaultValue={initial?.venue} placeholder="Tên sân hoặc nhà thi đấu" className={inputClass} /></div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div><label htmlFor="court_details" className="text-sm font-semibold text-ink">Số sân</label><input id="court_details" name="court_details" maxLength={200} defaultValue={initial?.court_details ?? ""} placeholder="Ví dụ: Sân 1, 2" className={inputClass} /></div>
          <div><label htmlFor="fee_per_member_vnd" className="text-sm font-semibold text-ink">Mức phí tham khảo (VNĐ)</label><input min="0" max={Number.MAX_SAFE_INTEGER} step="1" id="fee_per_member_vnd" name="fee_per_member_vnd" type="number" defaultValue={initial?.fee_per_member_vnd ?? 0} className={inputClass} /><p className="mt-1 text-xs leading-5 text-muted">Khoản phải trả được tính từ tổng chi phí thực tế, không dùng mức phí tham khảo này.</p></div>
        </div>
        <fieldset className="rounded-2xl border border-line p-4 sm:p-5">
          <legend className="px-1 text-sm font-semibold text-ink">Người tham gia</legend>
          {options.length === 0 ? <p className="py-3 text-sm text-muted">Chưa có thành viên đang hoạt động. Hãy thêm thành viên trước.</p> : <div className="mt-2 grid gap-2 sm:grid-cols-2">{options.map((member) => <label key={member.id} className={`flex items-center gap-3 rounded-xl border border-line p-3 ${member.is_active ? "cursor-pointer hover:bg-slate-50" : "bg-slate-50"}`}><input type="checkbox" checked={selectedIds.includes(member.id)} disabled={!member.is_active} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, member.id] : current.filter((id) => id !== member.id))} className="h-4 w-4 accent-[#16794a]" /><span className="min-w-0 flex-1 text-sm font-medium text-ink">{member.full_name}{!member.is_active && <small className="ml-2 text-xs text-muted">(đã ẩn — lịch sử)</small>}</span></label>)}</div>}
          <p className="mt-3 flex items-center gap-2 text-xs text-muted"><UsersRound size={14} /> Thành viên đã ẩn không thể thêm vào buổi mới; tham gia cũ được giữ lại.</p>
        </fieldset>
        <div><label htmlFor="notes" className="text-sm font-semibold text-ink">Ghi chú <span className="font-normal text-muted">(không bắt buộc)</span></label><textarea id="notes" name="notes" rows={3} maxLength={2000} defaultValue={initial?.notes ?? ""} placeholder="Thông tin thêm cho thành viên..." className="mt-2 w-full resize-y rounded-xl border border-line bg-white px-3.5 py-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-emerald-100" /></div>
        <div className="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:justify-end"><Link href={initial ? `/sessions/${initial.id}` : "/sessions"} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line px-4 text-sm font-semibold text-ink hover:bg-slate-50"><ArrowLeft size={16} className="mr-2" />Hủy</Link><Button type="submit" disabled={pending}>{pending ? "Đang lưu..." : editing ? "Lưu thay đổi" : "Tạo buổi đánh"}</Button></div>
      </form>
    </Card>
  );
}
