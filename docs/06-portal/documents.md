# Gestão de Documentos — Volume 03 — Portal do Cliente

> **Volume:** 03 — Portal do Cliente  
> **Estado:** 📋 Especificação — aguarda aprovação PO  
> **Princípio:** Todo download é assinado, temporário e auditado

---

## 1. Visão Geral

O módulo de documentos permite ao Azul Coworking partilhar ficheiros com os clientes de forma
segura e controlada: contratos assinados, declarações, comprovantes, guias de uso do espaço.

Os clientes podem também fazer upload de documentos solicitados (declarações, comprovantes de
pagamento bancário, etc.).

---

## 2. Tipos de Documentos

| Categoria | Exemplos | Quem faz upload |
|---|---|---|
| `contrato` | Contrato de coworking assinado | Admin |
| `fatura-manual` | Fatura gerada externamente | Admin |
| `declaracao` | Declaração de frequência | Admin |
| `comprovante` | Comprovante de pagamento | Admin ou Cliente |
| `guia` | Guia de uso do espaço | Admin |
| `outro` | Qualquer outro documento | Admin ou Cliente |

---

## 3. Upload de Documentos

### 3.1 Upload pelo Admin

```
1. Admin Panel → Empresa → Documentos → "Carregar documento"
2. Campos: título, categoria, descrição, ficheiro (PDF/DOCX/XLSX/JPG)
3. Sistema faz upload para Cloudinary:
   - Folder: /azul-cowork/portal/documents/[companyId]/[YYYY]/
   - Resource type: "raw" (para PDFs e documentos)
4. Cria PortalDocument + PortalDocumentVersion (v1)
5. Cria PortalNotification (tipo: DOCUMENT_AVAILABLE)
6. Notifica o cliente via canais activos
```

### 3.2 Upload pelo Cliente (PORTAL_OWNER e PORTAL_ADMIN)

```
1. /portal/documentos → "Enviar documento"
2. Campos: título, categoria, descrição, ficheiro
3. Limites: máx 50 MB, tipos: PDF, DOCX, XLSX, JPG, PNG
4. Upload para Cloudinary: /azul-cowork/portal/uploads/[companyId]/[YYYY]/
5. Cria PortalDocument + PortalDocumentVersion (v1)
6. Notifica admin (in-app) sobre novo documento do cliente
```

### 3.3 Versionamento

Quando um documento é actualizado (nova versão):

```
1. Admin selecciona documento existente → "Nova versão"
2. Upload do novo ficheiro
3. Cria nova PortalDocumentVersion (v = último + 1)
4. Actualiza PortalDocument.currentVersionId
5. Versão anterior mantida no histórico (imutável)
6. Notifica cliente: "Documento actualizado: [título] — Versão [N]"
```

---

## 4. Download de Documentos (BR-PORT-002)

**Regra fundamental:** Nenhum URL directo do Cloudinary é exposto ao cliente.
Todos os downloads usam URLs assinadas com TTL de 15 minutos.

### 4.1 Fluxo de Download

```
1. Cliente clica em [Download] na lista de documentos
2. Frontend chama: POST /api/portal/documents/[id]/download
3. Sistema verifica:
   a. PortalUser autenticado e activo
   b. Documento pertence à empresa do cliente (companyId match)
   c. Documento está activo (isActive = true)
4. Sistema busca a versão actual: PortalDocument.currentVersionId
5. Gera URL assinada Cloudinary:
   - TTL: 15 minutos
   - Parâmetros: timestamp, signature (HMAC-SHA1 com api_secret)
   - URL: https://res.cloudinary.com/[cloud]/raw/authenticated/[public_id]?token=...
6. Cria PortalDocumentAccess:
   - action: "DOWNLOAD"
   - portalUserId, documentId, versionId
   - signedUrl (para auditoria)
   - urlExpiresAt: now() + 15 min
   - ipAddress, userAgent
7. Cria TimelineEntry na empresa:
   - "Documento [título] descarregado por [nome utilizador]"
8. Devolve: { url: "https://...[signed]...", expiresAt: "..." }
9. Frontend abre URL em nova tab → download iniciado pelo browser
```

