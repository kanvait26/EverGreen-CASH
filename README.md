# EverGreen CASH

Arabic-first, offline-first cash, advances, and invoicing PWA for **EVER GREEN AGRICULTURAL CONTRACTORS**.

Runs entirely in the browser (IndexedDB). No backend and no login for daily use. Google Drive is used only for encrypted backups.

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind · Dexie · Zod · jsPDF · Web Crypto · Google Identity Services

## Features

- Dashboard from live local records (cash, income, expenses, advances, charts)
- Append-only ledger: income, expense, advances, refunds, opening balance, adjustments
- Advance example: 500 given, 350 settled as expense (no extra cash out), 150 returned to cash
- People directory with statements and PDF
- Invoices: draft / finalize / cancel / duplicate / Arabic RTL PDF / native share
- Issuing an invoice does not collect cash; collection is a separate ledger event
- Cash reconciliation with explicit confirmation before adjustments
- Reports: PDF, CSV, print
- AES-256-GCM backups (PBKDF2) to a file or Google Drive `appDataFolder`
- PIN lock (app-level, not device encryption)
- Installable PWA with RTL Cairo font bundled locally

## Quick start (Windows)

```
npm install
copy .env.example .env.local
npm run dev
```

Open http://localhost:3000

```
npm test
npm run typecheck
npm run lint
npm run build
```

## Environment

See `.env.example`. Only public values belong in the frontend:

```
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-id.apps.googleusercontent.com
```

Never put an OAuth client secret in this repository.

## Docs

- `docs/SETUP.md` — Windows, Google Cloud OAuth, iPad PWA install
- `docs/SCHEMA.md` — Dexie tables and money rules
- `docs/BACKUP.md` — encryption, Drive, restore, iOS limits
- `docs/TESTING.md` — automated tests and real-device checklist

## Branding

`public/logo.jpg` is the app logo. Forest green, lime, white, black. UI is Arabic RTL.

## License

Private — EVER GREEN AGRICULTURAL CONTRACTORS
