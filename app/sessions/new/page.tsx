import { PageHeading } from "@/components/ui";
import { SessionForm } from "@/components/session-form";
import { getMembers } from "@/lib/supabase/data";

export default async function NewSessionPage() {
  const members = await getMembers(false);
  return <><PageHeading eyebrow="Lịch hoạt động" title="Tạo buổi đánh" description="Điền thông tin, chọn thành viên đang hoạt động và lưu lịch cho đội." /><SessionForm members={members} /></>;
}
