import Link from "next/link";
import { ArrowRight, CalendarDays, CircleDollarSign, Clock3, Plus, UsersRound, Wallet } from "lucide-react";
import { Badge, Card, PageHeading, StatCard } from "@/components/ui";
import { money, shortDate } from "@/lib/format";
import { getDashboardData } from "@/lib/supabase/data";

export default async function DashboardPage() {
  const data = await getDashboardData();
  const nextSession = data.nextSession;
  const today = new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const outstandingVnd = data.outstandingVnd;

  return (
    <>
      <PageHeading eyebrow={today} title={`Chào ${data.team.team_name} 👋`} description="Tổng quan buổi đánh và tình hình đóng góp của đội." action={<Link href="/sessions/new" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark"><Plus size={18} />Tạo buổi đánh</Link>} />
      <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900"><span className="font-bold">Đã kết nối với dữ liệu đội:</span> các số liệu bên dưới được tải từ Supabase.</div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Chi phí tháng này" value={money(data.expensesVnd)} detail="Tổng khoản chi đã ghi nhận" icon={<CircleDollarSign size={21} />} />
        <StatCard label="Thành viên hoạt động" value={`${data.activeMembers} người`} detail="Thành viên đang được kích hoạt" icon={<UsersRound size={21} />} tint="blue" />
        <StatCard label="Đã thu trong tháng" value={money(data.collectedVnd)} detail="Khoản thanh toán đã xác nhận" icon={<Wallet size={21} />} />
        <StatCard label="Còn cần thu" value={money(outstandingVnd)} detail="Dự kiến trừ đi số đã thu" icon={<CircleDollarSign size={21} />} tint="amber" />
      </div>
      <div className="mt-7 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-5"><div><h2 className="font-bold text-ink">Buổi đánh sắp tới</h2><p className="mt-1 text-xs text-muted">Lịch gần nhất được lưu trong đội</p></div><Link href="/sessions" className="flex items-center gap-1 text-sm font-semibold text-brand">Tất cả<ArrowRight size={16} /></Link></div>
          {nextSession ? <div className="p-5 sm:p-6"><div className="rounded-2xl bg-[#f5f9f6] p-4 sm:flex sm:items-center sm:justify-between sm:p-5"><div className="flex gap-4"><div className="flex h-[62px] w-[58px] shrink-0 flex-col items-center justify-center rounded-xl bg-white text-brand shadow-sm"><span className="text-[10px] font-bold uppercase">{new Intl.DateTimeFormat("vi-VN", { month: "short" }).format(new Date(`${nextSession.session_date}T12:00:00`))}</span><span className="text-2xl font-bold leading-7">{new Date(`${nextSession.session_date}T12:00:00`).getDate()}</span></div><div className="pt-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-ink">{nextSession.title}</h3><Badge>Sắp diễn ra</Badge></div><p className="mt-2 text-sm text-muted">{nextSession.venue}</p><p className="mt-1 flex items-center gap-1.5 text-xs text-muted"><Clock3 size={13} />{nextSession.starts_at.slice(0, 5)} – {nextSession.ends_at.slice(0, 5)}<span className="mx-1">·</span>{nextSession.attendee_count} người</p></div></div><Link href={`/sessions/${nextSession.id}`} className="mt-4 inline-flex min-h-10 items-center justify-center rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink hover:border-brand hover:text-brand sm:mt-0">Xem chi tiết</Link></div><div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-xl border border-line p-4"><p className="text-xs text-muted">Dự kiến thu</p><p className="mt-2 font-bold text-ink">{money(nextSession.expected_vnd)}</p></div><div className="rounded-xl border border-line p-4"><p className="text-xs text-muted">Chi phí đã lưu</p><p className="mt-2 font-bold text-brand">{money(nextSession.expenses_vnd)}</p></div></div></div> : <div className="flex flex-col items-center px-5 py-12 text-center"><CalendarDays size={25} className="text-slate-400" /><p className="mt-3 font-semibold text-ink">Chưa có buổi đánh sắp tới</p><Link href="/sessions/new" className="mt-4 text-sm font-semibold text-brand">Tạo buổi đánh đầu tiên</Link></div>}
        </Card>
        <Card className="p-5 sm:p-6">
          <div className="flex items-center justify-between"><div><h2 className="font-bold text-ink">Tình hình tháng này</h2><p className="mt-1 text-xs text-muted">Thu và chi theo dữ liệu đã ghi</p></div><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-mint text-brand"><CalendarDays size={20} /></span></div>
          <div className="mt-7 space-y-5"><div><div className="mb-2 flex justify-between text-sm"><span className="text-muted">Đã thu</span><strong className="text-ink">{money(data.collectedVnd)}</strong></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand" style={{ width: `${data.expectedVnd ? Math.min(data.collectedVnd / data.expectedVnd * 100, 100) : 0}%` }} /></div></div><div><div className="mb-2 flex justify-between text-sm"><span className="text-muted">Khoản chi</span><strong className="text-ink">{money(data.expensesVnd)}</strong></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full w-full rounded-full bg-sky-500" /></div></div><div className="flex items-center justify-between rounded-xl bg-amber-50 px-4 py-3"><span className="text-sm text-amber-900">Còn cần thu</span><span className="text-sm font-bold text-amber-800">{money(outstandingVnd)}</span></div></div>
          <Link href="/reports" className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-line py-3 text-sm font-semibold text-ink hover:border-brand hover:text-brand">Xem báo cáo<ArrowRight size={16} /></Link>
        </Card>
      </div>
      <Card className="mt-6 overflow-hidden"><div className="flex items-center justify-between border-b border-line px-5 py-5 sm:px-6"><div><h2 className="font-bold text-ink">Buổi đánh gần đây</h2><p className="mt-1 text-xs text-muted">Lấy từ danh sách của đội</p></div><Link href="/sessions" className="text-sm font-semibold text-brand">Xem lịch sử</Link></div>
        {data.sessions.length ? <div className="divide-y divide-line">{data.sessions.slice(0, 4).map((session) => <Link key={session.id} href={`/sessions/${session.id}`} className="flex items-center gap-3 px-5 py-4 hover:bg-slate-50"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-mint text-brand"><CalendarDays size={18} /></span><span className="min-w-0 flex-1"><strong className="block truncate text-sm text-ink">{session.title}</strong><small className="text-xs text-muted">{shortDate(session.session_date)} · {session.attendee_count} người · Chi {money(session.expenses_vnd)}</small></span><Badge tone={session.status === "scheduled" ? "green" : session.status === "completed" ? "blue" : "gray"}>{session.status === "scheduled" ? "Sắp diễn ra" : session.status === "completed" ? "Đã hoàn thành" : "Đã hủy"}</Badge></Link>)}</div> : <p className="p-8 text-center text-sm text-muted">Đội chưa có buổi đánh nào.</p>}
      </Card>
    </>
  );
}
