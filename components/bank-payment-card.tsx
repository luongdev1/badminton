"use client";

import { useState } from "react";
import Image from "next/image";
import { Copy, X } from "lucide-react";
import { Card } from "@/components/ui";

type BankSettings = {
  bank_name: string | null;
  bank_code?: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  transfer_note: string | null;
};

export function BankPaymentCard({
  settings,
  qrImageUrl,
  amountVnd,
}: {
  settings: BankSettings;
  qrImageUrl: string | null;
  amountVnd?: number;
}) {
  const [zoomed, setZoomed] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  const accountConfigured = Boolean(settings.bank_name && settings.bank_account_name && settings.bank_account_number);

  async function copy(label: string, value: string | null) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopyMessage(`Đã sao chép ${label}.`);
    } catch {
      setCopyMessage(`Không thể sao chép ${label}. Hãy kiểm tra quyền clipboard của trình duyệt.`);
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-line px-4 py-4 sm:px-5">
        <h2 className="font-bold text-ink">Thông tin chuyển khoản</h2>
        {amountVnd !== undefined && <p className="mt-1 text-sm font-semibold text-brand">Số tiền riêng của bạn: {new Intl.NumberFormat("vi-VN").format(amountVnd)}đ</p>}
      </div>
      <div className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(180px,0.8fr)] sm:p-5">
        <div className="space-y-4">
          {!accountConfigured && <p className="rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-900">Chưa cấu hình đầy đủ tài khoản nhận tiền. Vui lòng liên hệ quản lý đội.</p>}
          {accountConfigured && <>
            <CopyRow label="Ngân hàng" value={settings.bank_name!} onCopy={() => copy("tên ngân hàng", settings.bank_name)} />
            {settings.bank_code && <CopyRow label="Mã ngân hàng" value={settings.bank_code} onCopy={() => copy("mã ngân hàng", settings.bank_code ?? null)} />}
            <CopyRow label="Chủ tài khoản" value={settings.bank_account_name!} onCopy={() => copy("tên chủ tài khoản", settings.bank_account_name)} />
            <CopyRow label="Số tài khoản" value={settings.bank_account_number!} onCopy={() => copy("số tài khoản", settings.bank_account_number)} />
            {settings.transfer_note
              ? <CopyRow label="Nội dung gợi ý" value={settings.transfer_note} onCopy={() => copy("nội dung chuyển khoản", settings.transfer_note)} />
              : <p className="text-xs text-muted">Chưa có nội dung chuyển khoản gợi ý.</p>}
          </>}
          {copyMessage && <p role="status" aria-live="polite" className="text-xs text-muted">{copyMessage}</p>}
          <p className="text-xs leading-5 text-muted">Ảnh QR được cung cấp cố định; hãy nhập số tiền riêng ở trên khi cần. Không giả định QR đã điền sẵn số tiền.</p>
        </div>
        <div className="flex min-h-48 items-center justify-center rounded-xl bg-slate-50 p-3">
          {qrImageUrl
            ? <button type="button" onClick={() => setZoomed(true)} aria-label="Phóng to ảnh QR" className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"><Image src={qrImageUrl} unoptimized width={192} height={192} alt="Mã QR ngân hàng do quản lý cung cấp" className="h-48 w-48 rounded-lg bg-white object-contain p-1" /></button>
            : <p className="max-w-56 text-center text-sm leading-6 text-muted">Chưa có ảnh QR. Quản lý có thể tải ảnh QR thật tại trang Cài đặt.</p>}
        </div>
      </div>
      {zoomed && qrImageUrl && <div role="dialog" aria-modal="true" aria-label="Ảnh QR phóng to" onKeyDown={(event) => { if (event.key === "Escape") setZoomed(false); }} onClick={() => setZoomed(false)} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
        <button type="button" onClick={() => setZoomed(false)} aria-label="Đóng ảnh QR" className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white text-ink"><X size={22} /></button>
        <Image onClick={(event) => event.stopPropagation()} src={qrImageUrl} unoptimized width={640} height={640} alt="Mã QR ngân hàng phóng to" className="max-h-[90vh] max-w-[min(90vw,640px)] rounded-xl bg-white object-contain p-2" />
      </div>}
    </Card>
  );
}

function CopyRow({ label, value, onCopy }: { label: string; value: string; onCopy: () => void }) {
  return <div className="flex items-start justify-between gap-3">
    <span className="min-w-0"><span className="block text-xs text-muted">{label}</span><strong className="mt-1 block break-words text-sm text-ink">{value}</strong></span>
    <button type="button" onClick={onCopy} className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-semibold text-ink hover:border-brand hover:text-brand"><Copy size={14} />Sao chép</button>
  </div>;
}
