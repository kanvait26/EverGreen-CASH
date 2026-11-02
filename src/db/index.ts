import Dexie, { type Table } from "dexie";
import type {
  Advance,
  AdvanceMovement,
  AuditLog,
  BackupMeta,
  Invoice,
  InvoiceLine,
  InvoiceRevision,
  LedgerEvent,
  Person,
  Reconciliation,
  ReferenceCounter,
  Settings,
} from "@/lib/types";
import { SCHEMA_VERSION } from "@/lib/types";

export class EverGreenDB extends Dexie {
  settings!: Table<Settings, string>;
  people!: Table<Person, string>;
  ledgerEvents!: Table<LedgerEvent, string>;
  advances!: Table<Advance, string>;
  advanceMovements!: Table<AdvanceMovement, string>;
  invoices!: Table<Invoice, string>;
  invoiceLines!: Table<InvoiceLine, string>;
  invoiceRevisions!: Table<InvoiceRevision, string>;
  reconciliations!: Table<Reconciliation, string>;
  auditLogs!: Table<AuditLog, string>;
  backupMetadata!: Table<BackupMeta, string>;
  referenceCounters!: Table<ReferenceCounter, string>;

  constructor() {
    super("evergreen-cash");
    this.version(SCHEMA_VERSION).stores({
      settings: "id",
      people: "id, name, phone, archived, createdAt",
      ledgerEvents:
        "id, type, occurredAt, personId, invoiceId, advanceId, reversesEventId, referenceNumber, createdAt, voided",
      advances: "id, personId, status, createdAt, issuedEventId",
      advanceMovements: "id, advanceId, eventId, kind, createdAt",
      invoices: "id, number, status, paymentStatus, date, customerPersonId, createdAt",
      invoiceLines: "id, invoiceId, sortOrder",
      invoiceRevisions: "id, invoiceId, revision, createdAt",
      reconciliations: "id, date, createdAt",
      auditLogs: "id, entityType, entityId, createdAt",
      backupMetadata: "id, createdAt, source, verified, success",
      referenceCounters: "id",
    });
  }
}

let dbSingleton: EverGreenDB | null = null;

export function getDb(): EverGreenDB {
  if (!dbSingleton) {
    dbSingleton = new EverGreenDB();
  }
  return dbSingleton;
}

export function resetDbSingleton(): void {
  dbSingleton = null;
}

export async function withTransaction<T>(
  tables: Table[],
  fn: () => Promise<T>,
): Promise<T> {
  const db = getDb();
  return db.transaction("rw", tables, fn);
}
