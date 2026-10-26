"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { closeSession } from "@/app/sessions/actions";
import { Button } from "@/components/ui";

export function CloseSessionButton({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function handleClose() {
    if (!window.confirm("Đóng buổi đánh này? Toàn bộ thành viên, khoản chi và lịch sử thanh toán sẽ được giữ nguyên.")) return;
    setError("");
    startTransition(async () => {
      try {
        const result = await closeSession({ session_id: sessionId });
        if (!result.ok) {
          setError(result.message);
          return;
        }
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Không thể đóng buổi đánh. Vui lòng thử lại.");
      }
    });
  }

  return (
    <div>
      <Button type="button" variant="secondary" onClick={handleClose} disabled={pending}>
        <CheckCircle2 size={16} />{pending ? "Đang đóng..." : "Đóng buổi"}
      </Button>
      {error && <p role="alert" className="mt-2 text-right text-xs text-rose-700">{error}</p>}
    </div>
  );
}
