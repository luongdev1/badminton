import { redirect } from "next/navigation";
import { Card, PageHeading } from "@/components/ui";
import { requireDatabaseAdminIdentity } from "@/lib/app-auth";
import { activateTeam } from "./actions";

export const dynamic = "force-dynamic";

export default async function ChooseTeamPage() {
  const identity = await requireDatabaseAdminIdentity();
  if (identity.user.platform_role === "super_admin") redirect("/system-admin");

  return (
    <>
      <PageHeading
        eyebrow="Quyền truy cập"
        title="Chọn đội đang quản lý"
        description="Bạn được phân quyền vào nhiều đội. Mỗi phiên làm việc chỉ thao tác trên đội đang chọn."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {identity.teamMemberships.map(({ team }) => (
          <Card key={team.id} className="p-5">
            <h2 className="font-bold text-ink">{team.name}</h2>
            <form action={activateTeam} className="mt-4">
              <input type="hidden" name="team_id" value={team.id} />
              <button className="min-h-11 w-full rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark">
                Mở đội này
              </button>
            </form>
          </Card>
        ))}
        {identity.teamMemberships.length === 0 && (
          <Card className="p-5 text-sm text-muted">
            Tài khoản hiện chưa được gán vào đội nào đang hoạt động. Hãy liên hệ Super Admin.
          </Card>
        )}
      </div>
    </>
  );
}
