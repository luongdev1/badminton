"use server";

import { fileTypeFromBuffer } from "file-type";
import { z } from "zod";
import { requireAdminContext } from "@/lib/supabase/admin-context";
import { teamSettingsSchema } from "@/lib/validation";

const MAX_QR_SIZE_BYTES = 5 * 1024 * 1024;
const QR_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export async function updateTeamSettings(formData: FormData) {
  const parsed = teamSettingsSchema.safeParse({
    team_name: formData.get("team_name"),
    bank_name: formData.get("bank_name"),
    bank_code: formData.get("bank_code"),
    bank_account_name: formData.get("bank_account_name"),
    bank_account_number: formData.get("bank_account_number"),
    transfer_note: formData.get("transfer_note"),
    qr_image_url: formData.get("qr_image_url"),
  });
  if (!parsed.success) {
    return { ok: false as const, message: parsed.error.issues[0]?.message ?? "Thông tin đội không hợp lệ." };
  }
  return saveTeamSettings(formData, parsed.data);
}

export async function updateVenueQr(formData: FormData) {
    const parsed = z.object({
      venue_id: z.string().uuid(),
    }).safeParse({ venue_id: formData.get("venue_id") });
    if (!parsed.success) return { ok: false as const, message: "Địa điểm không hợp lệ." };

    const uploadValue = formData.get("qr_image");
    const upload = uploadValue && typeof uploadValue !== "string" && uploadValue.size > 0 ? uploadValue : null;
    if (!upload) return { ok: false as const, message: "Chọn ảnh QR trước khi lưu." };
    if (upload.size > MAX_QR_SIZE_BYTES) return { ok: false as const, message: "Ảnh QR không được vượt quá 5 MB." };

    const { supabase, team, userId } = await requireAdminContext();
    const { data: venue, error: venueError } = await supabase
      .from("team_venues")
      .select("id,name,qr_storage_path")
      .eq("team_id", team.id)
      .eq("id", parsed.data.venue_id)
      .maybeSingle();
    if (venueError) throw new Error(`Could not load the venue: ${venueError.message}`);
    if (!venue) return { ok: false as const, message: "Không tìm thấy địa điểm thuộc đội này." };

    const bytes = new Uint8Array(await upload.arrayBuffer());
    const detectedType = await fileTypeFromBuffer(bytes);
    const extension = detectedType ? QR_EXTENSIONS[detectedType.mime] : undefined;
    if (!detectedType || !extension || upload.type !== detectedType.mime) {
      return { ok: false as const, message: "Chỉ chấp nhận ảnh PNG, JPEG hoặc WebP hợp lệ." };
    }

    const uploadedPath = `${team.id}/${venue.id}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("team-bank-qr")
      .upload(uploadedPath, bytes, { contentType: detectedType.mime, cacheControl: "3600", upsert: false });
    if (uploadError) return { ok: false as const, message: `Không thể tải ảnh QR lên: ${uploadError.message}` };

    const { data, error } = await supabase
      .from("team_venues")
      .update({ qr_storage_path: uploadedPath })
      .eq("team_id", team.id)
      .eq("id", venue.id)
      .select("id")
      .maybeSingle();
    if (error || !data) {
      const { error: cleanupError } = await supabase.storage.from("team-bank-qr").remove([uploadedPath]);
      const cleanupMessage = cleanupError ? ` Ảnh tạm chưa được dọn: ${cleanupError.message}` : "";
      return {
        ok: false as const,
        message: `${error ? `Không thể lưu QR: ${error.message}` : "Địa điểm không còn tồn tại."}${cleanupMessage}`,
      };
    }

    const { error: auditError } = await supabase.from("audit_logs").insert({
      actor_app_user_id: userId,
      team_id: team.id,
      action: "venue.qr_updated",
      target_type: "venue",
      target_id: venue.id,
    });
    if (auditError) throw new Error(`QR đã lưu nhưng không thể ghi audit log: ${auditError.message}`);

    if (venue.qr_storage_path && !venue.qr_storage_path.startsWith("https://")) {
      const { error: removeError } = await supabase.storage.from("team-bank-qr").remove([venue.qr_storage_path]);
      if (removeError) {
        return { ok: true as const, message: `Đã thay QR nhưng chưa dọn được ảnh cũ: ${removeError.message}` };
      }
    }
    return { ok: true as const, message: "Đã cập nhật QR cho địa điểm." };
  }

export async function removeVenueQr(formData: FormData) {
    const parsed = z.object({
      venue_id: z.string().uuid(),
    }).safeParse({ venue_id: formData.get("venue_id") });
    if (!parsed.success) return { ok: false as const, message: "Địa điểm không hợp lệ." };

    const { supabase, team, userId } = await requireAdminContext();
    const { data: venue, error: venueError } = await supabase
      .from("team_venues")
      .select("id,qr_storage_path")
      .eq("team_id", team.id)
      .eq("id", parsed.data.venue_id)
      .maybeSingle();
    if (venueError) throw new Error(`Could not load the venue: ${venueError.message}`);
    if (!venue) return { ok: false as const, message: "Không tìm thấy địa điểm thuộc đội này." };
    if (!venue.qr_storage_path) return { ok: true as const, message: "Địa điểm chưa có QR riêng." };

    const { data, error } = await supabase
      .from("team_venues")
      .update({ qr_storage_path: null })
      .eq("team_id", team.id)
      .eq("id", venue.id)
      .select("id")
      .maybeSingle();
    if (error || !data) {
      return { ok: false as const, message: error ? `Không thể gỡ QR: ${error.message}` : "Địa điểm không còn tồn tại." };
    }

    const { error: auditError } = await supabase.from("audit_logs").insert({
      actor_app_user_id: userId,
      team_id: team.id,
      action: "venue.qr_removed",
      target_type: "venue",
      target_id: venue.id,
    });
    if (auditError) throw new Error(`QR đã gỡ nhưng không thể ghi audit log: ${auditError.message}`);

    if (!venue.qr_storage_path.startsWith("https://")) {
      const { error: removeError } = await supabase.storage.from("team-bank-qr").remove([venue.qr_storage_path]);
      if (removeError) {
        return { ok: true as const, message: `Đã gỡ QR khỏi địa điểm nhưng chưa dọn được file cũ: ${removeError.message}` };
      }
    }
    return { ok: true as const, message: "Đã gỡ QR riêng; link chia sẻ sẽ dùng QR đội mặc định nếu đã cấu hình." };
  }

async function saveTeamSettings(formData: FormData, settings: z.infer<typeof teamSettingsSchema>) {
  const uploadValue = formData.get("qr_image");
  const upload = uploadValue && typeof uploadValue !== "string" && uploadValue.size > 0 ? uploadValue : null;
  const removeQr = formData.get("remove_qr") === "true";
  if ([Boolean(upload), Boolean(settings.qr_image_url), removeQr].filter(Boolean).length > 1) {
    return { ok: false as const, message: "Chỉ chọn một thao tác: tải ảnh mới, dùng URL ảnh hoặc gỡ ảnh QR." };
  }
  if (upload && upload.size > MAX_QR_SIZE_BYTES) {
    return { ok: false as const, message: "Ảnh QR không được vượt quá 5 MB." };
  }

  const { supabase, team } = await requireAdminContext();
  let nextQrPath = team.qr_storage_path;
  let uploadedPath: string | null = null;

  if (removeQr) nextQrPath = null;
  if (settings.qr_image_url) nextQrPath = settings.qr_image_url;
  if (upload) {
    const bytes = new Uint8Array(await upload.arrayBuffer());
    const detectedType = await fileTypeFromBuffer(bytes);
    const extension = detectedType ? QR_EXTENSIONS[detectedType.mime] : undefined;
    if (!detectedType || !extension || upload.type !== detectedType.mime) {
      return { ok: false as const, message: "Chỉ chấp nhận ảnh PNG, JPEG hoặc WebP hợp lệ." };
    }

    uploadedPath = `${team.id}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("team-bank-qr")
      .upload(uploadedPath, bytes, { contentType: detectedType.mime, cacheControl: "3600", upsert: false });
    if (uploadError) return { ok: false as const, message: `Không thể tải ảnh QR lên: ${uploadError.message}` };
    nextQrPath = uploadedPath;
  }

  const { data, error } = await supabase
    .from("team_settings")
    .update({
      team_name: settings.team_name,
      bank_name: settings.bank_name || null,
      bank_code: settings.bank_code || null,
      bank_account_name: settings.bank_account_name || null,
      bank_account_number: settings.bank_account_number || null,
      transfer_note: settings.transfer_note || null,
      qr_storage_path: nextQrPath,
    })
    .eq("id", team.id)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    if (uploadedPath) {
      const { error: cleanupError } = await supabase.storage.from("team-bank-qr").remove([uploadedPath]);
      const cleanupMessage = cleanupError ? ` Ảnh tải lên chưa được dọn: ${uploadedPath}.` : "";
      const saveMessage = error ? `Không thể lưu cài đặt đội: ${error.message}` : "Không tìm thấy cài đặt đội.";
      return { ok: false as const, message: `${saveMessage}${cleanupMessage}` };
    }
    return { ok: false as const, message: error ? `Không thể lưu cài đặt đội: ${error.message}` : "Không tìm thấy cài đặt đội." };
  }

  const oldStoragePath = team.qr_storage_path && !team.qr_storage_path.startsWith("https://")
    ? team.qr_storage_path
    : null;
  if (oldStoragePath && oldStoragePath !== nextQrPath) {
    const { error: removeError } = await supabase.storage.from("team-bank-qr").remove([oldStoragePath]);
    if (removeError) {
      return { ok: true as const, message: `Đã lưu cài đặt nhưng chưa dọn được ảnh QR cũ (${oldStoragePath}): ${removeError.message}` };
    }
  }
  return { ok: true as const, message: "Đã lưu cài đặt đội." };
}
