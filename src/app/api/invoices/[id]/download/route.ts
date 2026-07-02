import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";
import { format } from "date-fns";
import { pt } from "date-fns/locale";

// ── colours (match template) ────────────────────────────────────────────────
const NAVY    = "#003366";
const GREY1   = "#666666";
const GREY2   = "#777777";
const GREY3   = "#333333";
const LIGHT   = "#CCCCCC";
const WHITE   = "#FFFFFF";

function formatKzAmount(amount: number): string {
  return new Intl.NumberFormat("pt-AO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount) + " AOA";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: { company: true },
  });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // ── derive values ─────────────────────────────────────────────────────────
  const issueDate   = format(new Date(invoice.issueDate), "dd/MM/yyyy", { locale: pt });
  const dueDateFmt  = format(new Date(invoice.dueDate),   "dd/MM/yyyy", { locale: pt });
  const issueDateIso= format(new Date(invoice.issueDate), "yyyy-MM-dd");
  const refNum      = invoice.invoiceNumber.replace("FT-", "");
  const receiptRef  = `AZC/REC/${refNum}`;
  const companyName = invoice.company.name;
  const companyNif  = invoice.company.nif || "N/D";
  const amountFmt   = formatKzAmount(invoice.amount);
  const payMethod   = invoice.paymentMethod || "Transferência Bancária";
  const serviceType = invoice.serviceType;

  // ── build PDF ─────────────────────────────────────────────────────────────
  const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50, info: {
      Title: `Recibo ${receiptRef}`,
      Author: "Azul Coworking",
    }});

    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end",  () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W    = doc.page.width;
    const M    = 50; // margin
    const CW   = W - M * 2; // content width

    // ── HEADER ───────────────────────────────────────────────────────────────
    const logoPath = path.join(process.cwd(), "public", "assets", "logo-recibo.jpg");
    const logoH = 55;
    const logoW = 80;

    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, M, M, { width: logoW, height: logoH });
    }

    // Company title block (right of logo)
    const titleX = M + logoW + 16;
    const titleW = CW - logoW - 16;

    doc.font("Helvetica-Bold")
       .fontSize(17)
       .fillColor(NAVY)
       .text("AZUL COWORKING", titleX, M + 8, { width: titleW });

    doc.font("Helvetica")
       .fontSize(8)
       .fillColor(GREY1)
       .text(
         "VERSÃO DE NEGÓCIOS - COMÉRCIO GERAL E PRESTAÇÃO DE SERVIÇOS, LDA  |  NIF: 5002174308",
         titleX, M + 30, { width: titleW }
       );

    // Navy underline below title block
    const lineY = M + logoH + 4;
    doc.moveTo(titleX, lineY).lineTo(W - M, lineY).lineWidth(2).strokeColor(NAVY).stroke();

    // ── ADDRESS BLOCK ─────────────────────────────────────────────────────────
    let y = lineY + 22;

    doc.font("Helvetica-Oblique").fontSize(10).fillColor(GREY2)
       .text("Exmo(s) Senhor(es)", M, y);
    y += 16;

    doc.font("Helvetica-Bold").fontSize(13).fillColor(NAVY)
       .text(companyName, M, y, { width: CW });
    y += 20;

    doc.font("Helvetica").fontSize(10).fillColor(GREY3)
       .text(`NIF: ${companyNif}`, M, y);
    y += 15;

    doc.font("Helvetica").fontSize(10).fillColor(GREY3)
       .text(invoice.company.email, M, y);
    y += 15;

    doc.font("Helvetica").fontSize(10).fillColor(GREY3)
       .text("LUANDA", M, y);
    y += 26;

    // ── REFERENCE TABLE ───────────────────────────────────────────────────────
    const col = CW / 3;
    const refHeaders  = ["Referência",       "Tipo de Pagamento",  "Data"];
    const refValues   = [receiptRef,          payMethod,            issueDateIso];

    // Header row
    refHeaders.forEach((h, i) => {
      const x = M + col * i;
      doc.font("Helvetica").fontSize(8).fillColor(GREY2)
         .text(h, x, y, { width: col - 4 });
    });
    y += 13;
    // Light separator
    doc.moveTo(M, y).lineTo(W - M, y).lineWidth(0.5).strokeColor(LIGHT).stroke();
    y += 6;

    // Value row
    refValues.forEach((v, i) => {
      const x = M + col * i;
      doc.font("Helvetica-Bold").fontSize(10).fillColor(GREY3)
         .text(v, x, y, { width: col - 4 });
    });
    y += 28;

    // ── DETAIL SECTION ────────────────────────────────────────────────────────
    doc.font("Helvetica-Bold").fontSize(11).fillColor(NAVY)
       .text("Detalhe do Pagamento", M, y);
    y += 8;
    doc.moveTo(M, y).lineTo(W - M, y).lineWidth(1).strokeColor(NAVY).stroke();
    y += 12;

    // Description paragraph
    doc.font("Helvetica").fontSize(10).fillColor(GREY3)
       .text(
         `Recibo de pagamento referente a ${serviceType} no Azul Coworking, ` +
         `com início em ${issueDate} e vencimento em ${dueDateFmt}.`,
         M, y, { width: CW }
       );
    y += 34;

    // Detail rows helper
    function detailRow(label: string, value: string, highlight = false) {
      doc.font("Helvetica").fontSize(9).fillColor(GREY2)
         .text(label, M, y, { width: 130, continued: false });
      doc.font("Helvetica-Bold").fontSize(10)
         .fillColor(highlight ? NAVY : GREY3)
         .text(value, M + 135, y, { width: CW - 135 });
      y += 4;
      doc.moveTo(M, y + 12).lineTo(W - M, y + 12).lineWidth(0.4).strokeColor(LIGHT).stroke();
      y += 18;
    }

    detailRow("Serviço / Plano:",   serviceType);
    detailRow("Período:",           `${issueDate}  –  ${dueDateFmt}`);
    detailRow("Beneficiário:",      "VERSÃO DE NEGÓCIOS - COM. GERAL E PREST. SERV., LDA");
    detailRow("Nº de conta / Ref:", "212870210001 AKZ  |  Banco BCS");
    detailRow("Montante:",          amountFmt, true);
    detailRow("Moeda:",             "AOA (Kwanzas angolanos)");

    // Total pago — highlighted box
    y += 4;
    doc.rect(M, y, CW, 28).fillAndStroke(NAVY, NAVY);
    doc.font("Helvetica").fontSize(9).fillColor(WHITE)
       .text("Total pago:", M + 10, y + 8, { width: 130 });
    doc.font("Helvetica-Bold").fontSize(13).fillColor(WHITE)
       .text(amountFmt, M + 140, y + 6, { width: CW - 150 });
    y += 38;

    // Disclaimer note
    doc.font("Helvetica-Oblique").fontSize(8).fillColor(GREY2)
       .text(
         "* Este documento serve como comprovativo de pagamento e deve ser assinado pelo cliente aquando da recepção.",
         M, y, { width: CW }
       );
    y += 28;

    // Closing
    doc.font("Helvetica").fontSize(10).fillColor(GREY3)
       .text("Com os nossos melhores cumprimentos,", M, y);
    y += 16;
    doc.font("Helvetica-Bold").fontSize(10).fillColor(NAVY)
       .text("Equipa Azul Coworking", M, y);

    // ── FOOTER ────────────────────────────────────────────────────────────────
    const footY = doc.page.height - 60;
    doc.moveTo(M, footY).lineTo(W - M, footY).lineWidth(0.5).strokeColor(LIGHT).stroke();

    doc.font("Helvetica-Bold").fontSize(9).fillColor(NAVY)
       .text("Azul Coworking", M, footY + 8);
    doc.font("Helvetica").fontSize(8).fillColor(GREY2)
       .text("Bairro Azul, Edifício 18, Luanda, Angola  (perto do Cine Tivoli)", M, footY + 20)
       .text("976 467 124  |  geral@azulcowork.com  |  azulcowork.com", M, footY + 31);

    doc.font("Helvetica-Oblique").fontSize(7).fillColor(LIGHT)
       .text("(documento emitido electronicamente — não carece de assinatura)", M, footY + 43, { width: CW, align: "right" });

    doc.end();
  });

  const filename = `Recibo_${receiptRef.replace(/\//g, "-")}_${companyName.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;

  return new NextResponse(pdfBuffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
