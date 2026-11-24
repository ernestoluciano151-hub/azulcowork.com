/**
 * Vercel Serverless Function — POST /api/contact
 * Envia email de contacto via Resend.
 *
 * Variáveis de ambiente (Vercel Dashboard → Settings → Environment Variables):
 *   RESEND_API_KEY  — chave da API Resend (resend.com)
 *   MAIL_FROM       — remetente verificado, ex: noreply@azulcowork.com
 *   MAIL_TO         — destinatário, ex: geral@azulcowork.com
 */

const RATE_LIMIT_MAP = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minuto
const RATE_LIMIT_MAX = 3;

function isRateLimited(ip) {
  const now = Date.now();
  const entry = RATE_LIMIT_MAP.get(ip);
  if (!entry || now - entry.ts > RATE_LIMIT_WINDOW_MS) {
    RATE_LIMIT_MAP.set(ip, { ts: now, count: 1 });
    return false;
  }
  if (entry.count >= RATE_LIMIT_MAX) return true;
  entry.count++;
  return false;
}

function sanitize(str, maxLen = 500) {
  if (typeof str !== "string") return "";
  return str.replace(/[<>]/g, "").trim().slice(0, maxLen);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://azulcowork.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido." });

  const ip = (req.headers["x-forwarded-for"] || "unknown").split(",")[0].trim();
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: "Demasiados pedidos. Aguarde um momento." });
  }

  const { nome, email, telefone, mensagem } = req.body || {};

  if (!nome || !email || !mensagem) {
    return res.status(400).json({ error: "Nome, email e mensagem são obrigatórios." });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: "Email inválido." });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const mailFrom = process.env.MAIL_FROM || "noreply@azulcowork.com";
  const mailTo = process.env.MAIL_TO || "geral@azulcowork.com";

  if (!apiKey) {
    console.error("[contact] RESEND_API_KEY não configurada.");
    return res.status(500).json({ error: "Serviço de email não configurado." });
  }

  const nomeS = sanitize(nome, 100);
  const emailS = sanitize(email, 200);
  const telS = sanitize(telefone || "", 50);
  const msgS = sanitize(mensagem, 2000);

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;background:#0A1628;color:#e2e8f0;border-radius:12px;padding:28px;">
      <h2 style="color:#00E676;margin:0 0 20px">📩 Novo contacto — Azul Coworking</h2>
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="color:#94a3b8;padding:6px 0;width:120px">Nome</td><td style="color:#f5f7fa;font-weight:600">${nomeS}</td></tr>
        <tr><td style="color:#94a3b8;padding:6px 0">Email</td><td><a href="mailto:${emailS}" style="color:#00E676">${emailS}</a></td></tr>
        ${telS ? `<tr><td style="color:#94a3b8;padding:6px 0">Telefone</td><td style="color:#f5f7fa">${telS}</td></tr>` : ""}
        <tr><td style="color:#94a3b8;padding:6px 0;vertical-align:top">Mensagem</td><td style="color:#f5f7fa;white-space:pre-wrap">${msgS}</td></tr>
      </table>
      <hr style="border:1px solid #1e293b;margin:20px 0"/>
      <p style="color:#94a3b8;font-size:12px;margin:0">Enviado através do formulário de contacto em azulcowork.com</p>
    </div>
  `;

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: mailFrom,
        to: [mailTo],
        reply_to: emailS,
        subject: `[Azul Coworking] Contacto de ${nomeS}`,
        html,
      }),
    });

    if (!r.ok) {
      const err = await r.text();
      console.error("[contact] Resend error:", err);
      return res.status(502).json({ error: "Falha ao enviar email. Tente pelo WhatsApp." });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[contact] fetch error:", err);
    return res.status(500).json({ error: "Erro interno. Tente pelo WhatsApp." });
  }
}
