"use client";

import { Badge, Button, Card, Empty, Money } from "@/components/ui";
import { useToast } from "@/components/toast";
import { getDb } from "@/db";
import { periodRange, type PeriodKey, formatDateTime } from "@/lib/dates";
import { TYPE_LABELS } from "@/lib/labels";
import { getOutstandingAdvances, getTotals, listEvents } from "@/lib/ledger";
import { getSettings } from "@/lib/settings";
import type { Invoice, LedgerEvent, Settings } from "@/lib/types";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function DashboardPage() {
  const { push } = useToast();
  const [period, setPeriod] = useState<PeriodKey>("today");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [cash, setCash] = useState(0);
  const [received, setReceived] = useState(0);
  const [paid, setPaid] = useState(0);
  const [advances, setAdvances] = useState(0);
  const [events, setEvents] = useState<LedgerEvent[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [chart, setChart] = useState<{ name: string; in: number; out: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const range = periodRange(period, from, to);
      const totals = await getTotals(range.fromIso, range.toIso);
      const allEvents = await listEvents({ fromIso: range.fromIso, toIso: range.toIso });
      const db = getDb();
      const recentInvoices = await db.invoices.orderBy("createdAt").reverse().limit(5).toArray();
      const s = await getSettings();
      const outstanding = await getOutstandingAdvances();
      setCash(totals.cashBalance);
      setReceived(totals.received);
      setPaid(totals.paid);
      setAdvances(outstanding);
      setEvents(allEvents.slice(0, 8));
      setInvoices(recentInvoices);
      setSettings(s);
      const byDay = new Map<string, { in: number; out: number }>();
      for (const e of allEvents) {
        const day = e.occurredAt.slice(5, 10);
        const cur = byDay.get(day) ?? { in: 0, out: 0 };
        if (e.cashDeltaMinor > 0) cur.in += e.cashDeltaMinor / 100;
        if (e.cashDeltaMinor < 0) cur.out += Math.abs(e.cashDeltaMinor) / 100;
        byDay.set(day, cur);
      }
      setChart([...byDay.entries()].slice(-14).map(([name, v]) => ({ name, ...v })));
    } catch (err) {
      push(err instanceof Error ? err.message : "تعذر التحميل", "err");
    } finally {
      setLoading(false);
    }
  }, [period, from, to, push]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-forest-800">لوحة التحكم</h1>
          <p className="text-forest-600">ملخص الصندوق من السجلات الحقيقية</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["today", "week", "month", "custom"] as PeriodKey[]).map((k) => (
            <Button key={k} variant={period === k ? "primary" : "secondary"} onClick={() => setPeriod(k)}>
              {k === "today" ? "اليوم" : k === "week" ? "الأسبوع" : k === "month" ? "الشهر" : "مخصص"}
            </Button>
          ))}
        </div>
      </div>

      {period === "custom" ? (
        <div className="flex flex-wrap gap-3">
          <input type="date" className="min-h-14 rounded-2xl border px-4" value={from} onChange={(e) => setFrom(e.target.value)} />
          <input type="date" className="min-h-14 rounded-2xl border px-4" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      ) : null}

      {!settings?.lastBackupVerified ? (
        <div className="rounded-3xl bg-amber-100 p-4 text-amber-950 ring-1 ring-amber-300">
          البيانات غير محمية بنسخة احتياطية موثّقة. اذهب إلى النسخ الاحتياطي لتشفير ورفع الصندوق.
        </div>
      ) : (
        <p className="text-sm text-forest-600">آخر نسخة ناجحة: {formatDateTime(settings.lastBackupAt ?? "")}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <p className="text-sm text-forest-600">رصيد الصندوق</p>
          <Money amount={cash} className="mt-2 block text-3xl" />
        </Card>
        <Card>
          <p className="text-sm text-forest-600">إجمالي المقبوضات (الفترة)</p>
          <Money amount={received} className="mt-2 block text-3xl" />
        </Card>
        <Card>
          <p className="text-sm text-forest-600">إجمالي المدفوعات (الفترة)</p>
          <Money amount={paid} className="mt-2 block text-3xl" />
        </Card>
        <Card>
          <p className="text-sm text-forest-600">سلف قائمة</p>
          <Money amount={advances} className="mt-2 block text-3xl" />
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/transactions?type=income"><Button className="w-full" variant="lime">إيراد</Button></Link>
        <Link href="/transactions?type=expense"><Button className="w-full">مصروف</Button></Link>
        <Link href="/transactions?type=advance_given"><Button className="w-full" variant="secondary">سلفة</Button></Link>
        <Link href="/invoices/new"><Button className="w-full" variant="secondary">فاتورة</Button></Link>
      </div>

      <Card>
        <h2 className="mb-4 text-xl font-bold">التدفق النقدي</h2>
        {chart.length === 0 ? (
          <Empty title="لا بيانات لهذه الفترة" />
        ) : (
          <div className="h-64" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="in" fill="#1b4d3e" name="داخل" />
                <Bar dataKey="out" fill="#8bc34a" name="خارج" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-xl font-bold">آخر الحركات</h2>
          {loading ? <p>جارٍ التحميل…</p> : events.length === 0 ? <Empty title="لا حركات بعد" hint="سجّل إيراداً أو مصروفاً للبدء" /> : (
            <ul className="divide-y">
              {events.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-semibold">{e.description}</p>
                    <p className="text-sm text-forest-600">{TYPE_LABELS[e.type]} · {e.referenceNumber}</p>
                  </div>
                  <Money amount={e.cashDeltaMinor} />
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="mb-3 text-xl font-bold">آخر الفواتير</h2>
          {invoices.length === 0 ? <Empty title="لا فواتير" /> : (
            <ul className="divide-y">
              {invoices.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-semibold">{inv.number} — {inv.customerName}</p>
                    <Badge tone={inv.status === "canceled" ? "red" : inv.status === "draft" ? "amber" : "forest"}>{inv.status}</Badge>
                  </div>
                  <Money amount={inv.grandTotalMinor} currency={inv.currency} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
