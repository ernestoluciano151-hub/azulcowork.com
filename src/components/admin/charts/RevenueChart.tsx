"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import ChartSkeleton from "./ChartSkeleton";

type MonthData = {
  month: string;
  coworking: number;
  sala: number;
  total: number;
};

type RevenueResponse = {
  months: MonthData[];
  totals: { coworking: number; sala: number; total: number };
};

function shortMonth(key: string): string {
  const [year, month] = key.split("-");
  const d = new Date(parseInt(year), parseInt(month) - 1, 1);
  return d.toLocaleDateString("pt-AO", { month: "short" }).replace(".", "");
}

function fmtKz(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M Kz`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}K Kz`;
  return `${v.toLocaleString("pt-AO")} Kz`;
}

export default function RevenueChart({ months = 12 }: { months?: number }) {
  const [data, setData] = useState<RevenueResponse | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`/api/bi/revenue?months=${months}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setError(true));
  }, [months]);

  if (error)
    return (
      <p className="text-xs text-red-400 mt-2">
        Erro ao carregar dados de receita.
      </p>
    );
  if (!data) return <ChartSkeleton height={240} />;

  const chartData = data.months.map((m) => ({
    name: shortMonth(m.month),
    Coworking: m.coworking,
    Sala: m.sala,
  }));

  return (
    <div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis
            dataKey="name"
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={fmtKz}
            tick={{ fill: "#94a3b8", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={70}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1e293b",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "8px",
              fontSize: "12px",
              color: "#e2e8f0",
            }}
            formatter={(value: number) => fmtKz(value)}
          />
          <Legend
            wrapperStyle={{ fontSize: "12px", color: "#94a3b8", paddingTop: "8px" }}
          />
          <Bar dataKey="Coworking" stackId="rev" fill="#3B82F6" radius={[0, 0, 0, 0]} />
          <Bar dataKey="Sala"      stackId="rev" fill="#10B981" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-3 flex gap-6 text-xs text-mist">
        <span>Total acumulado: <strong className="text-paper">{fmtKz(data.totals.total)}</strong></span>
        <span>Coworking: <strong className="text-blue-300">{fmtKz(data.totals.coworking)}</strong></span>
        <span>Sala: <strong className="text-emerald-300">{fmtKz(data.totals.sala)}</strong></span>
      </div>
    </div>
  );
}
