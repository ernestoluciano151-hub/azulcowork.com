/**
 * POST /api/communication/[id]/retry
 *
 * Retentar manualmente um CommunicationLog com status FAILED.
 * Apenas emails (type === EMAIL) são suportados para retry manual.
 *
 * Permissões: ADMIN apenas
 * VOL07 — Sprint VOL07-2
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import nodemailer from "nodemailer";

function isSmtpConfigured(): boolean {
  return !!(process.env.SMTP_USER && process.env.SMTP_PASS);
}

function createTransport() {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST   || "smtp.gmail.com",
    port:   parseInt(process.env.SMTP_PORT || "465"),
    secure: (process.env.SMTP_SECURE ?? "true") === "true",
    auth: {
      user: process.env.SMTP_USER || "",
      pass: process.env.SMTP_PASS || "",
    },
  });
}

const FROM = process.env.SMTP_FROM || `"Azul Coworking" <${process.env.SMTP_USER || "noreply@azulcowork.com"}>`;

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authErr = await requireRole(req, ["ADMIN"]);
  if (authErr) return authErr;

  const log = await prisma.communicationLog.findUnique({ where: { id: params.id } });

  if (!log) {
    return NextResponse.json({ error: "Log não encontrado" }, { status: 404 });
  }
  if (log.status !== "FAILED") {
    return NextResponse.json(
      { error: `Só é possível retentar logs com status FAILED. Estado actual: ${log.status}` },
      { status: 400 }
    );
  }
  if (log.type !== "EMAIL") {
    return NextResponse.json(
      { error: "Retry manual disponível apenas para emails (type=EMAIL)." },
      { status: 400 }
    );
  }
  if (!isSmtpConfigured()) {
    return NextResponse.json(
      { error: "SMTP não configurado — impossível retentar." },
      { status: 400 }
    );
  }

  // Actualizar para RETRYING
  await prisma.communicationLog.update({
    where: { id: log.id },
    data:  { status: "RETRYING" },
  });

  try {
    await createTransport().sendMail({
      from:    FROM,
      to:      log.to,
      subject: log.subject ?? "(sem assunto)",
      html:    log.body,
    });

    const updated = await prisma.communicationLog.update({
      where: { id: log.id },
      data: {
        status:        "SENT",
        attempts:      log.attempts + 1,
        lastAttemptAt: new Date(),
        sentAt:        new Date(),
        errorMsg:      null,
      },
    });

    return NextResponse.json({ success: true, log: updated });

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);

    const updated = await prisma.communicationLog.update({
      where: { id: log.id },
      data: {
        status:        "FAILED",
        attempts:      log.attempts + 1,
        lastAttemptAt: new Date(),
        errorMsg,
      },
    });

    return NextResponse.json(
      { success: false, error: errorMsg, log: updated },
      { status: 502 }
    );
  }
}
