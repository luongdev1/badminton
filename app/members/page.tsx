import { MembersManager } from "@/components/members-manager";
import { getMembers } from "@/lib/supabase/data";

export default async function MembersPage() {
  const members = await getMembers();
  return <MembersManager initialMembers={members} />;
}
