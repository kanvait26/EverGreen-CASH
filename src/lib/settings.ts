import { getDb } from "@/db";
import { nowIso } from "@/lib/ids";
import type { Settings } from "@/lib/types";
import { DEFAULT_CURRENCY } from "@/lib/money";

export const DEFAULT_SETTINGS: Settings = {
  id: "app",
  companyName: "EVER GREEN AGRICULTURAL CONTRACTORS",
  companyNameAr: "إيفر غرين للمقاولات الزراعية",
  logoDataUrl: "/logo.jpg",
  address: "",
  phone: "",
  defaultCurrency: DEFAULT_CURRENCY,
  invoicePrefix: "EG-",
  invoiceNextNumber: 1,
  invoiceFooter: "شكراً لتعاملكم معنا",
  autoBackupEnabled: true,
  backupIntervalMinutes: 30,
  pinEnabled: false,
  pinHash: "",
  pinSalt: "",
  autoLockMinutes: 5,
  lastBackupAt: null,
  lastBackupVerified: false,
  googleAccountEmail: null,
  createdAt: "",
  updatedAt: "",
};

export async function ensureSettings(): Promise<Settings> {
  const db = getDb();
  const existing = await db.settings.get("app");
  if (existing) return existing;
  const now = nowIso();
  const settings: Settings = { ...DEFAULT_SETTINGS, createdAt: now, updatedAt: now };
  await db.settings.put(settings);
  await db.referenceCounters.put({ id: "ledger", lastValue: 0 });
  await db.referenceCounters.put({ id: "invoice", lastValue: 0 });
  return settings;
}

export async function getSettings(): Promise<Settings> {
  return ensureSettings();
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const db = getDb();
  const current = await ensureSettings();
  const next: Settings = { ...current, ...patch, id: "app", updatedAt: nowIso() };
  await db.settings.put(next);
  return next;
}
