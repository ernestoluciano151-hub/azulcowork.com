/**
 * GET  /api/portal/documents  — lista documentos da empresa
 * POST /api/portal/documents  — upload de novo documento (PORTAL_ADMIN ou superior)
 *
 * Upload: multipart/form-data
 *   - file:        Blob (PDF, DOCX, XLSX, JPG, PNG — máx. 50 MB)
 *   - title:       string (obrigatório)
 *   - category:    "contrato" | "fatura-manual" | "declaracao" | "comprovante" | "guia" | "outro"
 *   - description: string (opcional)
 *   - tags:        string JSON array (opcional)
 *   - changeNote:  string (opcional, default "Versão inicial")
 *
 * Isolamento: companyId obrigatório em todas as queries.
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePortalSession, requirePortalRole } from "@/lib/portal-auth-service";
import { prisma } from "@/lib/prisma";
import { PortalRole } from "@prisma/client";
import {
  createDocument,
  VALID_CATEGORIES,
  type DocumentCategory,
} from "@/lib/portal-documents-service";

// ── GET — lista documentos ─────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const { user, error } = await requirePortalSession();
    if (error) return error;

    const { searchParams } = req.nextUrl;
    const category = searchParams.get("category");

    if (category && !VALID_CATEGORIES.includes(category as DocumentCategory)) {
      return NextResponse.json({ error: "Categoria inválida." }, { status: 400 });
    }

    const documents = await prisma.portalDocument.findMany({
      where: {
        companyId: user.companyId,   // isolamento multi-tenant
        isActive:  true,
        ...(category ? { category } : {}),
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id:               true,
        title:            true,
        category:         true,
        description:      true,
        tags:             true,
        currentVersionId: true,
        uploadedByName:   true,
        createdAt:        true,
        updatedAt:        true,
        versions: {
          orderBy: { version: "desc" },
          take:    1,
          select:  { version: true, mimeType: true, sizeBytes: true, createdAt: true },
        },
      },
    });

    // Adicionar número da versão actual ao resultado
    const data = documents.map(doc => ({
      ...doc,
      currentVersion: doc.versions[0] ?? null,
      versions:       undefined,  // não retornar lista de versões na listagem
    }));

    return NextResponse.json({ data });
  } catch (err) {
    console.error("[GET /api/portal/documents]", err);
    return NextResponse.json({ error: "Ocorreu um erro interno." }, { status: 500 });
  }
}

// ── POST — upload de documento ─────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const { user, error } = await requirePortalRole(PortalRole.PORTAL_ADMIN);
    if (error) return error;

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ error: "Pedido deve ser multipart/form-data." }, { status: 400 });
    }

    const file        = formData.get("file");
    const title       = formData.get("title")?.toString()?.trim();
    const category    = formData.get("category")?.toString()?.trim();
    const description = formData.get("description")?.toString()?.trim();
    const tagsRaw     = formData.get("tags")?.toString();
    const changeNote  = formData.get("changeNote")?.toString()?.trim();

    // Validações básicas
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "Campo 'file' é obrigatório." }, { status: 400 });
    }
    if (!title || title.length < 2 || title.length > 200) {
      return NextResponse.json({ error: "Campo 'title' é obrigatório (2–200 caracteres)." }, { status: 400 });
    }
    if (!category || !VALID_CATEGORIES.includes(category as DocumentCategory)) {
      return NextResponse.json(
        { error: `Campo 'category' inválido. Aceites: ${VALID_CATEGORIES.join(", ")}.` },
        { status: 400 }
      );
    }

    // Parsear tags
    let tags: string[] = [];
    if (tagsRaw) {
      try {
        const parsed = JSON.parse(tagsRaw);
        if (Array.isArray(parsed)) tags = parsed.filter(t => typeof t === "string").slice(0, 10);
      } catch {
        // tags inválidas ignoradas
      }
    }

    // Ler buffer do ficheiro
    const buffer   = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || "application/octet-stream";
    const filename = (file as File).name ?? "documento";

    // Criar documento + versão 1
    let result: { documentId: string; versionId: string };
    try {
      result = await createDocument({
        companyId:      user.companyId,
        title,
        category:       category as DocumentCategory,
        description,
        tags,
        buffer,
        mimeType,
        filename,
        changeNote,
        uploadedById:   user.sub,
        uploadedByName: user.name,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg === "CLOUDINARY_NOT_CONFIGURED") {
        return NextResponse.json(
          { error: "Serviço de armazenamento temporariamente indisponível." },
          { status: 503 }
        );
      }
      if (msg.startsWith("Ficheiro")) {
        return NextResponse.json({ error: msg }, { status: 400 });
      }
      throw err;
    }

    // Buscar documento criado para retornar
    const doc = await prisma.portalDocument.findUnique({
      where:  { id: result.documentId },
      select: {
        id:             true,
        title:          true,
        category:       true,
        description:    true,
        tags:           true,
        uploadedByName: true,
        createdAt:      true,
        versions: {
          orderBy: { version: "desc" },
          take:    1,
          select:  { id: true, version: true, mimeType: true, sizeBytes: true },
        },
      },
    });

    return NextResponse.json({ ok: true, data: doc }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/portal/documents]", err);
    return NextResponse.json({ error: "Ocorreu um erro interno." }, { status: 500 });
  }
}
