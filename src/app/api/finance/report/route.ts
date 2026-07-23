import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import ExcelJS from "exceljs";

export const dynamic = "force-dynamic";

const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" } };

function styleHeader(ws: ExcelJS.Worksheet) {
  ws.getRow(1).eachCell((cell) => {
    cell.font = HEADER_FONT;
    cell.fill = HEADER_FILL;
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });
}

const XLS_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");

  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const wb = new ExcelJS.Workbook();
  let filename = "relatorio.xlsx";

  if (type === "receita-mensal") {
    filename = `receita-mensal-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}.xlsx`;
    const payments = await prisma.payment.findMany({
      where: { status: "PAGO", paidDate: { gte: startOfMonth } },
      include: { company: { select: { name: true } } },
      orderBy: { paidDate: "desc" },
    });
    const ws = wb.addWorksheet("Receita Mensal");
    ws.columns = [
      { header: "Empresa",        width: 28 }, { header: "Valor",          width: 18 },
      { header: "Data Pagamento", width: 20 }, { header: "Vencimento",     width: 18 },
      { header: "Estado",         width: 16 }, { header: "Método",         width: 16 },
      { header: "Notas",          width: 36 },
    ];
    styleHeader(ws);
    payments.forEach(p => ws.addRow([
      p.company?.name ?? "—", p.amount,
      p.paidDate ? p.paidDate.toLocaleDateString("pt-PT") : "",
      p.dueDate.toLocaleDateString("pt-PT"), p.status, p.paymentMethod || "", p.notes || "",
    ]));

  } else if (type === "receita-anual") {
    filename = `receita-anual-${now.getFullYear()}.xlsx`;
    const ws = wb.addWorksheet("Receita Anual");
    ws.columns = [
      { header: "Mês",              width: 24 },
      { header: "Total Recebido",   width: 20 },
      { header: "Nº Pagamentos",    width: 16 },
    ];
    styleHeader(ws);
    for (let m = 0; m < 12; m++) {
      const from = new Date(now.getFullYear(), m, 1);
      const to = new Date(now.getFullYear(), m + 1, 1);
      const agg = await prisma.payment.aggregate({
        where: { status: "PAGO", paidDate: { gte: from, lt: to } },
        _sum: { amount: true }, _count: { id: true },
      });
      ws.addRow([
        from.toLocaleDateString("pt-PT", { month: "long", year: "numeric" }),
        agg._sum.amount || 0,
        agg._count.id,
      ]);
    }

  } else if (type === "devedoras") {
    filename = `empresas-devedoras-${now.toISOString().split("T")[0]}.xlsx`;
    const atrasados = await prisma.payment.findMany({
      where: { status: "ATRASADO" },
      include: { company: { select: { name: true, email: true, whatsapp: true, responsible: true } } },
      orderBy: { dueDate: "asc" },
    });
    const ws = wb.addWorksheet("Devedoras");
    ws.columns = [
      { header: "Empresa",         width: 28 }, { header: "Responsável",   width: 22 },
      { header: "Email",           width: 30 }, { header: "WhatsApp",      width: 18 },
      { header: "Vencimento",      width: 18 }, { header: "Valor",         width: 18 },
      { header: "Dias em Atraso",  width: 16 },
    ];
    styleHeader(ws);
    atrasados.forEach(p => ws.addRow([
      p.company?.name ?? "—", p.company?.responsible ?? "—",
      p.company?.email ?? "—", p.company?.whatsapp ?? "—",
      p.dueDate.toLocaleDateString("pt-PT"), p.amount,
      Math.floor((now.getTime() - p.dueDate.getTime()) / (1000 * 60 * 60 * 24)),
    ]));

  } else if (type === "fluxo-caixa") {
    filename = `fluxo-caixa-${now.getFullYear()}.xlsx`;
    const ws = wb.addWorksheet("Fluxo de Caixa");
    ws.columns = [
      { header: "Mês",          width: 24 }, { header: "Receita",      width: 18 },
      { header: "Despesa",      width: 18 }, { header: "Saldo Líquido",width: 18 },
    ];
    styleHeader(ws);
    for (let m = 0; m < 12; m++) {
      const from = new Date(now.getFullYear(), m, 1);
      const to = new Date(now.getFullYear(), m + 1, 1);
      const [rec, sala, desp] = await Promise.all([
        prisma.payment.aggregate({ where: { status: "PAGO", paidDate: { gte: from, lt: to } }, _sum: { amount: true } }),
        prisma.reservation.aggregate({ where: { paymentStatus: "PAGO", startDatetime: { gte: from, lt: to } }, _sum: { totalAmount: true } }),
        prisma.expense.aggregate({ where: { expenseDate: { gte: from, lt: to } }, _sum: { amount: true } }),
      ]);
      const receita = (rec._sum.amount || 0) + (sala._sum.totalAmount || 0);
      const despesa = desp._sum.amount || 0;
      ws.addRow([
        from.toLocaleDateString("pt-PT", { month: "long", year: "numeric" }),
        receita, despesa, receita - despesa,
      ]);
    }

  } else if (type === "despesas") {
    filename = `despesas-${now.getFullYear()}.xlsx`;
    const expenses = await prisma.expense.findMany({
      where: { expenseDate: { gte: startOfYear } },
      orderBy: { expenseDate: "desc" },
    });
    const ws = wb.addWorksheet("Despesas");
    ws.columns = [
      { header: "Categoria",  width: 20 }, { header: "Descrição",  width: 36 },
      { header: "Fornecedor", width: 24 }, { header: "Valor",      width: 18 },
      { header: "Data",       width: 18 }, { header: "Estado",     width: 14 },
      { header: "Notas",      width: 36 },
    ];
    styleHeader(ws);
    expenses.forEach(e => ws.addRow([
      e.category, e.description, e.supplier || "", e.amount,
      e.expenseDate.toLocaleDateString("pt-PT"), e.status, e.notes || "",
    ]));

  } else {
    return NextResponse.json({ error: "Tipo de relatório inválido." }, { status: 400 });
  }

  const buffer = await wb.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": XLS_MIME,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
