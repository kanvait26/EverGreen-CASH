import { endOfDay, endOfMonth, endOfWeek, startOfDay, startOfMonth, startOfWeek, subDays } from "date-fns";

export type PeriodKey = "today" | "week" | "month" | "custom";

export function periodRange(key: PeriodKey, from?: string, to?: string): { fromIso: string; toIso: string } {
  const now = new Date();
  if (key === "today") {
    return { fromIso: startOfDay(now).toISOString(), toIso: endOfDay(now).toISOString() };
  }
  if (key === "week") {
    return {
      fromIso: startOfWeek(now, { weekStartsOn: 6 }).toISOString(),
      toIso: endOfWeek(now, { weekStartsOn: 6 }).toISOString(),
    };
  }
  if (key === "month") {
    return { fromIso: startOfMonth(now).toISOString(), toIso: endOfMonth(now).toISOString() };
  }
  const start = from ? startOfDay(new Date(from)) : subDays(now, 30);
  const end = to ? endOfDay(new Date(to)) : endOfDay(now);
  return { fromIso: start.toISOString(), toIso: end.toISOString() };
}

export function datetimeLocalValue(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromDatetimeLocal(value: string): string {
  return new Date(value).toISOString();
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" });
}

export function formatDate(iso: string): string {
  const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("ar-EG", { dateStyle: "medium" });
}
