# Estratégia de Testes — Volume 03 — Portal do Cliente

> **Volume:** 03 — Portal do Cliente  
> **Estado:** ✅ Actualizado em VOL03-10E — 29 Jul 2026 · 223+ assertions · 8 ficheiros  
> **Framework:** Vitest 4.1.10  
> **Target de cobertura:** ≥ 70% nas funções críticas do portal

---

## 1. Princípios

- Toda lógica de segurança e isolamento de dados tem testes obrigatórios
- Testes de isolamento multi-tenant são prioritários: nenhum cliente acede a dados de outra empresa
- Downloads assinados têm testes de expiração e validade
- O motor de notificações tem testes de estado e re-tentativas
- Testes de SLA de suporte verificam cálculo em horas úteis

---

## 2. Estrutura de Ficheiros de Teste

```
src/__tests__/
├── unit/
│   ├── portal-auth-service.test.ts          # Magic link, sessões, RBAC
│   ├── portal-document-service.test.ts      # Signed URLs, auditoria, versionamento
│   ├── portal-notification-service.test.ts  # Estados, re-tentativas, fallback
│   ├── portal-omnichannel-service.test.ts   # Orquestração multicanal
│   ├── portal-support-service.test.ts       # SLA, ciclo de vida de tickets
│   ├── portal-permission-service.test.ts    # RBAC: 4 roles × 18 permissões
│   └── portal-isolation.test.ts             # Isolamento multi-tenant
├── integration/
│   ├── portal-auth.test.ts                  # Fluxo completo Magic Link
│   ├── portal-documents.test.ts             # Upload → Download → Auditoria
│   └── portal-notifications.test.ts         # Evento → Notificação → Estado
└── e2e/                                     # Manual (sem automação v1)
```

---

## 3. Testes Unitários — Portal Auth Service

```typescript
// src/__tests__/unit/portal-auth-service.test.ts

describe("PortalAuthService", () => {

  describe("Magic Link", () => {
    it("cria magic link com token único de 32 bytes", async () => {
      const link = await createMagicLink("user@empresa.com");
      expect(link.token).toHaveLength(64); // hex de 32 bytes
      expect(link.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it("magic link expira em 15 minutos", async () => {
      const link = await createMagicLink("user@empresa.com");
      const diff = link.expiresAt.getTime() - Date.now();
      expect(diff).toBeLessThanOrEqual(15 * 60 * 1000);
      expect(diff).toBeGreaterThan(14 * 60 * 1000);
    });

    it("magic link só pode ser usado uma vez (isUsed = true após uso)", async () => {
      const link = await createMagicLink("user@empresa.com");
      await consumeMagicLink(link.token);
      await expect(consumeMagicLink(link.token)).rejects.toThrow("MAGIC_LINK_ALREADY_USED");
    });

    it("magic link expirado é rejeitado", async () => {
      const expiredLink = { token: "abc", expiresAt: new Date(Date.now() - 1000), isUsed: false };
      expect(isMagicLinkValid(expiredLink)).toBe(false);
    });

    it("rate limit: máximo 3 magic links por hora por email", async () => {
      await createMagicLink("user@empresa.com");
      await createMagicLink("user@empresa.com");
      await createMagicLink("user@empresa.com");
      await expect(createMagicLink("user@empresa.com")).rejects.toThrow("RATE_LIMIT_EXCEEDED");
    });
  });

  describe("PortalSession", () => {
    it("sessão criada com expiração de 8 horas", () => {
      const session = buildPortalSession(portalUserId);
      const diff = session.expiresAt.getTime() - Date.now();
      expect(diff).toBeLessThanOrEqual(8 * 60 * 60 * 1000);
    });

    it("sessão revogada é inválida", async () => {
      const session = await createPortalSession(portalUser);
      await revokePortalSession(session.token);
      const found = await findActivePortalSession(session.token);
      expect(found).toBeNull();
    });

    it("sessão expirada não é retornada", async () => {
      // sessão com expiresAt no passado
      const found = await findActivePortalSession(expiredToken);
      expect(found).toBeNull();
    });
  });

  describe("RBAC do Portal", () => {
    it("PORTAL_VIEWER não pode criar utilizadores", () => {
      expect(canDo("PORTAL_VIEWER", "users:create")).toBe(false);
    });

    it("PORTAL_OWNER pode transferir ownership", () => {
      expect(canDo("PORTAL_OWNER", "users:transfer-ownership")).toBe(true);
    });

    it("PORTAL_ADMIN não pode transferir ownership", () => {
      expect(canDo("PORTAL_ADMIN", "users:transfer-ownership")).toBe(false);
    });

    it("PORTAL_VIEWER pode ver documentos", () => {
      expect(canDo("PORTAL_VIEWER", "documents:view")).toBe(true);
    });

    it("PORTAL_VIEWER não pode fazer upload de documentos", () => {
      expect(canDo("PORTAL_VIEWER", "documents:upload")).toBe(false);
    });

    it("PORTAL_VIEWER não pode criar tickets de suporte", () => {
      expect(canDo("PORTAL_VIEWER", "support:create")).toBe(false);
    });
  });
});
```

