# Setup guides

## Windows development

1. Install Node.js 20+ LTS.
2. Clone this repository.
3. `npm install`
4. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (optional until Drive is needed).
5. `npm run dev` — open http://localhost:3000
6. `npm test` — finance, advances, invoices, backup crypto.
7. `npm run typecheck` and `npm run lint`
8. `npm run build` then `npm start` for production mode.

## Google Cloud OAuth (Drive app data)

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project (e.g. `evergreen-cash`).
3. Enable **Google Drive API**.
4. Configure OAuth consent screen (External or Internal). App name: EverGreen CASH. Add scope `https://www.googleapis.com/auth/drive.appdata`.
5. Credentials → Create credentials → OAuth client ID → **Web application**.
6. Authorized JavaScript origins:
   - `http://localhost:3000`
   - your HTTPS production origin (required; Google OAuth will not run on plain HTTP except localhost)
7. Authorized redirect URIs: the same origins (GIS token client uses the origin).
8. Copy the **Client ID** (public) into `.env.local` as `NEXT_PUBLIC_GOOGLE_CLIENT_ID`. Never put a client secret in this app.
9. Rebuild / restart `next dev` after changing env.

## iPad PWA install (Safari)

1. Deploy the app on **HTTPS**.
2. Open the URL in Safari (not Chrome in-app browsers).
3. Share → **Add to Home Screen**.
4. Open the home-screen icon. It runs standalone.
5. Set a PIN in Settings (app lock only).
6. Create a recovery passphrase and run a **verified** Drive or file backup immediately.
7. Test airplane mode: create an income, kill Safari, reopen the PWA, confirm the row is still there.

## Production build

```
npm run build
npm start
```

Serve only over HTTPS. Set CSP is already applied in `next.config.ts`.
