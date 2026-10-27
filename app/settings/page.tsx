import { TeamSettingsForm } from "@/components/team-settings-form";
import { getTeamSettings } from "@/lib/supabase/data";
import { createSupabasePublicServerClient } from "@/lib/supabase/public-server";

export default async function SettingsPage() {
  const settings = await getTeamSettings();
  let qrImageUrl: string | null = null;
  if (settings.qr_storage_path) {
    qrImageUrl = settings.qr_storage_path.startsWith("https://")
      ? settings.qr_storage_path
      : createSupabasePublicServerClient().storage.from("team-bank-qr").getPublicUrl(settings.qr_storage_path).data.publicUrl;
  }
  return <TeamSettingsForm settings={settings} qrImageUrl={qrImageUrl} />;
}
