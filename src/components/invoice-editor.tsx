"use client";

import { Badge, Button, Card, Field, Input, Money, Select, Textarea } from "@/components/ui";
import { useToast } from "@/components/toast";
import {
  collectInvoicePayment,
  createInvoice,
  finalizeInvoice,
  getInvoiceWithLines,
  updateDraftInvoice,
} from "@/lib/invoices";
import { INVOICE_STATUS, PAYMENT_STATUS } from "@/lib/labels";
import { parseMajorToMinor } from "@/lib/money";
import { invoicePdf, shareOrDownload } from "@/lib/pdf";
import { searchPeople } from "@/lib/people";
import { getSettings } from "@/lib/settings";
import type { Invoice, InvoiceLine, Person } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface LineDraft {
  description: string;
  qty: string;
  unitPrice: string;
}

export function InvoiceEditor({ invoiceId }: { invoiceId?: string }) {
  const { push } = useToast();
  const router = useRouter();
  const [people, setPeople] = useState<Person[]>([]);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [customerPersonId, setCustomerPersonId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [discount, setDiscount] = useState("0");
  const [tax, setTax] = useState("0");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([{ description: "", qty: "1", unitPrice: "" }]);
  const [collectAmount, setCollectAmount] = useState("");

  useEffect(() => {
    searchPeople("").then(setPeople);
  }, []);

  useEffect(() => {
    if (!invoiceId) return;
    getInvoiceWithLines(invoiceId).then((data) => {
      if (!data) return;
      setInvoice(data.invoice);
      setCustomerPersonId(data.invoice.customerPersonId ?? "");
      setCustomerName(data.invoice.customerName);
      setCustomerPhone(data.invoice.customerPhone);
      setDate(data.invoice.date);
      setDiscount(String(data.invoice.discountMinor / 100));
      setTax(String(data.invoice.taxMinor / 100));
      setNotes(data.invoice.notes);
      setLines(
        data.lines.map((l: InvoiceLine) => ({
          description: l.description,
          qty: String(l.qtyMilli / 1000),
          unitPrice: String(l.unitPriceMinor / 100),
        })),
      );
    });
  }, [invoiceId]);

  const locked = invoice ? invoice.status !== "draft" : false;

  function parsedLines() {
    return lines.map((l) => ({
      description: l.description,
      qty: Number(l.qty),
      unitPriceMinor: parseMajorToMinor(l.unitPrice || "0"),
    }));
  }

  async function save(asDraft: boolean) {
    try {
      const payload = {
        customerPersonId: customerPersonId || null,
        customerName,
        customerPhone,
        date,
        discountMinor: discount ? parseMajorToMinor(discount === "0" ? "0.00" : discount) : 0,
        taxMinor: tax ? parseMajorToMinor(tax === "0" ? "0.00" : tax) : 0,
        notes,
        lines: parsedLines(),
      };
      if (discount === "0") payload.discountMinor = 0;
      if (tax === "0") payload.taxMinor = 0;
      if (invoice && invoice.status === "draft") {
        const next = await updateDraftInvoice(invoice.id, payload);
        if (!asDraft) await finalizeInvoice(next.id);
        push(asDraft ? "حُفظت المسودة" : "أُصدرت الفاتورة — لم يُسجَّل قبض نقدي");
        router.push("/invoices");
      } else {
        const created = await createInvoice(payload, asDraft);
        push(asDraft ? "مسودة جديدة" : "فاتورة نهائية بدون أثر نقدي");
        router.push(`/invoices/${created.id}`);
      }
    } catch (err) {
      push(err instanceof Error ? err.message : "فشل الحفظ", "err");
    }
  }

  async function exportPdf() {
    if (!invoice) {
      push("احفظ الفاتورة أولاً", "info");
      return;
    }
    const data = await getInvoiceWithLines(invoice.id);
    if (!data) return;
    const settings = await getSettings();
    const blob = await invoicePdf({ invoice: data.invoice, lines: data.lines, settings });
    shareOrDownload(blob, `${data.invoice.number}.pdf`);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-forest-800">{invoice ? invoice.number : "فاتورة جديدة"}</h1>
        {invoice ? (
          <div className="flex gap-2">
            <Badge>{INVOICE_STATUS[invoice.status]}</Badge>
            <Badge tone="amber">{PAYMENT_STATUS[invoice.paymentStatus]}</Badge>
          </div>
        ) : null}
      </div>
      <Card className="grid gap-4 md:grid-cols-2">
        <Field label="عميل محفوظ">
          <Select
            disabled={locked}
            value={customerPersonId}
            onChange={(e) => {
              const id = e.target.value;
              setCustomerPersonId(id);
              const p = people.find((x) => x.id === id);
              if (p) {
                setCustomerName(p.name);
                setCustomerPhone(p.phone);
              }
            }}
          >
            <option value="">بدون ربط</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="اسم العميل">
          <Input disabled={locked} value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
        </Field>
        <Field label="الهاتف">
          <Input disabled={locked} value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
        </Field>
        <Field label="التاريخ">
          <Input disabled={locked} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-bold">البنود</h2>
        {lines.map((line, i) => (
          <div key={i} className="grid gap-2 md:grid-cols-12">
            <div className="md:col-span-6">
              <Input
                disabled={locked}
                placeholder="الوصف"
                value={line.description}
                onChange={(e) => {
                  const next = [...lines];
                  next[i] = { ...line, description: e.target.value };
                  setLines(next);
                }}
              />
            </div>
            <div className="md:col-span-2">
              <Input
                disabled={locked}
                placeholder="كمية"
                value={line.qty}
                onChange={(e) => {
                  const next = [...lines];
                  next[i] = { ...line, qty: e.target.value };
                  setLines(next);
                }}
              />
            </div>
            <div className="md:col-span-3">
              <Input
                disabled={locked}
                placeholder="سعر الوحدة"
                value={line.unitPrice}
                onChange={(e) => {
                  const next = [...lines];
                  next[i] = { ...line, unitPrice: e.target.value };
                  setLines(next);
                }}
              />
            </div>
            <div className="md:col-span-1">
              {!locked ? (
                <Button
                  variant="ghost"
                  onClick={() => setLines(lines.filter((_, j) => j !== i))}
                  disabled={lines.length === 1}
                >
                  حذف
                </Button>
              ) : null}
            </div>
          </div>
        ))}
        {!locked ? (
          <Button variant="secondary" onClick={() => setLines([...lines, { description: "", qty: "1", unitPrice: "" }])}>
            بند إضافي
          </Button>
        ) : null}
      </Card>

      <Card className="grid gap-3 md:grid-cols-2">
        <Field label="خصم">
          <Input disabled={locked} value={discount} onChange={(e) => setDiscount(e.target.value)} />
        </Field>
        <Field label="ضريبة">
          <Input disabled={locked} value={tax} onChange={(e) => setTax(e.target.value)} />
        </Field>
        <Field label="ملاحظات">
          <Textarea disabled={locked} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {invoice ? (
          <div className="space-y-1">
            <p>
              الإجمالي: <Money amount={invoice.grandTotalMinor} />
            </p>
            <p>
              المدفوع: <Money amount={invoice.paidMinor} />
            </p>
            <p>
              المتبقي: <Money amount={invoice.grandTotalMinor - invoice.paidMinor} />
            </p>
          </div>
        ) : null}
      </Card>

      <div className="flex flex-wrap gap-3">
        {!locked ? (
          <>
            <Button variant="secondary" onClick={() => save(true)}>
              حفظ مسودة
            </Button>
            <Button onClick={() => save(false)}>إصدار نهائي</Button>
          </>
        ) : null}
        <Button variant="lime" onClick={exportPdf}>
          PDF / مشاركة
        </Button>
      </div>

      {invoice && invoice.status === "finalized" && invoice.paymentStatus !== "paid" ? (
        <Card className="space-y-3">
          <h2 className="font-bold">تحصيل نقدي منفصل عن الإصدار</h2>
          <Input placeholder="المبلغ المحصّل" value={collectAmount} onChange={(e) => setCollectAmount(e.target.value)} />
          <Button
            onClick={async () => {
              try {
                await collectInvoicePayment({ invoiceId: invoice.id, amountMinor: parseMajorToMinor(collectAmount) });
                push("سُجّل القبض في الدفتر مرة واحدة");
                const data = await getInvoiceWithLines(invoice.id);
                if (data) setInvoice(data.invoice);
                setCollectAmount("");
              } catch (err) {
                push(err instanceof Error ? err.message : "فشل", "err");
              }
            }}
          >
            تسجيل قبض
          </Button>
        </Card>
      ) : null}
    </div>
  );
}
