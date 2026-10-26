import Link from "next/link";
import { redirect } from "next/navigation";
import { Database, ShieldCheck } from "lucide-react";
import { Card, PageHeading } from "@/components/ui";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AdminSetupPage() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) redirect("/admin/login");

  const userId = data.claims.sub;
  const sql = `insert into public.team_settings (team_name, admin_user_id)\nvalues ('RallyTeam', '${userId}')\nreturning id, team_name;`;

  return (
    <>
      <PageHeading eyebrow="Thiết lập một lần" title="Khởi tạo không gian đội" description="Tài khoản đã đăng nhập chưa được gán với một đội. Chạy câu lệnh SQL bên dưới trong Supabase Dashboard → SQL Editor để tạo đội và gán quyền quản trị." />
      <Card className="max-w-3xl p-5 sm:p-7">
        <div className="flex items-start gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700"><Database size={20} /></span><div><h2 className="font-bold text-ink">Tạo đội đầu tiên</h2><p className="mt-1 text-sm leading-6 text-muted">Chạy câu lệnh này một lần. Mã người dùng được lấy từ phiên đăng nhập hiện tại; không có mật khẩu hoặc service-role key trong ứng dụng.</p></div></div>
        <pre className="mt-5 overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs leading-6 text-slate-100"><code>{sql}</code></pre>
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><strong>Chỉ chạy một lần.</strong> Nếu đã tạo team_settings trước đó, cập nhật trường admin_user_id cho bản ghi đó thay vì chèn bản ghi thứ hai.</div>
        <div className="mt-5 flex items-start gap-3 text-sm leading-6 text-muted"><ShieldCheck className="mt-0.5 shrink-0 text-brand" size={18} /><p>Hãy bật/tắt cho phép đăng ký công khai trong Supabase Auth phù hợp với quy trình tạo tài khoản quản trị viên của bạn. Màn hình này không tạo tài khoản mới.</p></div>
        <Link href="/admin/login" className="mt-5 inline-flex text-sm font-semibold text-brand hover:underline">Quay lại đăng nhập</Link>
      </Card>
    </>
  );
}
