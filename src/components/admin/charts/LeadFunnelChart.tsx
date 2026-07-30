"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from "recharts";
import ChartSkeleton from "./ChartSkeleton";

type LeadsResponse = {
  funnel: {
    total: number;
    novo: number;
    contactado: number;
    proposta: number;
    negociacao: number;
    convertido: number;
    perdido: number;
  };
  conversionRate: number;
  avgDaysToConvert: number;
};

const STAGE_COLORS: Record<string, string> = {
  "Novos":       "#64748b",
  "Contactados": "#6366f1",
  "Proposta":    "#8b5cf6",
  "Negociação":  "#f59e0b",
  "Convertidos": "#10b981",
  "Perdidos":    "#ef4444",
};

export default function LeadFunnelChart() {
  const [data, setData] = useState<LeadsResponse | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/bi/leads")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setError(true));
  }, []);

  if (error)
    return <p className="text-xs text-red-400 mt-2">Erro ao carregar funil de leads.</p>;
  if (!data) return <ChartSkeleton height={200} />;

  const { funnel } = data;
  const chartData = [
    { name: "Novos",       value: funnel.novo },
    { name: "Contactados", value: funnel.contactado },
    { name: "Proposta",    value: funnel.proposta },
    { name: "Negociação",  value: funnel.negociacao },
    { name: "Convertidos", value: funnel.convertido },
    { name: "Perdidos",    value: funnel.perdido },
  ];

  return (
    <div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.06)"
            horizontal={false}
          />
          <XAxis
            type="number"
            tick={{ fill: "#94a3b8", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={82}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1e293b",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "8px",
              fontSize: "12px",
              color: "#e2e8f0",
            }}
          />
          <Bar dataKey="value" name="Leads" radius={[0, 4, 4, 0]}>
            {chartData.map((entry) => (
              <Cell key={entry.name} fill={STAGE_COLORS[entry.name] ?? "#64748b"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-2 flex gap-6 text-xs text-mist">
        <span>Total: <strong className="text-paper">{funnel.total}</strong></span>
        <span>Taxa conversão: <strong className="text-emerald-300">{data.conversionRate}%</strong></span>
        {data.avgDaysToConvert > 0 && (
          <span>Tempo médio: <strong className="text-paper">{data.avgDaysToConvert} dias</strong></span>
        )}
      </div>
    </div>
  );
}