---

## 4. Testes Unitários — Isolamento Multi-Tenant

```typescript
// src/__tests__/unit/portal-isolation.test.ts

describe("Isolamento Multi-Tenant", () => {

  it("utilizador da empresa A não acede a documentos da empresa B", async () => {
    const userA = { id: "user-A", companyId: "company-A" };
    const docB  = { id: "doc-B", companyId: "company-B" };

    await expect(
      getPortalDocument(docB.id, userA)
    ).rejects.toThrow("NOT_FOUND"); // não revelar que o doc existe
  });

  it("utilizador da empresa A não vê faturas da empresa B", async () => {
    const userA = { id: "user-A", companyId: "company-A" };
    const invoices = await listPortalInvoices(userA);
    expect(invoices.every(inv => inv.companyId === "company-A")).toBe(true);
  });

  it("query de contratos tem companyId no WHERE obrigatório", () => {
    const query = buildContractsQuery({ companyId: "company-A" });
    expect(query.where).toHaveProperty("companyId", "company-A");
  });

  it("utilizador da empresa A não pode ver tickets de suporte da empresa B", async () => {
    const userA = { id: "user-A", companyId: "company-A" };
    const ticketB = { id: "ticket-B", companyId: "company-B" };

    await expect(
      getPortalTicket(ticketB.id, userA)
    ).rejects.toThrow("NOT_FOUND");
  });

  it("URL assinada para doc de outra empresa é rejeitada antes de gerar URL", async () => {
    const userA = { id: "user-A", companyId: "company-A" };
    const docB  = { id: "doc-B", companyId: "company-B" };

    await expect(
      generateSignedDownloadUrl(docB.id, userA)
    ).rejects.toThrow("NOT_FOUND");
    // Sistema nunca chega a chamar o Cloudinary
  });
});
```

---

## 5. Testes Unitários — Documentos e URLs Assinadas

