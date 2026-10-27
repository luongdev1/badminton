import { PageHeading } from "@/components/ui";
import { VenueQrManager } from "@/components/venue-qr-manager";
import { requireAdminContext } from "@/lib/supabase/admin-context";
import { createSupabasePublicServerClient } from "@/lib/supabase/public-server";

export const dynamic = "force-dynamic";

export default async function VenueQrSettingsPage() {
  const { supabase, team } = await requireAdminContext();
  const { data: venues, error } = await supabase
    .from("team_venues")
    .select("id,name,qr_storage_path")
    .eq("team_id", team.id)
    .order("name");
  if (error) throw new Error(`Could not load team venues: ${error.message}`);

  const storage = createSupabasePublicServerClient().storage.from("team-bank-qr");
  return (
    <>
      <PageHeading eyebrow="Cài đặt thanh toán" title="QR theo địa điểm" description="Mỗi địa điểm có thể dùng QR riêng. QR hiện được chọn theo tên địa điểm của buổi đánh; khi chưa cấu hình, hệ thống dùng QR đội mặc định." />
      {venues?.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {venues.map((venue) => {
            const imageUrl = venue.qr_storage_path
              ? storage.getPublicUrl(venue.qr_storage_path).data.publicUrl
              : null;
            return <VenueQrManager key={venue.id} venue={venue} imageUrl={imageUrl} />;
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-sm text-muted">
          Chưa có địa điểm. Tạo hoặc chỉnh sửa buổi đánh để thêm tên địa điểm; trang này sẽ hiển thị QR để cấu hình sau đó.
        </div>
      )}
    </>
  );
}
