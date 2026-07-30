# Modelo de Dados — Volume 03 — Portal do Cliente

> **Volume:** 03 — Portal do Cliente  
> **Estado:** 📋 Especificação — aguarda aprovação PO  
> **Migration a criar:** `portal-volume03`  
> **Modelos novos:** 10  
> **Enums novos:** 4

---

## 1. Enums Novos

```prisma
// Roles do portal (separados do AdminRole)
enum PortalRole {
  PORTAL_OWNER   // Proprietário — criado pelo admin
  PORTAL_ADMIN   // Administrador — criado pelo OWNER
  PORTAL_MEMBER  // Membro operacional
  PORTAL_VIEWER  // Só leitura
}

// Estado de uma notificação
enum NotificationStatus {
  PENDING    // Gerada, ainda não enviada
  SENT       // Enviada para o canal
  DELIVERED  // Confirmação de entrega (quando o canal suporta)
  READ       // Marcada como lida pelo utilizador
  FAILED     // Falha no envio (após re-tentativas)
}

// Canal de comunicação omnicanal
enum OmnichannelType {
  EMAIL      // Resend
  WHATSAPP   // Meta WhatsApp Business Cloud API
  IN_APP     // Server-Sent Events (in-app)
  PUSH_WEB   // Web Push API (VAPID)
  SMS        // Reservado para futuro
}

// Estado de um ticket de suporte
enum SupportTicketStatus {
  OPEN        // Aberto pelo cliente, aguarda resposta
  IN_PROGRESS // Em análise pela equipa
  WAITING     // Aguarda resposta do cliente
  RESOLVED    // Resolvido
  CLOSED      // Fechado (sem mais acção)
}

// Tipo de alerta automático do portal
enum PortalAlertType {
  RENT_DUE           // Renda a vencer em 7 dias
  CONTRACT_EXPIRING  // Contrato a expirar em 30/15/7 dias
  PAYMENT_OVERDUE    // Pagamento em atraso
  BOOKING_CONFIRMED  // Reserva de sala confirmada
  DOCUMENT_AVAILABLE // Novo documento disponível
}
```

---

## 2. Modelos Prisma

### 2.1 PortalUser

Utilizador autenticado do portal do cliente.

```prisma
model PortalUser {
  id          String     @id @default(cuid())
  companyId   String
  company     Company    @relation(fields: [companyId], references: [id])

  email       String
  name        String
  phone       String?    // Para notificações WhatsApp
  role        PortalRole @default(PORTAL_MEMBER)

  isActive    Boolean    @default(true)
  isConfirmed Boolean    @default(false) // true após primeiro login

  // Preferências de notificação
  notifyEmail    Boolean @default(true)
  notifyWhatsapp Boolean @default(false)
  notifyPush     Boolean @default(true)
  notifyInApp    Boolean @default(true)

  // Push web subscription (VAPID)
  pushEndpoint    String? // URL do browser push service
  pushP256dh      String? // Chave pública do cliente
  pushAuth        String? // Auth secret do cliente

  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
  lastLoginAt DateTime?

  // Relações
  sessions      PortalSession[]
  magicLinks    PortalMagicLink[]
  notifications PortalNotification[]
  supportMessages PortalSupportMessage[]
  documentAccesses PortalDocumentAccess[]

  @@unique([companyId, email])
  @@index([companyId])
  @@index([email])
}
```

### 2.2 PortalSession

Sessões activas no portal. Permite revogação em massa.

```prisma
model PortalSession {
  id           String     @id @default(cuid())
  portalUserId String
  portalUser   PortalUser @relation(fields: [portalUserId], references: [id])
  companyId    String     // Desnormalizado para queries rápidas de revogação

  token        String     @unique // Hash do JWT (para revogação)
  expiresAt    DateTime
  isRevoked    Boolean    @default(false)

  userAgent    String?
  ipAddress    String?
  createdAt    DateTime   @default(now())
  lastSeenAt   DateTime   @default(now())

  @@index([portalUserId])
  @@index([companyId])
  @@index([expiresAt])
}
```

### 2.3 PortalMagicLink

Token de magic link para autenticação sem password.

