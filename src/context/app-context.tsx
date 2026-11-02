"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ensureSettings, getSettings, updateSettings } from "@/lib/settings";
import { verifyPin } from "@/lib/crypto";
import type { Settings } from "@/lib/types";

interface Toast {
  id: number;
  kind: "success" | "error" | "info";
  message: string;
}

interface AppContextValue {
  ready: boolean;
  settings: Settings | null;
  online: boolean;
  locked: boolean;
  toasts: Toast[];
  refreshSettings: () => Promise<void>;
  toast: (message: string, kind?: Toast["kind"]) => void;
  dismissToast: (id: number) => void;
  unlock: (pin: string) => Promise<boolean>;
  lock: () => void;
  dirty: boolean;
  markDirty: () => void;
  clearDirty: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [online, setOnline] = useState(true);
  const [locked, setLocked] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dirty, setDirty] = useState(false);
  const toastId = React.useRef(1);

  const refreshSettings = useCallback(async () => {
    const s = await getSettings();
    setSettings(s);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await ensureSettings();
      const s = await getSettings();
      if (cancelled) return;
      setSettings(s);
      setLocked(Boolean(s.pinEnabled && s.pinHash));
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    setOnline(navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    if (!settings?.pinEnabled) return;
    const minutes = settings.autoLockMinutes || 5;
    let timer: number | undefined;
    const bump = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => setLocked(true), minutes * 60_000);
    };
    bump();
    const evts = ["pointerdown", "keydown", "touchstart"];
    evts.forEach((e) => window.addEventListener(e, bump));
    return () => {
      if (timer) window.clearTimeout(timer);
      evts.forEach((e) => window.removeEventListener(e, bump));
    };
  }, [settings?.pinEnabled, settings?.autoLockMinutes, locked]);

  const toast = useCallback((message: string, kind: Toast["kind"] = "success") => {
    const id = toastId.current++;
    setToasts((t) => [...t, { id, kind, message }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const unlock = useCallback(
    async (pin: string) => {
      const s = settings ?? (await getSettings());
      const ok = await verifyPin(pin, s.pinHash, s.pinSalt);
      if (ok) setLocked(false);
      return ok;
    },
    [settings],
  );

  const lock = useCallback(() => setLocked(true), []);

  const value = useMemo<AppContextValue>(
    () => ({
      ready,
      settings,
      online,
      locked,
      toasts,
      refreshSettings: async () => {
        const s = await updateSettings({});
        setSettings(s);
        await refreshSettings();
      },
      toast,
      dismissToast,
      unlock,
      lock,
      dirty,
      markDirty: () => setDirty(true),
      clearDirty: () => setDirty(false),
    }),
    [ready, settings, online, locked, toasts, toast, dismissToast, unlock, lock, dirty, refreshSettings],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp outside provider");
  return ctx;
}
