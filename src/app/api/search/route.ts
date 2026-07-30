import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AdminRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { error } = await requireRole(AdminRole.ADMIN, AdminRole.COMERCIAL, AdminRole.FINANCEIRO);
  if (error) return error;

  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json({ companies: [], leads: [], reservations: [], payments: [], invoices: [] });

  const mode = "insensitive" as const;

  const [companies, leads, reservations, payments, invoices] = await Promise.all([
    prisma.company.findMany({
      where: { OR: [
        { name:       { contains: q, mode } },
        { nif:        { contains: q, mode } },
        { email:      { contains: q, mode } },
        { whatsapp:   { contains: q, mode } },
        { responsible:{ contains: q, mode } },
      ]},
      select: { id: true, name: true, email: true, planType: true, contractStatus: true },
      take: 5,
    }),
    prisma.roomBookingLead.findMany({
      where: { OR: [
        { firstName: { contains: q, mode } },
        { lastName:  { contains: q, mode } },
        { email:     { contains: q, mode } },
        { whatsapp:  { contains: q, mode } },
        { company:   { contains: q, mode } },
      ]},
      select: { id: true, firstName: true, lastName: true, email: true, planName: true, status: true },
      take: 5,
    }),
    prisma.reservation.findMany({
      where: { OR: [
        { eventName:         { contains: q, mode } },
        { companyName:       { contains: q, mode } },
        { responsible:       { contains: q, mode } },
        { reservationNumber: { contains: q, mode } },
      ]},
      select: { id: true, reservationNumber: true, eventName: true, companyName: true, startDatetime: true, status: true },
      take: 5,
    }),
    prisma.payment.findMany({
      where: { OR: [
        { receiptNumber: { contains: q, mode } },
        { operationRef:  { contains: q, mode } },
        { company:       { name: { contains: q, mode } } },
      ]},
      include: { company: { select: { name: true } } },
      take: 5,
    }),
    prisma.invoice.findMany({
      where: { OR: [
        { invoiceNumber: { contains: q, mode } },
        { company:       { name: { contains: q, mode } } },
      ]},
      include: { company: { select: { name: true } } },
      take: 5,
    }),
  ]);

  return NextResponse.json({ companies, leads, reservations, payments, invoices });
}
