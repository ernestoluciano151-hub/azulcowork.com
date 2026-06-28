import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT || "465"),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendNewLeadEmail(lead: {
  firstName: string;
  lastName: string;
  email: string;
  whatsapp: string;
  scheduledDate: Date;
}) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS || !process.env.ADMIN_EMAIL) return;

  const dateStr = lead.scheduledDate.toLocaleString("pt-PT", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Africa/Luanda",
  });

  await transporter.sendMail({
    from: `"LeadGen CRM" <${process.env.SMTP_USER}>`,
    to: process.env.ADMIN_EMAIL,
    subject: `🔔 Novo lead: ${lead.firstName} ${lead.lastName}`,
    html: `
      <div style="font-family:sans-serif;max-width:500px;margin:auto;background:#0f172a;color:#e2e8f0;border-radius:12px;padding:24px">
        <h2 style="color:#3b82f6;margin-top:0">Novo lead captado! 🎉</h2>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:8px 0;color:#94a3b8">Nome</td><td style="padding:8px 0;font-weight:600">${lead.firstName} ${lead.lastName}</td></tr>
          <tr><td style="padding:8px 0;color:#94a3b8">E-mail</td><td style="padding:8px 0">${lead.email}</td></tr>
          <tr><td style="padding:8px 0;color:#94a3b8">WhatsApp</td><td style="padding:8px 0">${lead.whatsapp}</td></tr>
          <tr><td style="padding:8px 0;color:#94a3b8">Agendamento</td><td style="padding:8px 0;color:#22c55e;font-weight:600">${dateStr}</td></tr>
        </table>
        <a href="${process.env.NEXT_PUBLIC_SITE_URL}/admin/leads" style="display:inline-block;margin-top:20px;background:#3b82f6;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600">Ver no CRM →</a>
      </div>
    `,
  });
}
