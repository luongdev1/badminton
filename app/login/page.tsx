"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, KeyRound, UserRound } from "lucide-react";
import { loginAdmin } from "@/app/login/actions";
import { Button, Card } from "@/components/ui";
import { adminLoginSchema } from "@/lib/validation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = adminLoginSchema.safeParse({ username, password });
    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? "Thông tin đăng nhập không hợp lệ.");
      return;
    }

    setMessage("");
    startTransition(async () => {
      try {
        const result = await loginAdmin(parsed.data);
        if (!result.ok) {
          setMessage(result.message);
          return;
        }
        router.replace("/admin");
        router.refresh();
      } catch {
        setMessage("Không thể đăng nhập lúc này. Kiểm tra cấu hình server và thử lại.");
      }
    });
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md items-center justify-center">
      <Card className="w-full p-6 sm:p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-mint text-brand"><KeyRound size={23} /></div>
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-brand">Quản trị viên</p>
        <h1 className="mt-2 text-2xl font-bold text-ink">Đăng nhập quản trị</h1>
        <p className="mt-2 text-sm leading-6 text-muted">Dùng thông tin quản trị chung do chủ dự án cấu hình. Thành viên không cần tài khoản hoặc mật khẩu.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="admin-username" className="block text-sm font-semibold text-ink">Tên đăng nhập</label>
            <div className="relative mt-2">
              <UserRound className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input id="admin-username" type="text" autoComplete="username" required maxLength={64} value={username} onChange={(event) => setUsername(event.target.value)} className="h-12 w-full rounded-xl border border-line bg-white pl-11 pr-4 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-emerald-100" />
            </div>
          </div>
          <div>
            <label htmlFor="admin-password" className="block text-sm font-semibold text-ink">Mật khẩu</label>
            <div className="relative mt-2">
              <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input id="admin-password" type="password" autoComplete="current-password" required minLength={12} maxLength={256} value={password} onChange={(event) => setPassword(event.target.value)} className="h-12 w-full rounded-xl border border-line bg-white pl-11 pr-4 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-emerald-100" />
            </div>
          </div>
          <Button type="submit" disabled={pending} className="w-full">{pending ? "Đang xác minh..." : "Đăng nhập"}{!pending && <ArrowRight size={16} />}</Button>
        </form>
        {message && <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-3 py-2.5 text-sm leading-5 text-rose-800">{message}</p>}
        <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2.5 text-xs leading-5 text-muted">
          Phiên quản trị hết hạn sau 8 giờ. Không chia sẻ thông tin đăng nhập chung; mọi thao tác thanh toán từ link công khai không xác định danh tính người tick.
        </p>
      </Card>
    </div>
  );
}