### 4.2 Expiração da URL

Após 15 minutos, a URL assinada expira automaticamente no Cloudinary.
Se o cliente tentar usar a URL expirada, recebe 401 do Cloudinary.
O cliente deve solicitar uma nova URL (novo clique no botão Download).

### 4.3 URL Directa Proibida

```typescript
// ❌ NUNCA FAZER — expõe URL permanente
return NextResponse.json({ url: document.cloudinaryPublicId });

// ✅ CORRECTO — URL assinada temporária
const signedUrl = cloudinary.utils.private_download_url(
  document.cloudinaryPublicId,
  "pdf",
  { expires_at: Math.round(Date.now() / 1000) + 900 } // 15 minutos
);
```

---

## 5. Lista de Documentos (/portal/documentos)

```
Filtros: categoria, data

[Ícone] [Título]              [Categoria]   [Data]       [Versão] [Acções]
📄      Contrato 2026         contrato      01/01/2026   v2       [Download] [Histórico]
📄      Declaração Julho      declaracao    01/07/2026   v1       [Download]
📤      Comprovante Junho     comprovante   05/06/2026   v1       [Download]
```

### Histórico de Versões (modal)

```
Contrato de Coworking 2026 — Histórico de Versões

v2 — Actualizado em 01/03/2026 por Admin
     "Renovação anual com ajuste de preço"
     [Download v2]

v1 — Carregado em 01/01/2026 por Admin
     [Download v1]
```

---

## 6. Auditoria de Acessos (BR-PORT-003)

Toda interacção com documentos é registada em `PortalDocumentAccess`:

| Acção | Quando | Campos registados |
|---|---|---|
| `VIEW` | Cliente abre detalhe do documento | portalUserId, documentId, ip, userAgent |
| `DOWNLOAD` | URL assinada gerada | portalUserId, documentId, versionId, signedUrl, urlExpiresAt |
| `SIGNED_URL_GENERATED` | URL gerada mas download não confirmado | mesmo que DOWNLOAD |
| `VERSION_VIEWED` | Cliente vê histórico de versões | portalUserId, documentId |

### Relatório de Auditoria (Admin Panel)

```
Empresa: Empresa Alpha
Documento: Contrato de Coworking 2026

Data/Hora            | Utilizador        | Acção    | IP
29/07/2026 14:32:01  | João Silva        | DOWNLOAD | 196.200.xxx.xxx
28/07/2026 09:15:44  | Maria Santos      | VIEW     | 196.200.xxx.xxx
15/07/2026 11:02:33  | João Silva        | DOWNLOAD | 196.201.xxx.xxx
```

---

## 7. Placeholder — Assinatura Digital (Futura)

Na v1, os documentos são partilhados mas não assinados digitalmente dentro da plataforma.

**Placeholder para v2:**
```typescript
interface PortalDocument {
  // ...
  signatureStatus?: "UNSIGNED" | "PENDING_SIGNATURE" | "SIGNED"; // Futura integração
  signedAt?:        DateTime;
  signatureProvider?: "DOCUSIGN" | "YOUSIGN" | "ADOBE_SIGN";    // A decidir
  signatureDocumentId?: string;
}
```

Quando a integração com provider de assinatura for implementada:
- O botão "Assinar" enviará o documento para o provider
- O cliente recebe email do provider para assinar
- Após assinatura → nova versão do documento é criada com certificado digital

---

## 8. Limites e Restrições

| Parâmetro | Valor |
|---|---|
| Tamanho máximo por ficheiro | 50 MB |
| Tipos aceites | PDF, DOCX, XLSX, JPG, PNG, JPEG |
| TTL de URL assinada | 15 minutos |
| Retenção de versões | Indefinida (imutável) |
| Máximo de versões por documento | 50 (aviso ao admin se próximo do limite) |
| Total de documentos por empresa | Sem limite (limitado pelo storage Cloudinary) |

---

*VD Platform — Documents Spec — Volume 03 — 29 Julho 2026*
