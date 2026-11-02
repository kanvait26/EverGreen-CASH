"use client";

import { Button, Card, Empty, Field, Input, Money, Textarea } from "@/components/ui";
import { useToast } from "@/components/toast";
import { formatDateTime } from "@/lib/dates";
import { getCashBalance } from "@/lib/ledger";
import { parseMajorToMinor } from "@/lib/money";
import { listReconciliations, recordReconciliation } from "@/lib/reconciliation";
import type { Reconciliation } from "@/lib/types";
import { useCallback, useEffect, useState } from "react";

export default function ReconciliationPage() {
  const { push } = useToast();
  const [expected, setExpected] = useState(0);
  const [counted, setCounted] = useState("");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<Reconciliation[]>([]);
  const [confirm, setConfirm] = useState(false);

  const reload = useCallback(async () => {
    setExpected(await getCashBalance());
    setRows(await listReconciliations());
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  let countedMinor = 0;
  let parseError = "";
  try {
    countedMinor = counted === "" ? 0 : parseMajorToMinor(counted === "0" ? "0.00" : counted);
    if (counted === "0") countedMinor = 0;
  } catch (e) {
    parseError = e instanceof Error ? e.message : "";
  }
  const diff = counted === "" ? 0 : countedMinor - expected;

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold text-forest-800">جرد الصندوق</h1>
      <Card className="space-y-4">
        <p>
          المتوقع حسب الدفتر: <Money amount={expected} className="text-2xl" />
        </p>
        <Field label="المبلغ المعدود فعلياً" error={parseError}>
          <Input value={counted} onChange={(e) => { setCounted(e.target.value); setConfirm(false); }} placeholder="0.00" />
        </Field>
        {counted !== "" && !parseError ? (
          <p className={diff === 0 ? "text-forest-700" : "text-red-700"}>
            الفرق: <Money amount={diff} />
            {diff !== 0 ? " — لن يُعدَّل الصندوق إلا بعد التأكيد الصريح" : " — مطابق"}
          </p>
        ) : null}
        <Field label="ملاحظات">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {diff !== 0 && counted !== "" ? (
          <label className="flex items-center gap-3 text-forest-800">
            <input type="checkbox" className="h-6 w-6" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
            أؤكد تسجيل تسوية رصيد بهذا الفرق
          </label>
        ) : null}
        <Button
          onClick={async () => {
            try {
              if (counted === "") throw new Error("أدخل المبلغ المعدود");
              const minor = counted === "0" ? 0 : parseMajorToMinor(counted);
              const difference = minor - expected;
              if (difference !== 0 && !confirm) throw new Error("أكد تسجيل التسوية أولاً");
              await recordReconciliation({
                countedMinor: minor,
                notes,
                createAdjustment: difference !== 0 && confirm,
              });
              push("سُجّل الجرد");
              setCounted("");
              setNotes("");
              setConfirm(false);
              await reload();
            } catch (err) {
              push(err instanceof Error ? err.message : "فشل", "err");
            }
          }}
        >
          حفظ الجرد
        </Button>
      </Card>
      {rows.length === 0 ? (
        <Empty title="لا سجلات جرد" />
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r.id} className="flex flex-wrap justify-between gap-3">
              <div>
                <p>{formatDateTime(r.createdAt)}</p>
                <p className="text-sm text-forest-600">{r.notes}</p>
              </div>
              <div className="text-left" dir="ltr">
                <p>متوقع {r.expectedMinor / 100}</p>
                <p>معدود {r.countedMinor / 100}</p>
                <Money amount={r.differenceMinor} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
