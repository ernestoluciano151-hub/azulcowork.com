"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState, useCallback } from "react";
import Sidebar from "@/components/admin/Sidebar";
import { format } from "date-fns";

const STATUS_LABELS: Record<string,string> = { NOVO:"Novo", CONTACTADO:"Contactado", CONFIRMADO:"Confirmado", CANCELADO:"Cancelado" };
const STATUS_COLORS: Record<string,string> = { NOVO:"bg-blue-500/15 text-blue-300", CONTACTADO:"bg-amber-500/15 text-amber-300", CONFIRMADO:"bg-emerald-500/15 text-emerald-300", CANCELADO:"bg-red-500/15 text-red-300" };

export default function LeadsSalasPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState("ALL");
  const [planName, setPlanName] = useState("ALL");
  const [loading, setLoading] = useState(true);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if(status!=="ALL") params.set("status",status);
    if(planName!=="ALL") params.set("planName",planName);
    const res = await fetch(`/api/room-booking-leads?${params}`);
    if(res.ok){const d=await res.json();setLeads(d.leads);setTotal(d.total);}
    setLoading(false);
  },[status,planName]);

  useEffect(()=>{fetchLeads();},[fetchLeads]);

  async function updateStatus(id: string, newStatus: string) {
    await fetch(`/api/room-booking-leads/${id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:newStatus})});
    fetchLeads();
  }

  return (
    <div className="flex min-h-screen bg-ink">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div><h1 className="font-display text-2xl font-bold text-paper">Leads — Salas</h1><p className="mt-1 text-sm text-mist">{total} pedido(s) de agendamento de sala.</p></div>
        </div>
        <div className="flex flex-wrap gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 mb-5">
          <select value={status} onChange={e=>setStatus(e.target.value)} className="focus-ring rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper">
            <option value="ALL">Todos os estados</option>
            {Object.entries(STATUS_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
          </select>
          <select value={planName} onChange={e=>setPlanName(e.target.value)} className="focus-ring rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper">
            <option value="ALL">Todos os planos</option>
            {["Alpha","Beta","Gamma","Easy","Personalizado"].map(p=><option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.03] text-mist">
              <tr>
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Empresa</th>
                <th className="px-4 py-3 font-medium">Plano</th>
                <th className="px-4 py-3 font-medium">Participantes</th>
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3 font-medium">Hora</th>
                <th className="px-4 py-3 font-medium">Coffee</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Registo</th>
                <th className="px-4 py-3 font-medium"/>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading&&<tr><td colSpan={10} className="px-4 py-8 text-center text-mist">A carregar...</td></tr>}
              {!loading&&leads.length===0&&<tr><td colSpan={10} className="px-4 py-8 text-center text-mist">Nenhum pedido encontrado.</td></tr>}
              {leads.map(l=>(
                <tr key={l.id} className="text-paper">
                  <td className="px-4 py-3">{l.firstName} {l.lastName}<div className="text-xs text-mist">{l.email}</div></td>
                  <td className="px-4 py-3 text-mist">{l.company||"—"}</td>
                  <td className="px-4 py-3"><span className="rounded-full bg-azul/10 text-azul px-2 py-0.5 text-xs font-medium">{l.planName}</span></td>
                  <td className="px-4 py-3 text-mist">{l.participants||"—"}</td>
                  <td className="px-4 py-3">{l.preferredDate?format(new Date(l.preferredDate),"dd/MM/yyyy"):"—"}</td>
                  <td className="px-4 py-3">{l.preferredTime||"—"}</td>
                  <td className="px-4 py-3">{l.coffeeBreak?"☕ Sim":"Não"}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLORS[l.status]}`}>{STATUS_LABELS[l.status]}</span></td>
                  <td className="px-4 py-3 text-mist text-xs">{format(new Date(l.createdAt),"dd/MM/yy")}</td>
                  <td className="px-4 py-3">
                    <select value={l.status} onChange={e=>updateStatus(l.id,e.target.value)} className="focus-ring rounded border border-white/10 bg-ink px-2 py-1 text-xs text-paper">
                      {Object.entries(STATUS_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
