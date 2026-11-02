"use client";

import { Button, Card, Empty, Input, Money, Select } from "@/components/ui";
import { useToast } from "@/components/toast";
import { periodRange, type PeriodKey } from "@/lib/dates";
import { TYPE_LABELS } from "@/lib/labels";
import { getTotals, listEvents } from "@/lib/ledger";
import { eventsToCsv, reportPdf, shareOrDownload, downloadBlob } from "@/lib/pdf";
import { searchInvoices } from "@/lib/invoices";
import { listReconciliations } from "@/lib/reconciliation";
import { getSettings } from "@/lib/settings";
import { searchPeople } from "@/lib/people";
import { getDb } from "@/db";
import { formatMinor } from "@/lib/money";
import type { LedgerEvent } from "@/lib/types";
import { useCallback, useEffect, useState } from "react";

export default function ReportsPage() {
  const { push } = useToast();
  const [period, setPeriod] = useState<PeriodKey>("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [kind, setKind] = useState("all");
  const [search, setSearch] = useState("");
  const [events, setEvents] = useState<LedgerEvent[]>([]);
  const [received, setReceived] = useState(0);
  const [paid, setPaid] = useState(0);
  const [cash, setCash] = useState(0);
  const [peopleCount, setPeopleCount] = useState(0);
  const [invoiceCount, setInvoiceCount] = useState(0);
  const [recCount, setRecCount] = useState(0);

  const load = useCallback(async () => {
    const range = periodRange(period, from, to);
    const type = kind === "income" || kind === "expense" ? kind : undefined;
    const list = await listEvents({ fromIso: range.fromIso, toIso: range.toIso, type, search });
    setEvents(list);
    const t = await getTotals(range.fromIso, range.toIso);
    setReceived(t.received);
    setPaid(t.paid);
    setCash(t.cashBalance);
    setPeopleCount((await searchPeople("", true)).length);
    setInvoiceCount((await searchInvoices({})).length);
    setRecCount((await listReconciliations()).length);
    await getDb().advances.count();
  }, [period, from, to, kind, search]);

  useEffect(() => {
    load();
  }, [load]);

  async function exportPdf() {
    const settings = await getSettings();
    const rows = [
      [`مقبوضات ${formatMinor(received)}`, `مدفوعات ${formatMinor(paid)}`, `رصيد ${formatMinor(cash)}`],
      ...events.map((e) => [e.occurredAt.slice(0, 16), TYPE_LABELS[e.type], e.description, formatMinor(e.amountMinor, e.currency)]),
    ];
    const blob = await reportPdf("تقرير EverGreen CASH", rows, settings);
    shareOrDownload(blob, "evergreen-report.pdf");
  }

  function exportCsv() {
    const csv = eventsToCsv(events);
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), "evergreen-report.csv");
    push("تم تنزيل CSV");
  }

  return (
    <div className="space-y-5 print:p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <h1 className="text-3xl font-bold text-forest-800">التقارير</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={exportCsv}>CSV</Button>
          <Button onClick={exportPdf}>PDF</Button>
          <Button variant="lime" onClick={() => window.print()}>طباعة</Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-3 print:hidden">
        {(["today", "week", "month", "custom"] as PeriodKey[]).map((k) => (
          <Button key={k} variant={period === k ? "primary" : "secondary"} onClick={() => setPeriod(k)}>
            {k === "today" ? "يومي" : k === "week" ? "أسبوعي" : k === "month" ? "شهري" : "مخصص"}
          </Button>
        ))}
        <Select value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="all">الكل</option>
          <option value="income">إيراد</option>
          <option value="expense">مصروف</option>
        </Select>
        <Input placeholder="بحث" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {period === "custom" ? (
        <div className="flex gap-3 print:hidden">
          <input type="date" className="min-h-14 rounded-2xl border px-4" value={from} onChange={(e) => setFrom(e.target.value)} />
          <input type="date" className="min-h-14 rounded-2xl border px-4" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>مقبوضات <Money amount={received} className="block text-2xl" /></Card>
        <Card>مدفوعات <Money amount={paid} className="block text-2xl" /></Card>
        <Card>رصيد <Money amount={cash} className="block text-2xl" /></Card>
      </div>
      <p className="text-sm text-forest-600">
        أشخاص {peopleCount} · فواتير {invoiceCount} · جرد {recCount}
      </p>
      {events.length === 0 ? <Empty title="لا نتائج" /> : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-right">
            <thead className="bg-forest-50">
              <tr>
                <th className="p-3">التاريخ</th>
                <th className="p-3">النوع</th>
                <th className="p-3">الوصف</th>
                <th className="p-3">المبلغ</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-t">
                  <td className="p-3">{e.occurredAt.slice(0, 16)}</td>
                  <td className="p-3">{TYPE_LABELS[e.type]}</td>
                  <td className="p-3">{e.description}</td>
                  <td className="p-3"><Money amount={e.amountMinor} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
