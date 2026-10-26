import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";
import { Card } from "@/components/ui";

export default function NotFound() {
  return <Card className="mx-auto flex max-w-lg flex-col items-center p-8 text-center sm:mt-12"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"><SearchX size={25} /></span><h1 className="mt-4 text-xl font-bold text-ink">Không tìm thấy trang</h1><p className="mt-2 text-sm text-muted">Buổi đánh có thể không tồn tại trong dữ liệu mẫu.</p><Link href="/sessions" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark"><ArrowLeft size={16} />Về danh sách buổi đánh</Link></Card>;
}
