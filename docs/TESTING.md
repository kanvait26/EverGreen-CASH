# Testing

## Automated (Vitest + fake-indexeddb)

```
npm test
```

Covered:

- Integer money parsing / rejection of negatives
- Income, expense, opening balance, cash totals
- Ledger reversal (append-only, no silent overwrite)
- Ahmed advance 500 / settle 350 / refund 150 without double-counting cash or expense
- Over-settlement rejected
- People cannot be deleted when linked
- Invoices: unique numbers, draft edit, finalize, cancel retained
- Invoice issue ≠ cash; collect writes one ledger event
- Reconciliation difference and optional adjustment
- Backup encrypt / wrong passphrase / invalid blob / restore
- AES-GCM round trip

## Typecheck and lint

```
npm run typecheck
npm run lint
```

## E2E / real iPadOS (must be done on device)

These cannot be fully proven in CI:

1. Add to Home Screen, reopen after killing Safari — IndexedDB still present
2. Airplane mode: create income, invoice draft, person; reopen PWA; data intact
3. Native share sheet for invoice PDF (WhatsApp / Files / AirDrop)
4. Google OAuth in standalone PWA (may require Safari interaction)
5. Storage warning after iOS clears website data
6. Auto-backup does **not** run while the PWA is suspended — confirm manual backup still works
7. RTL layout and large touch targets in landscape iPad

Service worker updates never call `skipWaiting` automatically, to avoid wiping in-progress forms.
