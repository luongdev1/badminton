import { ReportsView } from "@/components/reports-view";
import { getSessions } from "@/lib/supabase/data";

export default async function ReportsPage() {
  const sessions = await getSessions(true);
  return <ReportsView sessions={sessions} />;
}
