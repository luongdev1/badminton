import Link from "next/link";
import { Database } from "lucide-react";
import { Card, PageHeading } from "@/components/ui";

export default function AdminSetupPage() {
  const sql = "insert into public.team_settings (team_name)\nvalues ('Tên đội của bạn')\nreturning id, team_name;";

  return (
    <>
      <PageHeading eyebrow="Thiết lập một lần" title="Khởi tạo không gian đội" description="Chưa có team_settings. Chạy câu lệnh SQL bên dưới trong Supabase Dashboard → SQL Editor để tạo đội đầu tiên." />
      <Card className="max-w-3xl p-5 sm:p-7">
        <div className="flex items-start gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700"><Database size={20} /></span><div><h2 className="font-bold text-ink">Tạo đội đầu tiên</h2><p className="mt-1 text-sm leading-6 text-muted">Thay `Tên đội của bạn` bằng tên thật rồi chạy một lần. Không thêm thông tin ngân hàng ở bước này.</p></div></div>
        <pre className="mt-5 overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs leading-6 text-slate-100"><code>{sql}</code></pre>
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><strong>Chỉ chạy khi chưa có đội.</strong> Nếu bảng đã có dữ liệu, không chạy lại để tránh tạo thêm team.</div>
        <Link href="/" className="mt-5 inline-flex text-sm font-semibold text-brand hover:underline">Quay lại tổng quan</Link>
      </Card>
    </>
  );
}
