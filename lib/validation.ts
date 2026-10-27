import { z } from "zod";

const MAX_VND = Number.MAX_SAFE_INTEGER;

export const memberInputSchema = z.object({
  full_name: z.string().trim().min(1, "Vui lòng nhập tên thành viên.").max(120, "Tên thành viên quá dài."),
});

export const memberStatusSchema = z.object({
  member_id: z.string().uuid("Mã thành viên không hợp lệ."),
  is_active: z.boolean(),
});

export const sessionInputSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1, "Vui lòng nhập tên buổi đánh.").max(120),
  session_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày không hợp lệ.").refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }, "Ngày không tồn tại."),
  starts_at: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Giờ bắt đầu không hợp lệ."),
  ends_at: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Giờ kết thúc không hợp lệ."),
  venue: z.string().trim().min(1, "Vui lòng nhập tên sân.").max(200),
  court_details: z.string().trim().max(200).optional().default(""),
  fee_per_member_vnd: z.number().int("Phí phải là số nguyên VND.").min(0).max(MAX_VND),
  notes: z.string().trim().max(2000).optional().default(""),
  confirm_paid_rebalance: z.boolean().optional(),
  member_ids: z.array(z.string().uuid("Mã thành viên không hợp lệ.")).max(500),
}).refine((data) => data.ends_at > data.starts_at, {
  message: "Giờ kết thúc phải sau giờ bắt đầu.",
  path: ["ends_at"],
}).refine((data) => new Set(data.member_ids).size === data.member_ids.length, {
  message: "Danh sách thành viên bị trùng.",
  path: ["member_ids"],
});

export const expenseInputSchema = z.object({
  id: z.string().uuid().optional(),
  session_id: z.string().uuid("Buổi đánh không hợp lệ."),
  description: z.string().trim().min(1, "Vui lòng nhập nội dung khoản chi.").max(200),
  category: z.enum(["court", "shuttlecock", "equipment", "other"]),
  amount_vnd: z.number().int("Số tiền phải là số nguyên VND.").positive("Số tiền phải lớn hơn 0.").max(MAX_VND),
});

export const expenseMutationSchema = expenseInputSchema.extend({
  confirm_paid_rebalance: z.boolean().optional(),
});

export const expenseIdSchema = z.object({
  expense_id: z.string().uuid("Khoản chi không hợp lệ."),
  session_id: z.string().uuid("Buổi đánh không hợp lệ."),
});

export const adminLoginSchema = z.object({
  username: z.string().trim().min(3, "Tên đăng nhập phải có ít nhất 3 ký tự.").max(64, "Tên đăng nhập quá dài."),
  password: z.string().min(12, "Mật khẩu phải có ít nhất 12 ký tự.").max(256, "Mật khẩu quá dài."),
}).strict();

export const teamSettingsSchema = z.object({
  team_name: z.string().trim().min(1, "Tên đội không được để trống.").max(120),
  bank_name: z.string().trim().max(120).optional().default(""),
  bank_code: z.string().trim().max(40).optional().default(""),
  bank_account_name: z.string().trim().max(120).optional().default(""),
  bank_account_number: z.string().trim().max(40).optional().default(""),
  transfer_note: z.string().trim().max(200).optional().default(""),
  qr_image_url: z.string().trim().max(2048).optional().default("").refine((value) => {
    if (!value) return true;
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  }, "Đường dẫn ảnh QR phải là URL HTTPS hợp lệ."),
}).refine((settings) => {
  const bankFields = [settings.bank_name, settings.bank_account_name, settings.bank_account_number];
  return bankFields.every((field) => field.length === 0) || bankFields.every((field) => field.length > 0);
}, {
  message: "Hãy nhập đầy đủ tên ngân hàng, chủ tài khoản và số tài khoản; hoặc để trống cả ba.",
  path: ["bank_name"],
});

export const publicSessionShareSchema = z.object({
  ok: z.literal(true),
  session: z.object({
    title: z.string(),
    session_date: z.string(),
    starts_at: z.string(),
    ends_at: z.string(),
    venue: z.string(),
    court_details: z.string().nullable(),
  }),
  team: z.object({
    team_name: z.string(),
    bank_name: z.string().nullable(),
    bank_code: z.string().nullable(),
    bank_account_name: z.string().nullable(),
    bank_account_number: z.string().nullable(),
    transfer_note: z.string().nullable(),
    qr_storage_path: z.string().nullable(),
  }),
  expenses: z.array(z.object({
    description: z.string(),
    category: z.enum(["court", "shuttlecock", "equipment", "other"]),
    amount_vnd: z.number().int().nonnegative(),
  })),
  participants: z.array(z.object({
    payment_id: z.string().uuid(),
    name: z.string(),
    payment_status: z.enum(["pending", "paid", "waived", "refunded"]),
    amount_due_vnd: z.number().int().nonnegative(),
    amount_to_pay_vnd: z.number().int().nonnegative(),
    paid_at: z.string().nullable(),
  })),
  totals: z.object({
    expenses_vnd: z.number().int().nonnegative(),
    collected_vnd: z.number().int().nonnegative(),
    outstanding_vnd: z.number().int().nonnegative(),
  }),
});

const shareTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/, "Liên kết chia sẻ không hợp lệ.");

export const publicShareRequestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("read"),
    token: shareTokenSchema,
  }).strict(),
  z.object({
    action: z.literal("confirm"),
    token: shareTokenSchema,
    payment_id: z.string().uuid("Mã khoản thanh toán không hợp lệ."),
    paid: z.boolean(),
  }).strict(),
]);

export type MemberInput = z.infer<typeof memberInputSchema>;
export type SessionInput = z.infer<typeof sessionInputSchema>;
export type ExpenseInput = z.infer<typeof expenseInputSchema>;
