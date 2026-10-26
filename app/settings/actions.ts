"use server";

import { fileTypeFromBuffer } from "file-type";
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

  const uploadValue = formData.get("qr_image");
  const upload = uploadValue && typeof uploadValue !== "string" && uploadValue.size > 0 ? uploadValue : null;
  const removeQr = formData.get("remove_qr") === "true";
  if ([Boolean(upload), Boolean(parsed.data.qr_image_url), removeQr].filter(Boolean).length > 1) {
    return { ok: false as const, message: "Chỉ chọn một thao tác: tải ảnh mới, dùng URL ảnh hoặc gỡ ảnh QR." };
  }
  if (upload && upload.size > MAX_QR_SIZE_BYTES) {
    return { ok: false as const, message: "Ảnh QR không được vượt quá 5 MB." };
  }

  const { supabase, team, userId } = await requireAdminContext();
  let nextQrPath = team.qr_storage_path;
  let uploadedPath: string | null = null;

  if (removeQr) nextQrPath = null;
  if (parsed.data.qr_image_url) nextQrPath = parsed.data.qr_image_url;
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
      team_name: parsed.data.team_name,
      bank_name: parsed.data.bank_name || null,
      bank_code: parsed.data.bank_code || null,
      bank_account_name: parsed.data.bank_account_name || null,
      bank_account_number: parsed.data.bank_account_number || null,
      transfer_note: parsed.data.transfer_note || null,
      qr_storage_path: nextQrPath,
    })
    .eq("id", team.id)
    .eq("admin_user_id", userId)
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
