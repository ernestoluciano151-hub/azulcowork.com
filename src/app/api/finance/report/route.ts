import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");

  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  let workbook: XLSX.WorkBook;
  let filename = "relatorio.xlsx";

  if (type === "receita-mensal") {
    filename = `receita-mensal-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}.xlsx`;
    const payments = await prisma.payment.findMany({
      where: { status: "PAGO", paidDate: { gte: startOfMonth } },
      include: { company: { select: { name: true } } },
      orderBy: { paidDate: "desc" },
    });
    const rows = payments.map((p) => ({
      Empresa: p.company?.name ?? "—",
      Valor: p.amount,
      "Data Pagamento": p.paidDate ? p.paidDate.toLocaleDateString("pt-PT") : "",
      Vencimento: p.dueDate.toLocaleDateString("pt-PT"),
      Estado: p.status,
      "Método": p.paymentMethod || "",
      Notas: p.notes || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, ws, "Receita Mensal");
  } else if (type === "receita-anual") {
    filename = `receita-anual-${now.getFullYear()}.xlsx`;
    // Monthly breakdown
    const monthlyRows = [];
    for (let m = 0; m < 12; m++) {
      const from = new Date(now.getFullYear(), m, 1);
      const to = new Date(now.getFullYear(), m + 1, 1);
      const agg = await prisma.payment.aggregate({
        where: { status: "PAGO", paidDate: { gte: from, lt: to } },
        _sum: { amount: true },
        _count: { id: true },
      });
      monthlyRows.push({
        Mês: from.toLocaleDateString("pt-PT", { month: "long", year: "numeric" }),
        "Total Recebido": agg._sum.amount || 0,
        "Nº Pagamentos": agg._count.id,
      });
    }
    const ws = XLSX.utils.json_to_sheet(monthlyRows);
    workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, ws, "Receita Anual");
  } else if (type === "devedoras") {
    filename = `empresas-devedoras-${now.toISOString().split("T")[0]}.xlsx`;
    const atrasados = await prisma.payment.findMany({
      where: { status: "ATRASADO" },
      include: { company: { select: { name: true, email: true, whatsapp: true, responsible: true } } },
      orderBy: { dueDate: "asc" },
    });
    const rows = atrasados.map((p) => ({
      Empresa:     p.company?.name        ?? "—",
      Responsável: p.company?.responsible ?? "—",
      Email:       p.company?.email       ?? "—",
      WhatsApp:    p.company?.whatsapp    ?? "—",
      Vencimento: p.dueDate.toLocaleDateString("pt-PT"),
      Valor: p.amount,
      "Dias em Atraso": Math.floor((now.getTime() - p.dueDate.getTime()) / (1000 * 60 * 60 * 24)),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, ws, "Devedoras");
  } else if (type === "fluxo-caixa") {
    filename = `fluxo-caixa-${now.getFullYear()}.xlsx`;
    const rows = [];
    for (let m = 0; m < 12; m++) {
      const from = new Date(now.getFullYear(), m, 1);
      const to = new Date(now.getFullYear(), m + 1, 1);
      const [rec, desp] = await Promise.all([
        prisma.payment.aggregate({ where: { status: "PAGO", paidDate: { gte: from, lt: to } }, _sum: { amount: true } }),
        prisma.expense.aggregate({ where: { expenseDate: { gte: from, lt: to } }, _sum: { amount: true } }),
      ]);
      const receita = rec._sum.amount || 0;
      const despesa = desp._sum.amount || 0;
      rows.push({
        Mês: from.toLocaleDateString("pt-PT", { month: "long", year: "numeric" }),
        Receita: receita,
        Despesa: despesa,
        "Saldo Líquido": receita - despesa,
      });
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, ws, "Fluxo de Caixa");
  } else if (type === "despesas") {
    filename = `despesas-${now.getFullYear()}.xlsx`;
    const expenses = await prisma.expense.findMany({
      where: { expenseDate: { gte: startOfYear } },
      orderBy: { expenseDate: "desc" },
    });
    const rows = expenses.map((e) => ({
      Categoria: e.category,
      Descrição: e.description,
      Fornecedor: e.supplier || "",
      Valor: e.amount,
      Data: e.expenseDate.toLocaleDateString("pt-PT"),
      Estado: e.status,
      Notas: e.notes || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, ws, "Despesas");
  } else {
    return NextResponse.json({ error: "Tipo de relatório inválido." }, { status: 400 });
  }

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