```typescript
// src/__tests__/unit/portal-document-service.test.ts

describe("PortalDocumentService", () => {

  describe("Signed URLs", () => {
    it("URL assinada tem TTL de 15 minutos", () => {
      const result = buildSignedUrlParams(publicId);
      const ttlSeconds = result.expiresAt - Math.round(Date.now() / 1000);
      expect(ttlSeconds).toBeLessThanOrEqual(900); // 15 min
      expect(ttlSeconds).toBeGreaterThan(890);
    });

    it("URL directa do Cloudinary nunca é devolvida", () => {
      const result = generateDownloadUrl(publicId);
      expect(result).toContain("signature=");       // URL assinada
      expect(result).not.toContain("/upload/");     // não é URL directa
    });
  });

  describe("Auditoria de Documentos", () => {
    it("download regista PortalDocumentAccess com action DOWNLOAD", async () => {
      const spy = vi.spyOn(prisma.portalDocumentAccess, "create");
      await requestDocumentDownload(docId, portalUser);
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: "DOWNLOAD" }) })
      );
    });

    it("visualização de detalhe regista action VIEW", async () => {
      const spy = vi.spyOn(prisma.portalDocumentAccess, "create");
      await viewDocumentDetail(docId, portalUser);
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: "VIEW" }) })
      );
    });

    it("download cria TimelineEntry na empresa", async () => {
      const spy = vi.spyOn(prisma.timelineEntry, "create");
      await requestDocumentDownload(docId, portalUser);
      expect(spy).toHaveBeenCalled();
    });
  });

  describe("Versionamento", () => {
    it("nova versão incrementa version int", async () => {
      const v1 = await createDocumentVersion(docId, { file: "v1.pdf" });
      const v2 = await createDocumentVersion(docId, { file: "v2.pdf" });
      expect(v2.version).toBe(v1.version + 1);
    });

    it("nova versão actualiza currentVersionId no documento", async () => {
      const v2 = await createDocumentVersion(docId, { file: "v2.pdf" });
      const doc = await prisma.portalDocument.findUnique({ where: { id: docId } });
      expect(doc?.currentVersionId).toBe(v2.id);
    });

    it("versões anteriores são imutáveis — não são apagadas", async () => {
      await createDocumentVersion(docId, { file: "v2.pdf" });
      const versions = await prisma.portalDocumentVersion.findMany({
        where: { documentId: docId }
      });
      expect(versions.length).toBe(2);
    });
  });
});
```

---

## 6. Testes Unitários — Notificações

```typescript
// src/__tests__/unit/portal-notification-service.test.ts

describe("PortalNotificationService", () => {

  describe("Máquina de Estados", () => {
    it("transição PENDING → SENT após envio bem-sucedido", async () => {
      const n = await sendNotification({ type: "INVOICE_ISSUED", companyId: "c1" });
      expect(n.status).toBe("SENT");
      expect(n.sentAt).toBeDefined();
    });

    it("transição SENT → READ ao marcar como lida", async () => {
      const n = await markNotificationRead(notificationId, portalUserId);
      expect(n.status).toBe("READ");
      expect(n.readAt).toBeDefined();
    });

    it("3 falhas → status FAILED", async () => {
      vi.mocked(emailService.send).mockRejectedValue(new Error("SMTP_ERROR"));
      const n = await retryNotification(pendingNotification);
      expect(n.attempts).toBe(3);
      expect(n.status).toBe("FAILED");
    });
  });

  describe("Motor de Re-tentativas", () => {
    it("backoff: tentativa 1 → nextRetryAt + 5 min", () => {
      const nextRetry = calculateNextRetry(1);
      const diff = nextRetry.getTime() - Date.now();
      expect(diff).toBeCloseTo(5 * 60 * 1000, -4);
    });

    it("backoff: tentativa 2 → nextRetryAt + 30 min", () => {
      const nextRetry = calculateNextRetry(2);
      const diff = nextRetry.getTime() - Date.now();
      expect(diff).toBeCloseTo(30 * 60 * 1000, -4);
    });

    it("falha em WhatsApp → fallback para email", async () => {
      vi.mocked(whatsAppService.send).mockRejectedValue(new Error("META_API_ERROR"));
      const emailSpy = vi.spyOn(emailService, "send");
      await sendOmnichannelNotification({ channel: "WHATSAPP", ...event });
      expect(emailSpy).toHaveBeenCalled(); // fallback activado
    });
  });

  describe("Preferências do Utilizador", () => {
    it("utilizador com notifyWhatsapp=false não recebe WhatsApp", async () => {
      const user = { ...portalUser, notifyWhatsapp: false };
      const waSpy = vi.spyOn(whatsAppService, "send");
      await sendOmnichannelNotification(event, user);
      expect(waSpy).not.toHaveBeenCalled();
    });

    it("CONTRACT_EXPIRING enviado a PORTAL_OWNER independente das preferências", async () => {
      const owner = { ...portalUser, role: "PORTAL_OWNER", notifyEmail: false };
      const emailSpy = vi.spyOn(emailService, "send");
      await sendOmnichannelNotification({ type: "CONTRACT_EXPIRING", ...event }, owner);
      expect(emailSpy).toHaveBeenCalled(); // override de preferências
    });
  });
});
```

