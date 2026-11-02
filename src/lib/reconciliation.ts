import { getDb } from "@/db";
import { writeAudit } from "@/lib/audit";
import { newId, nowIso } from "@/lib/ids";
import { getCashBalance, recordLedgerEvent } from "@/lib/ledger";
import type { Reconciliation } from "@/lib/types";

export async function recordReconciliation(input: {
  countedMinor: number;
  notes?: string;
  date?: string;
  createAdjustment: boolean;
}): Promise<Reconciliation> {
  if (!Number.isInteger(input.countedMinor) || input.countedMinor < 0) {
    throw new Error("المبلغ المعدود غير صالح");
  }
  const expectedMinor = await getCashBalance();
  const differenceMinor = input.countedMinor - expectedMinor;
  let adjustmentEventId: string | null = null;
  if (input.createAdjustment && differenceMinor !== 0) {
    const event = await recordLedgerEvent({
      type: "balance_adjustment",
      amountMinor: Math.abs(differenceMinor),
      direction: differenceMinor > 0 ? "in" : "out",
      description: "تسوية جرد الصندوق",
      notes: input.notes,
      category: "جرد",
    });
    adjustmentEventId = event.id;
  }
  const rec: Reconciliation = {
    id: newId(),
    expectedMinor,
    countedMinor: input.countedMinor,
    differenceMinor,
    date: input.date ?? nowIso().slice(0, 10),
    notes: input.notes?.trim() ?? "",
    adjustmentEventId,
    createdAt: nowIso(),
  };
  await getDb().reconciliations.add(rec);
  await writeAudit("reconciliation", rec.id, "create", {
    expectedMinor,
    countedMinor: input.countedMinor,
    differenceMinor,
    adjusted: Boolean(adjustmentEventId),
  });
  return rec;
}

export async function listReconciliations(): Promise<Reconciliation[]> {
  return getDb().reconciliations.orderBy("createdAt").reverse().toArray();
}
