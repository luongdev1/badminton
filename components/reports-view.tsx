"use client";

import { useMemo, useState } from "react";
import { ArrowDownToLine, CalendarDays, CircleDollarSign, Wallet } from "lucide-react";
import { Badge, Card, PageHeading, StatCard } from "@/components/ui";
import { dateTime, money, shortDate } from "@/lib/format";
import { filterReportSessions, groupReportSessionsByMonth, remainingPaymentDue, summarizeReportSessions } from "@/lib/reports";
import type { SessionSummary } from "@/lib/supabase/data";

const statusLabels: Record<SessionSummary["status"], string> = {
  scheduled: "Sắp diễn ra",
  completed: "Đã hoàn thành",
  cancelled: "Đã hủy",
};

export function ReportsView({ sessions }: { sessions: SessionSummary[] }) {
  const [month, setMonth] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [status, setStatus] = useState("all");
  const monthOptions = useMemo(
    () => [...new Set(sessions.map((session) => session.session_date.slice(0, 7)))].sort((a, b) => b.localeCompare(a)),
    [sessions],
  );
  const invalidDateRange = Boolean(dateFrom && dateTo && dateFrom > dateTo);
  const visible = useMemo(() => invalidDateRange ? [] : filterReportSessions(sessions, { month, dateFrom, dateTo, status }), [
    dateFrom, dateTo, invalidDateRange, month, sessions, status,
  ]);
  const summary = useMemo(() => summarizeReportSessions(visible), [visible]);
  const monthlySummary = useMemo(() => groupReportSessionsByMonth(visible), [visible]);
  const unpaidMembers = visible.flatMap((session) => session.payment_details
    .filter((payment) => payment.status !== "waived")
    .map((payment) => ({
      ...payment,
      sessionTitle: session.title,
      sessionDate: session.session_date,
      remainingVnd: remainingPaymentDue(payment),
    }))
    .filter((payment) => payment.remainingVnd > 0));
  const maxExpected = Math.max(...visible.map((session) => session.expected_vnd), 0);

  function exportCsv() {
    const rows = [
      ["Buổi đánh", "Ngày", "Trạng thái", "Số người", "Dự kiến (VND)", "Đã xác nhận (VND)", "Còn thiếu (VND)", "Chi phí (VND)"],
      ...visible.map((session) => [session.title, shortDate(session.session_date), statusLabels[session.status], String(session.attendee_count), String(session.expected_vnd), String(session.collected_vnd), String(session.outstanding_vnd), String(session.expenses_vnd)]),
    ];
    const csvCell = (cell: string) => {
      const safeCell = /^[\s]*[=+\-@]/.test(cell) ? `'${cell}` : cell;
      return `"${safeCell.replaceAll('"', '""')}"`;
    };
    const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "bao-cao-rallyteam.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeading
        eyebrow="Theo dõi đội"
        title="Lịch sử & báo cáo"
        description="Tổng hợp chi phí, người tham gia và các khoản thanh toán đã được lưu trong Supabase."
        action={<button onClick={exportCsv} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink hover:border-brand hover:text-brand"><ArrowDownToLine size={17} />Xuất CSV</button>}
      />

      <Card className="mb-5 p-4 sm:p-5">
        <h2 className="mb-3 text-sm font-bold text-ink">Bộ lọc báo cáo</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-semibold text-muted">Tháng
            <select value={month} onChange={(event) => setMonth(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink" aria-label="Lọc theo tháng">
              <option value="all">Tất cả các tháng</option>
              {monthOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-muted">Từ ngày
            <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink" />
          </label>
          <label className="text-xs font-semibold text-muted">Đến ngày
            <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink" />
          </label>
          <label className="text-xs font-semibold text-muted">Trạng thái buổi
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink" aria-label="Lọc theo trạng thái">
              <option value="all">Tất cả trạng thái</option>
              <option value="scheduled">Sắp diễn ra</option>
              <option value="completed">Đã hoàn thành</option>
              <option value="cancelled">Đã hủy</option>
            </select>
          </label>
        </div>
        {invalidDateRange && <p role="alert" className="mt-3 text-sm text-rose-700">Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.</p>}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Tổng chi phí" value={money(summary.expensesVnd)} detail={`${summary.sessionCount} buổi đánh`} icon={<CircleDollarSign size={21} />} />
        <StatCard label="Lượt tham gia" value={String(summary.participantCount)} detail="Tổng lượt thành viên theo các buổi" icon={<CalendarDays size={21} />} tint="blue" />
        <StatCard label="Đã xác nhận" value={money(summary.collectedVnd)} detail="Người xem xác nhận thủ công, chưa đối soát ngân hàng" icon={<Wallet size={21} />} tint="blue" />
        <StatCard label="Còn thiếu" value={money(summary.outstandingVnd)} detail="Số dư của payment chưa được xác nhận đủ" icon={<CircleDollarSign size={21} />} tint="amber" />
      </div>

      <Card className="mt-6 overflow-hidden">
        <div className="border-b border-line px-5 py-5"><h2 className="font-bold text-ink">Chi phí theo tháng</h2><p className="mt-1 text-xs text-muted">Tổng hợp theo tháng diễn ra buổi đánh</p></div>
        {monthlySummary.length === 0 ? <p className="p-6 text-sm text-muted">Không có dữ liệu cho lựa chọn này.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-slate-50 text-xs text-muted"><tr><th className="px-5 py-3">Tháng</th><th className="px-5 py-3">Buổi</th><th className="px-5 py-3">Lượt tham gia</th><th className="px-5 py-3">Chi phí</th><th className="px-5 py-3">Đã xác nhận</th><th className="px-5 py-3">Còn thiếu</th></tr></thead><tbody className="divide-y divide-line">{monthlySummary.map((item) => <tr key={item.month}><td className="px-5 py-3 font-semibold text-ink">{item.month}</td><td className="px-5 py-3">{item.sessionCount}</td><td className="px-5 py-3">{item.participantCount}</td><td className="px-5 py-3">{money(item.expensesVnd)}</td><td className="px-5 py-3">{money(item.collectedVnd)}</td><td className="px-5 py-3">{money(item.outstandingVnd)}</td></tr>)}</tbody></table></div>}
      </Card>

      <Card className="mt-6 overflow-hidden">
        <div className="border-b border-line px-5 py-5"><h2 className="font-bold text-ink">Thành viên chưa thanh toán đủ</h2><p className="mt-1 text-xs text-muted">{unpaidMembers.length} khoản còn số dư; các khoản đã miễn được loại trừ</p></div>
        {unpaidMembers.length === 0 ? <p className="p-6 text-sm text-muted">Không có thành viên còn thiếu trong bộ lọc hiện tại.</p> : <div className="divide-y divide-line">{unpaidMembers.map((payment) => <div key={payment.payment_id} className="flex flex-wrap items-center gap-2 px-5 py-4"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-ink">{payment.member_name}</p><p className="mt-1 text-xs text-muted">{payment.sessionTitle} · {shortDate(payment.sessionDate)}</p></div><span className="text-right text-sm font-bold text-amber-700">{money(payment.remainingVnd)} còn thiếu</span></div>)}</div>}
      </Card>

      <Card className="mt-6 p-5 sm:p-6">
        <div className="mb-5 flex items-start justify-between"><div><h2 className="font-bold text-ink">Thu chi theo buổi</h2><p className="mt-1 text-xs text-muted">So sánh số đã xác nhận với khoản phải thu</p></div><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-mint text-brand"><CalendarDays size={19} /></span></div>
        {visible.length === 0 ? <div className="py-8 text-center text-sm text-muted">Chưa có dữ liệu phù hợp.</div> : <div className="space-y-5">{visible.map((session) => {
          const expectedWidth = maxExpected ? Math.min(session.expected_vnd / maxExpected * 100, 100) : 0;
          const collectedWidth = maxExpected ? Math.min(session.collected_vnd / maxExpected * 100, 100) : 0;
          return <div key={session.id} className="grid gap-2 sm:grid-cols-[1.4fr_2fr_auto] sm:items-center">
            <div><p className="text-sm font-semibold text-ink">{session.title}</p><p className="mt-1 text-xs text-muted">{shortDate(session.session_date)} · {session.attendee_count} người · Chi {money(session.expenses_vnd)}</p></div>
            <div className="space-y-1.5"><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand" style={{ width: `${collectedWidth}%` }} /></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-sky-400" style={{ width: `${expectedWidth}%` }} /></div></div>
            <p className="text-right text-sm font-semibold text-ink">{money(session.collected_vnd)} <span className="text-xs font-normal text-muted">/ {money(session.expected_vnd)}</span></p>
          </div>;
        })}</div>}
      </Card>

      <Card className="mt-6 overflow-hidden">
        <div className="border-b border-line px-5 py-5"><h2 className="font-bold text-ink">Chi tiết và lịch sử buổi đánh</h2><p className="mt-1 text-xs text-muted">{visible.length} buổi trong bộ lọc</p></div>
        {visible.length === 0 ? <p className="p-6 text-sm text-muted">Không có hoạt động phù hợp.</p> : <div className="divide-y divide-line">{visible.map((session) => <details key={session.id} className="group px-5 py-4">
          <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-brand"><CalendarDays size={18} /></span>
            <span className="min-w-[150px] flex-1"><strong className="block text-sm text-ink">{session.title}</strong><small className="text-xs text-muted">{shortDate(session.session_date)} · {session.venue} · {session.attendee_count} người</small></span>
            <Badge tone={session.status === "scheduled" ? "green" : session.status === "completed" ? "blue" : "gray"}>{statusLabels[session.status]}</Badge>
            <strong className="w-full text-right text-sm text-ink sm:w-auto">{money(session.expenses_vnd)}</strong>
          </summary>
          <div className="mt-4 grid gap-5 border-t border-line pt-4 lg:grid-cols-3">
            <ReportList title="Khoản chi" empty="Không có khoản chi." items={session.expenses.map((expense) => `${expense.description} · ${money(expense.amount_vnd)}`)} />
            <ReportList title="Khoản phải trả" empty="Không có payment." items={session.payment_details.map((payment) => `${payment.member_name} · ${money(payment.amount_due_vnd)} · ${payment.status === "paid" ? "Đã xác nhận" : payment.status === "waived" ? "Đã miễn" : payment.status === "refunded" ? "Đã hoàn" : "Chưa thanh toán"}`)} />
            <ReportList title="Lịch sử thanh toán" empty="Chưa có thay đổi được ghi nhận." items={session.payment_history.map((entry) => `${entry.member_name} · ${entry.old_status ?? "tạo mới"} → ${entry.new_status} · ${entry.actor_source === "public_link" ? "xác nhận qua link" : entry.actor_source === "admin" ? "quản trị" : "hệ thống"} · ${dateTime(entry.created_at)}`)} />
          </div>
        </details>)}</div>}
      </Card>
      <p className="mt-5 text-center text-xs text-muted">Trạng thái thanh toán được người dùng xác nhận thủ công, không phải dữ liệu xác minh từ ngân hàng.</p>
    </>
  );
}

function ReportList({ title, empty, items }: { title: string; empty: string; items: string[] }) {
  return <section><h3 className="text-sm font-semibold text-ink">{title}</h3>{items.length ? <ul className="mt-2 space-y-2">{items.map((item, index) => <li key={`${item}-${index}`} className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-muted">{item}</li>)}</ul> : <p className="mt-2 text-xs text-muted">{empty}</p>}</section>;
}
