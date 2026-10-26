"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, Mail, ShieldCheck } from "lucide-react";
import { requestAdminMagicLink } from "@/app/admin/login/actions";
import { Button, Card } from "@/components/ui";

export default function AdminLoginPage({ searchParams }: { searchParams: { error?: string } }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState(() => {
    if (searchParams.error === "configuration") return "Supabase chưa được cấu hình. Hãy kiểm tra các biến môi trường.";
    if (searchParams.error === "connection") return "Không thể xác minh phiên Supabase. Hãy kiểm tra URL và publishable key.";
    if (searchParams.error === "link") return "Liên kết đăng nhập không hợp lệ hoặc đã hết hạn. Hãy yêu cầu liên kết mới.";
    return "";
  });
  const [isError, setIsError] = useState(Boolean(searchParams.error));
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    startTransition(async () => {
      try {
        const result = await requestAdminMagicLink({ email });
        setIsError(!result.ok);
        setMessage(result.ok
          ? "Supabase đã nhận yêu cầu. Nếu email này đã được tạo trong Authentication → Users, hãy kiểm tra hộp thư đến và mục Spam."
          : result.message);
      } catch (error) {
        setIsError(true);
        setMessage(error instanceof Error
          ? `Không gọi được Supabase: ${error.message}. Kiểm tra kết nối mạng và terminal đang chạy Next.js.`
          : "Không gọi được Supabase. Kiểm tra kết nối mạng và terminal đang chạy Next.js.");
      }
    });
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md items-center justify-center">
      <Card className="w-full p-6 sm:p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-mint text-brand"><ShieldCheck size={23} /></div>
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-brand">Quản trị viên</p>
        <h1 className="mt-2 text-2xl font-bold text-ink">Đăng nhập quản trị</h1>
        <p className="mt-2 text-sm leading-6 text-muted">Thành viên không cần đăng nhập. Nhập email quản trị viên đã được tạo trong Supabase để nhận liên kết đăng nhập một lần.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label htmlFor="admin-email" className="block text-sm font-semibold text-ink">Email quản trị</label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input id="admin-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@example.com" className="h-12 w-full rounded-xl border border-line bg-white pl-11 pr-4 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-emerald-100" />
          </div>
          <Button type="submit" disabled={pending} className="w-full">{pending ? "Đang gửi..." : "Gửi liên kết đăng nhập"}{!pending && <ArrowRight size={16} />}</Button>
        </form>
        {message && <p role={isError ? "alert" : "status"} className={`mt-4 rounded-xl px-3 py-2.5 text-sm leading-5 ${isError ? "bg-rose-50 text-rose-800" : "bg-emerald-50 text-emerald-800"}`}>{message}</p>}
        <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2.5 text-xs leading-5 text-muted">
          Không nhận được email? Tài khoản phải tồn tại trong Supabase → Authentication → Users. Nếu đã có, kiểm tra Authentication → Logs và cấu hình SMTP/email provider.
        </p>
        <Link href="/" className="mt-5 inline-block text-xs font-semibold text-muted hover:text-brand">Quay lại ứng dụng</Link>
      </Card>
    </div>
  );
}