```prisma
model PortalMagicLink {
  id           String     @id @default(cuid())
  portalUserId String
  portalUser   PortalUser @relation(fields: [portalUserId], references: [id])
  companyId    String

  token        String     @unique // Token criptograficamente aleatório (32 bytes, hex)
  expiresAt    DateTime   // TTL: 15 minutos
  usedAt       DateTime?  // null = disponível; not null = já utilizado
  isUsed       Boolean    @default(false)

  createdAt    DateTime   @default(now())

  @@index([token])
  @@index([portalUserId])
}
```

### 2.4 PortalDocument

Documento partilhado com a empresa pelo admin.

```prisma
model PortalDocument {
  id          String   @id @default(cuid())
  companyId   String
  company     Company  @relation(fields: [companyId], references: [id])

  title       String
  description String?
  category    String   // "contrato", "fatura-manual", "declaracao", "outro"
  tags        String[] @default([])

  // Versão activa
  currentVersionId String?
  isActive         Boolean @default(true)

  uploadedById  String  // AdminUser.id que fez upload
  uploadedByName String // snapshot do nome (não relation — admin pode ser desactivado)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  versions PortalDocumentVersion[]
  accesses PortalDocumentAccess[]
  notifications PortalNotification[]

  @@index([companyId])
  @@index([companyId, isActive])
}
```

### 2.5 PortalDocumentVersion

Histórico de versões de cada documento.

```prisma
model PortalDocumentVersion {
  id         String         @id @default(cuid())
  documentId String
  document   PortalDocument @relation(fields: [documentId], references: [id])

  version    Int            // 1, 2, 3, ...
  fileName   String
  fileSize   Int            // bytes
  mimeType   String         // "application/pdf", etc.
  cloudinaryPublicId String // ID no Cloudinary para gerar signed URL

  uploadedById   String
  uploadedByName String
  changeNote     String?    // Nota sobre o que mudou nesta versão

  createdAt  DateTime @default(now())

  @@unique([documentId, version])
  @@index([documentId])
}
```

### 2.6 PortalDocumentAccess

Auditoria de cada acesso a documento (BR-PORT-003).

```prisma
model PortalDocumentAccess {
  id           String         @id @default(cuid())
  documentId   String
  document     PortalDocument @relation(fields: [documentId], references: [id])
  versionId    String?        // Qual versão foi acedida
  companyId    String

  portalUserId String?        // null se download interno (admin)
  portalUser   PortalUser?    @relation(fields: [portalUserId], references: [id])

  action       String         // "VIEW" | "DOWNLOAD" | "SIGNED_URL_GENERATED"
  ipAddress    String?
  userAgent    String?
  signedUrl    String?        // A URL assinada gerada (para auditoria)
  urlExpiresAt DateTime?      // TTL da URL assinada

  createdAt    DateTime @default(now())

  @@index([documentId])
  @@index([companyId])
  @@index([portalUserId])
}
```

### 2.7 PortalNotification

Notificação enviada a um utilizador (com estado completo).

```prisma
model PortalNotification {
  id           String             @id @default(cuid())
  companyId    String
  portalUserId String?            // null = notificação para toda a empresa
  portalUser   PortalUser?        @relation(fields: [portalUserId], references: [id])

  type         PortalAlertType
  title        String
  body         String
  actionUrl    String?            // URL para onde navegar ao clicar

  // Referências opcionais ao objecto relacionado
  invoiceId    String?
  contractId   String?
  documentId   String?
  bookingId    String?

  status       NotificationStatus @default(PENDING)
  channel      OmnichannelType

  sentAt       DateTime?
  deliveredAt  DateTime?
  readAt       DateTime?
  failedAt     DateTime?
  failReason   String?

  // Re-tentativas
  attempts     Int      @default(0)
  maxAttempts  Int      @default(3)
  nextRetryAt  DateTime?

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([portalUserId, status])
  @@index([companyId, status])
  @@index([type, status])
  @@index([nextRetryAt])
}
```

### 2.8 OmnichannelMessage

Registo de cada mensagem enviada por qualquer canal (audit trail completo).

