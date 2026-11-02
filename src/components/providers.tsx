"use client";

import { LockGate } from "@/components/lock-screen";
import { Shell } from "@/components/shell";
import { ToastProvider } from "@/components/toast";
import { startAutoBackupLoop } from "@/lib/auto-backup";
import { ensureSettings } from "@/lib/settings";
import { useEffect } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    ensureSettings().catch(() => undefined);
    const stop = startAutoBackupLoop();
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        /* do not reload automatically — unsaved form data must not be lost */
      });
    }
    return () => stop();
  }, []);
  return (
    <ToastProvider>
      <LockGate>
        <Shell>{children}</Shell>
      </LockGate>
    </ToastProvider>
  );
}
