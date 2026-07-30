/**
 * crm.ts — Tipos TypeScript partilhados para o frontend CRM
 * Espelham a forma dos dados devolvidos pelos endpoints do Volume 01.
 */

// ── Enums ─────────────────────────────────────────────────────────────────────

export type PipelineStage =
  | "NEW_LEAD"
  | "CONTACTED"
  | "QUALIFIED"
  | "PROPOSAL_SENT"
  | "NEGOTIATION"
  | "WON"
  | "LOST";

export type DealStage =
  | "DISCOVERY"
  | "QUALIFICATION"
  | "PROPOSAL"
  | "NEGOTIATION"
  | "WON"
  | "LOST";

export type CompanyStatus =
  | "PROSPECT"
  | "QUALIFIED"
  | "NEGOTIATION"
  | "ACTIVE"
  | "INACTIVE"
  | "CHURNED"
  | "MERGED";

export type ContactRole =
  | "DECISION_MAKER"
  | "CHAMPION"
  | "INFLUENCER"
  | "BLOCKER"
  | "OTHER";

export type ActivityType =
  | "CALL"
  | "EMAIL"
  | "MEETING"
  | "WHATSAPP"
  | "VISIT"
  | "PROPOSAL"
  | "OTHER";

export type ActivityDirection = "INBOUND" | "OUTBOUND";

export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type TaskStatus   = "PENDING" | "IN_PROGRESS" | "DONE" | "CANCELLED";

// ── Entidades principais ───────────────────────────────────────────────────────

export interface CrmContact {
  id:         string;
  companyId:  string;
  firstName:  string;
  lastName:   string;
  email?:     string | null;
  phone?:     string | null;
  role:       ContactRole;
  isPrimary:  boolean;
  linkedInUrl?: string | null;
  notes?:     string | null;
  createdAt:  string;
  updatedAt:  string;
}

export interface CrmDeal {
  id:            string;
  companyId:     string;
  title:         string;
  stage:         DealStage;
  value?:        number | null;
  currency:      string;
  probability?:  number | null;
  expectedClose?: string | null;
  lostReason?:   string | null;
  assignedToId?: string | null;
  discountPct:   number;
  approvedBy?:   string | null;
  closedAt?:     string | null;
  deletedAt?:    string | null;
  createdAt:     string;
  updatedAt:     string;
  allowedTransitions?: DealStage[];
}

export interface CrmActivity {
  id:          string;
  companyId:   string;
  type:        ActivityType;
  direction:   ActivityDirection;
  summary:     string;
  description?: string | null;
  occurredAt:  string;
  durationMin?: number | null;
  actorId?:    string | null;
  createdAt:   string;
}

export interface CrmTask {
  id:           string;
  companyId:    string;
  title:        string;
  description?: string | null;
  priority:     TaskPriority;
  status:       TaskStatus;
  dueDate?:     string | null;
  completedAt?: string | null;
  assignedToId?: string | null;
  dealId?:      string | null;
  contactId?:   string | null;
  createdAt:    string;
  company?:     { id: string; name: string };
}

