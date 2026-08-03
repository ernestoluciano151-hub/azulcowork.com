// Cria o utilizador admin inicial a partir do .env (ADMIN_EMAIL / ADMIN_PASSWORD)
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL || "admin@versaodigital.ao";
  const password = process.env.ADMIN_PASSWORD || "MudeEstaSenha123!";
  const passwordHash = await bcrypt.hash(password, 12);

  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin já existe: ${email}`);
  } else {
    await prisma.adminUser.create({
      data: { email, passwordHash, name: "Administrador" }
    });
    console.log(`Admin criado: ${email}`);
  }

  // Seed MeetingPlans (single room with plans)
  const plans = [
    { name: "Alpha", maxPeople: 24, description: "Sala climatizada para até 24 pessoas. Inclui projetor, internet de alta velocidade, impressões limitadas e ambiente profissional.", coffeeBreakAvailable: true, customPricingAllowed: false },
    { name: "Beta", maxPeople: 15, description: "Sala climatizada para até 15 pessoas. Inclui projetor, internet de alta velocidade, impressões limitadas e ambiente profissional.", coffeeBreakAvailable: true, customPricingAllowed: false },
    { name: "Gamma", maxPeople: 8, description: "Sala climatizada para até 8 pessoas. Inclui projetor, internet de alta velocidade, impressões limitadas e ambiente profissional.", coffeeBreakAvailable: true, customPricingAllowed: false },
    { name: "Easy", maxPeople: 4, description: "Sala climatizada para até 4 pessoas. Inclui projetor, internet de alta velocidade, impressões limitadas e ambiente profissional.", coffeeBreakAvailable: true, customPricingAllowed: false },
    { name: "Executiva", maxPeople: 6, description: "Sala executiva privativa, reservada por diária (35.000 Kz/dia). Ambiente premium para reuniões de direcção e encontros estratégicos.", coffeeBreakAvailable: true, customPricingAllowed: false, fullDayPrice: 35000 },
    { name: "Personalizado", maxPeople: 24, description: "Plano especial para reuniões, formações e eventos corporativos com mais de 16 horas. Valores negociáveis.", coffeeBreakAvailable: true, customPricingAllowed: true, minHoursForCustom: 16 },
  ];

  for (const plan of plans) {
    const existing = await prisma.meetingPlan.findFirst({ where: { name: plan.name } });
    if (!existing) {
      await prisma.meetingPlan.create({ data: plan });
      console.log(`Plano criado: ${plan.name}`);
    } else {
      console.log(`Plano já existe: ${plan.name}`);
    }
  }

  // ── ERP Seed (Volume 02) ────────────────────────────────────────────────────

  // Centros de Custo (ADR-024 — estrutura plana)
  const costCenters = [
    { code: "OPERACIONAL", name: "Operações",             description: "Renda, utilidades, limpeza, segurança, manutenção",        budget: 250000 },
    { code: "RH",          name: "Recursos Humanos",      description: "Salários, encargos sociais, benefícios",                   budget: 400000 },
    { code: "MARKETING",   name: "Marketing",             description: "Digital, publicidade, eventos e networking",               budget: 80000  },
    { code: "TI",          name: "Tecnologia",            description: "Servidores, domínios, licenças, desenvolvimento",          budget: 60000  },
    { code: "ADMIN",       name: "Administração",         description: "Material escritório, seguros, jurídico, comunicações",     budget: 50000  },
    { code: "FINANCEIRO",  name: "Financeiro",            description: "Juros, perdas, rendimentos financeiros",                   budget: null   },
    { code: "COWORKING",   name: "Receita Coworking",     description: "Mensalidades de contratos de coworking",                   budget: null   },
    { code: "SALAS",       name: "Receita Salas",         description: "Receitas de reservas de salas de reunião",                 budget: null   },
    { code: "SERVICOS",    name: "Receita Serviços",      description: "Impressão, café, domiciliação fiscal e endereço comercial", budget: null  },
  ];

  for (const cc of costCenters) {
    const existing = await prisma.costCenter.findUnique({ where: { code: cc.code } });
    if (!existing) {
      await prisma.costCenter.create({ data: cc });
      console.log(`CostCenter criado: ${cc.code}`);
    } else {
      console.log(`CostCenter já existe: ${cc.code}`);
    }
  }

  // Categorias de Despesa (PGC Angola — Classe 6)
  const expenseCategories = [
    { name: "Renda do Imóvel",          accountCode: "6111" },
    { name: "Electricidade (ENDE)",     accountCode: "6121" },
    { name: "Água (EPAL)",              accountCode: "6122" },
    { name: "Internet / Telecom",       accountCode: "6123" },
    { name: "Limpeza e Higiene",        accountCode: "6124" },
    { name: "Segurança",                accountCode: "6125" },
    { name: "Salários",                 accountCode: "6211" },
    { name: "INSS / Encargos Sociais",  accountCode: "6212" },
    { name: "Subsídios e Benefícios",   accountCode: "6213" },
    { name: "Marketing Digital",        accountCode: "6311" },
    { name: "Publicidade e Promoção",   accountCode: "6312" },
    { name: "Eventos e Networking",     accountCode: "6313" },
    { name: "Servidores / Cloud",       accountCode: "6411" },
    { name: "Domínios e Certificados",  accountCode: "6412" },
    { name: "Licenças de Software",     accountCode: "6413" },
    { name: "Desenvolvimento",          accountCode: "6414" },
    { name: "Material de Escritório",   accountCode: "6511" },
    { name: "Seguros",                  accountCode: "6512" },
    { name: "Serviços Jurídicos",       accountCode: "6513" },
    { name: "Comunicações Gerais",      accountCode: "6514" },
    { name: "Manutenção e Reparações",  accountCode: "6611" },
    { name: "Outros",                   accountCode: "6514" },
  ];

  for (const cat of expenseCategories) {
    const existing = await prisma.expenseCategory.findUnique({ where: { name: cat.name } });
    if (!existing) {
      await prisma.expenseCategory.create({ data: cat });
      console.log(`ExpenseCategory criada: ${cat.name}`);
    } else {
      console.log(`ExpenseCategory já existe: ${cat.name}`);
    }
  }

  // DocumentCounters ERP — todos os tipos necessários em produção
  const erpCounters = [
    { type: "FT-CWORK", year: new Date().getFullYear() },  // Faturas coworking
    { type: "FT-SALA",  year: new Date().getFullYear() },  // Faturas salas de reunião
    { type: "FT-SERV",  year: new Date().getFullYear() },  // Faturas serviços
    { type: "REC",      year: new Date().getFullYear() },  // Recibos de pagamento
    { type: "NL",       year: new Date().getFullYear() },  // Notas de liquidação
    { type: "RES",      year: new Date().getFullYear() },  // Números de reserva
  ];

  for (const counter of erpCounters) {
    const existing = await prisma.documentCounter.findUnique({
      where: { type_year: { type: counter.type, year: counter.year } }
    });
    if (!existing) {
      await prisma.documentCounter.create({ data: { type: counter.type, year: counter.year, lastSeq: 0 } });
      console.log(`DocumentCounter criado: ${counter.type}-${counter.year}`);
    } else {
      console.log(`DocumentCounter já existe: ${counter.type}-${counter.year}`);
    }
  }

  console.log("\n✅ Seed ERP (Volume 02) concluído.");

  // ── Portal Seed (Volume 03) ─────────────────────────────────────────────────

  // DocumentCounter para tickets de suporte (ST-YYYY-NNNNNN)
  const portalCounters = [
    { type: "ST", year: new Date().getFullYear() },
  ];

  for (const counter of portalCounters) {
    const existing = await prisma.documentCounter.findUnique({
      where: { type_year: { type: counter.type, year: counter.year } }
    });
    if (!existing) {
      await prisma.documentCounter.create({ data: { type: counter.type, year: counter.year, lastSeq: 0 } });
      console.log(`DocumentCounter criado: ${counter.type}-${counter.year}`);
    } else {
      console.log(`DocumentCounter já existe: ${counter.type}-${counter.year}`);
    }
  }

  console.log("\n✅ Seed Portal (Volume 03) concluído.");

  // ── VOL07 Seed — EmailTemplate (Comunicação Avançada) ──────────────────────

  const emailTemplates = [
    {
      slug:      "lead-new-coworking",
      name:      "Novo Lead — Coworking",
      subject:   "🔔 Novo lead coworking: {{firstName}} {{lastName}}",
      category:  "crm",
      variables: ["firstName", "lastName", "email", "whatsapp", "scheduledDate", "spaceType", "planName", "appointmentType", "source", "adminUrl"],
      htmlBody: `<!DOCTYPE html>
