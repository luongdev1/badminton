"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, CalendarDays, Clock3, MapPin, Plus, Search, UsersRound } from "lucide-react";
import { Badge, Card, PageHeading } from "@/components/ui";
import { money, shortDate } from "@/lib/format";
import type { SessionSummary } from "@/lib/supabase/data";

export function SessionsList({ sessions }: { sessions: SessionSummary[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const filtered = useMemo(() => sessions.filter((session) => (
    `${session.title} ${session.venue}`.toLowerCase().includes(query.trim().toLowerCase())
    && (status === "all" || session.status === status)
  )), [query, sessions, status]);

  return (
    <>
      <PageHeading eyebrow="Lịch hoạt động" title="Buổi đánh" description={`${sessions.length} buổi đánh đã lưu trong đội.`} action={<Link href="/sessions/new" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark"><Plus size={18} />Tạo buổi đánh</Link>} />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm buổi đánh, địa điểm..." className="h-12 w-full rounded-xl border border-line bg-white pl-11 pr-4 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-emerald-100" /></label>
        <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Lọc trạng thái buổi đánh" className="h-12 rounded-xl border border-line bg-white px-4 text-sm text-ink"><option value="all">Tất cả</option><option value="scheduled">Sắp diễn ra</option><option value="completed">Đã hoàn thành</option><option value="cancelled">Đã hủy</option></select>
      </div>
      <p className="mb-3 text-sm text-muted">{filtered.length} buổi đánh</p>
      {filtered.length === 0 ? (
        <Card className="flex flex-col items-center px-5 py-14 text-center"><CalendarDays size={25} className="text-slate-400" /><h2 className="mt-4 font-bold text-ink">{sessions.length === 0 ? "Chưa có buổi đánh" : "Không tìm thấy buổi đánh"}</h2><p className="mt-2 text-sm text-muted">{sessions.length === 0 ? "Tạo buổi đánh đầu tiên để bắt đầu quản lý đội." : "Thử đổi từ khóa hoặc bộ lọc."}</p></Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((session) => (
            <Card key={session.id} className="p-5 transition hover:-translate-y-0.5 hover:shadow-md sm:p-6">
              <div className="flex items-start justify-between gap-3"><div><Badge tone={session.status === "scheduled" ? "green" : session.status === "completed" ? "blue" : "gray"}>{statusLabel(session.status)}</Badge><h2 className="mt-3 text-lg font-bold text-ink">{session.title}</h2></div><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-mint text-brand"><CalendarDays size={20} /></span></div>
              <div className="mt-4 grid gap-2.5 text-sm text-muted sm:grid-cols-2"><p className="flex items-center gap-2"><CalendarDays size={16} className="text-brand" />{shortDate(session.session_date)}</p><p className="flex items-center gap-2"><Clock3 size={16} className="text-brand" />{session.starts_at.slice(0, 5)} – {session.ends_at.slice(0, 5)}</p><p className="flex items-center gap-2 sm:col-span-2"><MapPin size={16} className="text-brand" />{session.venue}{session.court_details ? ` · ${session.court_details}` : ""}</p></div>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4"><div className="flex flex-wrap gap-x-5 gap-y-2"><span className="flex items-center gap-1.5 text-sm text-muted"><UsersRound size={16} />{session.attendee_count} người</span><span className="text-sm text-muted">Chi phí <strong className="text-ink">{money(session.expenses_vnd)}</strong></span></div><Link href={`/sessions/${session.id}`} className="inline-flex min-h-10 items-center gap-1 rounded-xl px-3 text-sm font-semibold text-brand hover:bg-mint">Chi tiết <ArrowRight size={16} /></Link></div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

function statusLabel(status: SessionSummary["status"]) {
  return status === "scheduled" ? "Sắp diễn ra" : status === "completed" ? "Đã hoàn thành" : "Đã hủy";
}
