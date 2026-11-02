import { getSettings } from "@/lib/settings";
import { tryAutoBackup } from "@/lib/drive";

const PASS_SESSION = "eg_backup_pass_session";
const LAST_TRY = "eg_last_auto_backup_try";

export function rememberPassphrase(pass: string) {
  sessionStorage.setItem(PASS_SESSION, pass);
}

export function startAutoBackupLoop() {
  const run = async () => {
    if (!navigator.onLine) return;
    const settings = await getSettings();
    if (!settings.autoBackupEnabled) return;
    const last = Number(sessionStorage.getItem(LAST_TRY) ?? 0);
    const intervalMs = Math.max(5, settings.backupIntervalMinutes) * 60_000;
    if (Date.now() - last < intervalMs && last !== 0) return;
    const ok = await tryAutoBackup(() => sessionStorage.getItem(PASS_SESSION));
    if (ok) sessionStorage.setItem(LAST_TRY, String(Date.now()));
  };

  window.addEventListener("online", () => {
    run().catch(() => undefined);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") run().catch(() => undefined);
  });
  window.addEventListener("focus", () => {
    run().catch(() => undefined);
  });
  run().catch(() => undefined);
  const id = window.setInterval(() => {
    run().catch(() => undefined);
  }, 5 * 60_000);
  return () => window.clearInterval(id);
}
