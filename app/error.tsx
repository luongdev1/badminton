"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button, Card } from "@/components/ui";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Application route error:", error); }, [error]);
  return <Card className="mx-auto flex max-w-lg flex-col items-center p-8 text-center sm:mt-12"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-700"><AlertTriangle size={25} /></span><h1 className="mt-4 text-xl font-bold text-ink">Có lỗi khi tải nội dung</h1><p className="mt-2 text-sm leading-6 text-muted">Vui lòng thử tải lại. Nếu lỗi tiếp tục xảy ra, hãy quay lại sau.</p><Button onClick={reset} className="mt-5"><RotateCcw size={16} />Thử lại</Button></Card>;
}
