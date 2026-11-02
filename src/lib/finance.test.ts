import { describe, expect, it, beforeEach } from "vitest";
import { getDb } from "@/db";
import { ensureSettings } from "@/lib/settings";
import { formatMinor, parseMajorToMinor } from "@/lib/money";
import {
  getCashBalance,
  getTotals,
  giveAdvance,
  recordLedgerEvent,
  refundAdvance,
  reverseEvent,
  settleAdvance,
} from "@/lib/ledger";
import { createPerson, deletePerson } from "@/lib/people";
import {
  cancelInvoice,
  collectInvoicePayment,
  createInvoice,
  finalizeInvoice,
  updateDraftInvoice,
} from "@/lib/invoices";
import { recordReconciliation } from "@/lib/reconciliation";
import { encryptSnapshot, restoreSnapshot, validateSnapshot } from "@/lib/backup";
import { encryptJson, decryptJson } from "@/lib/crypto";

beforeEach(async () => {
  await ensureSettings();
});

describe("money", () => {
  it("parses and formats integer minor units", () => {
    expect(parseMajorToMinor("500")).toBe(50000);
    expect(parseMajorToMinor("350.5")).toBe(35050);
    expect(parseMajorToMinor("0.15")).toBe(15);
    expect(formatMinor(50000, "ILS")).toContain("500.00");
  });

  it("rejects negatives and invalid input", () => {
    expect(() => parseMajorToMinor("-1")).toThrow();
    expect(() => parseMajorToMinor("abc")).toThrow();
  });
});

describe("ledger balances", () => {
  it("tracks income and expense cash", async () => {
    await recordLedgerEvent({ type: "opening_balance", amountMinor: 100000, description: "افتتاح" });
    await recordLedgerEvent({ type: "income", amountMinor: 20000, description: "بيع" });
    await recordLedgerEvent({ type: "expense", amountMinor: 5000, description: "وقود" });
    expect(await getCashBalance()).toBe(115000);
    const t = await getTotals();
    expect(t.received).toBe(20000);
    expect(t.paid).toBe(5000);
  });

  it("reverses with a new event, never silent overwrite", async () => {
    const e = await recordLedgerEvent({ type: "income", amountMinor: 10000, description: "أ" });
    await reverseEvent(e.id, "خطأ إدخال");
    expect(await getCashBalance()).toBe(0);
    const events = await getDb().ledgerEvents.toArray();
    expect(events).toHaveLength(2);
    expect(events.some((x) => x.type === "reversal")).toBe(true);
  });
});

describe("advances — Ahmed 500 / 350 / 150", () => {
  it("does not double-count expense or cash", async () => {
    const person = await createPerson({ name: "أحمد" });
    await giveAdvance({ personId: person.id, amountMinor: 50000, description: "سلفة أحمد" });
    expect(await getCashBalance()).toBe(-50000);
    const adv = (await getDb().advances.toArray())[0];
    expect(adv.outstandingMinor).toBe(50000);
    await settleAdvance({ advanceId: adv.id, amountMinor: 35000 });
    expect(await getCashBalance()).toBe(-50000);
    const afterSettle = await getDb().advances.get(adv.id);
    expect(afterSettle?.outstandingMinor).toBe(15000);
    const totalsAfterSettle = await getTotals();
    expect(totalsAfterSettle.paid).toBe(35000);
    await refundAdvance({ advanceId: adv.id, amountMinor: 15000 });
    expect(await getCashBalance()).toBe(-35000);
    const closed = await getDb().advances.get(adv.id);
    expect(closed?.status).toBe("settled");
    expect(closed?.outstandingMinor).toBe(0);
    const t = await getTotals();
    expect(t.paid).toBe(35000);
    expect(t.outstandingAdvances).toBe(0);
  });

  it("rejects over-settlement", async () => {
    const person = await createPerson({ name: "سامي" });
    const { advance } = await giveAdvance({ personId: person.id, amountMinor: 10000 });
    await expect(settleAdvance({ advanceId: advance.id, amountMinor: 20000 })).rejects.toThrow();
  });
});