<html lang="pt"><head><meta charset="UTF-8"><title>Novo Lead Coworking</title></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;font-size:14px;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:8px;overflow:hidden;">
      <tr><td style="background:#1e3a5f;padding:24px 32px;">
        <p style="margin:0;color:#fff;font-size:20px;font-weight:bold;">🎉 Novo Lead — Coworking</p>
        <p style="margin:4px 0 0;color:#93c5fd;font-size:12px;">Azul Coworking · Luanda</p>
      </td></tr>
      <tr><td style="padding:28px 32px;color:#e2e8f0;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:8px 0;border-bottom:1px solid #1e293b;color:#94a3b8;width:140px;">Nome</td><td style="padding:8px 0 8px 12px;font-weight:500;">{{firstName}} {{lastName}}</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #1e293b;color:#94a3b8;">E-mail</td><td style="padding:8px 0 8px 12px;"><a href="mailto:{{email}}" style="color:#5C8FFF;">{{email}}</a></td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #1e293b;color:#94a3b8;">WhatsApp</td><td style="padding:8px 0 8px 12px;color:#22c55e;">{{whatsapp}}</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #1e293b;color:#94a3b8;">Agendamento</td><td style="padding:8px 0 8px 12px;color:#22c55e;">{{scheduledDate}}</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #1e293b;color:#94a3b8;">Tipo de espaço</td><td style="padding:8px 0 8px 12px;">{{spaceType}}</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #1e293b;color:#94a3b8;">Plano interesse</td><td style="padding:8px 0 8px 12px;">{{planName}}</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #1e293b;color:#94a3b8;">Tipo contacto</td><td style="padding:8px 0 8px 12px;">{{appointmentType}}</td></tr>
          <tr><td style="padding:8px 0;color:#94a3b8;">Fonte</td><td style="padding:8px 0 8px 12px;">{{source}}</td></tr>
        </table>
        <p style="margin-top:20px;"><a href="{{adminUrl}}" style="background:#2F6FED;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:700;font-size:13px;">Ver no CRM →</a></p>
        <p style="font-size:11px;color:#475569;margin-top:16px;">Azul Coworking · Bairro Azul, Edifício 18, Luanda</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`,
    },
    {
      slug:      "lead-new-sala",
      name:      "Novo Pedido de Sala — Reunião",
      subject:   "🏨 Pedido de sala: {{firstName}} {{lastName}} — Plano {{planName}}",
      category:  "crm",
      variables: ["firstName", "lastName", "email", "whatsapp", "company", "planName", "participants", "preferredDate", "preferredTime", "coffeeBreak", "observations", "adminUrl"],
      htmlBody: `<!DOCTYPE html>
<html lang="pt"><head><meta charset="UTF-8"><title>Pedido de Sala</title></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;font-size:14px;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:8px;overflow:hidden;">
      <tr><td style="background:#1e3a5f;padding:24px 32px;">
        <p style="margin:0;color:#fff;font-size:20px;font-weight:bold;">🏨 Novo Pedido — Sala de Reunião</p>
        <p style="margin:4px 0 0;color:#93c5fd;font-size:12px;">Azul Coworking · Luanda</p>
      </td></tr>
      <tr><td style="padding:28px 32px;color:#e2e8f0;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:8px 0;border-bottom:1px solid #1e293b;color:#94a3b8;width:140px;">Nome</td><td style="padding:8px 0 8px 12px;font-weight:500;">{{firstName}} {{lastName}}</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #1e293b;color:#94a3b8;">E-mail</td><td style="padding:8px 0 8px 12px;"><a href="mailto:{{email}}" style="color:#5C8FFF;">{{email}}</a></td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #1e293b;color:#94a3b8;">WhatsApp</td><td style="padding:8px 0 8px 12px;color:#22c55e;">{{whatsapp}}</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #1e293b;color:#94a3b8;">Empresa</td><td style="padding:8px 0 8px 12px;">{{company}}</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #1e293b;color:#94a3b8;">Plano</td><td style="padding:8px 0 8px 12px;color:#5C8FFF;font-weight:700;">{{planName}}</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #1e293b;color:#94a3b8;">Participantes</td><td style="padding:8px 0 8px 12px;">{{participants}}</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #1e293b;color:#94a3b8;">Data preferida</td><td style="padding:8px 0 8px 12px;color:#22c55e;">{{preferredDate}}</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #1e293b;color:#94a3b8;">Hora preferida</td><td style="padding:8px 0 8px 12px;">{{preferredTime}}</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #1e293b;color:#94a3b8;">Coffee Break</td><td style="padding:8px 0 8px 12px;">{{coffeeBreak}}</td></tr>
          <tr><td style="padding:8px 0;color:#94a3b8;">Observações</td><td style="padding:8px 0 8px 12px;color:#fbbf24;">{{observations}}</td></tr>
        </table>
        <p style="margin-top:20px;"><a href="{{adminUrl}}" style="background:#2F6FED;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:700;font-size:13px;">Ver no CRM →</a></p>
        <p style="font-size:11px;color:#475569;margin-top:16px;">Azul Coworking · Bairro Azul, Edifício 18, Luanda</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`,
    },
    {
      slug:      "reservation-confirmation",
      name:      "Confirmação de Reserva (Cliente)",
      subject:   "✅ Reserva confirmada — {{eventName}} | Azul Coworking",
      category:  "reservas",
      variables: ["clientName", "eventName", "planName", "startDatetime", "endDatetime", "totalHours", "coffeeBreak", "totalAmount", "invoiceNumber"],
      htmlBody: `<!DOCTYPE html>
