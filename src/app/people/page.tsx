"use client";

import { Badge, Button, Card, Empty, Field, Input, Modal, Money, Textarea } from "@/components/ui";
import { useToast } from "@/components/toast";
import { getPersonFinancials } from "@/lib/ledger";
import { TYPE_LABELS } from "@/lib/labels";
import { archivePerson, createPerson, deletePerson, restorePerson, searchPeople, updatePerson } from "@/lib/people";
import { getSettings } from "@/lib/settings";
import { shareOrDownload, statementPdf } from "@/lib/pdf";
import type { Person } from "@/lib/types";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

export default function PeoplePage() {
  const { push } = useToast();
  const [people, setPeople] = useState<Person[]>([]);
  const [q, setQ] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Person | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [detail, setDetail] = useState<Person | null>(null);
  const [fin, setFin] = useState<Awaited<ReturnType<typeof getPersonFinancials>> | null>(null);

  const reload = useCallback(async () => {
    setPeople(await searchPeople(q, showArchived));
  }, [q, showArchived]);

  useEffect(() => {
    reload();
  }, [reload]);

  function reset() {
    setEditing(null);
    setName("");
    setPhone("");
    setAddress("");
    setNotes("");
  }

  async function save() {
    try {
      if (editing) await updatePerson(editing.id, { name, phone, address, notes });
      else await createPerson({ name, phone, address, notes });
      push("تم حفظ الشخص");
      setOpen(false);
      reset();
      await reload();
    } catch (err) {
      push(err instanceof Error ? err.message : "فشل", "err");
    }
  }

  async function openDetail(p: Person) {
    setDetail(p);
    setFin(await getPersonFinancials(p.id));
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-forest-800">الأشخاص</h1>
        <Button
          onClick={() => {
            reset();
            setOpen(true);
          }}
        >
          شخص جديد
        </Button>
      </div>
      <div className="flex flex-wrap gap-3">
        <Input placeholder="بحث بالاسم أو الهاتف" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button variant="secondary" onClick={() => setShowArchived((v) => !v)}>
          {showArchived ? "إخفاء المؤرشف" : "إظهار المؤرشف"}
        </Button>
      </div>
      {people.length === 0 ? (
        <Empty title="لا أشخاص" hint="أضف عملاء أو موظفين أو موردين" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {people.map((p) => (
            <Card key={p.id} className="flex items-start justify-between gap-3">
              <button className="text-right" onClick={() => openDetail(p)}>
                <p className="text-lg font-bold">{p.name}</p>
                <p className="text-sm text-forest-600">{p.phone || "بدون هاتف"}</p>
                {p.archived ? <Badge tone="amber">مؤرشف</Badge> : null}
              </button>
              <div className="flex flex-col gap-2">
                <Button
                  variant="secondary"
                  className="min-h-10 px-3 text-sm"
                  onClick={() => {
                    setEditing(p);
                    setName(p.name);
                    setPhone(p.phone);
                    setAddress(p.address);
                    setNotes(p.notes);
                    setOpen(true);
                  }}
                >
                  تعديل
                </Button>
                {p.archived ? (
                  <Button
                    variant="lime"
                    className="min-h-10 px-3 text-sm"
                    onClick={async () => {
                      await restorePerson(p.id);
                      await reload();
                    }}
                  >
                    استعادة
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    className="min-h-10 px-3 text-sm"
                    onClick={async () => {
                      await archivePerson(p.id);
                      push("تمت الأرشفة");
                      await reload();
                    }}
                  >
                    أرشفة
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} title={editing ? "تعديل شخص" : "شخص جديد"} onClose={() => setOpen(false)}>
        <div className="space-y-3">
          <Field label="الاسم">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="الهاتف">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label="العنوان">
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </Field>
          <Field label="ملاحظات">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          <Button className="w-full" onClick={save}>
            حفظ
          </Button>
        </div>
      </Modal>

      <Modal open={Boolean(detail)} title={detail?.name ?? ""} onClose={() => setDetail(null)}>
        {detail && fin ? (
          <div className="space-y-4">
            <p>{detail.phone}</p>
            <p>{detail.address}</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xs">مقبوض</p>
                <Money amount={fin.received} />
              </div>
              <div>
                <p className="text-xs">مدفوع</p>
                <Money amount={fin.paid} />
              </div>
              <div>
                <p className="text-xs">سلف</p>
                <Money amount={fin.outstandingAdvances} />
              </div>
            </div>
            <ul className="max-h-48 space-y-2 overflow-auto text-sm">
              {fin.events.map((e) => (
                <li key={e.id} className="flex justify-between">
                  <span>
                    {TYPE_LABELS[e.type]} — {e.description}
                  </span>
                  <Money amount={e.amountMinor} />
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={async () => {
                  const settings = await getSettings();
                  const blob = await statementPdf({
                    person: detail,
                    events: fin.events,
                    settings,
                    outstandingMinor: fin.outstandingAdvances,
                  });
                  shareOrDownload(blob, `statement-${detail.name}.pdf`);
                }}
              >
                تصدير PDF
              </Button>
              <Link href={`/transactions?type=advance_given`}>
                <Button variant="lime">سلفة</Button>
              </Link>
              <Button
                variant="danger"
                onClick={async () => {
                  try {
                    await deletePerson(detail.id);
                    push("تم الحذف");
                    setDetail(null);
                    await reload();
                  } catch (err) {
                    push(err instanceof Error ? err.message : "لا يمكن الحذف", "err");
                  }
                }}
              >
                حذف إن لم توجد سجلات
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
