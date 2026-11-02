# Backup and recovery

## Threat model

- All financial data lives in the iPad Safari / PWA IndexedDB.
- Google Drive is used only as a **blob store** for ciphertext (`drive.appdata`).
- The recovery passphrase never leaves the device. It is not uploaded and not stored in Drive.
- Session storage may hold the passphrase temporarily to attempt best-effort auto backup while the tab is alive.

## Encrypt

1. Snapshot every Dexie table with `schemaVersion` and `appVersion`.
2. Validate arrays and settings exist.
3. PBKDF2-SHA-256, 210000 iterations, 16-byte salt, AES-256-GCM, 12-byte IV.
4. File extension `.egbak` (JSON of `{ v, kdf, iter, salt, iv, ct }`).

## Drive upload

1. OAuth 2.0 via Google Identity Services token client. Scope: `https://www.googleapis.com/auth/drive.appdata`.
2. No OAuth client secret in the frontend. Access token lives in `sessionStorage` only.
3. Multipart upload to `appDataFolder`.
4. Success is recorded only after a follow-up `files.get` verification.
5. Keep the latest 7 verified Drive files; older files are deleted only after the new file is verified.

## Restore

1. Authenticate (Drive) or pick a local `.egbak`.
2. Decrypt and validate schema.
3. Show exported date and record counts.
4. Explicit confirm.
5. Safety snapshot of current DB.
6. Atomic clear + bulk add.
7. On failure, write the safety snapshot back.

## Auto backup (best effort)

Triggers: app open while online, `visibilitychange` / resume, `online` event, interval if data may have changed.

iPadOS may freeze PWAs in the background. OAuth tokens expire. Auto backup **must not** be treated as a guarantee. The UI never claims success without verification metadata.

## iOS storage limits

- IndexedDB can be evicted under storage pressure if the PWA is not used.
- Add to Home Screen and keep regular encrypted backups.
- Background fetch / silent refresh is not reliable for this PWA.
- Do not assume a stored refresh token; GIS access tokens are short-lived and interactive re-consent may be required.
