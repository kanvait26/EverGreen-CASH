"use client";

import { Badge, Button, Card, Empty, Field, Input, Modal, Money, Select, Textarea } from "@/components/ui";
import { useToast } from "@/components/toast";
import { getDb } from "@/db";
import { datetimeLocalValue, formatDateTime, fromDatetimeLocal } from "@/lib/dates";
import { TYPE_LABELS } from "@/lib/labels";
import {
  correctEvent,
  giveAdvance,
  listEvents,
  recordLedgerEvent,
  refundAdvance,
  reverseEvent,
  settleAdvance,
} from "@/lib/ledger";
import { parseMajorToMinor } from "@/lib/money";
import { searchPeople } from "@/lib/people";
import type { Advance, LedgerEvent, LedgerEventType, Person } from "@/lib/types";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

const TYPES: LedgerEventType[] = [
  "income",
  "expense",
  "advance_given",
  "advance_settlement",
  "advance_refund",
  "opening_balance",
  "balance_adjustment",
];

function TransactionsInner() {
  const params = useSearchParams();
  const { push } = useToast();
  const [events, setEvents] = useState<LedgerEvent[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<LedgerEventType>((params.get("type") as LedgerEventType) || "income");
  const [amount, setAmount] = useState("");
  const [personId, setPersonId] = useState("");
  const [advanceId, setAdvanceId] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [occurredAt, setOccurredAt] = useState(datetimeLocalValue());
  const [notes, setNotes] = useState("");
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("");
  const [editing, setEditing] = useState<LedgerEvent | null>(null);
  const [reason, setReason] = useState("");

  const reload = useCallback(async () => {
    setEvents(await listEvents({ search, type: (filterType || undefined) as LedgerEventType | undefined }));
    setPeople(await searchPeople("", false));
    setAdvances(await getDb().advances.toArray());
  }, [search, filterType]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    const t = params.get("type") as LedgerEventType | null;
    if (t) {
      setType(t);
      setOpen(true);
    }
  }, [params]);

  function resetForm() {
    setAmount("");
    setPersonId("");
    setAdvanceId("");
    setDescription("");
    setCategory("");
    setOccurredAt(datetimeLocalValue());
    setNotes("");
    setDirection("in");
    setEditing(null);
    setReason("");
  }

  async function submit() {
    try {
      const amountMinor = parseMajorToMinor(amount);
      const occurred = fromDatetimeLocal(occurredAt);
      if (editing) {
        if (!reason.trim()) throw new Error("سبب التصحيح مطلوب");
        await correctEvent(
          editing.id,
          {
            type,
            amountMinor,
            personId: personId || null,
            description,
            category,
            occurredAt: occurred,
            notes,
            direction: type === "balance_adjustment" ? direction : null,
          },
          reason,
        );
        push("تم إنشاء قيد تصحيح مع أثر التدقيق");
      } else if (type === "advance_given") {
        if (!personId) throw new Error("اختر الشخص");
        await giveAdvance({ personId, amountMinor, description, notes, occurredAt: occurred, category });
        push("تم تسجيل السلفة");
      } else if (type === "advance_settlement") {
        if (!advanceId) throw new Error("اختر السلفة");
        await settleAdvance({ advanceId, amountMinor, description, notes, occurredAt: occurred });
        push("تم تسوية السلفة دون تكرار المصروف النقدي");
      } else if (type === "advance_refund") {
        if (!advanceId) throw new Error("اختر السلفة");
        await refundAdvance({ advanceId, amountMinor, description, notes, occurredAt: occurred });
        push("تم استرداد السلفة إلى الصندوق");
      } else {
        await recordLedgerEvent({
          type,
          amountMinor,
          personId: personId || null,
          description: description || TYPE_LABELS[type],
          category,
          occurredAt: occurred,
          notes,
          direction: type === "balance_adjustment" ? direction : null,
        });
        push("تم حفظ القيد");
      }
      setOpen(false);
      resetForm();
      await reload();
    } catch (err) {
      push(err instanceof Error ? err.message : "فشل الحفظ", "err");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-forest-800">الحركات</h1>
        <Button
          onClick={() => {
            resetForm();
            setOpen(true);
          }}
        >
          حركة جديدة
        </Button>
      </div>
      <div className="flex flex-wrap gap-3">
        <Input placeholder="بحث بالوصف أو الرقم" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="">كل الأنواع</option>
          {TYPES.concat("invoice_payment", "reversal").map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
      </div>
      {events.length === 0 ? (
        <Empty title="لا حركات" hint="دفتر اليومية فارغ" />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-right">
            <thead className="bg-forest-50 text-sm text-forest-700">
              <tr>
                <th className="p-3">المرجع</th>
                <th className="p-3">النوع</th>
                <th className="p-3">الوصف</th>
                <th className="p-3">المبلغ</th>
                <th className="p-3">أثر الصندوق</th>
                <th className="p-3">التاريخ</th>
                <th className="p-3">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-t">
                  <td className="p-3 font-mono text-sm">{e.referenceNumber}</td>
                  <td className="p-3">
                    <Badge>{TYPE_LABELS[e.type]}</Badge>
                  </td>
                  <td className="p-3">{e.description}</td>
                  <td className="p-3">
                    <Money amount={e.amountMinor} currency={e.currency} />
                  </td>
                  <td className="p-3">
                    <Money amount={e.cashDeltaMinor} currency={e.currency} />
                  </td>
                  <td className="p-3 text-sm">{formatDateTime(e.occurredAt)}</td>
                  <td className="p-3">
                    {e.type !== "reversal" ? (
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          className="min-h-10 px-3 text-sm"
                          onClick={() => {
                            setEditing(e);
                            setType(e.type === "invoice_payment" ? "income" : (e.type as LedgerEventType));
                            setAmount(String(e.amountMinor / 100));
                            setPersonId(e.personId ?? "");
                            setAdvanceId(e.advanceId ?? "");
                            setDescription(e.description);
                            setCategory(e.category);
                            setOccurredAt(datetimeLocalValue(e.occurredAt));
                            setNotes(e.notes);
                            setOpen(true);
                          }}
                        >
                          تصحيح
                        </Button>
                        <Button
                          variant="danger"
                          className="min-h-10 px-3 text-sm"
                          onClick={async () => {
                            const r = window.prompt("سبب العكس؟");
                            if (!r) return;
                            try {
                              await reverseEvent(e.id, r);
                              push("تم عكس القيد");
                              await reload();
                            } catch (err) {
                              push(err instanceof Error ? err.message : "فشل", "err");
                            }
                          }}
                        >
                          عكس
                        </Button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Modal
        open={open}
        title={editing ? "تصحيح قيد (عكس + قيد جديد)" : "حركة جديدة"}
        onClose={() => {
          setOpen(false);
          resetForm();
        }}
      >
        <div className="space-y-3">
          <Field label="النوع">
            <Select value={type} onChange={(e) => setType(e.target.value as LedgerEventType)}>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="المبلغ">
            <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
          </Field>
          {(type === "advance_given" || type === "income" || type === "expense") && (
            <Field label="الشخص">
              <Select value={personId} onChange={(e) => setPersonId(e.target.value)}>
                <option value="">—</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {(type === "advance_settlement" || type === "advance_refund") && (
            <Field label="السلفة">
              <Select value={advanceId} onChange={(e) => setAdvanceId(e.target.value)}>
                <option value="">اختر سلفة مفتوحة</option>
                {advances
                  .filter((a) => a.status !== "settled")
                  .map((a) => {
                    const person = people.find((p) => p.id === a.personId);
                    return (
                      <option key={a.id} value={a.id}>
                        {(person?.name ?? a.personId) + " — متبقي " + a.outstandingMinor / 100}
                      </option>
                    );
                  })}
              </Select>
            </Field>
          )}
          {type === "balance_adjustment" && (
            <Field label="الاتجاه">
              <Select value={direction} onChange={(e) => setDirection(e.target.value as "in" | "out")}>
                <option value="in">زيادة الصندوق</option>
                <option value="out">نقص الصندوق</option>
              </Select>
            </Field>
          )}
          <Field label="الوصف">
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <Field label="التصنيف">
            <Input value={category} onChange={(e) => setCategory(e.target.value)} />
          </Field>
          <Field label="التاريخ والوقت">
            <Input type="datetime-local" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} />
          </Field>
          <Field label="ملاحظات">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          {editing ? (
            <Field label="سبب التصحيح">
              <Input value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
          ) : null}
          <Button className="w-full" onClick={submit}>
            حفظ
          </Button>
        </div>
      </Modal>
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={<p>جارٍ التحميل…</p>}>
      <TransactionsInner />
    </Suspense>
  );
}
