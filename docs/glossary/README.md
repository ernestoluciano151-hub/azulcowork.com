# Glossário de Domínio — VD Platform

> **Documento:** GLOSS-001  
> **Volume:** 00 — Foundation  
> **Estado:** ✅ Aprovado v1.0  
> **Data:** Julho 2026  

---

## Propósito

O Glossário define os termos oficiais do domínio do VD Platform. Estes termos devem ser usados de forma consistente em código, documentação e conversas entre equipa e clientes. A consistência de linguagem é um pilar do Domain-Driven Design.

---

## A

**Aggregate Root**  
Entidade principal de um Bounded Context que controla o acesso às suas entidades dependentes. No VD Platform: `Lead` (CRM), `Company` (Cowork), `Invoice` (Financial), `Reservation` (Reservas).

**AOA**  
Angola Kwanza — moeda oficial de Angola. Todas as quantias monetárias do sistema são em AOA (Kwanzas). Símbolo: Kz.

**Assistente Comercial**  
Utilizador com role `COMERCIAL` responsável pela gestão operacional de leads, reservas e comunicação com clientes.

**Auditoria Financeira**  
Registo imutável de todas as operações financeiras (tabela `FinancialAudit`). Nunca pode ser alterado ou eliminado.

---

## B

**Bounded Context**  
Região do domínio com fronteiras claras e linguagem ubíqua própria. Os bounded contexts do VD Platform são: CRM, Cowork, Financial, Reservation, Security, Communication.

**Business Bible**  
Repositório oficial de todas as regras de negócio do VD Platform. Localização: `docs/business-bible/README.md`.

---

## C

**CUID**  
Collision-resistant Unique Identifier — formato de ID usado em todas as entidades do sistema. Gerado automaticamente pelo Prisma com `@default(cuid())`.

**Coffee Break**  
Serviço opcional de pausa com coffee/chá e snacks para eventos na sala de reunião. Valor adicional ao preço base da reserva.

**Colaborador**  
Ver Employee.

**COMERCIAL**  
Role de utilizador com acesso a CRM, Reservas e Comunicação. Sem acesso ao módulo Financeiro ou Configurações.

**Contrato de Alocação**  
Documento legal que formaliza a utilização de espaço no Azul Coworking por uma Empresa Cliente. Tem data de início, fim, valor mensal e condições de utilização.

**contractEnd**  
Data de fim do contrato de uma `Company`. Campo crítico monitorado para alertas de expiração.

**contractStatus**  
Estado do contrato de uma `Company`. Valores: `ATIVO`, `PRESTES_EXPIRAR`, `RENOVADO`, `ENCERRADO`, `SUSPENSO`.

**Conversão**  
Processo pelo qual um `Lead` se torna uma `Company` activa. Operação atómica e irreversível. Regra de negócio: BR-002.

---

## D

**DeleteRequest**  
Pedido formal de eliminação de um registo de dados, submetido por um utilizador e aprovado/rejeitado pelo ADMIN. Implementa conformidade com RGPD/LGPD.

**Domain Event**  
Facto de negócio que já ocorreu, representado como mensagem no Event Bus. Exemplo: `lead.created`, `payment.received`.

**DRY**  
Don't Repeat Yourself — princípio de engenharia que proíbe a duplicação de lógica ou dados no sistema.

---

## E

**Employee (Colaborador)**  
Funcionário de uma `Company` cliente do coworking. Não tem acesso ao sistema admin.

**Empresa Cliente**  
Ver `Company`.

**Event Bus**  
Mecanismo de comunicação assíncrono entre módulos, baseado em publish/subscribe. Implementado em `src/lib/event-bus.ts`.

**Expense (Despesa)**  
Registo de uma despesa operacional do Azul Coworking (não do cliente). Categorias: aluguer, utilities, salários, equipamento, etc.

---

## F

**FINANCEIRO**  
Role de utilizador com acesso ao módulo Financeiro completo (faturas, pagamentos, relatórios). Sem acesso a Configurações ou CRM.

**FinancialHistory (Histórico Financeiro)**  
Registo cronológico de todos os movimentos financeiros de uma `Company`, com saldo acumulado (`runningBalance`).

**Fatura**  
Ver `Invoice`.

**FT-SALA-YYYY-NNNNNN**  
Formato do número de fatura de sala de reunião. Exemplo: `FT-SALA-2026-000001`.

---

## H

**Hot Desk**  
Posto de trabalho partilhado em open space. Preço actual: ~79.900 Kz/lugar/mês (verificar tabela de preços actual).

---

## I

**Invoice (Fatura)**  
Documento de cobrança emitido ao cliente. Pode estar ligada a uma `Company` (coworking) ou a uma `Reservation` (sala de reunião). Estados: `PENDENTE`, `PARCIAL`, `LIQUIDADA`, `EM_ATRASO`.

**InvoicePayment (Parcela de Pagamento)**  
Registo de uma parcela de pagamento de uma `Invoice`. Suporta pagamentos parciais.

**IVA**  
Imposto sobre o Valor Acrescentado. Campo `iva` nas entidades `Invoice` e `Reservation` representa a percentagem (ex: 14 para 14%). O sistema suporta IVA = 0 (isento).

---

## J

**JWT**  
JSON Web Token — formato do token de sessão do admin. Algoritmo: HS256. Expiração: 12h. Armazenado em cookie httpOnly.

---

## K

