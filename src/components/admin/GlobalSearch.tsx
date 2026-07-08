"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";

type SearchResults = {
  companies: { id: string; name: string; email: string; planType: string; contractStatus: string }[];
  leads: { id: string; firstName: string; lastName: string; email: string; planName: string; status: string }[];
  reservations: { id: string; reservationNumber: string | null; eventName: string; companyName: string | null; startDatetime: string; status: string }[];
  payments: { id: string; receiptNumber: string | null; amount: number; status: string; company: { name: string } | null }[];
  invoices: { id: string; invoiceNumber: string; amount: number; status: string; company: { name: string } | null }[];
};

export default function GlobalSearch() {
  const [query, setQuery]   = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [open, setOpen]     = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef        = useRef<HTMLDivElement>(null);
  const timeoutRef          = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults(null); setOpen(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data);
        setOpen(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => search(query), 300);
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [query, search]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const hasResults = results && (
    results.companies.length > 0 ||
    results.leads.length > 0 ||
    results.reservations.length > 0 ||
    results.payments.length > 0 ||
    results.invoices.length > 0
  );

  return (
    <div ref={containerRef} className="relative mt-4">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] text-sm">🔍</span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (results && query.length >= 2) setOpen(true); }}
          placeholder="Pesquisar..."
          className="w-full rounded-lg border border-white/10 bg-white/[0.03] pl-8 pr-3 py-2 text-sm text-[#F5F7FA] placeholder:text-[#94A3B8]/50 focus:border-[#2F6FED]/50 focus:outline-none"
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] text-xs">...</span>
        )}
      </div>

      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-1 z-50 rounded-xl border border-white/10 bg-[#0d1829] shadow-2xl overflow-hidden max-h-96 overflow-y-auto">
          {!hasResults ? (
            <div className="px-4 py-3 text-sm text-[#94A3B8]">Nenhum resultado encontrado.</div>
          ) : (
            <div className="divide-y divide-white/5">
              {results!.companies.length > 0 && (
                <div>
                  <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] bg-white/[0.02]">Empresas</div>
                  {results!.companies.map(c => (
                    <Link key={c.id} href={`/admin/financeiro/empresa/${c.id}`} onClick={() => setOpen(false)}
                      className="flex items-center justify-between px-3 py-2 hover:bg-white/[0.04] text-sm">
                      <div>
                        <span className="text-[#F5F7FA] font-medium">{c.name}</span>
                        <span className="text-[#94A3B8] text-xs ml-2">{c.email}</span>
                      </div>
                      <span className="text-xs text-[#5C8FFF] bg-[#2F6FED]/10 px-1.5 py-0.5 rounded-full">{c.contractStatus}</span>
                    </Link>
                  ))}
                </div>
              )}
              {results!.leads.length > 0 && (
                <div>
                  <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] bg-white/[0.02]">Leads Salas</div>
                  {results!.leads.map(l => (
                    <Link key={l.id} href="/admin/leads-salas" onClick={() => setOpen(false)}
                      className="flex items-center justify-between px-3 py-2 hover:bg-white/[0.04] text-sm">
                      <div>
                        <span className="text-[#F5F7FA] font-medium">{l.firstName} {l.lastName}</span>
                        <span className="text-[#94A3B8] text-xs ml-2">{l.email}</span>
                      </div>
                      <span className="text-xs text-[#5C8FFF] bg-[#2F6FED]/10 px-1.5 py-0.5 rounded-full">{l.planName}</span>
                    </Link>
                  ))}
                </div>
              )}
              {results!.reservations.length > 0 && (
                <div>
                  <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] bg-white/[0.02]">Reservas</div>
                  {results!.reservations.map(r => (
                    <Link key={r.id} href="/admin/salas" onClick={() => setOpen(false)}
                      className="flex items-center justify-between px-3 py-2 hover:bg-white/[0.04] text-sm">
                      <div>
                        <span className="text-[#F5F7FA] font-medium">{r.reservationNumber || r.eventName}</span>
                        <span className="text-[#94A3B8] text-xs ml-2">{r.companyName}</span>
                      </div>
                      <span className="text-xs text-[#94A3B8]">{new Date(r.startDatetime).toLocaleDateString("pt-PT")}</span>
                    </Link>
                  ))}
                </div>
              )}
              {results!.payments.length > 0 && (
                <div>
                  <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] bg-white/[0.02]">Pagamentos</div>
                  {results!.payments.map(p => (
                    <Link key={p.id} href="/admin/pagamentos" onClick={() => setOpen(false)}
                      className="flex items-center justify-between px-3 py-2 hover:bg-white/[0.04] text-sm">
                      <div>
                        <span className="text-[#F5F7FA] font-medium">{p.receiptNumber || p.id.slice(0, 8)}</span>
                        <span className="text-[#94A3B8] text-xs ml-2">{p.company?.name}</span>
                      </div>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${p.status === "PAGO" ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}>{p.status}</span>
                    </Link>
                  ))}
                </div>
              )}
              {results!.invoices.length > 0 && (
                <div>
                  <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] bg-white/[0.02]">Facturas</div>
                  {results!.invoices.map(inv => (
                    <Link key={inv.id} href="/admin/pagamentos" onClick={() => setOpen(false)}
                      className="flex items-center justify-between px-3 py-2 hover:bg-white/[0.04] text-sm">
                      <div>
                        <span className="text-[#F5F7FA] font-medium">{inv.invoiceNumber}</span>
                        <span className="text-[#94A3B8] text-xs ml-2">{inv.company?.name}</span>
                      </div>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${inv.status === "PAGO" ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}>{inv.status}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
