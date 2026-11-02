"use client";

import { NAV } from "@/lib/labels";
import { cn } from "@/lib/cn";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

function Icon({ name }: { name: string }) {
  const common = "h-6 w-6";
  switch (name) {
    case "home":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 10.5 12 4l8 6.5V20H4z" />
        </svg>
      );
    case "list":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
        </svg>
      );
    case "users":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="9" cy="8" r="3" />
          <path d="M3 19a6 6 0 0 1 12 0M17 8a3 3 0 1 1 0 6M21 19a5 5 0 0 0-4-4.9" />
        </svg>
      );
    case "file":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M7 3h8l5 5v13H7z" />
          <path d="M15 3v5h5" />
        </svg>
      );
    case "scale":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 3v18M4 7h16M7 7l-3 8h6L7 7zm10 0 3 8h-6l3-8z" />
        </svg>
      );
    case "chart":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 20V10M12 20V4M20 20v-7" />
        </svg>
      );
    case "cloud":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M7 18h10a4 4 0 0 0 0-8 6 6 0 0 0-11-2A4 4 0 0 0 7 18z" />
        </svg>
      );
    default:
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
        </svg>
      );
  }
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [online, setOnline] = useState(true);
  const [more, setMore] = useState(false);
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  const primary = NAV.slice(0, 3);
  const rest = NAV.slice(3);

  return (
    <div className="min-h-screen bg-[#f4f7f5] text-forest-900">
      <aside className="fixed inset-y-0 right-0 z-30 hidden w-72 flex-col bg-forest-800 p-5 text-white lg:flex">
        <div className="mb-8 flex items-center gap-3">
          <img src="/logo.jpg" alt="EverGreen" className="h-14 w-14 rounded-2xl object-cover" />
          <div>
            <p className="text-lg font-bold leading-tight">EverGreen CASH</p>
            <p className="text-xs text-forest-100">إيفر غرين للمقاولات الزراعية</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((item) => {
            const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-h-12 items-center gap-3 rounded-2xl px-4 text-base font-semibold",
                  active ? "bg-lime-400 text-forest-900" : "text-white hover:bg-forest-700",
                )}
              >
                <Icon name={item.icon} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <p className={`mt-4 rounded-2xl px-3 py-2 text-center text-sm ${online ? "bg-forest-700" : "bg-amber-600"}`}>
          {online ? "متصل — النسخ الاحتياطي متاح" : "غير متصل — العمل محلي بالكامل"}
        </p>
      </aside>

      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 bg-forest-800 px-4 py-3 text-white lg:hidden">
        <div className="flex items-center gap-3">
          <img src="/logo.jpg" alt="" className="h-10 w-10 rounded-xl object-cover" />
          <span className="font-bold">EverGreen CASH</span>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs ${online ? "bg-lime-400 text-forest-900" : "bg-amber-400 text-forest-900"}`}>
          {online ? "متصل" : "غير متصل"}
        </span>
      </header>

      <main className="px-4 pb-28 pt-4 lg:mr-72 lg:px-8 lg:pb-10 lg:pt-8">{children}</main>

      {more ? (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setMore(false)}>
          <div className="absolute inset-x-0 bottom-20 rounded-t-3xl bg-white p-4" onClick={(e) => e.stopPropagation()}>
            {rest.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex min-h-14 items-center gap-3 rounded-2xl px-3 text-lg font-semibold text-forest-800"
                onClick={() => setMore(false)}
              >
                <Icon name={item.icon} />
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 gap-1 border-t border-forest-200 bg-white p-2 lg:hidden">
        {primary.map((item) => {
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center rounded-2xl text-xs font-semibold",
                active ? "bg-forest-500 text-white" : "text-forest-700",
              )}
            >
              <Icon name={item.icon} />
              {item.label}
            </Link>
          );
        })}
        <button
          className="flex min-h-14 flex-col items-center justify-center rounded-2xl text-xs font-semibold text-forest-700"
          onClick={() => setMore(true)}
        >
          <Icon name="gear" />
          المزيد
        </button>
      </nav>
    </div>
  );
}
