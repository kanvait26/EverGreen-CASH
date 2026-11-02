export const SCHEMA_VERSION = 1;
export const APP_VERSION = "1.0.0";

export type LedgerEventType =
  | "income"
  | "expense"
  | "advance_given"
  | "advance_settlement"
  | "advance_refund"
  | "opening_balance"
  | "balance_adjustment"
  | "invoice_payment"
  | "reversal";

export type AdjustmentDirection = "in" | "out";
export type InvoiceStatus = "draft" | "finalized" | "canceled";
export type InvoicePaymentStatus = "unpaid" | "partial" | "paid";
export type AdvanceStatus = "open" | "partial" | "settled";
export type BackupSource = "drive" | "file";

export interface Settings {
  id: "app";
  companyName: string;
  companyNameAr: string;
  logoDataUrl: string;
  address: string;
  phone: string;
  defaultCurrency: string;
  invoicePrefix: string;
  invoiceNextNumber: number;
  invoiceFooter: string;
  autoBackupEnabled: boolean;
  backupIntervalMinutes: number;
  pinEnabled: boolean;
  pinHash: string;
  pinSalt: string;
  autoLockMinutes: number;
  lastBackupAt: string | null;
  lastBackupVerified: boolean;
  googleAccountEmail: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Person {
  id: string;
  name: string;
  phone: string;
  address: string;
  notes: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LedgerEvent {
  id: string;
  type: LedgerEventType;
  amountMinor: number;
  cashDeltaMinor: number;
  incomeDeltaMinor: number;
  expenseDeltaMinor: number;
  advanceDeltaMinor: number;
  currency: string;
  personId: string | null;
  description: string;
  category: string;
  occurredAt: string;
  notes: string;
  invoiceId: string | null;
  advanceId: string | null;
  reversesEventId: string | null;
  direction: AdjustmentDirection | null;
  referenceNumber: string;
  createdAt: string;
  updatedAt: string;
  voided: boolean;
}

export interface Advance {
  id: string;
  personId: string;
  issuedEventId: string;
  originalAmountMinor: number;
  outstandingMinor: number;
  status: AdvanceStatus;
  currency: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

export interface AdvanceMovement {
  id: string;
  advanceId: string;
  eventId: string;
  kind: "issue" | "settlement" | "refund";
  amountMinor: number;
  createdAt: string;
}

export interface Invoice {
  id: string;
  number: string;
  status: InvoiceStatus;
  paymentStatus: InvoicePaymentStatus;
  customerPersonId: string | null;
  customerName: string;
  customerPhone: string;
  date: string;
  discountMinor: number;
  taxMinor: number;
  subtotalMinor: number;
  grandTotalMinor: number;
  paidMinor: number;
  notes: string;
  currency: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  finalizedAt: string | null;
  canceledAt: string | null;
}

export interface InvoiceLine {
  id: string;
  invoiceId: string;
  description: string;
  qtyMilli: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
  sortOrder: number;
}

export interface InvoiceRevision {
  id: string;
  invoiceId: string;
  revision: number;
  snapshotJson: string;
  createdAt: string;
}

export interface Reconciliation {
  id: string;
  expectedMinor: number;
  countedMinor: number;
  differenceMinor: number;
  date: string;
  notes: string;
  adjustmentEventId: string | null;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  payloadJson: string;
  createdAt: string;
}

export interface BackupMeta {
  id: string;
  source: BackupSource;
  driveFileId: string | null;
  fileName: string;
  createdAt: string;
  recordCounts: Record<string, number>;
  schemaVersion: number;
  verified: boolean;
  sizeBytes: number;
  success: boolean;
  error: string | null;
}

export interface ReferenceCounter {
  id: string;
  lastValue: number;
}

export interface SnapshotPayload {
  schemaVersion: number;
  appVersion: string;
  exportedAt: string;
  settings: Settings;
  people: Person[];
  ledgerEvents: LedgerEvent[];
  advances: Advance[];
  advanceMovements: AdvanceMovement[];
  invoices: Invoice[];
  invoiceLines: InvoiceLine[];
  invoiceRevisions: InvoiceRevision[];
  reconciliations: Reconciliation[];
  auditLogs: AuditLog[];
  backupMetadata: BackupMeta[];
  referenceCounters: ReferenceCounter[];
}
