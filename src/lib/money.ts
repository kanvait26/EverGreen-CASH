export const MINOR_PER_MAJOR = 100;
export const DEFAULT_CURRENCY = "ILS" as const;
export const CURRENCY_SYMBOLS: Record<string, string> = {
  ILS: "₪",
  USD: "$",
  JOD: "د.أ",
  EUR: "€",
};

export type CurrencyCode = string;

export function parseMajorToMinor(input: string | number): number {
  if (typeof input === "number") {
    if (!Number.isFinite(input) || input < 0) {
      throw new Error("قيمة غير صالحة");
    }
    return Math.round(input * MINOR_PER_MAJOR);
  }
  const raw = input.trim().replace(/,/g, "");
  if (raw.startsWith("-")) throw new Error("قيمة غير صالحة");
  if (!/^\d+(\.\d+)?$/.test(raw)) throw new Error("صيغة المبلغ غير صحيحة");
  const trimmed = raw;
  if ((trimmed.match(/\./g) ?? []).length > 1) {
    throw new Error("صيغة المبلغ غير صحيحة");
  }
  const [whole, frac = ""] = trimmed.split(".");
  const fracPadded = (frac + "00").slice(0, 2);
  const minor = Number(whole) * MINOR_PER_MAJOR + Number(fracPadded);
  if (!Number.isInteger(minor) || minor < 0) {
    throw new Error("قيمة غير صالحة");
  }
  return minor;
}

export function minorToMajorNumber(minor: number): number {
  assertMinor(minor);
  return minor / MINOR_PER_MAJOR;
}

export function formatMinor(
  minor: number,
  currency: CurrencyCode = DEFAULT_CURRENCY,
  withSymbol = true,
): string {
  assertMinor(minor);
  const negative = minor < 0;
  const abs = Math.abs(minor);
  const whole = Math.floor(abs / MINOR_PER_MAJOR);
  const frac = String(abs % MINOR_PER_MAJOR).padStart(2, "0");
  const grouped = whole.toLocaleString("en-US");
  const body = `${grouped}.${frac}`;
  const signed = negative ? `−${body}` : body;
  if (!withSymbol) return signed;
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;
  return `${signed} ${symbol}`;
}

export function assertMinor(minor: number): void {
  if (!Number.isInteger(minor)) {
    throw new Error("المبالغ تُخزَّن كأعداد صحيحة فقط");
  }
}

export function assertPositiveMinor(minor: number): void {
  assertMinor(minor);
  if (minor <= 0) {
    throw new Error("المبلغ يجب أن يكون أكبر من صفر");
  }
}

export function addMinor(a: number, b: number): number {
  assertMinor(a);
  assertMinor(b);
  return a + b;
}

export function subMinor(a: number, b: number): number {
  assertMinor(a);
  assertMinor(b);
  return a - b;
}
