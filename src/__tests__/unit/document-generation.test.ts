/**
 * document-generation.test.ts — Testes unitários VOL08 (Sprint VOL08-1)
 *
 * Cobre:
 *   sha256Hex()             — integridade SHA-256 determinística
 *   generateDocument()      — ciclo completo: template → PDF → upload → persist
 *   getDocumentDownloadUrl() — URL assinada
 *   versioning              — versão incremental por entidade
 *   falha Cloudinary        — não cria GeneratedDocument
 *   AuditLog fire-and-forget — falha não bloqueia geração
 *   template inactivo       — lança erro adequado
 *   template inexistente    — lança erro adequado
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";
import { sha256Hex } from "@/lib/document-generation-service";

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    documentTemplate: {
      findUnique: vi.fn(),
    },
    generatedDocument: {
      findFirst:  vi.fn(),
      findUnique: vi.fn(),
      create:     vi.fn(),
      findMany:   vi.fn(),
      count:      vi.fn(),
    },
    erpContract: {
      findUnique: vi.fn(),
    },
    timeline: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("cloudinary", () => ({
  v2: {
    config: vi.fn(),
    uploader: {
      upload: vi.fn(),
    },
    url: vi.fn(),
  },
}));

vi.mock("@/lib/audit-service", () => ({
  recordAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/document-pdf-renderer", () => ({
  renderProposalPdf: vi.fn().mockResolvedValue(Buffer.from("PROPOSAL_PDF_BYTES")),
  renderContractPdf: vi.fn().mockResolvedValue(Buffer.from("CONTRACT_PDF_BYTES")),
}));

// ── Importações após mocks ─────────────────────────────────────────────────────

import { prisma } from "@/lib/prisma";
import { v2 as cloudinary } from "cloudinary";
import { recordAudit } from "@/lib/audit-service";
import {
  generateDocument,
  getDocumentDownloadUrl,
  listGeneratedDocuments,
} from "@/lib/document-generation-service";

// ── Fixtures ───────────────────────────────────────────────────────────────────

const MOCK_TEMPLATE = {
  id:          "tpl_001",
  slug:        "proposta-coworking",
  name:        "Proposta Comercial",
  type:        "PROPOSAL" as const,
  description: "Proposta de teste",
  htmlBody:    "<html>{{nomeEmpresa}}</html>",
  variables:   ["nomeEmpresa", "valorMensal"],
  version:     3,           // versão actual do template
  isActive:    true,
  createdAt:   new Date(),
  updatedAt:   new Date(),
};

const MOCK_GENERATED_DOC = {
  id:              "doc_001",
  templateSlug:    "proposta-coworking",
  templateVersion: 3,
  type:            "PROPOSAL" as const,
  entityType:      "LEAD",
  entityId:        "lead_abc",
  version:         2,
  cloudinaryId:    "azul-cowork/documents/PROPOSAL/LEAD/lead_abc/v2",
  fileName:        "proposta-coworking-v2.pdf",
  fileSizeBytes:   48000,
  sha256Hash:      "aabbcc",
  generatedBy:     "admin_001",
  generatedAt:     new Date(),
  createdAt:       new Date(),
};

const GENERATE_OPTS = {
  templateSlug:  "proposta-coworking",
  entityType:    "LEAD" as const,
  entityId:      "lead_abc",
  vars:          { nomeEmpresa: "Tech Lda", valorMensal: "50000" },
  generatedBy:   "admin_001",
  actorEmail:    "admin@azulcowork.com",
  actorRole:     "ADMIN",
};

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════════
// 1. SHA-256 — integridade determinística
// ═══════════════════════════════════════════════════════════════════════════════

describe("sha256Hex()", () => {
  it("retorna hash hex de 64 caracteres", () => {
    const hash = sha256Hex(Buffer.from("hello"));
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it("é determinístico — mesmo input → mesmo hash", () => {
    const buf = Buffer.from("PDF_CONTENT_INVARIANT");
    expect(sha256Hex(buf)).toBe(sha256Hex(buf));
  });

  it("inputs diferentes → hashes diferentes", () => {
    const h1 = sha256Hex(Buffer.from("doc_v1"));
    const h2 = sha256Hex(Buffer.from("doc_v2"));
    expect(h1).not.toBe(h2);
  });

  it("coincide com cálculo directo do crypto.createHash", () => {
    const buf      = Buffer.from("AZUL_COWORKING_DOC");
    const expected = crypto.createHash("sha256").update(buf).digest("hex");
    expect(sha256Hex(buf)).toBe(expected);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. generateDocument() — fluxo principal
// ═══════════════════════════════════════════════════════════════════════════════

describe("generateDocument()", () => {
  it("cria GeneratedDocument com sha256Hash e templateVersion correctos", async () => {
    vi.mocked(prisma.documentTemplate.findUnique).mockResolvedValue(MOCK_TEMPLATE);

    vi.mocked(prisma.$transaction).mockImplementation(async (fn: (tx: typeof prisma) => Promise<typeof MOCK_GENERATED_DOC>) => {
      vi.mocked(prisma.generatedDocument.findFirst).mockResolvedValue({ version: 1 } as { version: number });
      vi.mocked((cloudinary.uploader.upload as ReturnType<typeof vi.fn>)).mockResolvedValue({
        public_id: "azul-cowork/documents/PROPOSAL/LEAD/lead_abc/v2",
        bytes: 48000,
      });
      vi.mocked(prisma.generatedDocument.create).mockResolvedValue(MOCK_GENERATED_DOC);
      return fn(prisma as unknown as Parameters<typeof fn>[0]);
    });

    vi.mocked(prisma.timeline.create).mockResolvedValue({} as ReturnType<typeof prisma.timeline.create> extends Promise<infer T> ? T : never);

    const result = await generateDocument(GENERATE_OPTS);

    expect(result.templateVersion).toBe(3);   // snapshot do MOCK_TEMPLATE.version
    expect(result.sha256Hash).toBeTruthy();
    expect(result.sha256Hash).toHaveLength(64);
    expect(result.version).toBe(2);
    expect(result.fileName).toBe("proposta-coworking-v2.pdf");
  });

  it("usa templateVersion como snapshot da versão do template (imutável)", async () => {
    // Template está na versão 5 — o documento deve guardar templateVersion=5
    const templateV5 = { ...MOCK_TEMPLATE, version: 5 };
    vi.mocked(prisma.documentTemplate.findUnique).mockResolvedValue(templateV5);

    vi.mocked(prisma.$transaction).mockImplementation(async (fn: (tx: typeof prisma) => Promise<typeof MOCK_GENERATED_DOC>) => {
      vi.mocked(prisma.generatedDocument.findFirst).mockResolvedValue(null);
      vi.mocked((cloudinary.uploader.upload as ReturnType<typeof vi.fn>)).mockResolvedValue({ public_id: "x", bytes: 1000 });
      vi.mocked(prisma.generatedDocument.create).mockResolvedValue({
        ...MOCK_GENERATED_DOC,
        templateVersion: 5,
        version:         1,
      });
      return fn(prisma as unknown as Parameters<typeof fn>[0]);
    });

    const result = await generateDocument(GENERATE_OPTS);
    expect(result.templateVersion).toBe(5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Versioning — versão incremental por entidade
// ═══════════════════════════════════════════════════════════════════════════════

describe("versionamento incremental", () => {
  it("versão 1 quando não há documentos anteriores", async () => {
    vi.mocked(prisma.documentTemplate.findUnique).mockResolvedValue(MOCK_TEMPLATE);

    vi.mocked(prisma.$transaction).mockImplementation(async (fn: (tx: typeof prisma) => Promise<typeof MOCK_GENERATED_DOC>) => {
      vi.mocked(prisma.generatedDocument.findFirst).mockResolvedValue(null); // sem anteriores
      vi.mocked((cloudinary.uploader.upload as ReturnType<typeof vi.fn>)).mockResolvedValue({ public_id: "x/v1", bytes: 5000 });
      vi.mocked(prisma.generatedDocument.create).mockResolvedValue({
        ...MOCK_GENERATED_DOC,
        version: 1,
        fileName: "proposta-coworking-v1.pdf",
      });
      return fn(prisma as unknown as Parameters<typeof fn>[0]);
    });

    const result = await generateDocument(GENERATE_OPTS);
    expect(result.version).toBe(1);
  });

  it("versão N+1 quando já existe versão N", async () => {
    vi.mocked(prisma.documentTemplate.findUnique).mockResolvedValue(MOCK_TEMPLATE);

    vi.mocked(prisma.$transaction).mockImplementation(async (fn: (tx: typeof prisma) => Promise<typeof MOCK_GENERATED_DOC>) => {
      vi.mocked(prisma.generatedDocument.findFirst).mockResolvedValue({ version: 4 } as { version: number }); // versão anterior = 4
      vi.mocked((cloudinary.uploader.upload as ReturnType<typeof vi.fn>)).mockResolvedValue({ public_id: "x/v5", bytes: 5000 });
      vi.mocked(prisma.generatedDocument.create).mockResolvedValue({
        ...MOCK_GENERATED_DOC,
        version: 5,
        fileName: "proposta-coworking-v5.pdf",
      });
      return fn(prisma as unknown as Parameters<typeof fn>[0]);
    });

    const result = await generateDocument(GENERATE_OPTS);
    expect(result.version).toBe(5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Falha Cloudinary — não cria GeneratedDocument
// ═══════════════════════════════════════════════════════════════════════════════

describe("falha de upload Cloudinary", () => {
  it("lança excepção e NÃO chama prisma.generatedDocument.create", async () => {
    vi.mocked(prisma.documentTemplate.findUnique).mockResolvedValue(MOCK_TEMPLATE);

    vi.mocked(prisma.$transaction).mockImplementation(async (fn: (tx: typeof prisma) => Promise<never>) => {
      vi.mocked(prisma.generatedDocument.findFirst).mockResolvedValue(null);
      vi.mocked((cloudinary.uploader.upload as ReturnType<typeof vi.fn>)).mockRejectedValue(
        new Error("Cloudinary upload failed: network timeout")
      );
      return fn(prisma as unknown as Parameters<typeof fn>[0]);
    });

    await expect(generateDocument(GENERATE_OPTS)).rejects.toThrow("Cloudinary upload failed");
    // GeneratedDocument.create NUNCA foi chamado
    expect(prisma.generatedDocument.create).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Template inactivo e inexistente
// ═══════════════════════════════════════════════════════════════════════════════

describe("validações de template", () => {
  it("lança TEMPLATE_NOT_FOUND se slug não existe", async () => {
    vi.mocked(prisma.documentTemplate.findUnique).mockResolvedValue(null);
    await expect(generateDocument(GENERATE_OPTS)).rejects.toThrow("TEMPLATE_NOT_FOUND");
  });

  it("lança TEMPLATE_INACTIVE se isActive=false", async () => {
    vi.mocked(prisma.documentTemplate.findUnique).mockResolvedValue({
      ...MOCK_TEMPLATE,
      isActive: false,
    });
    await expect(generateDocument(GENERATE_OPTS)).rejects.toThrow("TEMPLATE_INACTIVE");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. AuditLog fire-and-forget — falha não bloqueia geração
// ═══════════════════════════════════════════════════════════════════════════════

describe("AuditLog fire-and-forget", () => {
  it("geração conclui mesmo que recordAudit lance excepção", async () => {
    vi.mocked(prisma.documentTemplate.findUnique).mockResolvedValue(MOCK_TEMPLATE);
    vi.mocked(recordAudit).mockRejectedValue(new Error("DB audit timeout"));

    vi.mocked(prisma.$transaction).mockImplementation(async (fn: (tx: typeof prisma) => Promise<typeof MOCK_GENERATED_DOC>) => {
      vi.mocked(prisma.generatedDocument.findFirst).mockResolvedValue(null);
      vi.mocked((cloudinary.uploader.upload as ReturnType<typeof vi.fn>)).mockResolvedValue({ public_id: "x/v1", bytes: 1000 });
      vi.mocked(prisma.generatedDocument.create).mockResolvedValue({
        ...MOCK_GENERATED_DOC, version: 1,
      });
      return fn(prisma as unknown as Parameters<typeof fn>[0]);
    });

    // Deve resolver sem lançar — recordAudit falhou mas é fire-and-forget
    await expect(generateDocument(GENERATE_OPTS)).resolves.toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. getDocumentDownloadUrl — URL assinada temporária
// ═══════════════════════════════════════════════════════════════════════════════

describe("getDocumentDownloadUrl()", () => {
  it("retorna URL não-vazia e expiresAt no futuro", async () => {
    vi.mocked(prisma.generatedDocument.findUnique).mockResolvedValue({
      cloudinaryId: "azul-cowork/documents/PROPOSAL/LEAD/lead_abc/v1",
    } as Parameters<typeof prisma.generatedDocument.findUnique>[0] extends object ? { cloudinaryId: string } : never);

    vi.mocked(cloudinary.url).mockReturnValue("https://res.cloudinary.com/signed/azul-cowork/documents/PROPOSAL/LEAD/lead_abc/v1?expires_at=9999999999");

    const result = await getDocumentDownloadUrl("doc_001");

    expect(result.url).toContain("cloudinary.com");
    expect(result.expiresAt).toBeInstanceOf(Date);
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("lança DOCUMENT_NOT_FOUND se documento não existe", async () => {
    vi.mocked(prisma.generatedDocument.findUnique).mockResolvedValue(null);
    await expect(getDocumentDownloadUrl("doc_xyz")).rejects.toThrow("DOCUMENT_NOT_FOUND");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. listGeneratedDocuments — paginação
// ═══════════════════════════════════════════════════════════════════════════════

describe("listGeneratedDocuments()", () => {
  it("retorna paginação correcta", async () => {
    vi.mocked(prisma.generatedDocument.findMany).mockResolvedValue([MOCK_GENERATED_DOC] as typeof MOCK_GENERATED_DOC[]);
    vi.mocked(prisma.generatedDocument.count).mockResolvedValue(42);

    const result = await listGeneratedDocuments({ page: 2, limit: 10 });

    expect(result.pagination.page).toBe(2);
    expect(result.pagination.limit).toBe(10);
    expect(result.pagination.total).toBe(42);
    expect(result.pagination.pages).toBe(5);
    expect(result.docs).toHaveLength(1);
  });

  it("limita max a 50 por página", async () => {
    vi.mocked(prisma.generatedDocument.findMany).mockResolvedValue([]);
    vi.mocked(prisma.generatedDocument.count).mockResolvedValue(0);

    const result = await listGeneratedDocuments({ page: 1, limit: 999 });
    expect(result.pagination.limit).toBe(50);
  });
});