<html lang="pt"><head><meta charset="UTF-8"><title>Reserva Confirmada</title></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;font-size:14px;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
      <tr><td style="background:#1e4d91;padding:24px 32px;">
        <p style="margin:0;color:#fff;font-size:22px;font-weight:bold;">AZUL COWORKING</p>
        <p style="margin:4px 0 0;color:#b3c8f0;font-size:12px;">Bairro Azul, Edifício 18 · Luanda, Angola</p>
      </td></tr>
      <tr><td style="padding:32px;">
        <h2 style="color:#22c55e;margin:0 0 12px;">✅ Reserva Confirmada!</h2>
        <p style="color:#444;">Olá <strong>{{clientName}}</strong>, a sua reserva foi confirmada com sucesso.</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;font-size:13px;">
          <tr style="background:#f0f9ff;"><td style="padding:9px 12px;color:#666;">Evento</td><td style="padding:9px 12px;font-weight:bold;">{{eventName}}</td></tr>
          <tr><td style="padding:9px 12px;color:#666;">Plano</td><td style="padding:9px 12px;color:#1e4d91;font-weight:bold;">{{planName}}</td></tr>
          <tr style="background:#f0f9ff;"><td style="padding:9px 12px;color:#666;">Início</td><td style="padding:9px 12px;color:#16a34a;font-weight:bold;">{{startDatetime}}</td></tr>
          <tr><td style="padding:9px 12px;color:#666;">Fim</td><td style="padding:9px 12px;">{{endDatetime}}</td></tr>
          <tr style="background:#f0f9ff;"><td style="padding:9px 12px;color:#666;">Duração</td><td style="padding:9px 12px;">{{totalHours}}h</td></tr>
          <tr><td style="padding:9px 12px;color:#666;">Coffee Break</td><td style="padding:9px 12px;">{{coffeeBreak}}</td></tr>
          <tr style="background:#f0f9ff;"><td style="padding:9px 12px;color:#666;">Valor total</td><td style="padding:9px 12px;font-weight:bold;font-size:16px;color:#1e4d91;">{{totalAmount}} Kz</td></tr>
          <tr><td style="padding:9px 12px;color:#666;">N.º Fatura</td><td style="padding:9px 12px;">{{invoiceNumber}}</td></tr>
        </table>
        <div style="background:#f0fdf4;padding:14px 16px;border-radius:6px;border-left:4px solid #22c55e;margin:16px 0;">
          <p style="margin:0;color:#166534;font-size:13px;">📍 <strong>Local:</strong> Azul Coworking — Bairro Azul, Edifício 18, Luanda</p>
          <p style="margin:6px 0 0;color:#666;font-size:11px;">Dúvidas? WhatsApp: +244 976 467 124</p>
        </div>
      </td></tr>
      <tr><td style="background:#f9f9f9;padding:16px 32px;border-top:1px solid #eee;">
        <p style="color:#999;font-size:11px;margin:0;text-align:center;">VERSÃO DE NEGÓCIOS · NIF: 5002174308 · <a href="mailto:geral@azulcowork.com" style="color:#1e4d91;">geral@azulcowork.com</a></p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`,
    },
    {
      slug:      "reservation-new-admin",
      name:      "Nova Reserva — Notificação Admin",
      subject:   "🏨 Nova reserva: {{eventName}} — {{planName}}",
      category:  "reservas",
      variables: ["clientName", "clientEmail", "clientWhatsapp", "eventName", "planName", "startDatetime", "endDatetime", "totalHours", "coffeeBreak", "totalAmount", "status", "reservationUrl"],
      htmlBody: `<!DOCTYPE html>
<html lang="pt"><head><meta charset="UTF-8"><title>Nova Reserva</title></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;font-size:14px;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:8px;overflow:hidden;">
      <tr><td style="background:#1e3a5f;padding:24px 32px;">
        <p style="margin:0;color:#fff;font-size:20px;font-weight:bold;">🏨 Nova Reserva de Sala</p>
        <p style="margin:4px 0 0;color:#93c5fd;font-size:12px;">Azul Coworking CRM · notificação automática</p>
      </td></tr>
      <tr><td style="padding:28px 32px;color:#e2e8f0;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:8px 0;border-bottom:1px solid #1e293b;color:#94a3b8;width:140px;">Cliente</td><td style="padding:8px 0 8px 12px;font-weight:500;">{{clientName}}</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #1e293b;color:#94a3b8;">E-mail</td><td style="padding:8px 0 8px 12px;"><a href="mailto:{{clientEmail}}" style="color:#5C8FFF;">{{clientEmail}}</a></td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #1e293b;color:#94a3b8;">WhatsApp</td><td style="padding:8px 0 8px 12px;color:#22c55e;">{{clientWhatsapp}}</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #1e293b;color:#94a3b8;">Evento</td><td style="padding:8px 0 8px 12px;">{{eventName}}</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #1e293b;color:#94a3b8;">Plano</td><td style="padding:8px 0 8px 12px;color:#5C8FFF;font-weight:700;">{{planName}}</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #1e293b;color:#94a3b8;">Início</td><td style="padding:8px 0 8px 12px;color:#22c55e;">{{startDatetime}}</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #1e293b;color:#94a3b8;">Fim</td><td style="padding:8px 0 8px 12px;">{{endDatetime}}</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #1e293b;color:#94a3b8;">Duração</td><td style="padding:8px 0 8px 12px;">{{totalHours}}h</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #1e293b;color:#94a3b8;">Coffee Break</td><td style="padding:8px 0 8px 12px;">{{coffeeBreak}}</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #1e293b;color:#94a3b8;">Valor</td><td style="padding:8px 0 8px 12px;color:#fbbf24;font-weight:700;">{{totalAmount}} Kz</td></tr>
          <tr><td style="padding:8px 0;color:#94a3b8;">Estado</td><td style="padding:8px 0 8px 12px;">{{status}}</td></tr>
        </table>
        <p style="margin-top:20px;"><a href="{{reservationUrl}}" style="background:#2F6FED;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:700;font-size:13px;">Ver reserva →</a></p>
        <p style="font-size:11px;color:#475569;margin-top:16px;">Azul Coworking CRM · notificação automática</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`,
    },
    {
      slug:      "invoice-sent",
      name:      "Fatura Emitida",
      subject:   "Factura {{invoiceNumber}} — Azul Coworking",
      category:  "financeiro",
      variables: ["companyName", "invoiceNumber", "issueDate", "dueDate", "total", "pdfUrl"],
      htmlBody: `<!DOCTYPE html>
