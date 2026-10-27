import { Card, PageHeading } from "@/components/ui";
import { TeamForm } from "@/components/system-admin/team-form";
import { requireDatabaseSuperAdmin } from "@/lib/app-auth";
import {
  createTeamAdmin,
  createTeamWithAdmin,
  grantTeamMembership,
  resetTeamAdminPassword,
  revokeAdminSessions,
  revokeTeamMembership,
  setTeamAdminStatus,
} from "./actions";

export const dynamic = "force-dynamic";

const notices: Record<string, string> = {
  "team-created": "Đã tạo đội và tài khoản quản trị.",
  "team-updated": "Đã cập nhật đội.",
  "admin-created": "Đã tạo tài khoản quản trị.",
  "membership-granted": "Đã cấp quyền quản lý đội.",
  "password-reset": "Đã đổi mật khẩu và thu hồi các phiên cũ.",
  "membership-revoked": "Đã thu hồi quyền đội và các phiên liên quan.",
  "account-updated": "Đã cập nhật trạng thái tài khoản.",
  "sessions-revoked": "Đã thu hồi các phiên đăng nhập.",
};
const errors: Record<string, string> = {
  "operation-failed": "Không thể hoàn tất thao tác. Kiểm tra cấu hình migration/quyền và thử lại; lỗi chi tiết đã được ghi server-side.",
};

