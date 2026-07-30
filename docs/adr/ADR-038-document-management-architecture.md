# ADR-038 — Arquitectura de Gestão Documental: PDF Imutável, Versionamento e Upload-em-Transacção

**Estado:** ✅ ACEITE  
**Data:** 2026-07-30  
**Decisores:** Ernesto Pinto Luciano (PO), Claude Architect  
**Volume:** VOL08 — Gestão Documental

---

## Contexto

O VD Platform necessitava de um módulo para gerar propostas comerciais e contratos de alocação em formato PDF, arquivá-los de forma permanente, e disponibilizá-los tanto a operadores admin como a clientes via portal. Existia já experiência com `@react-pdf/renderer` (VOL02) e Cloudinary (VOL03), mas sem integração num serviço unificado de documentos.

As exigências do Product Owner incluíam:
1. Imutabilidade dos PDFs gerados (uma vez guardados, não podem ser alterados)
2. Integridade verificável (hash SHA-256)
3. Versionamento de templates (auditoria de qual versão gerou cada documento)
4. Versionamento de documentos (múltiplas gerações por entidade, cada uma imutável)
5. Downloads via URL temporária (TTL 15 minutos)
6. Auditoria de todas as operações (sem que falha de auditoria bloqueie geração)
7. Upload falho não deve criar registo `GeneratedDocument` (consistência referencial)

---

## Decisões

### 1. PDF Imutável via `overwrite: false` no Cloudinary

Ao fazer upload para Cloudinary, usa-se a opção `overwrite: false`. Se o `public_id` já existir (versão anterior do mesmo documento), o upload é recusado sem erro de sistema — garantindo que nenhum documento é substituído silenciosamente.

O `public_id` é construído deterministicamente:  
`azul-cowork/documents/{type}/{entityType}/{entityId}/v{version}`

Assim, cada versão tem o seu próprio `public_id`, e versões anteriores persistem para sempre.

**Alternativa rejeitada:** Armazenar PDFs no filesystem — viola o modelo cloud-first; não suporta CDN, assinatura de URL ou acesso externo.

### 2. Upload dentro de `$transaction` (atomicidade)

O upload Cloudinary é feito **dentro** da `$transaction` Prisma. Se o upload falhar, a transacção faz rollback e nenhum `GeneratedDocument` é criado. Isto evita registos orfãos (registo na DB sem ficheiro no Cloudinary).

**Trade-off:** Transacções longas são geralmente a evitar. Aqui aceita-se o risco porque:
- O Cloudinary upload de um PDF típico (< 200 KB) é < 1 segundo
- O alternative (upload fora de $transaction) criaria inconsistências difíceis de detectar

**Referência:** ADR-033 usa o padrão oposto (Post-Commit) para AuditLog porque falha de auditoria nunca deve bloquear a operação principal. A geração de documentos é diferente: se o upload falhar, **não** se deve criar o registo.

### 3. SHA-256 Hash para Integridade

Cada `GeneratedDocument` inclui `sha256Hash` calculado sobre o Buffer do PDF antes do upload. Esta hash:
- Permite verificar a integridade do ficheiro descarregado (hash do download == hash guardado)
- Serve como fingerprint imutável do documento
- É calculada em memória (sem I/O extra): `crypto.createHash("sha256").update(buffer).digest("hex")`

### 4. Versionamento Duplo: Template e Documento

`DocumentTemplate.version` incrementa cada vez que `htmlBody` é modificado via PATCH. Documentos gerados guardam `GeneratedDocument.templateVersion` (snapshot imutável do momento da geração). Assim, mesmo que o template evolua, sabe-se sempre qual versão foi usada para cada PDF.

`GeneratedDocument.version` é calculado atomicamente dentro da `$transaction`:
```sql
SELECT MAX(version) FROM GeneratedDocument
WHERE entityType = ? AND entityId = ? AND templateSlug = ?
```
Resultado + 1 é a nova versão. Sem race condition porque está dentro da transacção.

### 5. Download via URL Assinada (TTL 15 min)

URLs directas do Cloudinary são públicas por defeito. Para documentos empresariais, usa-se `cloudinary.url({ sign_url: true, expires_at: ... })` com TTL de 15 minutos. Cada pedido `GET /api/admin/documents/[id]` gera uma nova URL assinada on-demand.

**Razão do TTL de 15 minutos:** Tempo suficiente para download humano; curto o suficiente para reduzir risco de partilha indevida de links.

### 6. Fire-and-Forget para AuditLog e Timeline (ADR-033 reutilizado)

AuditLog (`DOCUMENT_GENERATED`, `DOCUMENT_DOWNLOADED`, `DOCUMENT_SHARED_PORTAL`) e Timeline são criados com o padrão fire-and-forget:

```typescript
void recordAudit({ ... }).catch(err => console.error(...));
```

Consistente com ADR-033: falhas de auditoria nunca bloqueiam a operação principal (geração de documento). O documento é gerado e devolvido ao utilizador independentemente do estado do AuditLog.

### 7. Partilha para Portal sem Duplicação (SSoT)

Quando um `GeneratedDocument` é partilhado com o cliente via `POST /share-portal`, cria-se um `PortalDocument` + `PortalDocumentVersion` com o **mesmo `cloudinaryId`** do documento original. Não há re-upload nem duplicação de ficheiros. O ficheiro existe exactamente uma vez no Cloudinary (SSoT de armazenamento).

---

## Alternativas Consideradas

| Alternativa | Razão de Rejeição |
|---|---|
| Gerar PDF no frontend (client-side) | Não compatível com upload automático, auditoria e imutabilidade |
| Armazenar como base64 na DB | Aumenta drasticamente o tamanho da DB; sem CDN; sem URL assinada |
| Upload fora de `$transaction` | Cria risco de registo orfão (DB tem registo, Cloudinary não tem ficheiro) |
| TTL de 1 hora para URL | Demasiado longo; aumenta risco de partilha indevida de links temporários |
| Versionamento apenas por timestamp | Não garante ordenação determinística sob carga; `MAX(version)+1` é mais semântico |

---

## Consequências

### Positivas
- PDFs são imutáveis após geração — conformidade com exigências de auditoria
- Integridade verificável via SHA-256 — rastreabilidade total
- Versionamento duplo (template + documento) — histórico completo
- Sem duplicação de ficheiros no Cloudinary — custos de armazenamento mínimos
- URL assinada por pedido — acesso controlado sem expor URLs permanentes

### Negativas (trade-offs)
- Transacção mais longa (inclui I/O de rede para Cloudinary) — risco de timeout em redes lentas
- URL expira em 15 min — utilizador deve descarregar imediatamente; não pode guardar o link
- Re-geração cria novo ficheiro Cloudinary — versões acumulam-se; limpeza periódica necessária no futuro

---

## Revisão

Rever se:
- O TTL de 15 minutos precisa de ajuste com base em feedback de utilizadores
- A limpeza de versões antigas no Cloudinary justifica uma tarefa cron
- A integração com assinaturas digitais (PDF/A) é necessária para conformidade legal angolana

---

*ADR-038 — VD Platform — VOL08 — 30 de Julho de 2026*