<html lang="pt"><head><meta charset="UTF-8"><title>Factura {{invoiceNumber}}</title></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;font-size:14px;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
      <tr><td style="background:#1e4d91;padding:24px 32px;">
        <p style="margin:0;color:#fff;font-size:22px;font-weight:bold;letter-spacing:1px;">AZUL COWORKING</p>
        <p style="margin:4px 0 0;color:#b3c8f0;font-size:12px;">Bairro Azul, Edifício 18 · Luanda, Angola</p>
      </td></tr>
      <tr><td style="padding:32px;">
        <h2 style="color:#1e4d91;margin:0 0 16px;">Factura Emitida</h2>
        <p>Estimado(a) <strong>{{companyName}}</strong>,</p>
        <p style="color:#444;">Enviamos em anexo a sua factura referente ao período de serviços.</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;font-size:13px;">
          <tr style="background:#f0f4ff;"><td style="padding:9px 12px;color:#666;">N.º Factura</td><td style="padding:9px 12px;font-weight:bold;">{{invoiceNumber}}</td></tr>
          <tr><td style="padding:9px 12px;color:#666;">Data de Emissão</td><td style="padding:9px 12px;">{{issueDate}}</td></tr>
          <tr style="background:#f0f4ff;"><td style="padding:9px 12px;color:#666;">Data de Vencimento</td><td style="padding:9px 12px;color:#cc4400;font-weight:bold;">{{dueDate}}</td></tr>
          <tr><td style="padding:9px 12px;color:#666;">Total (incl. IVA 14%)</td><td style="padding:9px 12px;font-weight:bold;font-size:16px;color:#1e4d91;">Kz {{total}}</td></tr>
        </table>
        <div style="background:#f0f4ff;padding:14px 16px;border-radius:6px;margin:16px 0;font-size:13px;">
          <p style="margin:0 0 8px;font-weight:bold;color:#1e4d91;">Dados para Pagamento por Transferência</p>
          <p style="margin:3px 0;">Banco: <strong>BCS</strong></p>
          <p style="margin:3px 0;">IBAN: <strong style="font-family:monospace;">AO06007000000212870210113</strong></p>
          <p style="margin:3px 0;">SWIFT: CDTSAOLU</p>
          <p style="margin:3px 0;">Referência: <strong>{{invoiceNumber}}</strong></p>
        </div>
        <p style="margin-top:16px;"><a href="{{pdfUrl}}" style="background:#1e4d91;color:#fff;padding:10px 22px;text-decoration:none;border-radius:4px;display:inline-block;font-size:13px;">⬇ Download Factura PDF</a></p>
        <p style="color:#666;font-size:13px;margin-top:20px;">Qualquer questão, contacte-nos em <a href="mailto:geral@azulcowork.com" style="color:#1e4d91;">geral@azulcowork.com</a> ou +244 976 467 124.</p>
        <p style="margin-top:20px;">Cumprimentos,<br><strong>Azul Coworking</strong></p>
      </td></tr>
      <tr><td style="background:#f9f9f9;padding:16px 32px;border-top:1px solid #eee;">
        <p style="color:#999;font-size:11px;margin:0;text-align:center;line-height:1.6;">VERSÃO DE NEGÓCIOS · NIF: 5002174308 · <a href="mailto:geral@azulcowork.com" style="color:#1e4d91;">geral@azulcowork.com</a> · +244 976 467 124</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`,
    },
    {
      slug:      "payment-receipt",
      name:      "Recibo de Pagamento",
      subject:   "Recibo de Pagamento {{receiptNumber}} — Azul Coworking",
      category:  "financeiro",
      variables: ["companyName", "receiptNumber", "invoiceNumber", "amount", "paidAt", "method", "pdfUrl"],
      htmlBody: `<!DOCTYPE html>
<html lang="pt"><head><meta charset="UTF-8"><title>Recibo {{receiptNumber}}</title></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;font-size:14px;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
      <tr><td style="background:#1e4d91;padding:24px 32px;">
        <p style="margin:0;color:#fff;font-size:22px;font-weight:bold;letter-spacing:1px;">AZUL COWORKING</p>
        <p style="margin:4px 0 0;color:#b3c8f0;font-size:12px;">Bairro Azul, Edifício 18 · Luanda, Angola</p>
      </td></tr>
      <tr><td style="padding:32px;">
        <h2 style="color:#1e4d91;margin:0 0 16px;">Recibo de Pagamento</h2>
        <p>Estimado(a) <strong>{{companyName}}</strong>,</p>
        <p style="color:#444;">Confirmamos a recepção do seu pagamento. Obrigado!</p>
        <div style="background:#1e4d91;color:#fff;padding:20px;border-radius:8px;margin:16px 0;text-align:center;">
          <p style="margin:0;font-size:12px;opacity:0.8;">VALOR RECEBIDO</p>
          <p style="margin:8px 0 0;font-size:30px;font-weight:bold;">Kz {{amount}}</p>
        </div>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;font-size:13px;">
          <tr style="background:#f0f4ff;"><td style="padding:9px 12px;color:#666;">N.º Recibo</td><td style="padding:9px 12px;font-weight:bold;">{{receiptNumber}}</td></tr>
          <tr><td style="padding:9px 12px;color:#666;">Factura</td><td style="padding:9px 12px;">{{invoiceNumber}}</td></tr>
          <tr style="background:#f0f4ff;"><td style="padding:9px 12px;color:#666;">Data de Pagamento</td><td style="padding:9px 12px;">{{paidAt}}</td></tr>
          <tr><td style="padding:9px 12px;color:#666;">Forma de Pagamento</td><td style="padding:9px 12px;">{{method}}</td></tr>
        </table>
        <p style="margin-top:16px;"><a href="{{pdfUrl}}" style="background:#1e4d91;color:#fff;padding:10px 22px;text-decoration:none;border-radius:4px;display:inline-block;font-size:13px;">⬇ Download Recibo PDF</a></p>
        <p style="color:#444;font-size:13px;margin-top:20px;">Azul Coworking agradece a sua confiança e preferência.</p>
        <p style="margin-top:20px;">Cumprimentos,<br><strong>Azul Coworking</strong></p>
      </td></tr>
      <tr><td style="background:#f9f9f9;padding:16px 32px;border-top:1px solid #eee;">
        <p style="color:#999;font-size:11px;margin:0;text-align:center;line-height:1.6;">VERSÃO DE NEGÓCIOS · NIF: 5002174308 · <a href="mailto:geral@azulcowork.com" style="color:#1e4d91;">geral@azulcowork.com</a> · +244 976 467 124</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`,
    },
    {
      slug:      "payment-reminder",
      name:      "Lembrete de Pagamento",
      subject:   "Lembrete: Factura {{invoiceNumber}} vence em {{daysLeft}} dia(s) — Azul Coworking",
      category:  "financeiro",
      variables: ["companyName", "invoiceNumber", "dueDate", "total", "daysLeft"],
      htmlBody: `<!DOCTYPE html>
