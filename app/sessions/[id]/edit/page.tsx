import Link from "next/link";
import { notFound } from "next/navigation";
import { SessionForm } from "@/components/session-form";
import { PageHeading } from "@/components/ui";
import { getMembers, getSessionDetail } from "@/lib/supabase/data";

export default async function EditSessionPage({ params }: { params: { id: string } }) {
  const [detail, members] = await Promise.all([getSessionDetail(params.id), getMembers()]);
  if (!detail) notFound();
  return (
    <>
      <PageHeading eyebrow={<Link href={`/sessions/${detail.session.id}`} className="hover:underline">Chi tiết buổi đánh</Link>} title="Chỉnh sửa buổi đánh" description="Cập nhật lịch, phí và danh sách người tham gia." />
      <SessionForm initial={detail.session} members={members} participants={detail.participants} confirmedPaymentsCount={detail.confirmedPaymentsCount} />
    </>
  );
}
