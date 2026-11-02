import { getDb } from "@/db";
import { writeAudit } from "@/lib/audit";
import { newId, nowIso } from "@/lib/ids";
import { assertPositiveMinor } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import type {
  Advance,
  AdvanceMovement,
  LedgerEvent,
  LedgerEventType,
} from "@/lib/types";

export interface RecordEventInput {
  type: LedgerEventType;
  amountMinor: number;
  personId?: string | null;
  description: string;
  category?: string;
  occurredAt?: string;
  notes?: string;
  invoiceId?: string | null;
  advanceId?: string | null;
  reversesEventId?: string | null;
  direction?: "in" | "out" | null;
  currency?: string;
}

function cashDelta(type: LedgerEventType, amount: number, direction?: "in" | "out" | null): number {
  switch (type) {
    case "income":
    case "advance_refund":
    case "invoice_payment":
    case "opening_balance":
      return amount;
    case "expense":
    case "advance_given":
      return -amount;
    case "advance_settlement":
      return 0;
    case "balance_adjustment":
      return direction === "out" ? -amount : amount;
    case "reversal":
      return 0;
    default:
      return 0;
  }
}

function incomeDelta(type: LedgerEventType, amount: number): number {
  if (type === "income" || type === "invoice_payment") return amount;
  return 0;
}

function expenseDelta(type: LedgerEventType, amount: number): number {
  if (type === "expense" || type === "advance_settlement") return amount;
  return 0;
}

function advanceDelta(type: LedgerEventType, amount: number): number {
  if (type === "advance_given") return amount;
  if (type === "advance_settlement" || type === "advance_refund") return -amount;
  return 0;
}

async function nextReference(prefix: string): Promise<string> {
  const db = getDb();
  const counter = (await db.referenceCounters.get("ledger")) ?? { id: "ledger", lastValue: 0 };
  const next = counter.lastValue + 1;
  await db.referenceCounters.put({ id: "ledger", lastValue: next });
  return `${prefix}${String(next).padStart(5, "0")}`;
}

export async function recordLedgerEvent(input: RecordEventInput): Promise<LedgerEvent> {
  if (input.type !== "reversal") {
    assertPositiveMinor(input.amountMinor);
  }
  const settings = await getSettings();
  const db = getDb();
  const now = nowIso();
  const type = input.type;
  const amount = input.amountMinor;
  const event: LedgerEvent = {
    id: newId(),
    type,
    amountMinor: amount,
    cashDeltaMinor: cashDelta(type, amount, input.direction),
    incomeDeltaMinor: incomeDelta(type, amount),
    expenseDeltaMinor: expenseDelta(type, amount),
    advanceDeltaMinor: advanceDelta(type, amount),
    currency: input.currency ?? settings.defaultCurrency,
    personId: input.personId ?? null,
    description: input.description.trim(),
    category: input.category?.trim() ?? defaultCategory(type),
    occurredAt: input.occurredAt ?? now,
    notes: input.notes?.trim() ?? "",
    invoiceId: input.invoiceId ?? null,
    advanceId: input.advanceId ?? null,
    reversesEventId: input.reversesEventId ?? null,
    direction: input.direction ?? null,
    referenceNumber: await nextReference("TX-"),
    createdAt: now,
    updatedAt: now,
    voided: false,
  };
  await db.ledgerEvents.add(event);
  await writeAudit("ledger", event.id, "create", { type: event.type, amount: event.amountMinor });
  return event;
}

function defaultCategory(type: LedgerEventType): string {
  const map: Record<LedgerEventType, string> = {
    income: "إيراد",
    expense: "مصروف",
    advance_given: "سلفة",
    advance_settlement: "تسوية سلفة",
    advance_refund: "استرداد سلفة",
    opening_balance: "رصيد افتتاحي",
    balance_adjustment: "تسوية رصيد",
    invoice_payment: "تحصيل فاتورة",
    reversal: "عكس قيد",
  };
  return map[type];
}

export async function getCashBalance(asOf?: string): Promise<number> {
  const db = getDb();
  const events = await db.ledgerEvents.filter((e) => !e.voided).toArray();
  return events
    .filter((e) => !asOf || e.occurredAt <= asOf)
    .reduce((sum, e) => sum + e.cashDeltaMinor, 0);
}

