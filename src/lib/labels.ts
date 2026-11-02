import type { InvoicePaymentStatus, InvoiceStatus, LedgerEventType } from "@/lib/types";

export const TYPE_LABELS: Record<LedgerEventType, string> = {
  income: "إيراد",
  expense: "مصروف",
  advance_given: "سلفة",
  advance_settlement: "تسوية سلفة",
  advance_refund: "استرداد سلفة",
  opening_balance: "رصيد افتتاحي",
  balance_adjustment: "تسوية رصيد",
  invoice_payment: "تحصيل فاتورة",
  reversal: "عكس قيد",
};

export const INVOICE_STATUS: Record<InvoiceStatus, string> = {
  draft: "مسودة",
  finalized: "نهائية",
  canceled: "ملغاة",
};

export const PAYMENT_STATUS: Record<InvoicePaymentStatus, string> = {
  unpaid: "غير مدفوعة",
  partial: "جزئية",
  paid: "مدفوعة",
};

export const NAV = [
  { href: "/", label: "لوحة التحكم", icon: "home" },
  { href: "/transactions", label: "الحركات", icon: "list" },
  { href: "/people", label: "الأشخاص", icon: "users" },
  { href: "/invoices", label: "الفواتير", icon: "file" },
  { href: "/reconciliation", label: "الجرد", icon: "scale" },
  { href: "/reports", label: "التقارير", icon: "chart" },
  { href: "/backup", label: "النسخ الاحتياطي", icon: "cloud" },
  { href: "/settings", label: "الإعدادات", icon: "gear" },
];
