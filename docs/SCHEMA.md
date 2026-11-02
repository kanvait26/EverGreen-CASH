# EverGreen CASH — Database schema

IndexedDB database name: `evergreen-cash`  
Dexie schema version: `1` (`SCHEMA_VERSION`)

All money fields are **integer minor units** (fils / agorot). Never floats.

## Tables

### settings (`id`)
Singleton `id = "app"`. Company profile, invoice numbering, PIN hash/salt (PBKDF2), backup flags, default currency.

### people (`id, name, phone, archived, createdAt`)
Directory. Archive instead of delete when ledger/invoice/advance rows exist.

### ledgerEvents (`id, type, occurredAt, personId, invoiceId, advanceId, reversesEventId, referenceNumber, createdAt, voided`)
Append-only journal. Source of truth for cash.

Cash / income / expense / advance effects are stored as signed integer deltas:

| type | cashDelta | incomeDelta | expenseDelta | advanceDelta |
|---|---|---|---|---|
| income | +amt | +amt | 0 | 0 |
| expense | −amt | 0 | +amt | 0 |
| advance_given | −amt | 0 | 0 | +amt |
| advance_settlement | 0 | 0 | +amt | −amt |
| advance_refund | +amt | 0 | 0 | −amt |
| opening_balance | +amt | 0 | 0 | 0 |
| balance_adjustment | ±amt | 0 | 0 | 0 |
| invoice_payment | +amt | +amt | 0 | 0 |
| reversal | negated original | | | |

Edits never overwrite. Correction = reversal event + new event.

### advances / advanceMovements
Outstanding tracked on `advances.outstandingMinor`. Movements: issue, settlement, refund.

### invoices / invoiceLines / invoiceRevisions
Numbers unique and never reused. Draft editable. Finalized snapshots stored in `invoiceRevisions`. Cancel keeps the row.

Issuing an invoice does **not** write cash. `invoice_payment` ledger events do.

### reconciliations
expected vs counted vs difference. Optional `balance_adjustment` event.

### auditLogs
Every create/update/reverse/backup action.

### backupMetadata
Local history of encrypted backups (Drive or file).

### referenceCounters
Monotonic `ledger` and `invoice` counters.

## Migrations

v1 is the initial schema. Future Dexie versions must add `.upgrade()` handlers that copy existing rows; never drop financial tables.
