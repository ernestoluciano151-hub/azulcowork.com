"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getDialInfoFromTimezone, type DialInfo } from "@/lib/countryCode";

const PLANS = ["Alpha","Beta","Gamma","Easy","Executiva","Personalizado"];
const TIMES = Array.from({length:21},(_,i)=>{const h=Math.floor(i/2)+8;const m=i%2===0?"00":"30";return `${String(h).padStart(2,"0")}:${m}`;});

export default function SalaBookingForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [dialInfo, setDialInfo] = useState<DialInfo>({code:"+244",flag:"🇦🇴",name:"Angola"});
  const [form, setForm] = useState({ firstName:"",lastName:"",company:"",email:"",whatsappNumber:"",planName: searchParams.get("plano") || "",participants:"",preferredTime:"",observations:"" });
  const [date, setDate] = useState<Date|undefined>();
  const [showCal, setShowCal] = useState(false);
  const [coffeeBreak, setCoffeeBreak] = useState(false);
  const [errors, setErrors] = useState<Record<string,string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string|null>(null);

  useEffect(() => {
    try { const tz = Intl.DateTimeFormat().resolvedOptions().timeZone; setDialInfo(getDialInfoFromTimezone(tz)); } catch{}
  },[]);

  function update(k: string, v: string) { setForm(p => ({...p,[k]:v})); }

  function validate() {
    const e: Record<string,string> = {};
    if(!form.firstName.trim()) e.firstName="Indique o primeiro nome.";
    if(!form.lastName.trim()) e.lastName="Indique o último nome.";
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email="E-mail inválido.";
    if(form.whatsappNumber.replace(/\D/g,"").length < 7) e.whatsapp="Número inválido.";
    if(!form.planName) e.planName="Escolha um plano.";
    setErrors(e);
    return Object.keys(e).length===0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    if(!validate()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/room-booking-leads",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        firstName:form.firstName,lastName:form.lastName,company:form.company||undefined,
        email:form.email,whatsapp:`${dialInfo.code} ${form.whatsappNumber}`,
        planName:form.planName,participants:form.participants?Number(form.participants):undefined,
        preferredDate:date?.toISOString(),preferredTime:form.preferredTime||undefined,
        observations:form.observations||undefined,coffeeBreak,
      })});
      if(!res.ok){const d=await res.json().catch(()=>({}));setServerError(d?.error||"Erro. Tente novamente.");return;}
      router.push("/obrigado");
    } catch{ setServerError("Erro de ligação."); }
    finally{ setSubmitting(false); }
  }

  const inp = (err: boolean) => `focus-ring w-full rounded-lg border bg-ink2 px-4 py-3 text-sm text-paper placeholder:text-mist/60 ${err?"border-red-400/60":"border-white/10"}`;

  return (
    <div className="max-w-xl mx-auto">
      <form onSubmit={handleSubmit} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-8 space-y-5">
        <h2 className="font-display text-xl font-bold text-paper">Formulário de Reserva</h2>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium text-paper mb-1.5">Primeiro nome *</label><input className={inp(!!errors.firstName)} value={form.firstName} onChange={e=>update("firstName",e.target.value)} placeholder="Ex: João"/>{errors.firstName&&<p className="text-xs text-red-300 mt-1">{errors.firstName}</p>}</div>
          <div><label className="block text-sm font-medium text-paper mb-1.5">Último nome *</label><input className={inp(!!errors.lastName)} value={form.lastName} onChange={e=>update("lastName",e.target.value)} placeholder="Ex: Silva"/>{errors.lastName&&<p className="text-xs text-red-300 mt-1">{errors.lastName}</p>}</div>
        </div>
        <div><label className="block text-sm font-medium text-paper mb-1.5">Empresa</label><input className={inp(false)} value={form.company} onChange={e=>update("company",e.target.value)} placeholder="Nome da empresa (opcional)"/></div>
        <div><label className="block text-sm font-medium text-paper mb-1.5">E-mail *</label><input type="email" className={inp(!!errors.email)} value={form.email} onChange={e=>update("email",e.target.value)} placeholder="email@empresa.com"/>{errors.email&&<p className="text-xs text-red-300 mt-1">{errors.email}</p>}</div>
        <div><label className="block text-sm font-medium text-paper mb-1.5">WhatsApp *</label><div className="flex gap-2"><div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-ink2 px-3 py-3 text-sm text-paper whitespace-nowrap"><span>{dialInfo.flag}</span><span className="font-medium">{dialInfo.code}</span></div><input type="tel" className={`${inp(!!errors.whatsapp)} flex-1`} value={form.whatsappNumber} onChange={e=>update("whatsappNumber",e.target.value)} placeholder="9XX XXX XXX"/></div>{errors.whatsapp&&<p className="text-xs text-red-300 mt-1">{errors.whatsapp}</p>}</div>
        <div><label className="block text-sm font-medium text-paper mb-1.5">Plano *</label><select className={inp(!!errors.planName)} value={form.planName} onChange={e=>update("planName",e.target.value)}><option value="">Escolha um plano</option>{PLANS.map(p=><option key={p} value={p}>{p}{p==="Alpha"?" — até 24 pessoas":p==="Beta"?" — até 15 pessoas":p==="Gamma"?" — até 8 pessoas":p==="Easy"?" — até 4 pessoas":p==="Executiva"?" — sala executiva (35.000 Kz/dia)":" — negociável (≥16h)"}</option>)}</select>{errors.planName&&<p className="text-xs text-red-300 mt-1">{errors.planName}</p>}</div>
        <div><label className="block text-sm font-medium text-paper mb-1.5">Nº de participantes</label><input type="number" min="1" className={inp(false)} value={form.participants} onChange={e=>update("participants",e.target.value)} placeholder="Ex: 10"/></div>
        <div><label className="block text-sm font-medium text-paper mb-1.5">Data pretendida</label><button type="button" onClick={()=>setShowCal(s=>!s)} className={`${inp(false)} flex items-center justify-between text-left`}><span className={date?"text-paper":"text-mist/60"}>{date?format(date,"PPP",{locale:ptBR}):"Selecionar data"}</span><span>📅</span></button>{showCal&&<div className="mt-3 rounded-xl border border-white/10 bg-ink2 p-3"><DayPicker mode="single" selected={date} onSelect={d=>{setDate(d);setShowCal(false);}} fromDate={new Date()} locale={ptBR}/></div>}</div>
        <div><label className="block text-sm font-medium text-paper mb-1.5">Hora pretendida</label><select className={inp(false)} value={form.preferredTime} onChange={e=>update("preferredTime",e.target.value)}><option value="">Escolha uma hora</option>{TIMES.map(t=><option key={t} value={t}>{t}</option>)}</select></div>
        <div className="flex items-start gap-3 rounded-lg border border-white/10 bg-ink2 p-4"><input type="checkbox" id="cb" checked={coffeeBreak} onChange={e=>setCoffeeBreak(e.target.checked)} className="mt-0.5 h-4 w-4 rounded"/><label htmlFor="cb" className="text-sm text-paper cursor-pointer">☕ <strong>Coffee Break</strong> <span className="text-mist">(opcional — custos adicionais aplicáveis)</span></label></div>
        <div><label className="block text-sm font-medium text-paper mb-1.5">Observações</label><textarea rows={3} className={`${inp(false)} resize-none`} value={form.observations} onChange={e=>update("observations",e.target.value)} placeholder="Descreva o seu evento ou necessidades específicas..."/></div>
        {serverError&&<p className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-300">{serverError}</p>}
        <button type="submit" disabled={submitting} className="focus-ring w-full rounded-xl bg-azul px-6 py-4 text-sm font-semibold text-white shadow-glow hover:bg-azul-dim disabled:opacity-60">
          {submitting?"A enviar...":"Agendar Reserva"}
        </button>
        <p className="text-center text-xs text-mist">Entraremos em contacto pelo WhatsApp para confirmar.</p>
      </form>
    </div>
  );
}