export interface CrmNote {
  id:        string;
  companyId: string;
  content:   string;
  authorId:  string;
  dealId?:   string | null;
  contactId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TimelineEntry {
  id:               string;
  companyId:        string;
  eventType:        string;
  title:            string;
  description?:     string | null;
  metadata:         Record<string, unknown>;
  actorId?:         string | null;
  actorName?:       string | null;
  isSystem:         boolean;
  linkedEntityType?: string | null;
  linkedEntityId?:  string | null;
  occurredAt:       string;
  createdAt:        string;
}

export interface CrmTag {
  tagId:      string;
  name:       string;
  color?:     string | null;
  assignedAt: string;
  assignedBy?: string | null;
}

// ── Customer 360° (GET /api/crm/companies/:id) ───────────────────────────────

export interface Company360 {
  id:            string;
  name:          string;
  nif?:          string | null;
  email?:        string | null;
  phone?:        string | null;
  website?:      string | null;
  sector?:       string | null;
  country?:      string | null;
  responsible?:  string | null;
  crmStatus?:    CompanyStatus | null;
  pipelineStage?: PipelineStage | null;
  assignedToId?: string | null;
  assignedTo?:   { id: string; name: string | null; email: string } | null;
  mergedIntoId?: string | null;
  crmDeletedAt?: string | null;
  createdAt:     string;
  updatedAt:     string;
  // Relações
  crmContacts:   CrmContact[];
  crmDeals:      CrmDeal[];
  crmTasks:      CrmTask[];
  crmNotes:      CrmNote[];
  crmActivities: CrmActivity[];
  companyTags:   CrmTag[];
  crmTimeline:   TimelineEntry[];
  // Stats financeiras (coworking)
  contractStatus?: string;
  planType?:       string;
  roomNumber?:     string;
  rentAmount?:     number;
}

// ── Lista de empresas (GET /api/crm/companies) ────────────────────────────────

export interface CrmCompanyListItem {
  id:            string;
  name:          string;
  nif?:          string | null;
  email?:        string | null;
  crmStatus?:    CompanyStatus | null;
  pipelineStage?: PipelineStage | null;
  sector?:       string | null;
  country?:      string | null;
  assignedToId?: string | null;
  createdAt:     string;
  updatedAt:     string;
}

export interface CrmCompaniesResponse {
  data: CrmCompanyListItem[];
  meta: {
    total:    number;
    page:     number;
    pageSize: number;
    pages:    number;
  };
}

// ── Kanban ────────────────────────────────────────────────────────────────────

export interface KanbanCard {
  id:            string;
  name:          string;
  nif?:          string | null;
  crmStatus?:    CompanyStatus | null;
  pipelineStage?: PipelineStage | null;
  assignedToId?: string | null;
  sector?:       string | null;
  createdAt:     string;
  primaryContact?: { id: string; firstName: string; lastName: string; email?: string | null; phone?: string | null } | null;
  activeDeals:   Array<{ id: string; title: string; stage: DealStage; value?: number | null; expectedClose?: string | null }>;
  dealValue:     number;
  taskCount:     number;
  lastActivity?: { id: string; type: ActivityType; summary: string; occurredAt: string } | null;
}

export interface KanbanColumn {
  stage:      PipelineStage;
  count:      number;
  totalValue: number;
  companies:  KanbanCard[];
}

export interface KanbanResponse {
  columns: KanbanColumn[];
  meta: {
    totalCompanies: number;
    totalValue:     number;
    currency:       string;
    wonCount:       number;
    lostCount:      number;
    scope:          "global" | "personal";
  };
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export interface CrmDashboard {
  generatedAt: string;
  scope:       "global" | "personal";
  companies: {
    total:    number;
    byStage:  Record<string, number>;
    byStatus: Record<string, number>;
  };
  pipeline: {
    byStage:    Record<string, { count: number; totalValue: number }>;
    totalValue: number;
    currency:   string;
  };
  performance: {
    wonTotal:       number;
    won30d:         number;
    won90d:         number;
    wonValueAOA:    number;
    conversionRate: number | null;
    avgCycleDays:   number | null;
  };
  tasks: {
    pending:    number;
    inProgress: number;
    overdue:    number;
  };
  recentActivities: Array<{
    id:         string;
    type:       ActivityType;
    direction:  ActivityDirection;
    summary:    string;
    occurredAt: string;
    company:    { id: string; name: string };
  }>;
}

// ── Labels e cores por stage ──────────────────────────────────────────────────

export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  NEW_LEAD:      "Novo Lead",
  CONTACTED:     "Contactado",
  QUALIFIED:     "Qualificado",
  PROPOSAL_SENT: "Proposta Enviada",
  NEGOTIATION:   "Negociação",
  WON:           "Ganho",
  LOST:          "Perdido",
};

export const PIPELINE_STAGE_COLORS: Record<PipelineStage, string> = {
  NEW_LEAD:      "bg-slate-500/15 text-slate-300",
  CONTACTED:     "bg-blue-500/15 text-blue-300",
  QUALIFIED:     "bg-violet-500/15 text-violet-300",
  PROPOSAL_SENT: "bg-amber-500/15 text-amber-300",
  NEGOTIATION:   "bg-orange-500/15 text-orange-300",
  WON:           "bg-emerald-500/15 text-emerald-300",
  LOST:          "bg-red-500/15 text-red-300",
};

export const DEAL_STAGE_LABELS: Record<DealStage, string> = {
  DISCOVERY:     "Descoberta",
  QUALIFICATION: "Qualificação",
  PROPOSAL:      "Proposta",
  NEGOTIATION:   "Negociação",
  WON:           "Ganho",
  LOST:          "Perdido",
};

export const DEAL_STAGE_COLORS: Record<DealStage, string> = {
  DISCOVERY:     "bg-slate-500/15 text-slate-300",
  QUALIFICATION: "bg-blue-500/15 text-blue-300",
  PROPOSAL:      "bg-amber-500/15 text-amber-300",
  NEGOTIATION:   "bg-orange-500/15 text-orange-300",
  WON:           "bg-emerald-500/15 text-emerald-300",
  LOST:          "bg-red-500/15 text-red-300",
};

export const COMPANY_STATUS_LABELS: Record<CompanyStatus, string> = {
  PROSPECT:    "Prospecto",
  QUALIFIED:   "Qualificado",
  NEGOTIATION: "Em Negociação",
  ACTIVE:      "Activo",
  INACTIVE:    "Inactivo",
  CHURNED:     "Perdido",
  MERGED:      "Fundido",
};

export const TASK_PRIORITY_COLORS: Record<TaskPriority, string> = {
  LOW:    "bg-slate-500/15 text-slate-300",
  MEDIUM: "bg-blue-500/15 text-blue-300",
  HIGH:   "bg-amber-500/15 text-amber-300",
  URGENT: "bg-red-500/15 text-red-300",
};

export const ACTIVITY_TYPE_ICONS: Record<ActivityType, string> = {
  CALL:     "📞",
  EMAIL:    "✉️",
  MEETING:  "🤝",
  WHATSAPP: "💬",
  VISIT:    "🏢",
  PROPOSAL: "📄",
  OTHER:    "📌",
};

// ── Utilitários ───────────────────────────────────────────────────────────────

export function formatKzCRM(value: number): string {
  return new Intl.NumberFormat("pt-AO", {
    style:    "currency",
    currency: "AOA",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function fullName(contact: { firstName: string; lastName: string }): string {
  return `${contact.firstName} ${contact.lastName}`.trim();
}
