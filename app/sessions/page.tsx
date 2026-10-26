import { SessionsList } from "@/components/sessions-list";
import { getSessions } from "@/lib/supabase/data";

export default async function SessionsPage() {
  const sessions = await getSessions();
  return <SessionsList sessions={sessions} />;
}
