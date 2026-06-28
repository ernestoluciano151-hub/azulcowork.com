"use client";

import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";

const STATUS_COLORS: Record<string, string> = {
  NOVO: "#3b82f6",
  CONTACTADO: "#f59e0b",
  EM_NEGOCIACAO: "#a855f7",
  CONVERTIDO: "#22c55e",
  PERDIDO: "#ef4444"
};

const STATUS_LABELS: Record<string, string> = {
  NOVO: "Novo",
  CONTACTADO: "Contactado",
  EM_NEGOCIACAO: "Em negociação",
  CONVERTIDO: "Convertido",
  PERDIDO: "Perdido"
};

export default function LeadsChart() {
  const [data, setData] = useState<{
    last7: { day: string; count: number }[];
    byStatus: { status: string; _count: { id: number } }[];
  } | null>(null);

  useEffect(() => {
    fetch("/api/admin/stats").then((r) => r.json()).then(setData);
  }, []);

  if (!data) return (
    <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
      {[1, 2].map((i) => (
        <div key={i} className="h-64 rounded-2xl border border-white/10 bg-white/[0.03] animate-pulse" />
      ))}
    </div>
  );

  const pieData = data.byStatus.map((s) => ({
    name: STATUS_LABELS[s.status] || s.status,
    value: s._count.id,
    color: STATUS_COLORS[s.status] || "#64748b"
  }));

  return (
    <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Gráfico de barras - leads por dia */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="font-display text-base font-bold text-paper mb-4">Leads — últimos 7 dias</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data.last7}>
            <XAxis dataKey="day" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#e2e8f0" }}
              cursor={{ fill: "rgba(255,255,255,0.05)" }}
            />
            <Bar dataKey="count" name="Leads" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Gráfico de pizza - por status */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="font-display text-base font-bold text-paper mb-4">Leads por estado</h2>
        {pieData.length === 0 ? (
          <p className="mt-8 text-center text-sm text-mist">Sem dados ainda.</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} paddingAngle={3}>
                {pieData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#e2e8f0" }}
              />
              <Legend formatter={(value) => <span style={{ color: "#94a3b8", fontSize: 12 }}>{value}</span>} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
