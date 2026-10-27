"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { AlertTriangle, Pencil, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { createSessionExpense, deleteSessionExpense } from "@/app/sessions/actions";
import { Badge, Button, Card } from "@/components/ui";
import { money } from "@/lib/format";
import { calculateEqualCostShares } from "@/lib/calculations/equal-cost-share";
import { expenseInputSchema } from "@/lib/validation";
import type { ExpenseRow, SessionExpenseDetail } from "@/lib/supabase/data";

type ExpenseCategory = ExpenseRow["category"];
type ParticipantOption = { member_id: string; member_name: string };
type AllocationHistory = {
  id: string;
  event_type: string;
  description: string;
  amount_vnd: number;
  allocations: unknown;
  created_at: string;
};

export function ExpenseManager({
  sessionId,
  initialExpenses,
  participants,
  allocationHistory,
  hasConfirmedPayments,
}: {
  sessionId: string;
  initialExpenses: SessionExpenseDetail[];
  participants: ParticipantOption[];
  allocationHistory: AllocationHistory[];
  hasConfirmedPayments: boolean;
}) {
  const router = useRouter();
  const [expenses, setExpenses] = useState(initialExpenses);
  const [editing, setEditing] = useState<SessionExpenseDetail | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [amountInput, setAmountInput] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => setExpenses(initialExpenses), [initialExpenses]);

  const previewShares = useMemo(
    () => calculateEqualCostShares([Number.isSafeInteger(amountInput) && amountInput > 0 ? amountInput : 0], selectedIds),
    [amountInput, selectedIds],
  );

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const parsed = expenseInputSchema.safeParse({
      id: editing?.id,
      session_id: sessionId,
      description: data.get("description"),
      category: data.get("category"),
      amount_vnd: Number(data.get("amount_vnd")),
      participant_ids: selectedIds,
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
      setMessage(editing ? "Đã cập nhật khoản chi và phần chia." : "Đã thêm khoản chi và phần chia.");
      setIsError(false);
      setEditing(null);
      setFormOpen(false);
      router.refresh();
    });
  }

  function removeExpense(expense: SessionExpenseDetail) {
    if (!window.confirm(`Xóa khoản chi "${expense.description}" (${money(expense.amount_vnd)})? Lịch sử thu đã ghi nhận sẽ được giữ nguyên.`)) return;
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
      setMessage("Đã xóa khoản chi; lịch sử phân bổ và thu tiền vẫn được lưu.");
      router.refresh();
    });
  }

  function beginCreate() {
    setEditing(null);
    setAmountInput(0);
    setSelectedIds(participants.map((participant) => participant.member_id));
    setFormOpen((open) => !open);
    setMessage("");
  }

  function editExpense(expense: SessionExpenseDetail) {
    setEditing(expense);
    setAmountInput(expense.amount_vnd);
    setSelectedIds(expense.allocations.map((allocation) => allocation.member_id));
    setFormOpen(true);
    setMessage("");
  }

  function toggleParticipant(memberId: string) {
    setSelectedIds((current) => current.includes(memberId)
      ? current.filter((id) => id !== memberId)
      : [...current, memberId]);
  }

  return (
    <Card className="mt-5 overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-5 py-5">
        <div><h2 className="font-bold text-ink">Khoản chi</h2><p className="mt-1 text-xs text-muted">{expenses.length} khoản · {money(expenses.reduce((sum, expense) => sum + expense.amount_vnd, 0))}</p></div>
        <Button onClick={beginCreate} variant="secondary"><Plus size={16} />Thêm khoản chi</Button>
      </div>
      {message && <div role={isError ? "alert" : "status"} className={`mx-5 mt-4 rounded-xl px-3 py-2 text-sm ${isError ? "bg-rose-50 text-rose-800" : "bg-emerald-50 text-emerald-800"}`}>{message}</div>}
      {hasConfirmedPayments && <div className="mx-5 mt-4 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-5 text-amber-900"><AlertTriangle className="mt-0.5 shrink-0" size={18} /><p>Buổi đánh có khoản đã xác nhận. Khi sửa hoặc xóa chi phí, khoản phải trả được tính lại; khoản đã xác nhận và trạng thái thanh toán được giữ nguyên. Không tự động hoàn tiền nếu đã thu vượt mức mới.</p></div>}
      {formOpen && (
        <form key={editing?.id ?? "new-expense"} onSubmit={submit} className="space-y-4 border-b border-line bg-slate-50/60 p-5">
          <div className="grid gap-3 sm:grid-cols-[1.2fr_1fr_0.8fr]">
            <label className="text-sm font-semibold text-ink">Nội dung<input required maxLength={200} name="description" defaultValue={editing?.description} placeholder="Ví dụ: Tiền thuê sân" className="mt-2 h-11 w-full rounded-xl border border-line px-3 text-sm font-normal outline-none focus:border-brand" /></label>
            <label className="text-sm font-semibold text-ink">Loại chi<select name="category" defaultValue={editing?.category ?? "court"} className="mt-2 h-11 w-full rounded-xl border border-line bg-white px-3 text-sm font-normal"><option value="court">Tiền sân</option><option value="shuttlecock">Tiền cầu</option><option value="equipment">Dụng cụ</option><option value="other">Khác</option></select></label>
            <label className="text-sm font-semibold text-ink">Số tiền (VNĐ)<input required type="number" min="1" max={Number.MAX_SAFE_INTEGER} step="1" name="amount_vnd" defaultValue={editing?.amount_vnd} onChange={(event) => {
              const next = Number(event.currentTarget.value);
              setAmountInput(Number.isSafeInteger(next) ? next : 0);
            }} className="mt-2 h-11 w-full rounded-xl border border-line px-3 text-sm font-normal outline-none focus:border-brand" /></label>
          </div>

          <section aria-labelledby="expense-participants-title" className="rounded-2xl border border-line bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h3 id="expense-participants-title" className="text-sm font-bold text-ink">Người được chia khoản chi</h3><p className="mt-1 text-xs text-muted">Chia đều VND; phần dư được phân bổ lần lượt để tổng luôn khớp.</p></div>
              <div className="flex gap-2"><Button type="button" variant="ghost" className="min-h-9 px-3 text-xs" onClick={() => setSelectedIds(participants.map((participant) => participant.member_id))}>Chọn tất cả</Button><Button type="button" variant="ghost" className="min-h-9 px-3 text-xs" onClick={() => setSelectedIds([])}>Bỏ chọn</Button></div>
            </div>
            {participants.length === 0 ? <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Chưa có người tham gia để phân bổ khoản chi.</p> : (
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {participants.map((participant) => (
                  <label key={participant.member_id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-line px-3 py-2 text-sm">
                    <input type="checkbox" checked={selectedIds.includes(participant.member_id)} onChange={() => toggleParticipant(participant.member_id)} className="h-4 w-4 accent-emerald-600" />
                    <span className="min-w-0 flex-1 truncate font-medium text-ink">{participant.member_name}</span>
                    <span className="text-xs text-muted">{money(previewShares.allocations.find((share) => share.participantId === participant.member_id)?.amountVnd ?? 0)}</span>
                  </label>
                ))}
              </div>
            )}
            {selectedIds.length === 0
              ? <p role="alert" className="mt-3 text-sm font-medium text-rose-700">Chọn ít nhất một người. Khoản chi sẽ không được lưu khi chưa có người nhận chia.</p>
              : <p className="mt-3 text-sm font-semibold text-ink">{selectedIds.length} người · Mỗi người khoảng {money(previewShares.allocations[0]?.amountVnd ?? 0)} · Tổng phân bổ {money(previewShares.allocatedVnd)}</p>}
          </section>
          <div className="flex flex-wrap gap-2"><Button type="submit" disabled={pending || participants.length === 0}>{pending ? "Đang lưu..." : editing ? "Cập nhật khoản chi" : "Lưu khoản chi"}</Button><Button type="button" variant="ghost" aria-label="Đóng biểu mẫu khoản chi" onClick={() => { setFormOpen(false); setEditing(null); }}>Hủy</Button></div>
        </form>
      )}
      {expenses.length === 0 ? <p className="p-8 text-center text-sm text-muted">Chưa có khoản chi cho buổi đánh này.</p> : (
        <div className="divide-y divide-line">
          {expenses.map((expense) => (
            <div key={expense.id} className="px-5 py-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-ink">{expense.description}</p><p className="mt-1 text-xs text-muted">{new Date(expense.incurred_at).toLocaleDateString("vi-VN")} · {expense.allocations.length} người được chia</p></div>
                <Badge tone="blue">{categoryLabel(expense.category)}</Badge><strong className="w-32 text-right text-sm text-ink">{money(expense.amount_vnd)}</strong>
                <div className="flex gap-1"><Button variant="ghost" className="min-h-10 px-2" aria-label={`Sửa khoản chi ${expense.description}`} onClick={() => editExpense(expense)} disabled={pending}><Pencil size={16} /></Button><Button variant="ghost" className="min-h-10 px-2 text-rose-700" aria-label={`Xóa khoản chi ${expense.description}`} onClick={() => removeExpense(expense)} disabled={pending}><Trash2 size={16} /></Button></div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">{expense.allocations.map((allocation) => <span key={allocation.member_id} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">{allocation.member_name}: {money(allocation.amount_vnd)}</span>)}</div>
            </div>
          ))}
        </div>
      )}
      {allocationHistory.length > 0 && (
        <details className="border-t border-line px-5 py-4">
          <summary className="cursor-pointer text-sm font-semibold text-muted">Lịch sử phân bổ ({allocationHistory.length})</summary>
          <div className="mt-3 space-y-3">
            {allocationHistory.map((entry) => <AllocationHistoryItem key={entry.id} entry={entry} />)}
          </div>
        </details>
      )}
    </Card>
  );
}