```prisma
model OmnichannelMessage {
  id        String          @id @default(cuid())
  companyId String
  company   Company         @relation(fields: [companyId], references: [id])

  channel   OmnichannelType
  recipient String          // email | phone number | push endpoint
  subject   String?         // Assunto (email)
  body      String          // Corpo da mensagem (texto ou HTML)
  template  String?         // Nome do template usado

  status    NotificationStatus @default(PENDING)
  externalId String?        // ID da mensagem no provider (Resend ID, WhatsApp message ID)

  sentAt     DateTime?
  deliveredAt DateTime?
  readAt     DateTime?
  failedAt   DateTime?
  failReason String?

  // Referência à notificação que originou (se existir)
  notificationId String?

  // Metadata (JSON livre para dados específicos do canal)
  metadata   Json?

  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([companyId])
  @@index([channel, status])
  @@index([recipient])
}
```

### 2.9 PortalSupportTicket

Ticket de suporte aberto pelo cliente.

```prisma
model PortalSupportTicket {
  id          String              @id @default(cuid())
  companyId   String
  company     Company             @relation(fields: [companyId], references: [id])

  number      String              @unique // ST-2026-000001
  subject     String
  category    String              // "faturação", "contrato", "reservas", "técnico", "outro"
  priority    String              @default("NORMAL") // LOW | NORMAL | HIGH | URGENT
  status      SupportTicketStatus @default(OPEN)

  openedById  String             // PortalUser.id
  openedByName String            // snapshot

  assignedTo  String?            // AdminUser.id (staff interno)
  resolvedAt  DateTime?
  closedAt    DateTime?
  slaDeadline DateTime?          // calculado em abertura: createdAt + 48h

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  messages    PortalSupportMessage[]

  @@index([companyId, status])
  @@index([status, slaDeadline])
}
```

### 2.10 PortalSupportMessage

Mensagem dentro de um ticket (cliente e staff).

```prisma
model PortalSupportMessage {
  id       String              @id @default(cuid())
  ticketId String
  ticket   PortalSupportTicket @relation(fields: [ticketId], references: [id])

  body     String
  isInternal Boolean @default(false) // Nota interna (só visível ao staff)

  // Remetente: cliente ou staff
  senderType  String  // "PORTAL_USER" | "ADMIN"
  senderId    String  // PortalUser.id ou AdminUser.id
  senderName  String  // snapshot

  // Anexos
  attachments Json?   // [{ fileName, cloudinaryPublicId, fileSize }]

  portalUserId String?
  portalUser   PortalUser? @relation(fields: [portalUserId], references: [id])

  createdAt DateTime @default(now())

  @@index([ticketId])
  @@index([ticketId, createdAt])
}
```

---

## 3. Relações com Modelos Existentes

```
Company (existente)
  ├── PortalUser[]          — utilizadores do portal desta empresa
  ├── PortalDocument[]      — documentos partilhados
  ├── PortalNotification[]  — notificações
  ├── PortalSupportTicket[] — tickets de suporte
  └── OmnichannelMessage[]  — histórico de comunicação

ErpInvoice (existente) — referenciado nas notificações (invoiceId)
ErpContract (existente) — referenciado nas notificações (contractId)
Reservation (existente) — referenciado nas notificações (bookingId)
TimelineEntry (existente) — criada para eventos do portal
AuditLog (existente) — criada para acções sensíveis do portal
```

---

## 4. Índices Críticos de Performance

```prisma
// Isolamento multi-tenant — queries mais frequentes
@@index([companyId])                        // em todos os modelos portal
@@index([companyId, status])               // listagens filtradas
@@index([portalUserId, status])            // notificações por utilizador

// Re-tentativas de notificação (cron de retry)
@@index([nextRetryAt])                     // PortalNotification
@@index([type, status])                    // relatórios de entrega

// Suporte — SLA monitoring
@@index([status, slaDeadline])             // tickets em risco de SLA breach
```

---

## 5. Contadores de Documentos

Adicionar ao `DocumentCounter` existente:

```
ST-YYYY-NNNNNN  — Número de ticket de suporte (ST = Support Ticket)
```

---

*VD Platform — Portal Data Model — Volume 03 — 29 Julho 2026*
