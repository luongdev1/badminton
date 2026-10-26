"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { infer as Infer } from "zod";
import { CalendarDays, Clock3, MapPin, RefreshCw, UsersRound } from "lucide-react";
import { BankPaymentCard } from "@/components/bank-payment-card";
import { Card, PageHeading } from "@/components/ui";
import { longDate, money } from "@/lib/format";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { publicSessionShareSchema } from "@/lib/validation";

type ShareData = Infer<typeof publicSessionShareSchema>;
const SHARE_TOKEN_STORAGE_KEY = "rallyteam.public-share-token";

export function PublicSessionShare() {
  const [token, setToken] = useState<string | null>(null);
  const [share, setShare] = useState<ShareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const [message, setMessage] = useState("");
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const loadShare = useCallback(async (shareToken: string, showLoading = false): Promise<boolean> => {
    if (showLoading) setLoading(true);
    try {
      const response = await fetch("/api/public-share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ action: "read", token: shareToken }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        if (response.status === 404) {
          window.sessionStorage.removeItem(SHARE_TOKEN_STORAGE_KEY);
          setShare(null);
          setToken(null);
          setMessage("Liên kết chia sẻ không hợp lệ hoặc đã bị thu hồi.");
          return false;
        }
        const error = result && typeof result === "object" && "error" in result && typeof result.error === "string"
          ? result.error
          : "Không thể tải thông tin chia sẻ.";
        setMessage(error);
        return true;
      }
      const parsed = publicSessionShareSchema.safeParse(result);
      if (!parsed.success) {
        setMessage("Dữ liệu chia sẻ không đúng định dạng.");
        return true;
      }
      setShare(parsed.data);
      setMessage("");
      return true;
    } catch {
      setMessage("Lỗi kết nối. Kiểm tra mạng rồi tải lại trang.");
      return true;
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const hasFragment = window.location.hash.length > 1;
    const fragmentToken = window.location.hash.slice(1);
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    if (hasFragment && !/^[A-Za-z0-9_-]{43}$/.test(fragmentToken)) {
      setMessage("Liên kết chia sẻ không hợp lệ hoặc đã bị thu hồi.");
      setLoading(false);
      return;
    }
    const shareToken = hasFragment ? fragmentToken : window.sessionStorage.getItem(SHARE_TOKEN_STORAGE_KEY);
    if (!shareToken || !/^[A-Za-z0-9_-]{43}$/.test(shareToken)) {
      setMessage("Liên kết chia sẻ không hợp lệ hoặc đã bị thu hồi.");
      setLoading(false);
      return;
    }
    window.sessionStorage.setItem(SHARE_TOKEN_STORAGE_KEY, shareToken);
    setToken(shareToken);
    void loadShare(shareToken, true);
    const interval = window.setInterval(() => {
      void loadShare(shareToken).then((shouldContinue) => {
        if (!shouldContinue) window.clearInterval(interval);
      });
    }, 15000);
    return () => window.clearInterval(interval);
  }, [loadShare]);

  async function togglePayment(paymentId: string, paid: boolean) {
    if (!token) return;
    setPendingIds((previous) => new Set(previous).add(paymentId));
    setMessage("");
    try {
      const response = await fetch("/api/public-share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ action: "confirm", token, payment_id: paymentId, paid }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const error = result && typeof result === "object" && "error" in result && typeof result.error === "string"
          ? result.error
          : "Không thể cập nhật trạng thái thanh toán.";
        setMessage(error);
        return;
      }
      await loadShare(token);
      setMessage(paid
        ? "Đã ghi nhận xác nhận thanh toán thủ công."
        : "Đã bỏ xác nhận thanh toán.");
    } catch {
      setMessage("Lỗi kết nối. Trạng thái chưa được xác nhận; vui lòng thử lại.");
    } finally {
      setPendingIds((previous) => {
        const next = new Set(previous);
        next.delete(paymentId);
        return next;
      });
    }
  }

  if (loading) {
    return <div className="mx-auto max-w-5xl"><Card className="p-8 text-center text-sm text-muted"><RefreshCw className="mx-auto mb-3 animate-spin text-brand" size={22} />Đang tải thông tin buổi đánh...</Card></div>;
  }
  if (!share) {
    return <div className="mx-auto max-w-xl"><Card className="p-6 text-center"><h1 className="text-lg font-bold text-ink">Không mở được link chia sẻ</h1><p role="alert" className="mt-2 text-sm leading-6 text-rose-700">{message || "Liên kết không hợp lệ hoặc đã bị thu hồi."}</p><button type="button" onClick={() => window.location.reload()} className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-white">Tải lại</button></Card></div>;
  }

  const { session, team, expenses, participants, totals } = share;
  const qrImageUrl = team.qr_storage_path
    ? team.qr_storage_path.startsWith("https://")
      ? team.qr_storage_path
      : supabase.storage.from("team-bank-qr").getPublicUrl(team.qr_storage_path).data.publicUrl
    : null;

  return <div className="mx-auto max-w-5xl">
    <PageHeading eyebrow={team.team_name} title={session.title} description={`${longDate(session.session_date)} · Link chia sẻ công khai`} />
    {message && <p role="status" aria-live="polite" className="mb-4 rounded-xl bg-sky-50 p-3 text-sm text-sky-900">{message}</p>}
    <Card className="mb-5 p-5 sm:p-7">
      <h2 className="font-bold text-ink">Thông tin buổi đánh</h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <Detail icon={<CalendarDays size={18} />} label="Ngày" value={longDate(session.session_date)} />
        <Detail icon={<Clock3 size={18} />} label="Thời gian" value={`${session.starts_at.slice(0, 5)} – ${session.ends_at.slice(0, 5)}`} />
        <Detail icon={<MapPin size={18} />} label="Địa điểm" value={`${session.venue}${session.court_details ? ` · ${session.court_details}` : ""}`} />
      </div>
    </Card>

    <div className="mb-5 grid gap-3 sm:grid-cols-3">
      <Summary label="Tổng chi phí" amount={totals.expenses_vnd} />
      <Summary label="Đã xác nhận" amount={totals.collected_vnd} />
      <Summary label="Còn thiếu" amount={totals.outstanding_vnd} />
    </div>

    {expenses.length > 0 && <Card className="mb-5 overflow-hidden">
      <div className="border-b border-line px-5 py-4"><h2 className="font-bold text-ink">Các khoản chi</h2></div>
      <div className="divide-y divide-line px-5">{expenses.map((expense, index) => <div key={`${expense.description}-${index}`} className="flex items-center justify-between gap-3 py-3"><span className="text-sm text-ink">{expense.description}</span><strong className="text-sm text-ink">{money(expense.amount_vnd)}</strong></div>)}</div>
    </Card>}

    <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
      <BankPaymentCard settings={team} qrImageUrl={qrImageUrl} />
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-5">
          <div><h2 className="font-bold text-ink">Thành viên và thanh toán</h2><p className="mt-1 text-xs text-muted">{participants.length} người tham gia</p></div>
          <UsersRound size={20} className="text-brand" />
        </div>
        {participants.length
          ? <div className="divide-y divide-line px-4 sm:px-5">{participants.map((participant) => {
            const canToggle = participant.payment_status === "pending" || participant.payment_status === "paid" || participant.payment_status === "refunded";
            const isPaid = participant.payment_status === "paid";
            return <div key={participant.payment_id} className="flex items-center gap-3 py-4">
              <span className="min-w-0 flex-1">
                <strong className="block truncate text-sm text-ink">{participant.name}</strong>
                <small className="mt-1 block text-xs text-muted">Cần chuyển: {money(participant.amount_to_pay_vnd)}</small>
                {participant.paid_at && isPaid && <small className="mt-1 block text-xs text-emerald-700">Xác nhận lúc {new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(participant.paid_at))}</small>}
              </span>
              {canToggle
                ? <label className={`flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-xs font-semibold ${isPaid ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-700"} ${pendingIds.has(participant.payment_id) ? "opacity-50" : ""}`}>
                  <input type="checkbox" checked={isPaid} disabled={pendingIds.has(participant.payment_id)} onChange={(event) => void togglePayment(participant.payment_id, event.target.checked)} className="h-4 w-4 accent-emerald-700" aria-label={`${isPaid ? "Bỏ xác nhận" : "Xác nhận"} thanh toán của ${participant.name}`} />
                  {pendingIds.has(participant.payment_id) ? "Đang lưu..." : isPaid ? "Đã thanh toán" : "Chưa thanh toán"}
                </label>
                : <span className="rounded-xl bg-slate-100 px-3 py-3 text-xs font-semibold text-slate-600">{participant.payment_status === "waived" ? "Miễn thu" : "Đã hoàn"}</span>}
            </div>;
          })}</div>
          : <p className="p-6 text-sm text-muted">Chưa có thành viên tham gia.</p>}
      </Card>
    </div>

    <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
      Trạng thái thanh toán do người có link tự xác nhận thủ công, không được đối chiếu với ngân hàng và không xác định danh tính người tick. Dữ liệu được làm mới tự động khoảng mỗi 15 giây.
    </p>
  </div>;
}

function Summary({ label, amount }: { label: string; amount: number }) {
  return <Card className="p-4"><p className="text-xs font-medium text-muted">{label}</p><p className="mt-2 text-xl font-bold text-ink">{money(amount)}</p></Card>;
}

function Detail({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="flex gap-3"><span className="mt-0.5 text-brand">{icon}</span><span><span className="block text-xs text-muted">{label}</span><strong className="mt-1 block text-sm text-ink">{value}</strong></span></div>;
}