---

## 7. Testes Unitários — Suporte e SLA

```typescript
// src/__tests__/unit/portal-support-service.test.ts

describe("PortalSupportService", () => {

  describe("Numeração de Tickets", () => {
    it("gera número no formato ST-YYYY-NNNNNN", () => {
      const number = formatTicketNumber(2026, 1);
      expect(number).toBe("ST-2026-000001");
    });

    it("número é sequencial e único (DocumentCounter)", async () => {
      const n1 = await getNextTicketNumber();
      const n2 = await getNextTicketNumber();
      expect(parseInt(n2.split("-")[2])).toBe(parseInt(n1.split("-")[2]) + 1);
    });
  });

  describe("Cálculo de SLA em Horas Úteis", () => {
    it("SLA NORMAL (48h úteis) a partir de segunda-feira 09h", () => {
      const created = new Date("2026-07-27T09:00:00Z"); // Segunda
      const deadline = calculateSlaDeadline(created, "NORMAL");
      // 48h úteis (Mon 09h → Mer 09h)
      expect(deadline.toISOString()).toContain("2026-07-29");
    });

    it("SLA URGENT (4h úteis) a partir de sexta-feira 17h", () => {
      // 17h sexta + 4h úteis = 09h segunda (horas úteis: 08h-18h WAT)
      const created = new Date("2026-07-31T17:00:00+01:00"); // Sexta 17h WAT
      const deadline = calculateSlaDeadline(created, "URGENT");
      expect(deadline.getDay()).toBe(1); // Próxima segunda
    });

    it("horas fora do horário de trabalho não contam", () => {
      // Noite não conta para SLA
      const created = new Date("2026-07-27T20:00:00Z"); // Segunda 20h
      const deadline = calculateSlaDeadline(created, "HIGH"); // 24h úteis
      // Deve ser Quarta de manhã, não Terça à noite
      expect(deadline.getDay()).not.toBe(2); // não é Terça à noite
    });
  });

  describe("Ciclo de Vida do Ticket", () => {
    it("ticket WAITING auto-close após 7 dias sem resposta", async () => {
      const oldWaiting = { ...ticket, status: "WAITING", updatedAt: daysAgo(8) };
      const result = await processAutoClose(oldWaiting);
      expect(result.status).toBe("CLOSED");
    });

    it("ticket RESOLVED permanece aberto se cliente responde", async () => {
      await addCustomerMessage(resolvedTicket.id, "Ainda tenho dúvidas");
      const updated = await getTicket(resolvedTicket.id);
      expect(updated.status).toBe("OPEN");
    });

    it("nota interna não aparece para o cliente", async () => {
      const messages = await getTicketMessagesForClient(ticketId);
      expect(messages.every(m => !m.isInternal)).toBe(true);
    });
  });
});
```

---

## 8. Testes de Integração

```typescript
// src/__tests__/integration/portal-auth.test.ts

describe("Portal Auth — Fluxo Completo", () => {

  it("fluxo Magic Link completo: email → token → sessão → logout", async () => {
    // 1. Solicitar magic link
    const response1 = await POST("/api/portal/auth/magic-link", { email: "user@empresa.com" });
    expect(response1.status).toBe(200);

    // 2. Buscar token na BD (em teste)
    const link = await prisma.portalMagicLink.findFirst({
      where: { portalUser: { email: "user@empresa.com" } },
      orderBy: { createdAt: "desc" }
    });
    expect(link).toBeDefined();

    // 3. Validar token
    const response2 = await GET(`/api/portal/auth/magic?token=${link!.token}`);
    expect(response2.status).toBe(302); // redirect para /portal/dashboard
    expect(response2.headers.get("set-cookie")).toContain("portal-session");

    // 4. Aceder a recurso protegido
    const response3 = await GET("/api/portal/auth/me", { cookie: response2.headers.get("set-cookie") });
    expect(response3.status).toBe(200);

    // 5. Logout
    const response4 = await POST("/api/portal/auth/logout", {}, { cookie: response2.headers.get("set-cookie") });
    expect(response4.status).toBe(200);

    // 6. Sessão já não funciona após logout
    const response5 = await GET("/api/portal/auth/me", { cookie: response2.headers.get("set-cookie") });
    expect(response5.status).toBe(401);
  });
});
```