<html lang="pt"><head><meta charset="UTF-8"><title>Lembrete: Factura {{invoiceNumber}}</title></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;font-size:14px;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
      <tr><td style="background:#1e4d91;padding:24px 32px;">
        <p style="margin:0;color:#fff;font-size:22px;font-weight:bold;letter-spacing:1px;">AZUL COWORKING</p>
        <p style="margin:4px 0 0;color:#b3c8f0;font-size:12px;">Bairro Azul, Edifício 18 · Luanda, Angola</p>
      </td></tr>
      <tr><td style="padding:32px;">
        <h2 style="color:#d97706;margin:0 0 16px;">⏰ Lembrete de Pagamento</h2>
        <p>Estimado(a) <strong>{{companyName}}</strong>,</p>
        <p style="color:#444;">Informamos que a factura <strong>{{invoiceNumber}}</strong> tem vencimento próximo em <strong style="color:#cc4400;">{{dueDate}}</strong>.</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;font-size:13px;">
          <tr style="background:#fff8ed;"><td style="padding:9px 12px;color:#666;">N.º Factura</td><td style="padding:9px 12px;font-weight:bold;">{{invoiceNumber}}</td></tr>
          <tr><td style="padding:9px 12px;color:#666;">Vencimento</td><td style="padding:9px 12px;color:#cc4400;font-weight:bold;">{{dueDate}}</td></tr>
          <tr style="background:#fff8ed;"><td style="padding:9px 12px;color:#666;">Dias para Vencimento</td><td style="padding:9px 12px;font-weight:bold;">{{daysLeft}} dia(s)</td></tr>
          <tr><td style="padding:9px 12px;color:#666;">Total</td><td style="padding:9px 12px;font-weight:bold;font-size:16px;color:#1e4d91;">Kz {{total}}</td></tr>
        </table>
        <div style="background:#f0f4ff;padding:14px 16px;border-radius:6px;margin:16px 0;font-size:13px;">
          <p style="margin:0 0 8px;font-weight:bold;color:#1e4d91;">Dados para Pagamento</p>
          <p style="margin:3px 0;">Banco: <strong>BCS</strong> · IBAN: <strong style="font-family:monospace;">AO06007000000212870210113</strong></p>
          <p style="margin:3px 0;">Referência: <strong>{{invoiceNumber}}</strong></p>
        </div>
        <p style="color:#666;font-size:13px;">Dúvidas? <a href="mailto:geral@azulcowork.com" style="color:#1e4d91;">geral@azulcowork.com</a></p>
        <p style="margin-top:20px;">Cumprimentos,<br><strong>Azul Coworking</strong></p>
      </td></tr>
      <tr><td style="background:#f9f9f9;padding:16px 32px;border-top:1px solid #eee;">
        <p style="color:#999;font-size:11px;margin:0;text-align:center;line-height:1.6;">VERSÃO DE NEGÓCIOS · NIF: 5002174308 · <a href="mailto:geral@azulcowork.com" style="color:#1e4d91;">geral@azulcowork.com</a> · +244 976 467 124</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`,
    },
    {
      slug:      "payment-overdue",
      name:      "Fatura em Atraso (Urgente)",
      subject:   "⚠ URGENTE: Factura {{invoiceNumber}} em atraso ({{daysOverdue}} dias) — Azul Coworking",
      category:  "financeiro",
      variables: ["companyName", "invoiceNumber", "dueDate", "total", "daysOverdue"],
      htmlBody: `<!DOCTYPE html>
<html lang="pt"><head><meta charset="UTF-8"><title>Factura em Atraso {{invoiceNumber}}</title></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;font-size:14px;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
      <tr><td style="background:#1e4d91;padding:24px 32px;">
        <p style="margin:0;color:#fff;font-size:22px;font-weight:bold;letter-spacing:1px;">AZUL COWORKING</p>
        <p style="margin:4px 0 0;color:#b3c8f0;font-size:12px;">Bairro Azul, Edifício 18 · Luanda, Angola</p>
      </td></tr>
      <tr><td style="padding:32px;">
        <h2 style="color:#dc2626;margin:0 0 16px;">⚠ Factura em Atraso</h2>
        <p>Estimado(a) <strong>{{companyName}}</strong>,</p>
        <p style="color:#444;">A sua factura <strong>{{invoiceNumber}}</strong> encontra-se em atraso há <strong style="color:#dc2626;">{{daysOverdue}} dia(s)</strong>. Solicitamos a regularização urgente para evitar a suspensão do serviço.</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border:2px solid #dc2626;border-radius:6px;font-size:13px;">
          <tr style="background:#fef2f2;"><td style="padding:9px 12px;color:#666;">N.º Factura</td><td style="padding:9px 12px;font-weight:bold;">{{invoiceNumber}}</td></tr>
          <tr><td style="padding:9px 12px;color:#666;">Vencimento</td><td style="padding:9px 12px;color:#dc2626;font-weight:bold;">{{dueDate}}</td></tr>
          <tr style="background:#fef2f2;"><td style="padding:9px 12px;color:#666;">Dias em Atraso</td><td style="padding:9px 12px;color:#dc2626;font-weight:bold;">{{daysOverdue}} dia(s)</td></tr>
          <tr><td style="padding:9px 12px;color:#666;">Total em Dívida</td><td style="padding:9px 12px;font-weight:bold;font-size:16px;color:#dc2626;">Kz {{total}}</td></tr>
        </table>
        <div style="background:#f0f4ff;padding:14px 16px;border-radius:6px;margin:16px 0;font-size:13px;">
          <p style="margin:0 0 8px;font-weight:bold;color:#1e4d91;">Dados para Pagamento Imediato</p>
          <p style="margin:3px 0;">Banco: <strong>BCS</strong> · IBAN: <strong style="font-family:monospace;">AO06007000000212870210113</strong></p>
          <p style="margin:3px 0;">Referência: <strong>{{invoiceNumber}}</strong></p>
        </div>
        <p style="color:#444;font-size:13px;">Contacte-nos imediatamente em <a href="mailto:geral@azulcowork.com" style="color:#1e4d91;">geral@azulcowork.com</a> ou +244 976 467 124.</p>
        <p style="margin-top:20px;">Cumprimentos,<br><strong>Equipa Financeira — Azul Coworking</strong></p>
      </td></tr>
      <tr><td style="background:#f9f9f9;padding:16px 32px;border-top:1px solid #eee;">
        <p style="color:#999;font-size:11px;margin:0;text-align:center;line-height:1.6;">VERSÃO DE NEGÓCIOS · NIF: 5002174308 · <a href="mailto:geral@azulcowork.com" style="color:#1e4d91;">geral@azulcowork.com</a> · +244 976 467 124</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`,
    },
  ];

  for (const tpl of emailTemplates) {
    await prisma.emailTemplate.upsert({
      where:  { slug: tpl.slug },
      update: { name: tpl.name, subject: tpl.subject, htmlBody: tpl.htmlBody, variables: tpl.variables, category: tpl.category },
      create: { slug: tpl.slug, name: tpl.name, subject: tpl.subject, htmlBody: tpl.htmlBody, variables: tpl.variables, category: tpl.category, isActive: true },
    });
    console.log(`EmailTemplate upsert: ${tpl.slug}`);
  }

  console.log("\n✅ Seed VOL07 (Comunicação Avançada) concluído — 8 EmailTemplate registados.");

  // ── VOL08 Seed — DocumentTemplate (Gestão Documental) ──────────────────────
  // 2 templates iniciais: PROPOSAL + CONTRACT
  // version começa em 1; incrementa a cada PATCH via API.
  // htmlBody usa {{variavel}} — interpolado por template-interpolator.ts
  // ──────────────────────────────────────────────────────────────────────────────

  const docTemplates = [
    {
      slug:        "proposta-coworking",
      name:        "Proposta Comercial — Coworking",
      type:        "PROPOSAL",
      description: "Proposta comercial para planos de coworking (mensal, trimestral, anual)",
      version:     1,
      variables:   [
        "nomeEmpresa","nifEmpresa","moradaEmpresa",
        "nomeContacto","emailContacto","telefoneContacto",
        "planoDescricao","valorMensal","duracao",
        "dataInicio","dataValidade","nomeComercial",
        "dataDocumento","numeroDocumento","observacoes",
      ],
      htmlBody: `<!DOCTYPE html>
