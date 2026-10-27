"use client";

import { updateTeam } from "@/app/system-admin/actions";

export function TeamForm({
  team,
}: {
  team: { id: string; name: string; status: "active" | "locked" };
}) {
  function confirmLock(event: React.FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget);
    if (team.status === "active" && formData.get("status") === "locked") {
      if (!window.confirm(`Khóa team "${team.name}"? Mọi thành viên sẽ mất quyền truy cập, dữ liệu không bị xóa.`)) {
        event.preventDefault();
      }
    }
  }

  return (
    <form action={updateTeam} onSubmit={confirmLock} className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
      <input type="hidden" name="team_id" value={team.id} />
      <input name="team_name" required maxLength={120} defaultValue={team.name} className="h-10 rounded-xl border border-line px-3 text-sm" aria-label="Tên team" />
      <select name="status" defaultValue={team.status} aria-label="Trạng thái team" className="h-10 rounded-xl border border-line bg-white px-3 text-sm">
        <option value="active">Đang hoạt động</option>
        <option value="locked">Đã khóa</option>
      </select>
      <button className="min-h-10 rounded-xl border border-line px-4 text-sm font-semibold">Lưu thay đổi</button>
    </form>
  );
}