---

## 9. Cobertura Mínima por Componente

| Componente | Cobertura mínima | Justificação |
|---|---|---|
| `portal-auth-service.ts` | 90% | Segurança crítica |
| `portal-permission-service.ts` | 100% | RBAC sem excepções |
| `portal-isolation.ts` | 100% | Multi-tenant crítico |
| `portal-document-service.ts` | 85% | Downloads assinados + auditoria |
| `portal-notification-service.ts` | 80% | Motor de estados |
| `portal-omnichannel-service.ts` | 75% | Orquestração com mocks |
| `portal-support-service.ts` | 80% | SLA + ciclo de vida |
| **TOTAL Portal** | **≥ 70%** | Quality Gate Volume 03 |

---

## 10. Quality Gate — Volume 03

O Quality Gate do CLAUDE.md aplica-se integralmente ao Volume 03:

```
GATE 1 (pre-commit):
  □ lint → 0 erros
  □ tsc  → 0 erros TypeScript
  □ vitest run --reporter=verbose [ficheiros afectados] → 0 falhas

GATE 2 (pre-merge):
  □ next build → 0 erros
  □ vitest run  → suite completa, 0 falhas
  □ cobertura portal ≥ 70%
  □ checklist PR incluída

GATE 3 (pre-deploy):
  □ Smoke tests Portal executados em staging
  □ Plano de rollback documentado
```

### Smoke Tests Manuais do Portal (pós-deploy)

```
□ Magic link recebido e funciona (envio + validação)
□ Login por credenciais funciona (se ADR-026 → credentials)
□ Dashboard carrega dados da empresa correcta
□ Download de fatura gera URL assinada (verifica expiração)
□ Download de documento regista auditoria
□ Notificação in-app chega via SSE (abrir 2 tabs, acção numa, badge actualiza na outra)
□ Ticket de suporte criado e número gerado (ST-YYYY-NNNNNN)
□ Utilizador de empresa A não vê recursos de empresa B (teste manual de isolamento)
□ Push Web: permissão solicitada, notificação enviada
□ Logout invalida sessão (redirect para login)
```

---

## 11. Mocking — Serviços Externos

```typescript
// src/__tests__/setup/portal-mocks.ts

vi.mock("@/lib/portal-resend-service", () => ({
  sendPortalEmail: vi.fn().mockResolvedValue({ id: "email-mock-id" }),
}));

vi.mock("@/lib/portal-whatsapp-service", () => ({
  sendWhatsAppTemplate: vi.fn().mockResolvedValue({ messageId: "wa-mock-id" }),
}));

vi.mock("@/lib/portal-push-service", () => ({
  sendPushNotification: vi.fn().mockResolvedValue(undefined),
}));

// Cloudinary signed URL: mockar para não chamar API externa
vi.mock("cloudinary", () => ({
  v2: {
    utils: {
      private_download_url: vi.fn().mockReturnValue(
        "https://res.cloudinary.com/mock/raw/authenticated/doc.pdf?signature=mocksig"
      ),
    },
  },
}));
```

---

## 12. Contagem de Testes Esperados

| Ficheiro de Teste | Testes Estimados |
|---|---|
| `portal-auth-service.test.ts` | 18 |
| `portal-permission-service.test.ts` | 24 |
| `portal-isolation.test.ts` | 12 |
| `portal-document-service.test.ts` | 16 |
| `portal-notification-service.test.ts` | 20 |
| `portal-omnichannel-service.test.ts` | 12 |
| `portal-support-service.test.ts` | 18 |
| `portal-auth.test.ts` (integração) | 6 |
| `portal-documents.test.ts` (integração) | 8 |
| `portal-notifications.test.ts` (integração) | 6 |
| **TOTAL Volume 03** | **≈ 140 testes** |

---

*VD Platform — Testing Strategy — Volume 03 — 29 Julho 2026*
