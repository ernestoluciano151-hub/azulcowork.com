"use client";

import { useEffect, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import ChartSkeleton from "./ChartSkeleton";

type PaymentSummaryResponse = {
  coworking: {
    paid:    { count: number; total: number };
    pending: { count: number; total: number };
    overdue: { count: number; total: number };
  };
  sala: {
    paid:    { count: number; total: number };
    pending: { count: number; total: number };
  };
  combined: {
    totalRevenue: number;
    totalPending: number;
    totalOverdue: number;
  };
};

function fmtKz(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M Kz`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}K Kz`;
  return `${v.toLocaleString("pt-AO")} Kz`;
}

const COLORS = {
  Recebido: "#10b981",
  Pendente: "#f59e0b",
  Atrasado: "#ef4444",
};

export default function PaymentStatusChart() {
  const [data, setData] = useState<PaymentSummaryResponse | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/bi/payments-summary")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setError(true));
  }, []);

  if (error)
    return (
      <p className="text-xs text-red-400 mt-2">Erro ao carregar dados de pagamentos.</p>
    );
  if (!data) return <ChartSkeleton height={200} />;

  const { combined, coworking } = data;

  const chartData = [
    { name: "Recebido", value: combined.totalRevenue },
    { name: "Pendente", value: combined.totalPending },
    ...(combined.totalOverdue > 0
      ? [{ name: "Atrasado", value: combined.totalOverdue }]
      : []),
  ].filter((d) => d.value > 0);

  return (
    <div>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
          >
            {chartData.map((entry) => (
              <Cell key={entry.name} fill={COLORS[entry.name as keyof typeof COLORS] ?? "#64748b"} />
            ))}
          </Pie>
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
            wrapperStyle={{ fontSize: "12px", color: "#94a3b8", paddingTop: "4px" }}
            formatter={(value) => value}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-1 text-xs text-mist space-y-0.5">
        <p>
          Recebido: <strong className="text-emerald-300">{fmtKz(combined.totalRevenue)}</strong>
        </p>
        {combined.totalPending > 0 && (
          <p>
            Pendente: <strong className="text-amber-300">{fmtKz(combined.totalPending)}</strong>
            {" "}({coworking.pending.count} pagamentos CRM)
          </p>
        )}
        {combined.totalOverdue > 0 && (
          <p>
            Em atraso: <strong className="text-red-300">{fmtKz(combined.totalOverdue)}</strong>
            {" "}({coworking.overdue.count} pagamentos)
          </p>
        )}
      </div>
    </div>
  );
}
