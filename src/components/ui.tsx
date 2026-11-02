"use client";

import { cn } from "@/lib/cn";
import { formatMinor } from "@/lib/money";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "lime";
}) {
  const styles = {
    primary: "bg-forest-500 text-white hover:bg-forest-600",
    secondary: "bg-white text-forest-700 border border-forest-200 hover:bg-forest-50",
    ghost: "bg-transparent text-forest-700 hover:bg-forest-50",
    danger: "bg-red-700 text-white hover:bg-red-800",
    lime: "bg-lime-400 text-forest-900 hover:bg-lime-300",
  }[variant];
  return (
    <button
      className={cn(
        "inline-flex min-h-14 min-w-14 items-center justify-center gap-2 rounded-2xl px-5 text-base font-semibold transition disabled:opacity-50",
        styles,
        className,
      )}
      {...props}
    />
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-3xl bg-white p-5 shadow-sm ring-1 ring-forest-100", className)}>{children}</div>;
}

export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold text-forest-800">{label}</span>
      {children}
      {error ? <span className="text-sm text-red-700">{error}</span> : null}
    </label>
  );
}

const inputClass =
  "w-full min-h-14 rounded-2xl border border-forest-200 bg-white px-4 text-base text-forest-900 outline-none focus:border-lime-400 focus:ring-2 focus:ring-lime-200";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputClass, props.className)} {...props} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputClass, "min-h-28 py-3", props.className)} {...props} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(inputClass, props.className)} {...props} />;
}

export function Money({ amount, currency = "ILS", className }: { amount: number; currency?: string; className?: string }) {
  const negative = amount < 0;
  return (
    <span className={cn("font-bold tabular-nums", negative ? "text-red-700" : "text-forest-800", className)} dir="ltr">
      {formatMinor(amount, currency)}
    </span>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-forest-200 p-10 text-center text-forest-600">
      <p className="text-lg font-semibold">{title}</p>
      {hint ? <p className="mt-2 text-sm">{hint}</p> : null}
    </div>
  );
}

export function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog">
      <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-3xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-forest-800">{title}</h2>
          <Button variant="ghost" onClick={onClose} aria-label="إغلاق">
            إغلاق
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Badge({ children, tone = "forest" }: { children: ReactNode; tone?: "forest" | "lime" | "red" | "amber" }) {
  const map = {
    forest: "bg-forest-100 text-forest-800",
    lime: "bg-lime-100 text-lime-800",
    red: "bg-red-100 text-red-800",
    amber: "bg-amber-100 text-amber-800",
  }[tone];
  return <span className={cn("inline-flex rounded-full px-3 py-1 text-sm font-semibold", map)}>{children}</span>;
}