describe("people", () => {
  it("refuses delete when ledger is linked", async () => {
    const p = await createPerson({ name: "خالد" });
    await recordLedgerEvent({ type: "income", amountMinor: 1000, personId: p.id, description: "دفعة" });
    await expect(deletePerson(p.id)).rejects.toThrow();
  });
});

describe("invoices", () => {
  it("create, edit draft, finalize, cancel — numbers unique", async () => {
    const a = await createInvoice({
      customerName: "عميل",
      lines: [{ description: "حرث", qty: 2, unitPriceMinor: 10000 }],
    });
    const b = await createInvoice({
      customerName: "آخر",
      lines: [{ description: "ري", qty: 1, unitPriceMinor: 5000 }],
    });
    expect(a.number).not.toBe(b.number);
    expect(a.status).toBe("draft");
    await updateDraftInvoice(a.id, {
      customerName: "عميل محدّث",
      lines: [{ description: "حرث", qty: 3, unitPriceMinor: 10000 }],
    });
    const finalized = await finalizeInvoice(a.id);
    expect(finalized.status).toBe("finalized");
    await expect(
      updateDraftInvoice(a.id, { customerName: "x", lines: [{ description: "a", qty: 1, unitPriceMinor: 1 }] }),
    ).rejects.toThrow();
    const canceled = await cancelInvoice(a.id, "طلب العميل");
    expect(canceled.status).toBe("canceled");
    const still = await getDb().invoices.get(a.id);
    expect(still).toBeTruthy();
  });

  it("issuing does not collect cash; collect is a separate ledger event", async () => {
    const inv = await createInvoice(
      {
        customerName: "مزرعة",
        lines: [{ description: "خدمة", qty: 1, unitPriceMinor: 20000 }],
      },
      false,
    );
    expect(await getCashBalance()).toBe(0);
    await collectInvoicePayment({ invoiceId: inv.id, amountMinor: 20000 });
    expect(await getCashBalance()).toBe(20000);
    await expect(collectInvoicePayment({ invoiceId: inv.id, amountMinor: 1 })).rejects.toThrow();
  });
});

describe("reconciliation", () => {
  it("records expected vs counted and optional adjustment", async () => {
    await recordLedgerEvent({ type: "opening_balance", amountMinor: 500000, description: "افتتاح" });
    const rec = await recordReconciliation({ countedMinor: 495000, createAdjustment: true, notes: "نقص" });
    expect(rec.differenceMinor).toBe(-5000);
    expect(await getCashBalance()).toBe(495000);
  });
});

describe("backup encrypt/decrypt/restore", () => {
  it("round-trips and rejects bad passphrase and garbage", async () => {
    await recordLedgerEvent({ type: "income", amountMinor: 77700, description: "اختبار" });
    const { blob } = await encryptSnapshot("recovery-phrase-ok");
    const decoded = await decryptJson<Awaited<ReturnType<typeof encryptSnapshot>>["snapshot"]>(
      blob,
      "recovery-phrase-ok",
    );
    expect(decoded.ledgerEvents).toHaveLength(1);
    await expect(decryptJson(blob, "wrong-pass")).rejects.toThrow();
    expect(() => validateSnapshot({})).toThrow();
    await recordLedgerEvent({ type: "expense", amountMinor: 100, description: "لاحق" });
    expect(await getCashBalance()).toBe(77600);
    await restoreSnapshot(decoded);
    expect(await getCashBalance()).toBe(77700);
  });

  it("rejects invalid encrypted files", async () => {
    await expect(
      decryptJson({ v: 1, kdf: "PBKDF2-SHA256", iter: 1, salt: "", iv: "", ct: "" } as never, "abcdefgh"),
    ).rejects.toThrow();
  });
});

describe("crypto helpers", () => {
  it("encryptJson / decryptJson", async () => {
    const blob = await encryptJson({ hello: "مرحبا" }, "passphrase1");
    const data = await decryptJson<{ hello: string }>(blob, "passphrase1");
    expect(data.hello).toBe("مرحبا");
  });
});
