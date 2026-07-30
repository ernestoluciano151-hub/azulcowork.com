/**
 * reservation-state-machine.ts
 *
 * Máquina de estados formal para Reservation.status.
 * Garante que nenhuma transição inválida é aceite pelo servidor.
 *
 * Estados:
 *   PENDENTE_APROVACAO — orçamento personalizado aguarda aprovação
 *   RESERVADO          — confirmado mas pagamento pendente (pagar no dia)
 *   CONFIRMADA         — reserva activa (pago | facturado | isento | aprovado)
 *   CONCLUIDA          — evento ocorreu (terminal)
 *   CANCELADA          — cancelado (terminal)
 *
 * Transições válidas:
 *   PENDENTE_APROVACAO → CONFIRMADA | CANCELADA
 *   RESERVADO          → CONFIRMADA | CANCELADA
 *   CONFIRMADA         → CONCLUIDA  | CANCELADA
 *   CONCLUIDA          → (nenhuma — estado terminal)
 *   CANCELADA          → (nenhuma — estado terminal)
 *
 * VOL04-1 — 29 Julho 2026
 */

export type ReservationStatus =
  | "PENDENTE_APROVACAO"
  | "RESERVADO"
  | "CONFIRMADA"
  | "CONCLUIDA"
  | "CANCELADA";

/**
 * Tabela de transições válidas.
 * Estados terminais têm array vazio.
 */
export const VALID_TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
  PENDENTE_APROVACAO: ["CONFIRMADA", "CANCELADA"],
  RESERVADO:          ["CONFIRMADA", "CANCELADA"],
  CONFIRMADA:         ["CONCLUIDA",  "CANCELADA"],
  CONCLUIDA:          [],   // terminal — evento ocorreu
  CANCELADA:          [],   // terminal — sem reactivação
};

/**
 * Estados que bloqueiam um slot de sala (usados no conflict check).
 */
export const OCCUPYING_STATUSES: ReservationStatus[] = [
  "CONFIRMADA",
  "RESERVADO",
  "PENDENTE_APROVACAO",
];

/**
 * Verifica se a transição de estado é permitida.
 *
 * @param from   Estado actual da reserva
 * @param to     Estado pretendido
 * @returns      true se a transição for válida
 */
export function canTransition(
  from: ReservationStatus | string,
  to:   ReservationStatus | string
): boolean {
  const validNext = VALID_TRANSITIONS[from as ReservationStatus];
  if (!validNext) return false;
  return validNext.includes(to as ReservationStatus);
}

/**
 * Lança erro se a transição não for válida.
 * Usar antes de qualquer PATCH de status.
 */
export function assertValidTransition(
  from: ReservationStatus | string,
  to:   ReservationStatus | string
): void {
  if (!canTransition(from, to)) {
    throw new InvalidStatusTransitionError(from, to);
  }
}

/**
 * Erro lançado quando uma transição de estado inválida é tentada.
 * Deve ser capturado pelo handler da rota e retornado como HTTP 422.
 */
export class InvalidStatusTransitionError extends Error {
  readonly from: string;
  readonly to:   string;

  constructor(from: string, to: string) {
    super(`Transição de estado inválida: ${from} → ${to}`);
    this.name = "InvalidStatusTransitionError";
    this.from = from;
    this.to   = to;
  }
}

/**
 * Constante de política de cancelamento.
 * Cancelamentos com ≥ 24h de antecedência têm direito a reembolso total.
 */
export const CANCELLATION_FREE_HOURS = 24;

/**
 * Verifica se o cancelamento é elegível para reembolso total.
 *
 * @param startDatetime  Início do evento reservado
 * @param now            Momento actual (default: Date.now())
 * @returns              true se houver ≥ 24h até ao início
 */
export function isCancellationFree(
  startDatetime: Date,
  now: Date = new Date()
): boolean {
  const hoursUntilEvent =
    (startDatetime.getTime() - now.getTime()) / (1000 * 60 * 60);
  return hoursUntilEvent >= CANCELLATION_FREE_HOURS;
}
