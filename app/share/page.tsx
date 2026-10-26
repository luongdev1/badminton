import { PublicSessionShare } from "@/components/public-session-share";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function PublicSharePage() {
  return <PublicSessionShare />;
}