<html lang="pt">
<head><meta charset="UTF-8"/><title>Proposta Comercial</title></head>
<body style="font-family:Arial,sans-serif;font-size:11pt;color:#222;margin:0;padding:40px;">

<table width="100%" style="border-bottom:3px solid #1e4d91;padding-bottom:12px;margin-bottom:24px;">
  <tr>
    <td><div style="font-size:22pt;font-weight:bold;color:#1e4d91;">AZUL COWORKING</div>
        <div style="font-size:9pt;color:#666;">VERSÃO DE NEGÓCIOS - COMÉRCIO GERAL E PRESTAÇÃO DE SERVIÇOS, LDA</div>
        <div style="font-size:9pt;color:#666;">NIF: 5002174308 | Bairro Azul, Edifício 18, Luanda, Angola</div>
        <div style="font-size:9pt;color:#666;">Tel: +244 976 467 124 | geral@azulcowork.com | www.azulcowork.com</div>
    </td>
    <td align="right" style="vertical-align:top;">
      <div style="font-size:15pt;font-weight:bold;color:#1e4d91;">PROPOSTA COMERCIAL</div>
      <div style="font-size:9pt;color:#666;">Nº: {{numeroDocumento}}</div>
      <div style="font-size:9pt;color:#666;">Data: {{dataDocumento}}</div>
      <div style="font-size:9pt;color:#666;">Válida até: {{dataValidade}}</div>
    </td>
  </tr>
</table>

<table width="100%" style="margin-bottom:24px;border-collapse:collapse;">
  <tr>
    <td width="48%" style="background:#f0f4ff;padding:12px;border-radius:4px;">
      <div style="font-weight:bold;color:#1e4d91;margin-bottom:6px;">DESTINATÁRIO</div>
      <div><b>{{nomeEmpresa}}</b></div>
      <div>NIF: {{nifEmpresa}}</div>
      <div>{{moradaEmpresa}}</div>
      <div>Atenção: {{nomeContacto}}</div>
      <div>{{emailContacto}} | {{telefoneContacto}}</div>
    </td>
    <td width="4%"></td>
    <td width="48%" style="background:#f9f9f9;padding:12px;border-radius:4px;">
      <div style="font-weight:bold;color:#1e4d91;margin-bottom:6px;">COMERCIAL RESPONSÁVEL</div>
      <div>{{nomeComercial}}</div>
      <div>geral@azulcowork.com</div>
      <div>+244 976 467 124</div>
    </td>
  </tr>
</table>

<div style="font-weight:bold;color:#1e4d91;font-size:12pt;margin-bottom:8px;border-bottom:1px solid #ddd;padding-bottom:4px;">
  DESCRIÇÃO DO SERVIÇO
</div>
<table width="100%" style="border-collapse:collapse;margin-bottom:20px;">
  <thead>
    <tr style="background:#1e4d91;color:#fff;">
      <th style="padding:8px 10px;text-align:left;">Plano</th>
      <th style="padding:8px 10px;text-align:center;">Duração</th>
      <th style="padding:8px 10px;text-align:right;">Valor Mensal</th>
    </tr>
  </thead>
  <tbody>
    <tr style="border-bottom:1px solid #ddd;">
      <td style="padding:8px 10px;">{{planoDescricao}}</td>
      <td style="padding:8px 10px;text-align:center;">{{duracao}}</td>
      <td style="padding:8px 10px;text-align:right;font-weight:bold;">Kz {{valorMensal}}</td>
    </tr>
  </tbody>
</table>

<table width="100%" style="margin-bottom:20px;">
  <tr>
    <td style="font-size:9pt;color:#555;">
      <b>Data de início prevista:</b> {{dataInicio}}
    </td>
  </tr>
</table>

<div style="background:#f0f4ff;padding:12px;border-radius:4px;margin-bottom:20px;">
  <div style="font-weight:bold;color:#1e4d91;margin-bottom:6px;">O QUE ESTÁ INCLUÍDO</div>
  <ul style="margin:0;padding-left:18px;font-size:10pt;">
    <li>Espaço de trabalho partilhado no Bairro Azul, Edifício 18</li>
    <li>Internet de alta velocidade (fibra óptica)</li>
    <li>Acesso a salas de reunião (mediante reserva)</li>
    <li>Recepção e morada comercial</li>
    <li>Café e ambiente profissional</li>
  </ul>
</div>

<div style="font-weight:bold;color:#1e4d91;font-size:12pt;margin-bottom:8px;border-bottom:1px solid #ddd;padding-bottom:4px;">
  CONDIÇÕES DE PAGAMENTO
</div>
<p style="font-size:10pt;margin-bottom:4px;">Pagamento mensal antecipado, vencível no dia 1 de cada mês.</p>
<p style="font-size:10pt;margin-bottom:16px;"><b>IBAN:</b> AO06007000000212870210113 (BCS) | <b>SWIFT:</b> CDTSAOLU</p>

{{observacoes}}

<div style="margin-top:32px;border-top:1px solid #ddd;padding-top:12px;">
  <p style="font-size:9pt;color:#888;text-align:center;">
    Esta proposta é válida até {{dataValidade}}. Para aceitar, responda a este email ou contacte o seu comercial.<br/>
    Azul Coworking | Bairro Azul, Edifício 18, Luanda | geral@azulcowork.com
  </p>
</div>

</body>
</html>`,
    },
    {
      slug:        "contrato-coworking",
      name:        "Contrato de Alocação — Coworking",
      type:        "CONTRACT",
      description: "Contrato formal de alocação de espaço de coworking",
      version:     1,
      variables:   [
        "nomeEmpresa","nifEmpresa","moradaEmpresa",
        "representanteLegal","cargoRepresentante",
        "planoDescricao","valorMensal","dataInicio","dataFim","duracao",
        "depositoGarantia","formaPagamento","diaVencimento",
        "renovacaoAutomatica","dataDocumento","numeroContrato","clausulasEspeciais",
      ],
      htmlBody: `<!DOCTYPE html>
<html lang="pt">
<head><meta charset="UTF-8"/><title>Contrato de Alocação</title></head>
<body style="font-family:Arial,sans-serif;font-size:10.5pt;color:#222;margin:0;padding:40px;">

