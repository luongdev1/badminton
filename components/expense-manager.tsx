"use client";

import { useEffect, useState, useTransition } from "react";
import { AlertTriangle, Pencil, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { createSessionExpense, deleteSessionExpense } from "@/app/sessions/actions";
import { Badge, Button, Card } from "@/components/ui";
import { money } from "@/lib/format";
import { expenseInputSchema } from "@/lib/validation";
import type { ExpenseRow } from "@/lib/supabase/data";

type ExpenseCategory = ExpenseRow["category"];

export function ExpenseManager({
  sessionId,
  initialExpenses,
  hasConfirmedPayments,
}: {
  sessionId: string;
  initialExpenses: ExpenseRow[];
  hasConfirmedPayments: boolean;
}) {
  const router = useRouter();
  const [expenses, setExpenses] = useState(initialExpenses);
  const [editing, setEditing] = useState<ExpenseRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => setExpenses(initialExpenses), [initialExpenses]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const parsed = expenseInputSchema.safeParse({
      id: editing?.id,
      session_id: sessionId,
      description: data.get("description"),
      category: data.get("category"),
      amount_vnd: Number(data.get("amount_vnd")),
    });
    if (!parsed.success) {
      setIsError(true);
      setMessage(parsed.error.issues[0]?.message ?? "Thông tin khoản chi không hợp lệ.");
      return;
    }

    startTransition(async () => {
      let result = await createSessionExpense(parsed.data);
      if (!result.ok && "requiresConfirmation" in result && result.requiresConfirmation) {
        if (!window.confirm(result.message)) return;
        result = await createSessionExpense({ ...parsed.data, confirm_paid_rebalance: true });
      }
      if (!result.ok) {
        setIsError(true);
        setMessage(result.message);
        return;
      }
      setMessage(editing ? "Đã cập nhật khoản chi." : "Đã thêm khoản chi.");
      setIsError(false);
      setEditing(null);
      setFormOpen(false);
      router.refresh();
    });
  }

  function removeExpense(expense: ExpenseRow) {
    if (!window.confirm(`Xóa khoản chi "${expense.description}" (${money(expense.amount_vnd)})? Thao tác này không thể hoàn tác.`)) return;
    startTransition(async () => {
      const input = { session_id: sessionId, expense_id: expense.id };
      let result = await deleteSessionExpense(input);
      if (!result.ok && "requiresConfirmation" in result && result.requiresConfirmation) {
        if (!window.confirm(result.message)) return;
        result = await deleteSessionExpense({ ...input, confirm_paid_rebalance: true });
      }
      if (!result.ok) {
        setIsError(true);
        setMessage(result.message);
        return;
      }
      setExpenses((current) => current.filter((item) => item.id !== expense.id));
      setIsError(false);
      setMessage("Đã xóa khoản chi.");
      router.refresh();
    });
  }

  function editExpense(expense: ExpenseRow) {
    setEditing(expense);
    setFormOpen(true);
    setMessage("");
  }

  return (
    <Card className="mt-5 overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-5 py-5">
        <div><h2 className="font-bold text-ink">Khoản chi</h2><p className="mt-1 text-xs text-muted">{expenses.length} khoản · {money(expenses.reduce((sum, expense) => sum + expense.amount_vnd, 0))}</p></div>
        <Button onClick={() => { setEditing(null); setFormOpen((open) => !open); setMessage(""); }} variant="secondary"><Plus size={16} />Thêm khoản chi</Button>
      </div>
      {message && <div role={isError ? "alert" : "status"} className={`mx-5 mt-4 rounded-xl px-3 py-2 text-sm ${isError ? "bg-rose-50 text-rose-800" : "bg-emerald-50 text-emerald-800"}`}>{message}</div>}
      {hasConfirmedPayments && <div className="mx-5 mt-4 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-5 text-amber-900"><AlertTriangle className="mt-0.5 shrink-0" size={18} /><p>Buổi đánh có khoản đã xác nhận. Khi sửa hoặc xóa chi phí, khoản phải trả được tính lại; khoản đã xác nhận và trạng thái thanh toán được giữ nguyên. Không tự động hoàn tiền nếu đã thu vượt mức mới.</p></div>}
      {formOpen && (
        <form key={editing?.id ?? "new-expense"} onSubmit={submit} className="grid gap-3 border-b border-line bg-slate-50/60 p-5 sm:grid-cols-[1.2fr_1fr_0.8fr_auto] sm:items-end">
          <label className="text-sm font-semibold text-ink">Nội dung<input required maxLength={200} name="description" defaultValue={editing?.description} placeholder="Ví dụ: Tiền thuê sân" className="mt-2 h-11 w-full rounded-xl border border-line px-3 text-sm font-normal outline-none focus:border-brand" /></label>
          <label className="text-sm font-semibold text-ink">Loại chi<select name="category" defaultValue={editing?.category ?? "court"} className="mt-2 h-11 w-full rounded-xl border border-line bg-white px-3 text-sm font-normal"><option value="court">Tiền sân</option><option value="shuttlecock">Tiền cầu</option><option value="equipment">Dụng cụ</option><option value="other">Khác</option></select></label>
          <label className="text-sm font-semibold text-ink">Số tiền (VNĐ)<input required type="number" min="1" max={Number.MAX_SAFE_INTEGER} step="1" name="amount_vnd" defaultValue={editing?.amount_vnd} className="mt-2 h-11 w-full rounded-xl border border-line px-3 text-sm font-normal outline-none focus:border-brand" /></label>
          <div className="flex gap-2"><Button type="submit" disabled={pending}>{pending ? "Đang lưu..." : editing ? "Cập nhật" : "Lưu"}</Button><Button type="button" variant="ghost" aria-label="Đóng biểu mẫu khoản chi" onClick={() => { setFormOpen(false); setEditing(null); }}><X size={17} /></Button></div>
        </form>
      )}
      {expenses.length === 0 ? <p className="p-8 text-center text-sm text-muted">Chưa có khoản chi cho buổi đánh này.</p> : (
        <div className="divide-y divide-line">
          {expenses.map((expense) => (
            <div key={expense.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
              <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-ink">{expense.description}</p><p className="mt-1 text-xs text-muted">{new Date(expense.incurred_at).toLocaleDateString("vi-VN")}</p></div>
              <Badge tone="blue">{categoryLabel(expense.category)}</Badge><strong className="w-32 text-right text-sm text-ink">{money(expense.amount_vnd)}</strong>
              <div className="flex gap-1"><Button variant="ghost" className="min-h-10 px-2" aria-label={`Sửa khoản chi ${expense.description}`} onClick={() => editExpense(expense)} disabled={pending}><Pencil size={16} /></Button><Button variant="ghost" className="min-h-10 px-2 text-rose-700" aria-label={`Xóa khoản chi ${expense.description}`} onClick={() => removeExpense(expense)} disabled={pending}><Trash2 size={16} /></Button></div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function categoryLabel(category: ExpenseCategory) {
  return category === "court" ? "Tiền sân" : category === "shuttlecock" ? "Tiền cầu" : category === "equipment" ? "Dụng cụ" : "Khác";
}
