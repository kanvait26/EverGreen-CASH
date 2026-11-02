import { getDb } from "@/db";
import { writeAudit } from "@/lib/audit";
import { newId, nowIso } from "@/lib/ids";
import { recordLedgerEvent } from "@/lib/ledger";
import { getSettings, updateSettings } from "@/lib/settings";
import type { Invoice, InvoiceLine, InvoicePaymentStatus } from "@/lib/types";

export interface InvoiceLineInput {
  description: string;
  qty: number;
  unitPriceMinor: number;
}

export interface InvoiceInput {
  customerPersonId?: string | null;
  customerName: string;
  customerPhone?: string;
  date?: string;
  discountMinor?: number;
  taxMinor?: number;
  notes?: string;
  lines: InvoiceLineInput[];
}

function qtyToMilli(qty: number): number {
  if (!Number.isFinite(qty) || qty <= 0) throw new Error("الكمية غير صالحة");
  return Math.round(qty * 1000);
}

function lineTotal(qtyMilli: number, unitPriceMinor: number): number {
  if (!Number.isInteger(unitPriceMinor) || unitPriceMinor < 0) {
    throw new Error("سعر الوحدة غير صالح");
  }
  return Math.round((qtyMilli * unitPriceMinor) / 1000);
}

function totals(lines: { lineTotalMinor: number }[], discountMinor: number, taxMinor: number) {
  const subtotalMinor = lines.reduce((s, l) => s + l.lineTotalMinor, 0);
  if (discountMinor < 0 || taxMinor < 0) throw new Error("الخصم أو الضريبة غير صالح");
  if (discountMinor > subtotalMinor) throw new Error("الخصم أكبر من المجموع");
  const grandTotalMinor = subtotalMinor - discountMinor + taxMinor;
  return { subtotalMinor, grandTotalMinor };
}

function paymentStatus(grandTotalMinor: number, paidMinor: number): InvoicePaymentStatus {
  if (paidMinor <= 0) return "unpaid";
  if (paidMinor >= grandTotalMinor) return "paid";
  return "partial";
}

async function nextInvoiceNumber(): Promise<string> {
  const settings = await getSettings();
  const number = `${settings.invoicePrefix}${String(settings.invoiceNextNumber).padStart(4, "0")}`;
  await updateSettings({ invoiceNextNumber: settings.invoiceNextNumber + 1 });
  return number;
}

function buildLines(invoiceId: string, inputs: InvoiceLineInput[]): InvoiceLine[] {
  if (!inputs.length) throw new Error("أضف بنداً واحداً على الأقل");
  return inputs.map((line, index) => {
    const description = line.description.trim();
    if (!description) throw new Error("وصف البند مطلوب");
    const qtyMilli = qtyToMilli(line.qty);
    const lineTotalMinor = lineTotal(qtyMilli, line.unitPriceMinor);
    return {
      id: newId(),
      invoiceId,
      description,
      qtyMilli,
      unitPriceMinor: line.unitPriceMinor,
      lineTotalMinor,
      sortOrder: index,
    };
  });
}

export async function createInvoice(input: InvoiceInput, asDraft = true): Promise<Invoice> {
  const settings = await getSettings();
  const db = getDb();
  const now = nowIso();
  const id = newId();
  const lines = buildLines(id, input.lines);
  const discountMinor = input.discountMinor ?? 0;
  const taxMinor = input.taxMinor ?? 0;
  const { subtotalMinor, grandTotalMinor } = totals(lines, discountMinor, taxMinor);
  const number = await nextInvoiceNumber();
  const invoice: Invoice = {
    id,
    number,
    status: asDraft ? "draft" : "finalized",
    paymentStatus: "unpaid",
    customerPersonId: input.customerPersonId ?? null,
    customerName: input.customerName.trim(),
    customerPhone: input.customerPhone?.trim() ?? "",
    date: input.date ?? now.slice(0, 10),
    discountMinor,
    taxMinor,
    subtotalMinor,
    grandTotalMinor,
    paidMinor: 0,
    notes: input.notes?.trim() ?? "",
    currency: settings.defaultCurrency,
    revision: 1,
    createdAt: now,
    updatedAt: now,
    finalizedAt: asDraft ? null : now,
    canceledAt: null,
  };
  if (!invoice.customerName) throw new Error("اسم العميل مطلوب");
  await db.transaction("rw", db.invoices, db.invoiceLines, db.invoiceRevisions, db.auditLogs, async () => {
    await db.invoices.add(invoice);
    await db.invoiceLines.bulkAdd(lines);
    await db.invoiceRevisions.add({
      id: newId(),
      invoiceId: id,
      revision: 1,
      snapshotJson: JSON.stringify({ invoice, lines }),
      createdAt: now,
    });
  });
  await writeAudit("invoice", id, asDraft ? "create_draft" : "create_final", { number });
  return invoice;
}

export async function updateDraftInvoice(id: string, input: InvoiceInput): Promise<Invoice> {
  const db = getDb();
  const existing = await db.invoices.get(id);
  if (!existing) throw new Error("الفاتورة غير موجودة");
  if (existing.status !== "draft") throw new Error("يمكن تعديل المسودات فقط");
  const now = nowIso();
  const lines = buildLines(id, input.lines);
  const discountMinor = input.discountMinor ?? 0;
  const taxMinor = input.taxMinor ?? 0;
  const { subtotalMinor, grandTotalMinor } = totals(lines, discountMinor, taxMinor);
  const invoice: Invoice = {
    ...existing,
    customerPersonId: input.customerPersonId ?? null,
    customerName: input.customerName.trim(),
    customerPhone: input.customerPhone?.trim() ?? "",
    date: input.date ?? existing.date,
    discountMinor,
    taxMinor,
    subtotalMinor,
    grandTotalMinor,
    notes: input.notes?.trim() ?? "",
    revision: existing.revision + 1,
    updatedAt: now,
  };
  await db.transaction("rw", db.invoices, db.invoiceLines, db.invoiceRevisions, db.auditLogs, async () => {
    await db.invoices.put(invoice);
    await db.invoiceLines.where("invoiceId").equals(id).delete();
    await db.invoiceLines.bulkAdd(lines);
    await db.invoiceRevisions.add({
      id: newId(),
      invoiceId: id,
      revision: invoice.revision,
      snapshotJson: JSON.stringify({ invoice, lines }),
      createdAt: now,
    });
  });
  await writeAudit("invoice", id, "update_draft", { revision: invoice.revision });
  return invoice;
}

