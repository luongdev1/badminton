import { PublicSessionShare } from "@/components/public-session-share";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = {
  robots: { index: false, follow: false },
};

export default function PublicShareTokenPage({ params }: { params: { token: string } }) {
  return <PublicSessionShare initialToken={params.token} />;
}
