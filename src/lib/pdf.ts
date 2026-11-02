import { jsPDF } from "jspdf";
import type { Invoice, InvoiceLine, LedgerEvent, Person, Settings } from "@/lib/types";
import { formatMinor, minorToMajorNumber } from "@/lib/money";

function reshapeArabic(text: string): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const arabicReshaper = require("arabic-reshaper") as {
      convertArabic?: (s: string) => string;
      default?: (s: string) => string;
    };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const bidiMod = require("bidi-js") as { default?: () => { getReorderedString: (s: string) => string } };
    const convert = arabicReshaper.convertArabic ?? arabicReshaper.default;
    const factory = bidiMod.default ?? (bidiMod as unknown as () => { getReorderedString: (s: string) => string });
    const engine = typeof factory === "function" ? factory() : factory;
    const reshaped = convert ? convert(text) : text;
    return engine.getReorderedString ? engine.getReorderedString(reshaped) : reshaped;
  } catch {
    return text;
  }
}

async function loadFontBytes(url: string): Promise<string> {
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

async function withArabicFont(doc: jsPDF) {
  const regular = await loadFontBytes("/fonts/Cairo-Regular.ttf");
  doc.addFileToVFS("Cairo-Regular.ttf", regular);
  doc.addFont("Cairo-Regular.ttf", "Cairo", "normal");
  doc.setFont("Cairo", "normal");
}

function ar(text: string): string {
  return reshapeArabic(text);
}

export async function invoicePdf(opts: {
  invoice: Invoice;
  lines: InvoiceLine[];
  settings: Settings;
}): Promise<Blob> {
  const { invoice, lines, settings } = opts;
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  await withArabicFont(doc);
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  const right = pageW - margin;

  doc.setFillColor(27, 77, 62);
  doc.rect(0, 0, pageW, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text(ar(settings.companyNameAr || settings.companyName), right, 12, { align: "right" });
  doc.setFontSize(10);
  doc.text(ar("فاتورة"), right, 22, { align: "right" });

  try {
    if (settings.logoDataUrl && settings.logoDataUrl.startsWith("data:")) {
      doc.addImage(settings.logoDataUrl, "JPEG", margin, 4, 20, 20);
    }
  } catch {
    /* logo optional */
  }

  doc.setTextColor(20, 20, 20);
  doc.setFontSize(11);
  let y = 40;
  const row = (label: string, value: string) => {
    doc.text(ar(label), right, y, { align: "right" });
    doc.text(ar(value), right - 50, y, { align: "right" });
    y += 7;
  };
  row("رقم الفاتورة", invoice.number);
  row("التاريخ", invoice.date);
  row("العميل", invoice.customerName);
  if (invoice.customerPhone) row("الهاتف", invoice.customerPhone);
  row("الحالة", invoice.status === "draft" ? "مسودة" : invoice.status === "finalized" ? "نهائية" : "ملغاة");
  row("الدفع", invoice.paymentStatus === "paid" ? "مدفوعة" : invoice.paymentStatus === "partial" ? "جزئية" : "غير مدفوعة");

  y += 4;
  doc.setFillColor(139, 195, 74);
  doc.rect(margin, y, pageW - margin * 2, 8, "F");
  doc.setTextColor(20, 40, 20);
  doc.setFontSize(10);
  doc.text(ar("الوصف"), right, y + 5.5, { align: "right" });
  doc.text(ar("الكمية"), right - 80, y + 5.5, { align: "right" });
  doc.text(ar("السعر"), right - 110, y + 5.5, { align: "right" });
  doc.text(ar("المجموع"), margin + 28, y + 5.5, { align: "right" });
  y += 12;
  doc.setTextColor(20, 20, 20);
  for (const line of lines) {
    if (y > 260) {
      doc.addPage();
      y = 20;
      await withArabicFont(doc);
    }
    const qty = (line.qtyMilli / 1000).toFixed(2);
    doc.text(ar(line.description), right, y, { align: "right" });
    doc.text(qty, right - 80, y, { align: "right" });
    doc.text(formatMinor(line.unitPriceMinor, invoice.currency), right - 110, y, { align: "right" });
    doc.text(formatMinor(line.lineTotalMinor, invoice.currency), margin + 28, y, { align: "right" });
    y += 7;
  }
  y += 6;
  const moneyRow = (label: string, amount: number) => {
    doc.text(ar(label), right, y, { align: "right" });
    doc.text(formatMinor(amount, invoice.currency), margin + 40, y, { align: "right" });
    y += 7;
  };
  moneyRow("المجموع الفرعي", invoice.subtotalMinor);
  moneyRow("الخصم", invoice.discountMinor);
  moneyRow("الضريبة", invoice.taxMinor);
  doc.setFontSize(13);
  moneyRow("الإجمالي", invoice.grandTotalMinor);
  doc.setFontSize(11);
  moneyRow("المدفوع", invoice.paidMinor);
  moneyRow("المتبقي", invoice.grandTotalMinor - invoice.paidMinor);

  if (invoice.notes) {
    y += 4;
    doc.text(ar("ملاحظات: " + invoice.notes), right, y, { align: "right", maxWidth: pageW - margin * 2 });
  }
  y = 280;
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(ar(settings.invoiceFooter || "شكراً لتعاملكم معنا"), pageW / 2, y, { align: "center" });
  if (settings.phone || settings.address) {
    doc.text(ar([settings.phone, settings.address].filter(Boolean).join(" — ")), pageW / 2, y + 6, {
      align: "center",
    });
  }
  return doc.output("blob");
}

export async function statementPdf(opts: {
  person: Person;
  events: LedgerEvent[];
  settings: Settings;
  outstandingMinor: number;
}): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  await withArabicFont(doc);
  const pageW = doc.internal.pageSize.getWidth();
  const right = pageW - 14;
  doc.setFillColor(27, 77, 62);
  doc.rect(0, 0, pageW, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text(ar(`كشف حساب — ${opts.person.name}`), right, 14, { align: "right" });
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(11);
  let y = 34;
  doc.text(ar(`السلف القائمة: ${formatMinor(opts.outstandingMinor, opts.settings.defaultCurrency)}`), right, y, {
    align: "right",
  });
  y += 10;
  for (const e of opts.events) {
    if (y > 270) {
      doc.addPage();
      y = 20;
      await withArabicFont(doc);
    }
    doc.text(ar(`${e.occurredAt.slice(0, 10)}  ${e.referenceNumber}`), right, y, { align: "right" });
    y += 6;
    doc.text(ar(`${e.description} — ${formatMinor(e.amountMinor, e.currency)}`), right, y, { align: "right" });
    y += 8;
  }
  return doc.output("blob");
}

export async function reportPdf(title: string, rows: string[][], settings: Settings): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  await withArabicFont(doc);
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFillColor(27, 77, 62);
  doc.rect(0, 0, pageW, 20, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text(ar(title), pageW - 14, 13, { align: "right" });
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(10);
  let y = 30;
  for (const row of rows) {
    if (y > 280) {
      doc.addPage();
      y = 20;
      await withArabicFont(doc);
    }
    doc.text(ar(row.join("  |  ")), pageW - 14, y, { align: "right", maxWidth: pageW - 28 });
    y += 7;
  }
  doc.setFontSize(8);
  doc.text(ar(settings.companyNameAr), pageW / 2, 290, { align: "center" });
  return doc.output("blob");
}

export function shareOrDownload(blob: Blob, fileName: string) {
  const file = new File([blob], fileName, { type: blob.type || "application/pdf" });
  const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void>; canShare?: (d: ShareData) => boolean };
  if (nav.share && (!nav.canShare || nav.canShare({ files: [file] }))) {
    nav.share({ files: [file], title: fileName }).catch(() => downloadBlob(blob, fileName));
    return;
  }
  downloadBlob(blob, fileName);
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export function eventsToCsv(events: LedgerEvent[]): string {
  const header = [
    "reference",
    "type",
    "amount_major",
    "cash_delta_major",
    "personId",
    "description",
    "category",
    "occurredAt",
    "notes",
  ];
  const lines = events.map((e) =>
    [
      e.referenceNumber,
      e.type,
      minorToMajorNumber(e.amountMinor).toFixed(2),
      minorToMajorNumber(e.cashDeltaMinor).toFixed(2),
      e.personId ?? "",
      `"${e.description.replace(/"/g, '""')}"`,
      e.category,
      e.occurredAt,
      `"${e.notes.replace(/"/g, '""')}"`,
    ].join(","),
  );
  return [header.join(","), ...lines].join("\n");
}
