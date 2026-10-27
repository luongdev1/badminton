"use client";

import Image from "next/image";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Trash2 } from "lucide-react";
import { removeVenueQr, updateVenueQr } from "@/app/settings/actions";
import { Button, Card } from "@/components/ui";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];

export function VenueQrManager({
  venue,
  imageUrl,
}: {
  venue: { id: string; name: string; qr_storage_path: string | null };
  imageUrl: string | null;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setIsError(true);
      setMessage("Chọn ảnh QR để xem trước trước khi lưu.");
      return;
    }
    if (file.size > MAX_FILE_BYTES || !ACCEPTED_TYPES.includes(file.type)) {
      setIsError(true);
      setMessage("Ảnh QR phải là PNG, JPEG hoặc WebP và không vượt quá 5 MB.");
      return;
    }
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await updateVenueQr(formData);
      setIsError(!result.ok);
      setMessage(result.message);
      if (result.ok) {
        setFile(null);
        router.refresh();
      }
    });
  }

  function remove() {
    if (!window.confirm(`Gỡ QR riêng của địa điểm "${venue.name}"? Link chia sẻ sẽ dùng QR đội mặc định nếu có.`)) return;
    const formData = new FormData();
    formData.set("venue_id", venue.id);
    startTransition(async () => {
      const result = await removeVenueQr(formData);
      setIsError(!result.ok);
      setMessage(result.message);
      if (result.ok) router.refresh();
    });
  }

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-mint text-brand"><ImagePlus size={19} /></span>
        <div><h2 className="font-bold text-ink">{venue.name}</h2><p className="mt-1 text-xs text-muted">QR riêng cho địa điểm này; nếu chưa có sẽ dùng QR đội mặc định.</p></div>
      </div>
      {message && <p role={isError ? "alert" : "status"} className={`mt-4 rounded-xl p-3 text-sm ${isError ? "bg-rose-50 text-rose-800" : "bg-emerald-50 text-emerald-800"}`}>{message}</p>}
      {imageUrl && !file && <div className="mt-4 inline-flex rounded-xl border border-line bg-white p-2"><Image src={imageUrl} unoptimized width={192} height={192} alt={`QR thanh toán cho ${venue.name}`} className="h-48 w-48 object-contain" /></div>}
      {!imageUrl && !file && <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-muted">Chưa có QR riêng cho địa điểm này.</p>}
      {previewUrl && <div className="mt-4"><p className="mb-2 text-sm font-semibold text-ink">Xem trước ảnh mới</p><div className="inline-flex rounded-xl border border-line bg-white p-2"><Image src={previewUrl} unoptimized width={192} height={192} alt="Xem trước QR mới" className="h-48 w-48 object-contain" /></div></div>}
      <form onSubmit={submit} className="mt-4 space-y-3">
        <input type="hidden" name="venue_id" value={venue.id} />
        <label className="block text-sm font-semibold text-ink">Chọn QR (PNG, JPEG, WebP · tối đa 5 MB)
          <input name="qr_image" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setFile(event.currentTarget.files?.[0] ?? null)} className="mt-2 block w-full rounded-xl border border-line p-2 text-sm font-normal" />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending}>{pending ? "Đang lưu..." : "Lưu QR địa điểm"}</Button>
          {venue.qr_storage_path && <Button type="button" variant="danger" disabled={pending} onClick={remove}><Trash2 size={16} />Gỡ QR riêng</Button>}
        </div>
      </form>
    </Card>
  );
}
