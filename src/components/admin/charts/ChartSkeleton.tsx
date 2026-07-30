"use client";

export default function ChartSkeleton({ height = 220 }: { height?: number }) {
  return (
    <div
      className="animate-pulse rounded-xl bg-white/5"
      style={{ height }}
      aria-label="A carregar gráfico..."
    />
  );
}
