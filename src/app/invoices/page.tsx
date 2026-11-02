"use client";

import { Badge, Button, Card, Empty, Input, Money, Select } from "@/components/ui";
import { useToast } from "@/components/toast";
import { INVOICE_STATUS, PAYMENT_STATUS } from "@/lib/labels";
import { cancelInvoice, duplicateInvoice, searchInvoices } from "@/lib/invoices";
import type { Invoice } from "@/lib/types";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

export default function InvoicesPage() {
  const { push } = useToast();
  const [rows, setRows] = useState<Invoice[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [pay, setPay] = useState("");

  const reload = useCallback(async () => {
    setRows(
      await searchInvoices({
        search,
        status: (status || undefined) as Invoice["status"] | undefined,
        paymentStatus: (pay || undefined) as Invoice["paymentStatus"] | undefined,
      }),
    );
  }, [search, status, pay]);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-forest-800">الفواتير</h1>
        <Link href="/invoices/new">
          <Button>فاتورة جديدة</Button>
        </Link>
      </div>
      <div className="flex flex-wrap gap-3">
        <Input placeholder="رقم أو عميل أو هاتف" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">كل الحالات</option>
          <option value="draft">مسودة</option>
          <option value="finalized">نهائية</option>
          <option value="canceled">ملغاة</option>
        </Select>
        <Select value={pay} onChange={(e) => setPay(e.target.value)}>
          <option value="">كل الدفع</option>
          <option value="unpaid">غير مدفوعة</option>
          <option value="partial">جزئية</option>
          <option value="paid">مدفوعة</option>
        </Select>
      </div>
      {rows.length === 0 ? (
        <Empty title="لا فواتير" />
      ) : (
        <div className="space-y-3">
          {rows.map((inv) => (
            <Card key={inv.id} className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Link href={`/invoices/${inv.id}`} className="text-lg font-bold text-forest-800">
                  {inv.number} — {inv.customerName}
                </Link>
                <div className="mt-1 flex flex-wrap gap-2">
                  <Badge tone={inv.status === "canceled" ? "red" : inv.status === "draft" ? "amber" : "forest"}>
                    {INVOICE_STATUS[inv.status]}
                  </Badge>
                  <Badge tone={inv.paymentStatus === "paid" ? "lime" : "amber"}>{PAYMENT_STATUS[inv.paymentStatus]}</Badge>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Money amount={inv.grandTotalMinor} currency={inv.currency} className="text-xl" />
                <Button
                  variant="secondary"
                  className="min-h-10 text-sm"
                  onClick={async () => {
                    await duplicateInvoice(inv.id);
                    push("تم نسخ المسودة");
                    await reload();
                  }}
                >
                  نسخ
                </Button>
                {inv.status !== "canceled" ? (
                  <Button
                    variant="danger"
                    className="min-h-10 text-sm"
                    onClick={async () => {
                      const r = window.prompt("سبب الإلغاء؟");
                      if (!r) return;
                      try {
                        await cancelInvoice(inv.id, r);
                        push("أُلغيت الفاتورة وبقيت للتدقيق");
                        await reload();
                      } catch (err) {
                        push(err instanceof Error ? err.message : "فشل", "err");
                      }
                    }}
                  >
                    إلغاء
                  </Button>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