export async function getTotals(fromIso?: string, toIso?: string) {
  const db = getDb();
  const events = await db.ledgerEvents.filter((e) => !e.voided).toArray();
  const filtered = events.filter((e) => {
    if (fromIso && e.occurredAt < fromIso) return false;
    if (toIso && e.occurredAt > toIso) return false;
    return true;
  });
  return {
    received: filtered.reduce((s, e) => s + e.incomeDeltaMinor, 0),
    paid: filtered.reduce((s, e) => s + e.expenseDeltaMinor, 0),
    cashIn: filtered.filter((e) => e.cashDeltaMinor > 0).reduce((s, e) => s + e.cashDeltaMinor, 0),
    cashOut: filtered.filter((e) => e.cashDeltaMinor < 0).reduce((s, e) => s + e.cashDeltaMinor, 0),
    outstandingAdvances: await getOutstandingAdvances(),
    cashBalance: await getCashBalance(toIso),
    count: filtered.length,
  };
}

export async function getOutstandingAdvances(): Promise<number> {
  const db = getDb();
  const advances = await db.advances.toArray();
  return advances.reduce((s, a) => s + a.outstandingMinor, 0);
}

export async function listEvents(opts?: {
  fromIso?: string;
  toIso?: string;
  type?: LedgerEventType;
  personId?: string;
  search?: string;
}): Promise<LedgerEvent[]> {
  const db = getDb();
  let events = await db.ledgerEvents.orderBy("occurredAt").reverse().toArray();
  events = events.filter((e) => !e.voided);
  if (opts?.fromIso) events = events.filter((e) => e.occurredAt >= opts.fromIso!);
  if (opts?.toIso) events = events.filter((e) => e.occurredAt <= opts.toIso!);
  if (opts?.type) events = events.filter((e) => e.type === opts.type);
  if (opts?.personId) events = events.filter((e) => e.personId === opts.personId);
  if (opts?.search) {
    const q = opts.search.trim();
    events = events.filter(
      (e) =>
        e.description.includes(q) ||
        e.referenceNumber.includes(q) ||
        e.notes.includes(q) ||
        e.category.includes(q),
    );
  }
  return events;
}

export async function reverseEvent(eventId: string, reason: string): Promise<LedgerEvent> {
  const db = getDb();
  const original = await db.ledgerEvents.get(eventId);
  if (!original || original.voided) throw new Error("القيد غير موجود");
  if (original.type === "reversal") throw new Error("لا يمكن عكس قيد عكسي");
  const now = nowIso();
  const reversal: LedgerEvent = {
    ...original,
    id: newId(),
    type: "reversal",
    amountMinor: original.amountMinor,
    cashDeltaMinor: -original.cashDeltaMinor,
    incomeDeltaMinor: -original.incomeDeltaMinor,
    expenseDeltaMinor: -original.expenseDeltaMinor,
    advanceDeltaMinor: -original.advanceDeltaMinor,
    description: `عكس ${original.referenceNumber}: ${reason}`,
    notes: reason,
    reversesEventId: original.id,
    referenceNumber: await nextReference("RV-"),
    createdAt: now,
    updatedAt: now,
    voided: false,
    occurredAt: now,
  };
  await db.transaction("rw", db.ledgerEvents, db.advances, db.advanceMovements, db.auditLogs, async () => {
    await db.ledgerEvents.add(reversal);
    if (original.advanceId) {
      const adv = await db.advances.get(original.advanceId);
      if (adv) {
        const outstanding = adv.outstandingMinor - original.advanceDeltaMinor;
        await db.advances.update(adv.id, {
          outstandingMinor: outstanding,
          status: outstanding <= 0 ? "settled" : outstanding < adv.originalAmountMinor ? "partial" : "open",
          updatedAt: now,
          closedAt: outstanding <= 0 ? now : null,
        });
      }
    }
    await writeAudit("ledger", original.id, "reverse", { reversalId: reversal.id, reason });
  });
  return reversal;
}

export async function correctEvent(
  eventId: string,
  input: RecordEventInput,
  reason: string,
): Promise<{ reversal: LedgerEvent; replacement: LedgerEvent }> {
  const reversal = await reverseEvent(eventId, reason);
  const replacement = await recordLedgerEvent({
    ...input,
    notes: `${input.notes ?? ""}\nتصحيح لـ قيد معكوس. السبب: ${reason}`.trim(),
  });
  await writeAudit("ledger", eventId, "correct", {
    reversalId: reversal.id,
    replacementId: replacement.id,
    reason,
  });
  return { reversal, replacement };
}

