"use client";

import { Button, Input } from "@/components/ui";
import { verifyPin } from "@/lib/crypto";
import { getSettings } from "@/lib/settings";
import { useEffect, useState } from "react";

const UNLOCK_KEY = "eg_unlocked_at";

export function LockGate({ children }: { children: React.ReactNode }) {
  const [locked, setLocked] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [hash, setHash] = useState("");
  const [salt, setSalt] = useState("");
  const [minutes, setMinutes] = useState(5);

  useEffect(() => {
    let cancelled = false;
    getSettings().then((s) => {
      if (cancelled || !s.pinEnabled || !s.pinHash) return;
      setHash(s.pinHash);
      setSalt(s.pinSalt);
      setMinutes(s.autoLockMinutes || 5);
      const last = Number(sessionStorage.getItem(UNLOCK_KEY) ?? 0);
      const idleMs = (s.autoLockMinutes || 5) * 60_000;
      if (!last || Date.now() - last > idleMs) setLocked(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hash) return;
    const onVis = () => {
      const last = Number(sessionStorage.getItem(UNLOCK_KEY) ?? 0);
      if (Date.now() - last > minutes * 60_000) setLocked(true);
    };
    document.addEventListener("visibilitychange", onVis);
    const t = window.setInterval(onVis, 15_000);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(t);
    };
  }, [hash, minutes]);

  if (!locked) return <>{children}</>;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-forest-800 p-6 text-white">
      <img src="/logo.jpg" alt="EverGreen" className="mb-6 h-28 w-28 rounded-3xl object-cover" />
      <h1 className="mb-2 text-2xl font-bold">EverGreen CASH</h1>
      <p className="mb-6 max-w-sm text-center text-sm text-forest-100">
        قفل على مستوى التطبيق فقط، وليس تشفيراً للجهاز. أدخل رمز PIN للمتابعة.
      </p>
      <form
        className="w-full max-w-sm space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          const ok = await verifyPin(pin, hash, salt);
          if (!ok) {
            setError("رمز غير صحيح");
            return;
          }
          sessionStorage.setItem(UNLOCK_KEY, String(Date.now()));
          setLocked(false);
          setPin("");
        }}
      >
        <Input
          inputMode="numeric"
          autoComplete="off"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="PIN"
          className="text-center tracking-[0.4em] text-forest-900"
        />
        {error ? <p className="text-center text-lime-200">{error}</p> : null}
        <Button type="submit" variant="lime" className="w-full">
          فتح
        </Button>
      </form>
    </div>
  );
}
