"use client";

import type { ReactNode } from "react";

type Variant = "default" | "success" | "warning" | "danger" | "info";

const VARIANT_STYLES: Record<Variant, { card: string; label: string; value: string }> = {
  default:  { card: "border-white/10 bg-white/[0.03]",          label: "text-mist",        value: "text-paper" },
  success:  { card: "border-emerald-500/20 bg-emerald-500/5",   label: "text-emerald-400", value: "text-emerald-300" },
  warning:  { card: "border-amber-500/20 bg-amber-500/5",       label: "text-amber-400",   value: "text-amber-300" },
  danger:   { card: "border-red-500/20 bg-red-500/5",           label: "text-red-400",     value: "text-red-300" },
  info:     { card: "border-blue-500/20 bg-blue-500/5",         label: "text-blue-400",    value: "text-blue-300" },
};

export default function KpiCard({
  label,
  value,
  sub,
  icon,
  variant = "default",
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  icon?: string;
  variant?: Variant;
}) {
  const s = VARIANT_STYLES[variant];
  return (
    <div className={`rounded-2xl border p-5 ${s.card}`}>
      <div className="flex items-start justify-between gap-2">
        <p className={`text-xs font-semibold uppercase tracking-wider ${s.label}`}>{label}</p>
        {icon && <span className="text-lg leading-none">{icon}</span>}
      </div>
      <p className={`mt-2 font-display text-2xl font-bold ${s.value}`}>{value}</p>
      {sub && <p className={`mt-1 text-[11px] ${s.label} opacity-70`}>{sub}</p>}
    </div>
  );
}