export async function giveAdvance(input: {
  personId: string;
  amountMinor: number;
  description?: string;
  notes?: string;
  occurredAt?: string;
  category?: string;
}): Promise<{ event: LedgerEvent; advance: Advance }> {
  const db = getDb();
  const person = await db.people.get(input.personId);
  if (!person || person.archived) throw new Error("الشخص غير موجود");
  const event = await recordLedgerEvent({
    type: "advance_given",
    amountMinor: input.amountMinor,
    personId: input.personId,
    description: input.description?.trim() || `سلفة لـ ${person.name}`,
    notes: input.notes,
    occurredAt: input.occurredAt,
    category: input.category ?? "سلفة",
  });
  const now = nowIso();
  const advance: Advance = {
    id: newId(),
    personId: input.personId,
    issuedEventId: event.id,
    originalAmountMinor: input.amountMinor,
    outstandingMinor: input.amountMinor,
    status: "open",
    currency: event.currency,
    notes: input.notes ?? "",
    createdAt: now,
    updatedAt: now,
    closedAt: null,
  };
  const movement: AdvanceMovement = {
    id: newId(),
    advanceId: advance.id,
    eventId: event.id,
    kind: "issue",
    amountMinor: input.amountMinor,
    createdAt: now,
  };
  await db.transaction("rw", db.advances, db.advanceMovements, db.ledgerEvents, async () => {
    await db.advances.add(advance);
    await db.advanceMovements.add(movement);
    await db.ledgerEvents.update(event.id, { advanceId: advance.id });
  });
  await writeAudit("advance", advance.id, "issue", { amount: input.amountMinor, personId: input.personId });
  return { event: { ...event, advanceId: advance.id }, advance };
}

async function applyAdvanceReduction(
  advanceId: string,
  amountMinor: number,
  kind: "settlement" | "refund",
  description: string,
  notes?: string,
  occurredAt?: string,
): Promise<{ event: LedgerEvent; advance: Advance }> {
  const db = getDb();
  const advance = await db.advances.get(advanceId);
  if (!advance) throw new Error("السلفة غير موجودة");
  if (advance.status === "settled") throw new Error("السلفة مسددة بالكامل");
  if (amountMinor > advance.outstandingMinor) {
    throw new Error("المبلغ أكبر من الرصيد المتبقي للسلفة");
  }
  const event = await recordLedgerEvent({
    type: kind === "settlement" ? "advance_settlement" : "advance_refund",
    amountMinor,
    personId: advance.personId,
    description,
    notes,
    occurredAt,
    advanceId,
  });
  const now = nowIso();
  const outstanding = advance.outstandingMinor - amountMinor;
  const next: Advance = {
    ...advance,
    outstandingMinor: outstanding,
    status: outstanding === 0 ? "settled" : "partial",
    updatedAt: now,
    closedAt: outstanding === 0 ? now : null,
  };
  await db.transaction("rw", db.advances, db.advanceMovements, async () => {
    await db.advances.put(next);
    await db.advanceMovements.add({
      id: newId(),
      advanceId,
      eventId: event.id,
      kind,
      amountMinor,
      createdAt: now,
    });
  });
  await writeAudit("advance", advanceId, kind, { amount: amountMinor });
  return { event, advance: next };
}

export async function settleAdvance(input: {
  advanceId: string;
  amountMinor: number;
  description?: string;
  notes?: string;
  occurredAt?: string;
}) {
  const db = getDb();
  const advance = await db.advances.get(input.advanceId);
  if (!advance) throw new Error("السلفة غير موجودة");
  const person = await db.people.get(advance.personId);
  return applyAdvanceReduction(
    input.advanceId,
    input.amountMinor,
    "settlement",
    input.description?.trim() || `تسوية سلفة ${person?.name ?? ""}`.trim(),
    input.notes,
    input.occurredAt,
  );
}

export async function refundAdvance(input: {
  advanceId: string;
  amountMinor: number;
  description?: string;
  notes?: string;
  occurredAt?: string;
}) {
  const db = getDb();
  const advance = await db.advances.get(input.advanceId);
  if (!advance) throw new Error("السلفة غير موجودة");
  const person = await db.people.get(advance.personId);
  return applyAdvanceReduction(
    input.advanceId,
    input.amountMinor,
    "refund",
    input.description?.trim() || `استرداد سلفة ${person?.name ?? ""}`.trim(),
    input.notes,
    input.occurredAt,
  );
}

export async function getPersonFinancials(personId: string) {
  const events = await listEvents({ personId });
  const db = getDb();
  const advances = await db.advances.where("personId").equals(personId).toArray();
  return {
    received: events.reduce((s, e) => s + e.incomeDeltaMinor, 0),
    paid: events.reduce((s, e) => s + e.expenseDeltaMinor, 0),
    outstandingAdvances: advances.reduce((s, a) => s + a.outstandingMinor, 0),
    events,
    advances,
  };
}
