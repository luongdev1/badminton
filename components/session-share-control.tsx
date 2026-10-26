"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Link2, Link2Off, RefreshCw } from "lucide-react";
import { setSessionShare } from "@/app/sessions/actions";

export function SessionShareControl({ sessionId, initialShareEnabled }: { sessionId: string; initialShareEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialShareEnabled);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function update(shareEnabled: boolean) {
    if (shareEnabled && enabled && !window.confirm("Tạo lại liên kết sẽ vô hiệu hóa liên kết cũ. Bạn muốn tiếp tục?")) return;
    if (!shareEnabled && !window.confirm("Thu hồi liên kết sẽ ngăn mọi người tiếp tục xem hoặc xác nhận thanh toán. Bạn có muốn tiếp tục?")) return;
    setMessage("");
    startTransition(async () => {
      const result = await setSessionShare({ session_id: sessionId, enabled: shareEnabled });
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setEnabled(shareEnabled);
      setNewToken(result.token);
      setMessage(shareEnabled
        ? "Đã tạo link mới. Hãy sao chép và lưu ngay; token chỉ hiển thị lần này."
        : "Đã thu hồi link chia sẻ.");
    });
  }

  async function copyLink() {
    if (!newToken) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/share#${newToken}`);
      setMessage("Đã sao chép liên kết chia sẻ.");
    } catch {
      setMessage("Không thể sao chép liên kết. Hãy kiểm tra quyền clipboard của trình duyệt.");
    }
  }

  return <div className="flex flex-wrap items-center gap-2">
    {enabled ? <>
      {newToken
        ? <button type="button" onClick={copyLink} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink hover:border-brand hover:text-brand"><Copy size={16} />Sao chép link</button>
        : <span className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-50 px-3 text-xs font-semibold text-emerald-800"><Check size={15} />Link đang hoạt động</span>}
      <button type="button" disabled={pending} onClick={() => update(true)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink hover:border-brand hover:text-brand disabled:opacity-50"><RefreshCw size={16} />{pending ? "Đang tạo..." : "Tạo lại link"}</button>
      <button type="button" disabled={pending} onClick={() => update(false)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-4 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"><Link2Off size={16} />{pending ? "Đang xử lý..." : "Thu hồi link"}</button>
    </> : <button type="button" disabled={pending} onClick={() => update(true)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink hover:border-brand hover:text-brand disabled:opacity-50"><Link2 size={16} />{pending ? "Đang tạo..." : "Tạo link chia sẻ"}</button>}
    {message && <span role="status" aria-live="polite" className="flex basis-full items-center gap-1 text-xs text-muted">{newToken && message.startsWith("Đã tạo") ? <Check size={14} /> : null}{message}</span>}
  </div>;
}
