import { z } from "zod";

export const moneyString = z
  .string()
  .min(1, "أدخل مبلغاً")
  .refine((v) => {
    const n = Number(v.replace(/,/g, ""));
    return Number.isFinite(n) && n > 0;
  }, "المبلغ يجب أن يكون أكبر من صفر");

export const transactionFormSchema = z.object({
  type: z.enum([
    "income",
    "expense",
    "advance_given",
    "advance_settlement",
    "advance_refund",
    "opening_balance",
    "balance_adjustment",
  ]),
  amount: moneyString,
  personId: z.string().optional(),
  advanceId: z.string().optional(),
  description: z.string().min(1, "الوصف مطلوب"),
  category: z.string().optional(),
  occurredAt: z.string().min(1, "التاريخ مطلوب"),
  notes: z.string().optional(),
  direction: z.enum(["in", "out"]).optional(),
});

export const personFormSchema = z.object({
  name: z.string().min(1, "الاسم مطلوب"),
  phone: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

export const invoiceLineSchema = z.object({
  description: z.string().min(1, "وصف البند مطلوب"),
  qty: z.coerce.number().positive("الكمية أكبر من صفر"),
  unitPrice: moneyString,
});

export const invoiceFormSchema = z.object({
  customerPersonId: z.string().optional(),
  customerName: z.string().min(1, "اسم العميل مطلوب"),
  customerPhone: z.string().optional(),
  date: z.string().min(1),
  discount: z.string().optional(),
  tax: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(invoiceLineSchema).min(1, "أضف بنداً"),
});

export const pinSchema = z.object({
  pin: z.string().regex(/^\d{4,8}$/, "PIN من 4 إلى 8 أرقام"),
});

export const passphraseSchema = z.object({
  passphrase: z.string().min(8, "٨ أحرف على الأقل"),
  confirm: z.string().optional(),
});

export type TransactionForm = z.infer<typeof transactionFormSchema>;
export type PersonForm = z.infer<typeof personFormSchema>;
export type InvoiceForm = z.infer<typeof invoiceFormSchema>;