export default async function SystemAdminPage({
  searchParams,
}: {
  searchParams: { q?: string; notice?: string; error?: string };
}) {
  const identity = await requireDatabaseSuperAdmin();
  const query = searchParams.q?.trim().toLowerCase() ?? "";
  const [teamsResult, usersResult, membershipsResult, auditResult] = await Promise.all([
    identity.supabase.from("teams").select("id,name,slug,status,created_at").order("created_at", { ascending: false }),
    identity.supabase.from("app_users").select("id,username,platform_role,status,created_at").order("username"),
    identity.supabase.from("team_memberships").select("team_id,user_id,role,status,created_at"),
    identity.supabase.from("audit_logs").select("id,actor_app_user_id,team_id,action,target_type,target_id,created_at").order("created_at", { ascending: false }).limit(50),
  ]);
  const queryError = teamsResult.error ?? usersResult.error ?? membershipsResult.error ?? auditResult.error;
  if (queryError) throw new Error(`Không thể tải dữ liệu quản trị hệ thống: ${queryError.message}`);

  const teams = (teamsResult.data ?? []).filter((team) => (
    !query || team.name.toLowerCase().includes(query) || team.slug.includes(query)
  ));
  const usersById = new Map((usersResult.data ?? []).map((user) => [user.id, user]));
  const teamsById = new Map((teamsResult.data ?? []).map((team) => [team.id, team]));
  const membershipsByTeam = new Map<string, NonNullable<typeof membershipsResult.data>>();
  for (const membership of membershipsResult.data ?? []) {
    const list = membershipsByTeam.get(membership.team_id) ?? [];
    list.push(membership);
    membershipsByTeam.set(membership.team_id, list);
  }
  const notice = searchParams.notice ? notices[searchParams.notice] : undefined;
  const errorMessage = searchParams.error ? errors[searchParams.error] : undefined;

  return (
    <>
      <PageHeading
        eyebrow="Quản trị hệ thống"
        title="Super Admin"
        description={`Đăng nhập với tài khoản ${identity.user.username}. Quản lý team và quyền quản trị; mọi thao tác quan trọng được ghi audit.`}
      />
      {notice && <p role="status" className="mb-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}
      {errorMessage && <p role="alert" className="mb-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{errorMessage}</p>}

      <Card className="p-5 sm:p-6">
        <h2 className="font-bold text-ink">Tạo team và admin đầu tiên</h2>
        <form action={createTeamWithAdmin} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium text-ink">Tên team
            <input name="team_name" required maxLength={120} className="mt-1 h-11 w-full rounded-xl border border-line px-3" />
          </label>
          <label className="text-sm font-medium text-ink">Username admin
            <input name="username" required minLength={3} maxLength={64} autoComplete="off" className="mt-1 h-11 w-full rounded-xl border border-line px-3" />
          </label>
          <label className="text-sm font-medium text-ink sm:col-span-2">Mật khẩu tạm thời (tối thiểu 12 ký tự)
            <input name="password" type="password" required minLength={12} maxLength={256} autoComplete="new-password" className="mt-1 h-11 w-full rounded-xl border border-line px-3" />
          </label>
          <button className="min-h-11 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark sm:col-span-2">Tạo team</button>
        </form>
      </Card>

      <Card className="mt-6 p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div><h2 className="font-bold text-ink">Các team</h2><p className="mt-1 text-xs text-muted">{teams.length} kết quả</p></div>
          <form method="get" className="flex gap-2">
            <input name="q" defaultValue={searchParams.q} placeholder="Tìm team..." className="h-10 rounded-xl border border-line px-3 text-sm" />
            <button className="rounded-xl border border-line px-4 text-sm font-semibold">Tìm</button>
          </form>
        </div>
        <div className="mt-5 space-y-5">
          {teams.map((team) => {
            const memberships = membershipsByTeam.get(team.id) ?? [];
            return (
              <section key={team.id} className="rounded-2xl border border-line p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div><h3 className="font-bold text-ink">{team.name}</h3><p className="mt-1 text-xs text-muted">{team.slug}</p></div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${team.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
                    {team.status === "active" ? "Đang hoạt động" : "Đã khóa"}
                  </span>
                </div>

                <TeamForm team={{ id: team.id, name: team.name, status: team.status }} />

                <div className="mt-5 border-t border-line pt-4">
                  <h4 className="text-sm font-semibold text-ink">Tài khoản được gán</h4>
                  <div className="mt-3 space-y-3">
                    {memberships.map((membership) => {
                      const user = usersById.get(membership.user_id);
                      if (!user) return null;
                      return (
                        <div key={membership.user_id} className="rounded-xl bg-slate-50 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-ink">{user.username}</span>
                            <span className="text-xs text-muted">{user.status === "active" ? "Tài khoản hoạt động" : "Tài khoản đã khóa"} · {membership.status === "active" ? "Có quyền team" : "Đã thu hồi quyền"}</span>
                          </div>
                          <div className="mt-3 grid gap-2 lg:grid-cols-2">
                            <form action={resetTeamAdminPassword} className="flex gap-2">
                              <input type="hidden" name="team_id" value={team.id} />
                              <input type="hidden" name="user_id" value={user.id} />
                              <input name="password" type="password" required minLength={12} maxLength={256} placeholder="Mật khẩu mới" className="h-10 min-w-0 flex-1 rounded-xl border border-line px-3 text-sm" />
                              <button className="rounded-xl border border-line px-3 text-xs font-semibold">Reset</button>
                            </form>
                            <div className="flex flex-wrap gap-2">
                              {membership.status === "active" && <form action={revokeTeamMembership}><input type="hidden" name="team_id" value={team.id} /><input type="hidden" name="user_id" value={user.id} /><button className="min-h-10 rounded-xl border border-line px-3 text-xs font-semibold">Thu hồi team</button></form>}
                              <form action={setTeamAdminStatus}><input type="hidden" name="user_id" value={user.id} /><input type="hidden" name="status" value={user.status === "active" ? "disabled" : "active"} /><button className="min-h-10 rounded-xl border border-line px-3 text-xs font-semibold">{user.status === "active" ? "Khóa tài khoản" : "Mở tài khoản"}</button></form>
                              <form action={revokeAdminSessions}><input type="hidden" name="user_id" value={user.id} /><button className="min-h-10 rounded-xl border border-line px-3 text-xs font-semibold">Thu hồi phiên</button></form>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {!memberships.length && <p className="text-sm text-muted">Team chưa có tài khoản admin.</p>}
                  </div>

                  {usersResult.data?.some((user) => user.platform_role === "user" && user.status === "active") && (
                    <form action={grantTeamMembership} className="mt-4 flex flex-wrap gap-2">
                      <input type="hidden" name="team_id" value={team.id} />
                      <select name="user_id" required defaultValue="" className="h-10 min-w-48 rounded-xl border border-line bg-white px-3 text-sm">
                        <option value="" disabled>Gán tài khoản có sẵn...</option>
                        {(usersResult.data ?? []).filter((user) => user.platform_role === "user" && user.status === "active").map((user) => (
                          <option key={user.id} value={user.id}>{user.username}</option>
                        ))}
                      </select>
                      <button className="min-h-10 rounded-xl border border-line px-4 text-sm font-semibold">Gán admin</button>
                    </form>
                  )}

                  <form action={createTeamAdmin} className="mt-4 grid gap-2 sm:grid-cols-3">
                    <input type="hidden" name="team_id" value={team.id} />
                    <input name="username" required minLength={3} maxLength={64} placeholder="Username mới" className="h-10 rounded-xl border border-line px-3 text-sm" />
                    <input name="password" type="password" required minLength={12} maxLength={256} autoComplete="new-password" placeholder="Mật khẩu (tối thiểu 12 ký tự)" className="h-10 rounded-xl border border-line px-3 text-sm" />
                    <button className="min-h-10 rounded-xl bg-brand px-4 text-sm font-semibold text-white">Thêm admin</button>
                  </form>
                </div>
              </section>
            );
          })}
          {!teams.length && <p className="py-8 text-center text-sm text-muted">Không tìm thấy team.</p>}
        </div>
      </Card>

      <Card className="mt-6 p-5 sm:p-6">
        <h2 className="font-bold text-ink">Audit log gần đây</h2>
        <div className="mt-4 divide-y divide-line">
          {(auditResult.data ?? []).map((entry) => (
            <div key={entry.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
              <span className="font-medium text-ink">{entry.action} · {entry.target_type}</span>
              <span className="text-xs text-muted">{entry.team_id ? teamsById.get(entry.team_id)?.name ?? "Team đã ẩn" : "Hệ thống"} · {new Date(entry.created_at).toLocaleString("vi-VN")}</span>
            </div>
          ))}
          {!auditResult.data?.length && <p className="py-4 text-sm text-muted">Chưa có sự kiện audit.</p>}
        </div>
      </Card>
    </>
  );
}
