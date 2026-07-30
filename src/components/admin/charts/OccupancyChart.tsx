"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import ChartSkeleton from "./ChartSkeleton";

type MonthData = {
  month: string;
  bookedHours: number;
  availableHours: number;
  rate: number;
};

function shortMonth(key: string): string {
  const [year, month] = key.split("-");
  const d = new Date(parseInt(year), parseInt(month) - 1, 1);
  return d.toLocaleDateString("pt-AO", { month: "short" }).replace(".", "");
}

export default function OccupancyChart({ months = 12 }: { months?: number }) {
  const [data, setData] = useState<{ months: MonthData[]; avgRate: number } | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`/api/bi/occupancy?months=${months}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setError(true));
  }, [months]);

  if (error)
    return <p className="text-xs text-red-400 mt-2">Erro ao carregar dados de ocupação.</p>;
  if (!data) return <ChartSkeleton height={240} />;

  const chartData = data.months.map((m) => ({
    name: shortMonth(m.month),
    "Taxa (%)": m.rate,
    "Horas reservadas": m.bookedHours,
  }));

  return (
    <div>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis
            dataKey="name"
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) => `${v}%`}
            domain={[0, 100]}
            tick={{ fill: "#94a3b8", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1e293b",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "8px",
              fontSize: "12px",
              color: "#e2e8f0",
            }}
            formatter={(value: number, name: string) =>
              name === "Taxa (%)" ? `${value}%` : `${value}h`
            }
          />
          <ReferenceLine
            y={data.avgRate}
            stroke="#60A5FA"
            strokeDasharray="4 4"
            label={{
              value: `Média ${data.avgRate}%`,
              position: "insideTopRight",
              fill: "#60A5FA",
              fontSize: 10,
            }}
          />
          <Line
            type="monotone"
            dataKey="Taxa (%)"
            stroke="#60A5FA"
            strokeWidth={2}
            dot={{ fill: "#60A5FA", r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="mt-2 text-xs text-mist">
        Taxa média de ocupação: <strong className="text-blue-300">{data.avgRate}%</strong>
      </p>
    </div>
  );
}