<table width="100%" style="border-bottom:3px solid #1e4d91;padding-bottom:12px;margin-bottom:20px;">
  <tr>
    <td><div style="font-size:20pt;font-weight:bold;color:#1e4d91;">AZUL COWORKING</div>
        <div style="font-size:9pt;color:#666;">VERSÃO DE NEGÓCIOS - COMÉRCIO GERAL E PRESTAÇÃO DE SERVIÇOS, LDA</div>
        <div style="font-size:9pt;color:#666;">NIF: 5002174308 | Bairro Azul, Edifício 18, Luanda, Angola</div>
    </td>
    <td align="right" style="vertical-align:top;">
      <div style="font-size:14pt;font-weight:bold;color:#1e4d91;">CONTRATO DE ALOCAÇÃO</div>
      <div style="font-size:9pt;color:#666;">Nº: {{numeroContrato}}</div>
      <div style="font-size:9pt;color:#666;">Data: {{dataDocumento}}</div>
    </td>
  </tr>
</table>

<p style="text-align:center;font-weight:bold;font-size:13pt;margin-bottom:16px;">
  CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE COWORKING
</p>

<p style="margin-bottom:12px;">
  Entre as partes abaixo identificadas, é celebrado o presente Contrato de Prestação de Serviços de Coworking,
  que se rege pelas cláusulas seguintes:
</p>

<div style="background:#f0f4ff;padding:12px;border-radius:4px;margin-bottom:16px;">
  <b style="color:#1e4d91;">PRIMEIRA PARTE (PRESTADOR DE SERVIÇOS)</b><br/>
  VERSÃO DE NEGÓCIOS - COMÉRCIO GERAL E PRESTAÇÃO DE SERVIÇOS, LDA<br/>
  NIF: 5002174308 | Bairro Azul, Edifício 18, Luanda, Angola<br/>
  Doravante designada <b>"AZUL COWORKING"</b>
</div>

<div style="background:#f9f9f9;padding:12px;border-radius:4px;margin-bottom:16px;">
  <b style="color:#1e4d91;">SEGUNDA PARTE (CLIENTE)</b><br/>
  <b>{{nomeEmpresa}}</b><br/>
  NIF: {{nifEmpresa}}<br/>
  Morada: {{moradaEmpresa}}<br/>
  Representado por: {{representanteLegal}}, na qualidade de {{cargoRepresentante}}<br/>
  Doravante designado <b>"CLIENTE"</b>
</div>

<div style="font-weight:bold;color:#1e4d91;margin-bottom:6px;border-bottom:1px solid #ddd;padding-bottom:4px;">
  CLÁUSULA 1.ª — OBJECTO
</div>
<p style="margin-bottom:12px;">
  O AZUL COWORKING compromete-se a prestar ao CLIENTE serviços de espaço de trabalho partilhado
  (coworking), incluindo acesso às instalações, internet de alta velocidade, recepção e serviços
  associados, conforme o plano: <b>{{planoDescricao}}</b>.
</p>

<div style="font-weight:bold;color:#1e4d91;margin-bottom:6px;border-bottom:1px solid #ddd;padding-bottom:4px;">
  CLÁUSULA 2.ª — PRAZO
</div>
<p style="margin-bottom:12px;">
  O presente contrato tem início em <b>{{dataInicio}}</b> e término em <b>{{dataFim}}</b>,
  com duração de <b>{{duracao}}</b>.
  Renovação automática: <b>{{renovacaoAutomatica}}</b> (aviso prévio de 30 dias para não renovação).
</p>

<div style="font-weight:bold;color:#1e4d91;margin-bottom:6px;border-bottom:1px solid #ddd;padding-bottom:4px;">
  CLÁUSULA 3.ª — VALOR E PAGAMENTO
</div>
<p style="margin-bottom:12px;">
  O valor mensal é de <b>Kz {{valorMensal}}</b>, pago por <b>{{formaPagamento}}</b>,
  vencível no dia <b>{{diaVencimento}}</b> de cada mês.<br/>
  <b>Depósito de garantia:</b> Kz {{depositoGarantia}} (reembolsável no término, se não houver débitos pendentes).<br/>
  <b>IBAN:</b> AO06007000000212870210113 (BCS) | <b>SWIFT:</b> CDTSAOLU
</p>

<div style="font-weight:bold;color:#1e4d91;margin-bottom:6px;border-bottom:1px solid #ddd;padding-bottom:4px;">
  CLÁUSULA 4.ª — OBRIGAÇÕES DO CLIENTE
</div>
<p style="margin-bottom:12px;">
  O CLIENTE obriga-se a: (a) utilizar as instalações de forma adequada e respeitosa;
  (b) cumprir o regulamento interno do AZUL COWORKING;
  (c) efectuar os pagamentos nas datas acordadas;
  (d) comunicar com antecedência mínima de 30 dias a intenção de não renovar.
</p>

<div style="font-weight:bold;color:#1e4d91;margin-bottom:6px;border-bottom:1px solid #ddd;padding-bottom:4px;">
  CLÁUSULA 5.ª — RESOLUÇÃO
</div>
<p style="margin-bottom:12px;">
  O contrato pode ser resolvido por incumprimento grave de qualquer das partes, com aviso prévio
  de 15 dias. O atraso de pagamento superior a 30 dias constitui justa causa de resolução imediata.
</p>

{{clausulasEspeciais}}

<div style="margin-top:32px;">
  <table width="100%">
    <tr>
      <td width="45%" align="center" style="border-top:1px solid #333;padding-top:8px;">
        <div>AZUL COWORKING</div>
        <div style="font-size:9pt;color:#666;">Data: {{dataDocumento}}</div>
      </td>
      <td width="10%"></td>
      <td width="45%" align="center" style="border-top:1px solid #333;padding-top:8px;">
        <div>{{nomeEmpresa}}</div>
        <div style="font-size:9pt;color:#666;">{{representanteLegal}}</div>
        <div style="font-size:9pt;color:#666;">Data: ___/___/______</div>
      </td>
    </tr>
  </table>
</div>

<div style="margin-top:20px;font-size:8pt;color:#888;border-top:1px solid #eee;padding-top:8px;text-align:center;">
  Contrato Nº {{numeroContrato}} | Gerado em {{dataDocumento}} pelo Sistema VD Platform | Azul Coworking
</div>

</body>
</html>`,
    },
  ];

  for (const tpl of docTemplates) {
    await prisma.documentTemplate.upsert({
      where:  { slug: tpl.slug },
      update: { name: tpl.name, type: tpl.type, description: tpl.description, htmlBody: tpl.htmlBody, variables: tpl.variables },
      create: { slug: tpl.slug, name: tpl.name, type: tpl.type, description: tpl.description, htmlBody: tpl.htmlBody, variables: tpl.variables, version: 1, isActive: true },
    });
    console.log(`DocumentTemplate upsert: ${tpl.slug}`);
  }

  console.log("\n✅ Seed VOL08 (Gestão Documental) concluído — 2 DocumentTemplate registados.");

  // ── VOL10 Seed — EmailTemplates de Portal e Faturação Automática ───────────

  const vol10Templates = [
    {
      slug:      "portal-magic-link",
      name:      "Portal — Link de Acesso (Magic Link)",
      subject:   "O seu link de acesso — Azul Coworking",
      category:  "portal",
      variables: ["magicLinkUrl", "expiresMinutes", "email"],
      htmlBody: `<!DOCTYPE html>