function AllocationHistoryItem({ entry }: { entry: AllocationHistory }) {
  const allocations = Array.isArray(entry.allocations)
    ? entry.allocations.filter((item): item is { member_name: string; amount_vnd: number } =>
      typeof item === "object" && item !== null
      && "member_name" in item && typeof item.member_name === "string"
      && "amount_vnd" in item && typeof item.amount_vnd === "number",
    )
    : [];
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="flex flex-wrap justify-between gap-2 text-sm"><strong className="text-ink">{entry.description}</strong><span className="text-muted">{historyLabel(entry.event_type)} · {new Date(entry.created_at).toLocaleString("vi-VN")}</span></div>
      <p className="mt-1 text-xs text-muted">Tổng {money(entry.amount_vnd)} · {allocations.map((allocation) => `${allocation.member_name}: ${money(allocation.amount_vnd)}`).join(", ") || "Không có chi tiết thành viên"}</p>
    </div>
  );
}

function historyLabel(eventType: string) {
  return eventType === "created" ? "Tạo mới" : eventType === "updated" ? "Cập nhật" : eventType === "deleted" ? "Đã xóa" : "Backfill";
}

function categoryLabel(category: ExpenseCategory) {
  return category === "court" ? "Tiền sân" : category === "shuttlecock" ? "Tiền cầu" : category === "equipment" ? "Dụng cụ" : "Khác";
}
