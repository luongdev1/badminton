"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Search, UserPlus, UsersRound, X } from "lucide-react";
import { Badge, Button, Card, PageHeading } from "@/components/ui";
import { memberInputSchema } from "@/lib/validation";
import type { MemberRow } from "@/lib/supabase/data";
import { createMember, setMemberActive, updateMember } from "@/app/members/actions";

export function MembersManager({ initialMembers }: { initialMembers: MemberRow[] }) {
  const router = useRouter();
  const [members, setMembers] = useState(initialMembers);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("active");
  const [editing, setEditing] = useState<MemberRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [pending, startTransition] = useTransition();
  useEffect(() => setMembers(initialMembers), [initialMembers]);
  const visible = useMemo(
    () => members.filter((member) => {
      const matchesName = member.full_name.toLocaleLowerCase("vi").includes(query.trim().toLocaleLowerCase("vi"));
      const matchesState = filter === "all" || (filter === "active" ? member.is_active : !member.is_active);
      return matchesName && matchesState;
    }),
    [filter, members, query],
  );

  function submitMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = memberInputSchema.safeParse({ full_name: new FormData(event.currentTarget).get("full_name") });
    if (!parsed.success) {
      setIsError(true);
      setMessage(parsed.error.issues[0]?.message ?? "Tên thành viên không hợp lệ.");
      return;
    }

    setMessage("");
    startTransition(async () => {
      const result = editing
        ? await updateMember({ ...parsed.data, member_id: editing.id })
        : await createMember(parsed.data);
      if (!result.ok) {
        setIsError(true);
        setMessage(result.message);
        return;
      }

      if (editing) {
        setMembers((current) => current.map((member) => member.id === editing.id ? { ...member, full_name: parsed.data.full_name } : member));
      } else {
        router.refresh();
      }
      setEditing(null);
      setAdding(false);
      setIsError(false);
      setMessage(editing ? "Đã cập nhật thành viên." : "Đã thêm thành viên.");
    });
  }

  function toggleActive(member: MemberRow) {
    const nextState = !member.is_active;
    if (!nextState && !window.confirm(`Ẩn thành viên ${member.full_name}? Lịch sử tham gia cũ sẽ được giữ nguyên.`)) return;
    startTransition(async () => {
      const result = await setMemberActive({ member_id: member.id, is_active: nextState });
      if (!result.ok) {
        setIsError(true);
        setMessage(result.message);
        return;
      }
      setMembers((current) => current.map((item) => item.id === member.id
        ? { ...item, is_active: nextState, archived_at: nextState ? null : new Date().toISOString() }
        : item));
      setIsError(false);
      setMessage(nextState ? "Đã kích hoạt lại thành viên." : "Đã ẩn thành viên; lịch sử cũ vẫn được giữ.");
    });
  }

  const openForm = (member?: MemberRow) => {
    setMessage("");
    setEditing(member ?? null);
    setAdding(!member);
  };
  const formOpen = adding || Boolean(editing);

  return (
    <>
      <PageHeading
        eyebrow="Đội cầu lông"
        title="Thành viên"
        description={`${members.filter((member) => member.is_active).length} thành viên đang hoạt động.`}
        action={<Button onClick={() => openForm()}><UserPlus size={17} />Thêm thành viên</Button>}
      />
      {message && <div role={isError ? "alert" : "status"} className={`mb-5 rounded-xl px-4 py-3 text-sm ${isError ? "bg-rose-50 text-rose-800" : "bg-emerald-50 text-emerald-800"}`}>{message}</div>}

      {formOpen && (
        <Card className="mb-5 p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div><h2 className="font-bold text-ink">{editing ? "Đổi tên thành viên" : "Thêm thành viên"}</h2><p className="mt-1 text-xs text-muted">Dữ liệu sẽ được lưu vào đội hiện tại.</p></div>
            <button type="button" aria-label="Đóng biểu mẫu" onClick={() => { setAdding(false); setEditing(null); }} className="rounded-lg p-2 text-muted hover:bg-slate-100"><X size={18} /></button>
          </div>
          <form key={editing?.id ?? "new-member"} onSubmit={submitMember} className="flex flex-col gap-3 sm:flex-row">
            <input required name="full_name" defaultValue={editing?.full_name} maxLength={120} placeholder="Tên thành viên" className="h-11 flex-1 rounded-xl border border-line px-3 text-sm outline-none focus:border-brand" />
            <Button type="submit" disabled={pending}>{pending ? "Đang lưu..." : editing ? "Lưu tên" : "Thêm thành viên"}</Button>
          </form>
        </Card>
      )}

      <div className="mb-4 grid gap-4 sm:grid-cols-[1fr_auto]">
        <label className="relative"><Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm thành viên..." className="h-11 w-full rounded-xl border border-line bg-white pl-10 pr-4 text-sm outline-none focus:border-brand" /></label>
        <select aria-label="Lọc trạng thái thành viên" value={filter} onChange={(event) => setFilter(event.target.value)} className="h-11 rounded-xl border border-line bg-white px-4 text-sm"><option value="active">Đang hoạt động</option><option value="inactive">Đã ẩn</option><option value="all">Tất cả</option></select>
      </div>

      {visible.length === 0 ? (
        <Card className="flex flex-col items-center p-12 text-center">
          <UsersRound size={26} className="text-slate-400" />
          <p className="mt-3 font-semibold text-ink">{members.length === 0 ? "Đội chưa có thành viên" : "Không tìm thấy thành viên"}</p>
          <p className="mt-1 text-sm text-muted">{members.length === 0 ? "Thêm thành viên đầu tiên để chọn vào buổi đánh." : "Thử thay đổi từ khóa hoặc bộ lọc."}</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden grid-cols-[1.5fr_0.7fr_0.8fr_0.7fr] gap-4 border-b border-line bg-slate-50/70 px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-muted md:grid"><span>Thành viên</span><span>Vai trò</span><span>Trạng thái</span><span>Thao tác</span></div>
          <div className="divide-y divide-line">
            {visible.map((member) => {
              const initials = member.full_name.split(/\s+/).map((part) => part[0]).join("").slice(-2).toUpperCase();
              return (
                <div key={member.id} className="grid gap-3 px-4 py-4 sm:px-5 md:grid-cols-[1.5fr_0.7fr_0.8fr_0.7fr] md:items-center md:gap-4">
                  <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">{initials}</span><span><strong className="block text-sm text-ink">{member.full_name}</strong><small className="text-xs text-muted">Thành viên đội</small></span></div>
                  <div className="flex items-center justify-between md:block"><span className="text-xs text-muted md:hidden">Vai trò</span><Badge tone={member.role === "manager" ? "blue" : "gray"}>{member.role === "manager" ? "Quản lý" : "Thành viên"}</Badge></div>
                  <div className="flex items-center justify-between md:block"><span className="text-xs text-muted md:hidden">Trạng thái</span><Badge tone={member.is_active ? "green" : "gray"}>{member.is_active ? "Đang hoạt động" : "Đã ẩn"}</Badge></div>
                  <div className="flex items-center justify-end gap-2"><Button variant="secondary" className="min-h-10 px-3" onClick={() => openForm(member)} disabled={pending}><Pencil size={15} /><span className="md:hidden">Sửa</span></Button><Button variant={member.is_active ? "danger" : "secondary"} className="min-h-10 px-3" onClick={() => toggleActive(member)} disabled={pending}>{member.is_active ? "Ẩn" : "Kích hoạt"}</Button></div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
      <p className="mt-5 text-center text-xs text-muted">Thành viên bị ẩn không xuất hiện khi tạo buổi đánh mới; bản ghi và tên snapshot ở buổi cũ được giữ lại.</p>
    </>
  );
}
