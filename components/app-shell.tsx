"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Activity, CalendarDays, CircleHelp, LayoutDashboard, Menu, Settings2, UsersRound, X } from "lucide-react";
import { signOutAdmin } from "@/app/admin/login/actions";

const navItems = [
  { label: "Tổng quan", href: "/", icon: LayoutDashboard },
  { label: "Buổi đánh", href: "/sessions", icon: CalendarDays },
  { label: "Thành viên", href: "/members", icon: UsersRound },
  { label: "Lịch sử & báo cáo", href: "/reports", icon: Activity },
  { label: "Cài đặt", href: "/settings", icon: Settings2 },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const activeItem = navItems.find((item) => item.href === pathname || (item.href !== "/" && pathname.startsWith(item.href)));

  if (pathname === "/admin/login") {
    return <main className="min-h-screen bg-[#f7f9f7] px-4 py-8">{children}</main>;
  }
  if (pathname === "/share" || pathname.startsWith("/share/")) {
    return <main className="min-h-screen bg-[#f7f9f7] px-4 py-6 sm:px-7 sm:py-10">{children}</main>;
  }

  return (
    <div className="min-h-screen bg-[#f7f9f7]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-white px-5 py-6 lg:flex">
        <Brand />
        <p className="mb-3 mt-10 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Không gian đội</p>
        <nav className="space-y-1">
          {navItems.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return <Link key={item.href} href={item.href} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${active ? "bg-mint text-brand" : "text-slate-600 hover:bg-slate-50 hover:text-ink"}`}><Icon size={19} strokeWidth={1.8} />{item.label}</Link>;
          })}
        </nav>
        <div className="mt-auto rounded-2xl bg-[#f4f8f5] p-4">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-white text-brand shadow-sm"><CircleHelp size={18} /></div>
          <p className="text-sm font-semibold text-ink">Cần hỗ trợ?</p>
          <p className="mt-1 text-xs leading-5 text-muted">Mọi dữ liệu hiện tại chỉ dùng để trình diễn.</p>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur">
          <div className="mx-auto flex h-[68px] max-w-[1440px] items-center justify-between px-4 sm:px-7 lg:px-10">
            <div className="flex items-center gap-3">
              <button aria-label={menuOpen ? "Đóng menu" : "Mở menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)} className="flex h-10 w-10 items-center justify-center rounded-xl text-ink hover:bg-slate-100 lg:hidden">{menuOpen ? <X size={20} /> : <Menu size={20} />}</button>
              <div className="lg:hidden"><Brand compact /></div>
              <span className="hidden text-sm text-muted sm:block">{activeItem?.label ?? "Quản lý đội cầu lông"}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden text-right sm:block"><span className="block text-sm font-semibold text-ink">Quản trị viên</span><span className="block text-xs text-muted">Đội hiện tại</span></span>
              <form action={signOutAdmin}><button className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-xs font-bold text-white hover:bg-brand-dark" aria-label="Đăng xuất quản trị viên">QT</button></form>
            </div>
          </div>
          {menuOpen && <nav className="border-t border-line bg-white px-4 py-3 lg:hidden">{navItems.map((item) => { const Icon = item.icon; const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href); return <Link onClick={() => setMenuOpen(false)} key={item.href} href={item.href} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold ${active ? "bg-mint text-brand" : "text-slate-600"}`}><Icon size={18} />{item.label}</Link>; })}</nav>}
        </header>
        <main className="mx-auto min-h-[calc(100vh-68px)] max-w-[1440px] px-4 py-6 pb-24 sm:px-7 sm:py-8 lg:px-10 lg:pb-10">{children}</main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-line bg-white px-1 pb-[max(env(safe-area-inset-bottom),6px)] pt-2 lg:hidden">
        {navItems.map((item) => { const Icon = item.icon; const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href); const label = item.href === "/" ? "Tổng quan" : item.href === "/sessions" ? "Buổi đánh" : item.href === "/members" ? "Đội" : item.href === "/reports" ? "Báo cáo" : "Cài đặt"; return <Link key={item.href} href={item.href} className={`flex flex-col items-center gap-1 py-1.5 text-[10px] font-semibold ${active ? "text-brand" : "text-slate-500"}`}><Icon size={19} strokeWidth={active ? 2.4 : 1.8} />{label}</Link>; })}
      </nav>
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return <Link href="/" className="flex items-center gap-3">
    <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-brand text-white"><Activity size={21} strokeWidth={2.4} /></span>
    {!compact && <span><span className="block text-[15px] font-extrabold tracking-tight text-ink">RALLY<span className="text-brand">TEAM</span></span><span className="mt-0.5 block text-[10px] font-medium text-muted">BADMINTON MANAGER</span></span>}
  </Link>;
}
