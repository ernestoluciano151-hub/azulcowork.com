/**
 * POST /api/admin/documents/generate
 *
 * Gera um documento PDF a partir de um template e uma entidade.
 * body: {
 *   templateSlug: string,
 *   entityType:   "LEAD" | "ERPCONTRACT" | "COMPANY",
 *   entityId:     string,
 *   vars:         Record<string, string>
 * }
 *
 * Retorna: GenerateDocumentResult + { message }
 *
 * Rate limiting: máx 10 gerações / 60s por IP (operação pesada — renderização PDF)
 * Permissões: ADMIN apenas
 * VOL08 — Sprint VOL08-2B
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole }               from "@/lib/rbac";
import { isApiRateLimited }          from "@/lib/rateLimit";
import { requireSession }            from "@/lib/auth";
import { generateDocument }          from "@/lib/document-generation-service";

const VALID_ENTITY_TYPES = ["LEAD", "ERPCONTRACT", "COMPANY"] as const;
type EntityType = typeof VALID_ENTITY_TYPES[number];

export async function POST(req: NextRequest) {
  // Rate limiting — geração de PDF é operação pesada
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  if (isApiRateLimited(ip, "doc-generate")) {
    return NextResponse.json(
      { error: "Demasiadas gerações. Aguarde antes de tentar novamente." },
      { status: 429 }
    );
  }

  const authErr = await requireRole(req, ["ADMIN"]);
  if (authErr) return authErr;

  // Obter actor para AuditLog
  const session = await requireSession(req);
  const actorId    = typeof session === "object" && "id"    in session ? String(session.id)    : "ADMIN";
  const actorEmail = typeof session === "object" && "email" in session ? String(session.email) : "unknown";
  const actorRole  = typeof session === "object" && "role"  in session ? String(session.role)  : "ADMIN";

  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { templateSlug, entityType, entityId, vars } = body as {
    templateSlug?: string;
    entityType?:   string;
    entityId?:     string;
    vars?:         Record<string, string>;
  };

  if (!templateSlug || typeof templateSlug !== "string") {
    return NextResponse.json({ error: "templateSlug obrigatório" }, { status: 400 });
  }
  if (!entityType || !VALID_ENTITY_TYPES.includes(entityType as EntityType)) {
    return NextResponse.json(
      { error: `entityType inválido. Valores válidos: ${VALID_ENTITY_TYPES.join(", ")}` },
      { status: 400 }
    );
  }
  if (!entityId || typeof entityId !== "string") {
    return NextResponse.json({ error: "entityId obrigatório" }, { status: 400 });
  }

  try {
    const result = await generateDocument({
      templateSlug,
      entityType:  entityType as EntityType,
      entityId,
      vars:        vars ?? {},
      generatedBy: actorId,
      actorEmail,
      actorRole,
    });

    return NextResponse.json(
      {
        message: "Documento gerado com sucesso.",
        document: result,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);

    if (msg.startsWith("TEMPLATE_NOT_FOUND")) {
      return NextResponse.json({ error: "Template não encontrado" }, { status: 404 });
    }
    if (msg.startsWith("TEMPLATE_INACTIVE")) {
      return NextResponse.json({ error: "Template inactivo" }, { status: 422 });
    }
    if (msg.startsWith("PDF_RENDERER_NOT_IMPLEMENTED")) {
      return NextResponse.json({ error: "Tipo de documento não suportado neste sprint" }, { status: 422 });
    }
    if (msg.startsWith("CLOUDINARY_NOT_CONFIGURED")) {
      return NextResponse.json({ error: "Armazenamento de ficheiros não configurado" }, { status: 503 });
    }

    console.error("[POST /api/admin/documents/generate]", err);
    return NextResponse.json({ error: "Erro interno ao gerar documento" }, { status: 500 });
  }
}