export async function finalizeInvoice(id: string): Promise<Invoice> {
  const db = getDb();
  const invoice = await db.invoices.get(id);
  if (!invoice) throw new Error("الفاتورة غير موجودة");
  if (invoice.status !== "draft") throw new Error("الفاتورة ليست مسودة");
  const now = nowIso();
  const next: Invoice = { ...invoice, status: "finalized", finalizedAt: now, updatedAt: now };
  await db.invoices.put(next);
  const lines = await db.invoiceLines.where("invoiceId").equals(id).toArray();
  await db.invoiceRevisions.add({
    id: newId(),
    invoiceId: id,
    revision: next.revision,
    snapshotJson: JSON.stringify({ invoice: next, lines }),
    createdAt: now,
  });
  await writeAudit("invoice", id, "finalize", { number: invoice.number });
  return next;
}

export async function cancelInvoice(id: string, reason: string): Promise<Invoice> {
  const db = getDb();
  const invoice = await db.invoices.get(id);
  if (!invoice) throw new Error("الفاتورة غير موجودة");
  if (invoice.status === "canceled") throw new Error("الفاتورة ملغاة مسبقاً");
  const now = nowIso();
  const next: Invoice = { ...invoice, status: "canceled", canceledAt: now, updatedAt: now, notes: `${invoice.notes}\nإلغاء: ${reason}`.trim() };
  await db.invoices.put(next);
  await writeAudit("invoice", id, "cancel", { reason });
  return next;
}

export async function duplicateInvoice(id: string): Promise<Invoice> {
  const db = getDb();
  const invoice = await db.invoices.get(id);
  if (!invoice) throw new Error("الفاتورة غير موجودة");
  const lines = await db.invoiceLines.where("invoiceId").equals(id).sortBy("sortOrder");
  return createInvoice({
    customerPersonId: invoice.customerPersonId,
    customerName: invoice.customerName,
    customerPhone: invoice.customerPhone,
    discountMinor: invoice.discountMinor,
    taxMinor: invoice.taxMinor,
    notes: invoice.notes,
    lines: lines.map((l) => ({
      description: l.description,
      qty: l.qtyMilli / 1000,
      unitPriceMinor: l.unitPriceMinor,
    })),
  }, true);
}

export async function collectInvoicePayment(input: {
  invoiceId: string;
  amountMinor: number;
  occurredAt?: string;
  notes?: string;
}) {
  const db = getDb();
  const invoice = await db.invoices.get(input.invoiceId);
  if (!invoice) throw new Error("الفاتورة غير موجودة");
  if (invoice.status !== "finalized") throw new Error("تحصيل النقدية للفواتير النهائية فقط");
  const remaining = invoice.grandTotalMinor - invoice.paidMinor;
  if (input.amountMinor > remaining) throw new Error("المبلغ أكبر من المتبقي على الفاتورة");
  const event = await recordLedgerEvent({
    type: "invoice_payment",
    amountMinor: input.amountMinor,
    personId: invoice.customerPersonId,
    description: `تحصيل فاتورة ${invoice.number}`,
    invoiceId: invoice.id,
    occurredAt: input.occurredAt,
    notes: input.notes,
    category: "تحصيل فاتورة",
  });
  const paidMinor = invoice.paidMinor + input.amountMinor;
  const next: Invoice = {
    ...invoice,
    paidMinor,
    paymentStatus: paymentStatus(invoice.grandTotalMinor, paidMinor),
    updatedAt: nowIso(),
  };
  await db.invoices.put(next);
  await writeAudit("invoice", invoice.id, "collect", { amount: input.amountMinor, eventId: event.id });
  return { invoice: next, event };
}

export async function getInvoiceWithLines(id: string) {
  const db = getDb();
  const invoice = await db.invoices.get(id);
  if (!invoice) return null;
  const lines = await db.invoiceLines.where("invoiceId").equals(id).sortBy("sortOrder");
  const revisions = await db.invoiceRevisions.where("invoiceId").equals(id).sortBy("revision");
  return { invoice, lines, revisions };
}

export async function searchInvoices(opts?: {
  status?: Invoice["status"];
  paymentStatus?: InvoicePaymentStatus;
  search?: string;
  fromDate?: string;
  toDate?: string;
}) {
  const db = getDb();
  let invoices = await db.invoices.orderBy("createdAt").reverse().toArray();
  if (opts?.status) invoices = invoices.filter((i) => i.status === opts.status);
  if (opts?.paymentStatus) invoices = invoices.filter((i) => i.paymentStatus === opts.paymentStatus);
  if (opts?.fromDate) invoices = invoices.filter((i) => i.date >= opts.fromDate!);
  if (opts?.toDate) invoices = invoices.filter((i) => i.date <= opts.toDate!);
  if (opts?.search) {
    const q = opts.search.trim();
    invoices = invoices.filter(
      (i) => i.number.includes(q) || i.customerName.includes(q) || i.customerPhone.includes(q),
    );
  }
  return invoices;
}
