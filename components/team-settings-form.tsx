"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Landmark, ShieldCheck } from "lucide-react";
import { updateTeamSettings } from "@/app/settings/actions";
import { BankPaymentCard } from "@/components/bank-payment-card";
import { Button, Card, PageHeading } from "@/components/ui";
import type { Database } from "@/lib/supabase/database.types";
import { teamSettingsSchema } from "@/lib/validation";

const inputClass = "mt-2 h-12 w-full rounded-xl border border-line bg-white px-3.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand focus:ring-2 focus:ring-emerald-100";
const MAX_QR_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_QR_TYPES = ["image/png", "image/jpeg", "image/webp"];

type SettingsForm = Pick<
  Database["public"]["Tables"]["team_settings"]["Row"],
  "team_name" | "bank_name" | "bank_code" | "bank_account_name" | "bank_account_number" | "transfer_note" | "qr_storage_path"
>;

export function TeamSettingsForm({ settings, qrImageUrl }: { settings: SettingsForm; qrImageUrl: string | null }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [pending, startTransition] = useTransition();
  const [removeQr, setRemoveQr] = useState(false);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const parsed = teamSettingsSchema.safeParse({
      team_name: data.get("team_name"),
      bank_name: data.get("bank_name"),
      bank_code: data.get("bank_code"),
      bank_account_name: data.get("bank_account_name"),
      bank_account_number: data.get("bank_account_number"),
      transfer_note: data.get("transfer_note"),
      qr_image_url: data.get("qr_image_url"),
    });
    if (!parsed.success) {
      setIsError(true);
      setMessage(parsed.error.issues[0]?.message ?? "Thông tin không hợp lệ.");
      return;
    }
    const file = data.get("qr_image");
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_QR_SIZE_BYTES || !ALLOWED_QR_TYPES.includes(file.type)) {
        setIsError(true);
        setMessage("Ảnh QR phải là PNG, JPEG hoặc WebP và không vượt quá 5 MB.");
        return;
      }
      if (parsed.data.qr_image_url || removeQr) {
        setIsError(true);
        setMessage("Chỉ chọn một thao tác: tải ảnh mới, dùng URL ảnh hoặc gỡ ảnh QR.");
        return;
      }
    }

    startTransition(async () => {
      const result = await updateTeamSettings(data);
      setIsError(!result.ok);
      setMessage(result.message);
      if (result.ok) router.refresh();
    });
  }

  const currentQrIsExternal = settings.qr_storage_path?.startsWith("https://") ?? false;
  return (
    <>
      <PageHeading eyebrow="Tùy chỉnh đội" title="Cài đặt thanh toán" description="Thông tin đội, tài khoản nhận tiền và ảnh QR dùng chung được lưu trong Supabase." />
      {message && <div role={isError ? "alert" : "status"} className={`mb-5 rounded-xl px-4 py-3 text-sm ${isError ? "bg-rose-50 text-rose-800" : "bg-emerald-50 text-emerald-800"}`}>{message}</div>}
      <form onSubmit={submit} className="space-y-5">
        <Card className="p-5 sm:p-7">
          <div className="flex items-center gap-3 border-b border-line pb-5"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-mint text-brand"><Landmark size={21} /></span><div><h2 className="font-bold text-ink">Thông tin đội và ngân hàng</h2><p className="mt-1 text-xs text-muted">Chỉ quản trị viên mới có thể thay đổi các thông tin này.</p></div></div>
          <div className="grid gap-5 pt-5 sm:grid-cols-2">
            <div><label htmlFor="team_name" className="text-sm font-semibold text-ink">Tên đội</label><input required maxLength={120} id="team_name" name="team_name" defaultValue={settings.team_name} className={inputClass} /></div>
            <div><label htmlFor="bank_name" className="text-sm font-semibold text-ink">Tên ngân hàng</label><input maxLength={120} id="bank_name" name="bank_name" defaultValue={settings.bank_name ?? ""} placeholder="Nhập tên ngân hàng" className={inputClass} /></div>
            <div><label htmlFor="bank_code" className="text-sm font-semibold text-ink">Mã ngân hàng <span className="font-normal text-muted">(nếu có)</span></label><input maxLength={40} id="bank_code" name="bank_code" defaultValue={settings.bank_code ?? ""} placeholder="Mã ngân hàng do bạn cung cấp" className={inputClass} /></div>
            <div><label htmlFor="bank_account_name" className="text-sm font-semibold text-ink">Tên chủ tài khoản</label><input maxLength={120} id="bank_account_name" name="bank_account_name" defaultValue={settings.bank_account_name ?? ""} placeholder="Nhập tên chủ tài khoản" className={inputClass} /></div>
            <div><label htmlFor="bank_account_number" className="text-sm font-semibold text-ink">Số tài khoản</label><input maxLength={40} id="bank_account_number" name="bank_account_number" inputMode="numeric" defaultValue={settings.bank_account_number ?? ""} placeholder="Nhập số tài khoản" className={inputClass} /></div>
            <div className="sm:col-span-2"><label htmlFor="transfer_note" className="text-sm font-semibold text-ink">Nội dung chuyển khoản gợi ý</label><input maxLength={200} id="transfer_note" name="transfer_note" defaultValue={settings.transfer_note ?? ""} placeholder="Nhập nội dung gợi ý" className={inputClass} /></div>
          </div>
        </Card>
        <Card className="p-5 sm:p-7">
          <h2 className="font-bold text-ink">Ảnh QR ngân hàng cố định</h2>
          <p className="mt-2 text-sm leading-6 text-muted">Tải QR thật do quản lý cung cấp hoặc dùng URL HTTPS của ảnh hiện có. QR chỉ chứa thông tin theo ảnh gốc, không tự sinh số tiền riêng.</p>
          {qrImageUrl && !removeQr && <div className="mt-4 max-w-md"><BankPaymentCard settings={settings} qrImageUrl={qrImageUrl} /></div>}
          <div className="mt-5 grid gap-5">
            <div><label htmlFor="qr_image" className="text-sm font-semibold text-ink">Tải ảnh lên <span className="font-normal text-muted">(PNG, JPEG, WebP, tối đa 5 MB)</span></label><input id="qr_image" name="qr_image" type="file" accept="image/png,image/jpeg,image/webp" className={`${inputClass} h-auto py-3`} /></div>
            <div><label htmlFor="qr_image_url" className="text-sm font-semibold text-ink">Hoặc URL ảnh HTTPS</label><input id="qr_image_url" name="qr_image_url" defaultValue={currentQrIsExternal ? settings.qr_storage_path ?? "" : ""} maxLength={2048} type="url" placeholder="https://..." className={inputClass} /></div>
            {settings.qr_storage_path && <label className="flex items-center gap-3 text-sm font-medium text-rose-700"><input name="remove_qr" value="true" type="checkbox" checked={removeQr} onChange={(event) => setRemoveQr(event.target.checked)} className="h-4 w-4 accent-rose-600" />Gỡ ảnh QR hiện tại</label>}
          </div>
        </Card>
        <div className="flex flex-col gap-4 rounded-2xl border border-sky-100 bg-sky-50 p-4 sm:flex-row sm:items-center"><ShieldCheck size={21} className="shrink-0 text-sky-700" /><p className="text-sm leading-6 text-sky-900">Ảnh QR được công khai để người nhận tiền có thể quét; quyền tải lên và thay đổi thông tin vẫn chỉ dành cho quản trị viên.</p></div>
        <div className="flex justify-end"><Button type="submit" disabled={pending}>{pending ? "Đang lưu..." : "Lưu cài đặt"}</Button></div>
      </form>
    </>
  );
}
