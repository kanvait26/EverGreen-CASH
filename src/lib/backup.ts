import { getDb, resetDbSingleton } from "@/db";
import { writeAudit } from "@/lib/audit";
import { newId, nowIso } from "@/lib/ids";
import { encryptJson, decryptJson, blobToBytes, type EncryptedBlob } from "@/lib/crypto";
import { APP_VERSION, SCHEMA_VERSION, type SnapshotPayload, type BackupMeta } from "@/lib/types";
import { ensureSettings, updateSettings } from "@/lib/settings";

export async function takeSnapshot(): Promise<SnapshotPayload> {
  const db = getDb();
  const [
    settings,
    people,
    ledgerEvents,
    advances,
    advanceMovements,
    invoices,
    invoiceLines,
    invoiceRevisions,
    reconciliations,
    auditLogs,
    backupMetadata,
    referenceCounters,
  ] = await Promise.all([
    ensureSettings(),
    db.people.toArray(),
    db.ledgerEvents.toArray(),
    db.advances.toArray(),
    db.advanceMovements.toArray(),
    db.invoices.toArray(),
    db.invoiceLines.toArray(),
    db.invoiceRevisions.toArray(),
    db.reconciliations.toArray(),
    db.auditLogs.toArray(),
    db.backupMetadata.toArray(),
    db.referenceCounters.toArray(),
  ]);
  return {
    schemaVersion: SCHEMA_VERSION,
    appVersion: APP_VERSION,
    exportedAt: nowIso(),
    settings,
    people,
    ledgerEvents,
    advances,
    advanceMovements,
    invoices,
    invoiceLines,
    invoiceRevisions,
    reconciliations,
    auditLogs,
    backupMetadata,
    referenceCounters,
  };
}

export function snapshotCounts(snap: SnapshotPayload): Record<string, number> {
  return {
    people: snap.people.length,
    ledgerEvents: snap.ledgerEvents.length,
    advances: snap.advances.length,
    invoices: snap.invoices.length,
    invoiceLines: snap.invoiceLines.length,
    reconciliations: snap.reconciliations.length,
    auditLogs: snap.auditLogs.length,
  };
}

export function validateSnapshot(data: unknown): SnapshotPayload {
  if (!data || typeof data !== "object") throw new Error("النسخة الاحتياطية فارغة");
  const snap = data as SnapshotPayload;
  if (snap.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`إصدار قاعدة البيانات غير مدعوم (${snap.schemaVersion})`);
  }
  if (!Array.isArray(snap.ledgerEvents) || !Array.isArray(snap.people) || !snap.settings) {
    throw new Error("بنية النسخة الاحتياطية غير مكتملة");
  }
  return snap;
}

export async function encryptSnapshot(passphrase: string): Promise<{
  blob: EncryptedBlob;
  snapshot: SnapshotPayload;
  bytes: Uint8Array;
  fileName: string;
}> {
  const snapshot = await takeSnapshot();
  validateSnapshot(snapshot);
  const blob = await encryptJson(snapshot, passphrase);
  const bytes = blobToBytes(blob);
  const stamp = snapshot.exportedAt.replace(/[:.]/g, "-");
  return { blob, snapshot, bytes, fileName: `evergreen-cash-${stamp}.egbak` };
}

export async function decryptSnapshot(raw: string | EncryptedBlob, passphrase: string): Promise<SnapshotPayload> {
  const blob: EncryptedBlob = typeof raw === "string" ? (JSON.parse(raw) as EncryptedBlob) : raw;
  const data = await decryptJson<SnapshotPayload>(blob, passphrase);
  return validateSnapshot(data);
}

export async function restoreSnapshot(snap: SnapshotPayload): Promise<void> {
  validateSnapshot(snap);
  const safety = await takeSnapshot();
  const db = getDb();
  try {
    await db.transaction(
      "rw",
      db.tables,
      async () => {
        await Promise.all(db.tables.map((t) => t.clear()));
        await db.settings.put(snap.settings);
        if (snap.people.length) await db.people.bulkAdd(snap.people);
        if (snap.ledgerEvents.length) await db.ledgerEvents.bulkAdd(snap.ledgerEvents);
        if (snap.advances.length) await db.advances.bulkAdd(snap.advances);
        if (snap.advanceMovements.length) await db.advanceMovements.bulkAdd(snap.advanceMovements);
        if (snap.invoices.length) await db.invoices.bulkAdd(snap.invoices);
        if (snap.invoiceLines.length) await db.invoiceLines.bulkAdd(snap.invoiceLines);
        if (snap.invoiceRevisions.length) await db.invoiceRevisions.bulkAdd(snap.invoiceRevisions);
        if (snap.reconciliations.length) await db.reconciliations.bulkAdd(snap.reconciliations);
        if (snap.auditLogs.length) await db.auditLogs.bulkAdd(snap.auditLogs);
        if (snap.backupMetadata.length) await db.backupMetadata.bulkAdd(snap.backupMetadata);
        if (snap.referenceCounters.length) await db.referenceCounters.bulkAdd(snap.referenceCounters);
      },
    );
  } catch (err) {
    await db.transaction("rw", db.tables, async () => {
      await Promise.all(db.tables.map((t) => t.clear()));
      await db.settings.put(safety.settings);
      if (safety.people.length) await db.people.bulkAdd(safety.people);
      if (safety.ledgerEvents.length) await db.ledgerEvents.bulkAdd(safety.ledgerEvents);
      if (safety.advances.length) await db.advances.bulkAdd(safety.advances);
      if (safety.advanceMovements.length) await db.advanceMovements.bulkAdd(safety.advanceMovements);
      if (safety.invoices.length) await db.invoices.bulkAdd(safety.invoices);
      if (safety.invoiceLines.length) await db.invoiceLines.bulkAdd(safety.invoiceLines);
      if (safety.invoiceRevisions.length) await db.invoiceRevisions.bulkAdd(safety.invoiceRevisions);
      if (safety.reconciliations.length) await db.reconciliations.bulkAdd(safety.reconciliations);
      if (safety.auditLogs.length) await db.auditLogs.bulkAdd(safety.auditLogs);
      if (safety.backupMetadata.length) await db.backupMetadata.bulkAdd(safety.backupMetadata);
      if (safety.referenceCounters.length) await db.referenceCounters.bulkAdd(safety.referenceCounters);
    });
    throw err;
  }
  resetDbSingleton();
}

export async function recordBackupMeta(partial: Omit<BackupMeta, "id">): Promise<BackupMeta> {
  const meta: BackupMeta = { ...partial, id: newId() };
  await getDb().backupMetadata.add(meta);
  if (meta.success && meta.verified) {
    await updateSettings({ lastBackupAt: meta.createdAt, lastBackupVerified: true });
  }
  await writeAudit("backup", meta.id, meta.success ? "success" : "failure", {
    source: meta.source,
    fileName: meta.fileName,
  });
  return meta;
}

export async function listBackupMeta(): Promise<BackupMeta[]> {
  return getDb().backupMetadata.orderBy("createdAt").reverse().toArray();
}

export function downloadBytes(fileName: string, bytes: Uint8Array, mime = "application/octet-stream") {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