**KISS**  
Keep It Simple, Stupid — princípio de engenharia que favorece a solução mais simples que resolve o problema correctamente.

**Kz**  
Símbolo do Kwanza angolano (AOA). Ver `formatKz()` em `src/lib/currency.ts`.

---

## L

**Landing Page**  
Página pública principal (`/`) que apresenta o Azul Coworking e capta leads através de formulário.

**Lead**  
Potencial cliente que expressou interesse nos serviços do Azul Coworking. Tem estados que progridem num pipeline (NOVO → CONVERTIDO ou PERDIDO).

**Linguagem Ubíqua**  
Vocabulário comum entre negócio e tecnologia, definido neste glossário. Termos como "Lead", "Empresa", "Reserva" têm significados precisos no sistema.

**LiquidationNote (Nota de Liquidação)**  
Documento gerado automaticamente a cada confirmação de pagamento. Formato: `NL-YYYY-NNNNNN`. Imutável.

---

## M

**MeetingPlan (Plano de Reunião)**  
Tipo de reserva da sala de reunião com preço e capacidade definidos. Exemplos: "Standard 8 pax", "Executive 15 pax".

**Middleware**  
`src/middleware.ts` — verifica JWT e role antes de permitir acesso a rotas `/admin/*`.

**Multicaixa**  
Sistema de pagamento angolano. Método de pagamento aceite (`paymentMethod: "MULTICAIXA"`).

---

## N

**NIF**  
Número de Identificação Fiscal — campo opcional nas entidades `Company` e `AdminUser`.

**NL-YYYY-NNNNNN**  
Formato do número de Nota de Liquidação. Exemplo: `NL-2026-000001`.

**Nota de Liquidação**  
Ver `LiquidationNote`.

**Notificação**  
Alerta interno gerado pelo sistema para utilizadores do admin (tabela `Notification`). Tipos: INFO, WARNING, ERROR, SUCCESS. Prioridades: LOW, NORMAL, HIGH, URGENT.

---

## P

**PALOP**  
Países Africanos de Língua Oficial Portuguesa: Angola, Moçambique, Cabo Verde, São Tomé e Príncipe, Guiné-Bissau, Guiné Equatorial. Mercado-alvo de expansão do VD Platform.

**Payment (Pagamento/Recibo)**  
Registo de pagamento recebido ou pendente. O número de recibo segue o formato `REC-YYYY-NNNNNN`.

**PaymentMethod (Método de Pagamento)**  
Forma como o pagamento foi efectuado. Valores: `BCS_TRANSFERENCIA`, `MULTICAIXA`, `POS`, `NUMERARIO`, `CHEQUE`.

**PricingService**  
Serviço em `src/lib/pricing-service.ts` responsável por todos os cálculos de preço. É a única fonte de verdade para cálculos de preço.

---

## R

**RBAC**  
Role-Based Access Control — sistema de controlo de acesso por role (ADMIN, COMERCIAL, FINANCEIRO, VIEWER).

**REC-YYYY-NNNNNN**  
Formato do número de recibo de pagamento. Exemplo: `REC-2026-000001`.

**Reserva**  
Ver `Reservation`.

**RES-YYYY-NNNNNN**  
Formato do número de reserva. Exemplo: `RES-2026-000001`.

**Reservation (Reserva)**  
Utilização confirmada da sala de reunião. Tem datas, plano, participantes, e estado financeiro.

**RoomBookingLead (Lead de Sala)**  
Potencial cliente interessado em reservar a sala de reunião. Captado via formulário público `/salas`.

**RoomPricing**  
Tabela de preços da sala de reunião, configurável via admin.

**RoomSettings**  
Configurações gerais da sala (horário, duração mínima/máxima, IVA padrão, etc.).

**runningBalance**  
Saldo acumulado num `FinancialHistory`. Representa o saldo devedor/credor da empresa naquele momento. É a Source of Truth para o saldo financeiro de um cliente.

---

## S

**Sala de Reunião**  
Espaço dedicado a reuniões e eventos, reservável por hora, meio dia, dia inteiro ou fim de semana. Localização: Bairro Azul, Edifício 18, Luanda.

**SSoT**  
Single Source of Truth — princípio que garante que cada dado tem exactamente um proprietário no sistema.

**SOLID**  
Cinco princípios de design orientado a objectos: Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion.

---

## T

**Timeline**  
Registo cronológico de eventos de negócio associados a uma `Company` ou `Lead`. Visível na UI para a equipa operacional. É a "memória" do sistema sobre cada entidade.

**TOTP**  
Time-based One-Time Password — protocolo de 2FA implementado via `totpSecret` no `AdminUser`. Compatível com Google Authenticator.

---

## V

**VD Platform**  
Nome interno da plataforma SaaS desenvolvida pela Versão de Negócios. Acrónimo de "Versão Digital Platform".

**VERSÃO DE NEGÓCIOS - COMÉRCIO GERAL E PRESTAÇÃO DE SERVIÇOS, LDA**  
Entidade legal proprietária do Azul Coworking e do VD Platform. NIF: 5002174308.

**VIEWER**  
Role de utilizador com acesso apenas de leitura. Sem permissão para criar, actualizar ou eliminar dados.

---

## Y

**YAGNI**  
You Aren't Gonna Need It — princípio que desencoraja a implementação de funcionalidades não necessárias actualmente.

---

*VD Platform — Glossário v1.0.0 — Julho 2026*  
*Actualizar sempre que novos termos forem introduzidos no domínio*
