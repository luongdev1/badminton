import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Clock3, MapPin, Pencil, UsersRound, Wallet } from "lucide-react";
import { ExpenseManager } from "@/components/expense-manager";
import { BankPaymentCard } from "@/components/bank-payment-card";
import { SessionShareControl } from "@/components/session-share-control";
import { CloseSessionButton } from "@/components/close-session-button";
import { Badge, Card, PageHeading } from "@/components/ui";
import { longDate, money } from "@/lib/format";
import { getSessionDetail, getTeamSettings } from "@/lib/supabase/data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function SessionDetailPage({ params }: { params: { id: string } }) {
  const [detail, settings] = await Promise.all([getSessionDetail(params.id), getTeamSettings()]);
  if (!detail) notFound();
  const { session, participants, expenses, expectedVnd, collectedVnd, outstandingVnd, expensesVnd, unallocatedVnd } = detail;
  const activeParticipants = participants.filter((participant) => participant.status !== "declined");
  const supabase = await createSupabaseServerClient();
  const qrImageUrl = settings.qr_storage_path
    ? settings.qr_storage_path.startsWith("https://")
      ? settings.qr_storage_path
      : supabase.storage.from("team-bank-qr").getPublicUrl(settings.qr_storage_path).data.publicUrl
    : null;

  return (
    <>
      <Link href="/sessions" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-brand"><ArrowLeft size={16} />Quay lại danh sách</Link>
      <PageHeading eyebrow="Chi tiết buổi đánh" title={session.title} description={longDate(session.session_date)} action={<div className="flex flex-wrap gap-2"><SessionShareControl sessionId={session.id} initialShareEnabled={Boolean(session.share_token_hash)} />{session.status === "scheduled" && <CloseSessionButton sessionId={session.id} />}<Link href={`/sessions/${session.id}/edit`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink hover:border-brand hover:text-brand"><Pencil size={16} />Chỉnh sửa</Link></div>} />

      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Card className="p-5 sm:p-7">
          <div className="flex items-start justify-between"><div><Badge tone={session.status === "scheduled" ? "green" : session.status === "completed" ? "blue" : "gray"}>{session.status === "scheduled" ? "Sắp diễn ra" : session.status === "completed" ? "Đã hoàn thành" : "Đã hủy"}</Badge><h2 className="mt-4 text-xl font-bold text-ink">Thông tin buổi đánh</h2></div><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-mint text-brand"><CalendarDays size={22} /></span></div>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <Detail icon={<CalendarDays size={18} />} label="Ngày" value={longDate(session.session_date)} />
            <Detail icon={<Clock3 size={18} />} label="Thời gian" value={`${session.starts_at.slice(0, 5)} – ${session.ends_at.slice(0, 5)}`} />
            <Detail icon={<MapPin size={18} />} label="Địa điểm" value={session.venue} />
            <Detail icon={<UsersRound size={18} />} label="Sân" value={session.court_details || "Chưa cập nhật"} />
          </div>
          <div className="mt-7 rounded-2xl bg-[#f5f9f6] p-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted">Ghi chú</p><p className="mt-2 whitespace-pre-wrap text-sm text-ink">{session.notes || "Chưa có ghi chú cho buổi đánh này."}</p></div>
        </Card>

        <Card className="p-5 sm:p-7">
          <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 text-sky-700"><Wallet size={20} /></span><div><h2 className="font-bold text-ink">Tổng quan chi phí</h2><p className="text-xs text-muted">Dữ liệu đang lưu trong đội</p></div></div>
          <div className="mt-6 space-y-4">
            <Row label="Thành viên tham gia" value={`${activeParticipants.length} người`} />
            <Row label="Dự kiến thu theo chia đều" value={money(expectedVnd)} bold />
            <Row label="Đã thu" value={money(collectedVnd)} />
            <Row label="Tổng khoản chi" value={money(expensesVnd)} />
            <div className="flex items-center justify-between border-t border-line pt-4"><span className="text-sm text-muted">Còn cần thu</span><span className="font-bold text-amber-700">{money(outstandingVnd)}</span></div>
          </div>
        </Card>
      </div>
      {unallocatedVnd > 0 && <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">Chưa có người tham gia để chia {money(unallocatedVnd)} chi phí. Thêm người tham gia để hệ thống phân bổ khoản phải trả.</div>}

      <Card className="mt-5 overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-5"><div><h2 className="font-bold text-ink">Danh sách tham gia</h2><p className="mt-1 text-xs text-muted">{activeParticipants.length} người đang được tính vào buổi đánh</p></div><Badge tone="blue">{activeParticipants.length} người</Badge></div>
        {participants.length === 0 ? <p className="p-8 text-center text-sm text-muted">Chưa chọn thành viên tham gia.</p> : <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">{participants.map((participant) => <div key={participant.id} className={`flex items-center gap-3 rounded-xl border border-line p-3 ${participant.status === "declined" ? "opacity-60" : ""}`}><span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">{participant.member_name_snapshot.split(/\s+/).map((part) => part[0]).join("").slice(-2).toUpperCase()}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm text-ink">{participant.member_name_snapshot}</strong><small className="block text-xs text-muted">{participant.status === "declined" ? "Đã rút khỏi buổi" : participant.status === "attended" ? "Đã tham gia" : participant.status === "absent" ? "Vắng mặt" : "Đã xác nhận"}</small>{participant.status !== "declined" && <small className="mt-1 block text-xs font-semibold text-ink">Phải trả: {money(participant.payment_due_vnd)}{participant.payment_status === "paid" ? ` · Đã thu: ${money(participant.payment_amount_vnd ?? 0)}` : ""}</small>}</span></div>)}</div>}
      </Card>

      <section className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <BankPaymentCard settings={settings} qrImageUrl={qrImageUrl} />
        <Card className="p-5 sm:p-7">
          <h2 className="font-bold text-ink">Khoản phải trả từng người</h2>
          <p className="mt-1 text-sm text-muted">Chỉ tính thành viên đang tham gia; số tiền được phân bổ bởi database.</p>
          <div className="mt-4 space-y-3">
            {activeParticipants.length ? activeParticipants.map((participant) => <div key={participant.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-3"><span className="min-w-0 truncate text-sm font-medium text-ink">{participant.member_name_snapshot}</span><strong className="shrink-0 text-sm text-brand">{money(participant.payment_due_vnd)}</strong></div>) : <p className="rounded-xl bg-slate-50 p-4 text-sm text-muted">Chưa có thành viên được tính phí.</p>}
          </div>
        </Card>
      </section>

      <ExpenseManager sessionId={session.id} initialExpenses={expenses} hasConfirmedPayments={detail.hasConfirmedPayments} />
    </>
  );
}

function Detail({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="flex gap-3"><span className="mt-0.5 text-brand">{icon}</span><span><span className="block text-xs text-muted">{label}</span><strong className="mt-1 block text-sm text-ink">{value}</strong></span></div>;
}

function Row({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return <div className="flex items-center justify-between gap-3"><span className="text-sm text-muted">{label}</span><span className={`text-sm ${bold ? "font-bold text-ink" : "font-medium text-ink"}`}>{value}</span></div>;
}