<html lang="pt"><head><meta charset="UTF-8"><title>Link de Acesso</title></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;font-size:14px;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
      <tr><td style="background:#1e40af;padding:24px 32px;">
        <p style="margin:0;color:#fff;font-size:20px;font-weight:bold;">Azul Coworking</p>
        <p style="margin:4px 0 0;color:#bfdbfe;font-size:12px;">Portal do Cliente</p>
      </td></tr>
      <tr><td style="padding:32px;">
        <p style="color:#374151;">O seu link de acesso ao Portal do Cliente:</p>
        <p style="text-align:center;margin:28px 0;">
          <a href="{{magicLinkUrl}}" style="background:#1e40af;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">
            Aceder ao Portal
          </a>
        </p>
        <p style="font-size:13px;color:#6b7280;">Este link é válido por <strong>{{expiresMinutes}} minutos</strong> e só pode ser utilizado uma vez.</p>
        <p style="font-size:12px;color:#9ca3af;">Se não solicitou este acesso, ignore este email.<br>Link: <a href="{{magicLinkUrl}}" style="color:#1e40af;">{{magicLinkUrl}}</a></p>
      </td></tr>
      <tr><td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;">
        <p style="color:#9ca3af;font-size:11px;margin:0;text-align:center;">Azul Coworking · Bairro Azul, Edifício 18, Luanda · geral@azulcowork.com</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`,
    },
    {
      slug:      "portal-welcome",
      name:      "Portal — Boas-Vindas ao Cliente",
      subject:   "Bem-vindo ao Portal Azul Coworking — {{companyName}}",
      category:  "portal",
      variables: ["name", "companyName", "portalLoginUrl", "accessMethod"],
      htmlBody: `<!DOCTYPE html>
<html lang="pt"><head><meta charset="UTF-8"><title>Bem-vindo ao Portal</title></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;font-size:14px;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
      <tr><td style="background:#1e40af;padding:24px 32px;">
        <p style="margin:0;color:#fff;font-size:20px;font-weight:bold;">Azul Coworking</p>
        <p style="margin:4px 0 0;color:#bfdbfe;font-size:12px;">Portal do Cliente — {{companyName}}</p>
      </td></tr>
      <tr><td style="padding:32px;">
        <p>Olá <strong>{{name}}</strong>,</p>
        <p>A sua conta de acesso ao portal da empresa <strong>{{companyName}}</strong> foi criada com sucesso.</p>
        <p style="color:#374151;">{{accessMethod}}</p>
        <p style="text-align:center;margin:28px 0;">
          <a href="{{portalLoginUrl}}" style="background:#1e40af;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">
            Aceder ao Portal
          </a>
        </p>
        <p style="font-size:13px;color:#6b7280;">No portal pode consultar faturas, pagamentos, contratos, documentos e efectuar reservas de salas.</p>
      </td></tr>
      <tr><td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;">
        <p style="color:#9ca3af;font-size:11px;margin:0;text-align:center;">Azul Coworking · Bairro Azul, Edifício 18, Luanda · geral@azulcowork.com · 976 467 124</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`,
    },
    {
      slug:      "erp-invoice-issued",
      name:      "ERP — Fatura Mensal Emitida (Automática)",
      subject:   "Fatura {{invoiceNumber}} — {{companyName}} — Azul Coworking",
      category:  "financeiro",
      variables: ["invoiceNumber", "companyName", "totalAmount", "dueDate", "portalUrl"],
      htmlBody: `<!DOCTYPE html>
<html lang="pt"><head><meta charset="UTF-8"><title>Fatura {{invoiceNumber}}</title></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;font-size:14px;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
      <tr><td style="background:#1e4d91;padding:24px 32px;">
        <p style="margin:0;color:#fff;font-size:20px;font-weight:bold;letter-spacing:1px;">AZUL COWORKING</p>
        <p style="margin:4px 0 0;color:#b3c8f0;font-size:12px;">Fatura Mensal Automática</p>
      </td></tr>
      <tr><td style="padding:32px;">
        <p>Estimado cliente <strong>{{companyName}}</strong>,</p>
        <p>A sua fatura mensal foi emitida:</p>
        <table width="100%" style="margin:16px 0;font-size:13px;border-collapse:collapse;">
          <tr style="background:#f0f4ff;"><td style="padding:9px 12px;color:#666;border:1px solid #e5e7eb;">Número</td><td style="padding:9px 12px;font-weight:bold;border:1px solid #e5e7eb;">{{invoiceNumber}}</td></tr>
          <tr><td style="padding:9px 12px;color:#666;border:1px solid #e5e7eb;">Valor Total</td><td style="padding:9px 12px;font-weight:bold;color:#1e4d91;border:1px solid #e5e7eb;">{{totalAmount}}</td></tr>
          <tr style="background:#f0f4ff;"><td style="padding:9px 12px;color:#666;border:1px solid #e5e7eb;">Vencimento</td><td style="padding:9px 12px;color:#dc2626;font-weight:bold;border:1px solid #e5e7eb;">{{dueDate}}</td></tr>
        </table>
        <div style="background:#f0f4ff;padding:12px;border-radius:4px;margin:16px 0;font-size:13px;">
          <strong>Pagamento:</strong> IBAN AO06007000000212870210113 (BCS) · Ref: {{invoiceNumber}}
        </div>
        <p style="text-align:center;margin:24px 0;">
          <a href="{{portalUrl}}" style="background:#1e4d91;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">
            Ver Fatura no Portal
          </a>
        </p>
      </td></tr>
      <tr><td style="background:#f9f9f9;padding:16px 32px;border-top:1px solid #eee;">
        <p style="color:#999;font-size:11px;margin:0;text-align:center;">VERSÃO DE NEGÓCIOS · NIF: 5002174308 · geral@azulcowork.com · +244 976 467 124</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`,
    },
  ];

  for (const tpl of vol10Templates) {
    await prisma.emailTemplate.upsert({
      where:  { slug: tpl.slug },
      update: { name: tpl.name, subject: tpl.subject, htmlBody: tpl.htmlBody, variables: tpl.variables, category: tpl.category },
      create: { slug: tpl.slug, name: tpl.name, subject: tpl.subject, htmlBody: tpl.htmlBody, variables: tpl.variables, category: tpl.category, isActive: true },
    });
    console.log(`EmailTemplate upsert: ${tpl.slug}`);
  }

  console.log("\n✅ Seed VOL10 (Automações) concluído — 3 EmailTemplate registados (portal-magic-link, portal-welcome, erp-invoice-issued).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
