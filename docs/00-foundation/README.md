# Volume 00 — Foundation

> **Volume:** 00  
> **Título:** Foundation — Bases da Plataforma  
> **Estado:** ✅ Aprovado  
> **Versão:** 1.0.0  
> **Data:** Julho 2026  

---

## Sumário Executivo

O Volume 00 estabelece as **bases irrevogáveis** sobre as quais toda a plataforma VD será construída. Nenhum volume subsequente poderá contradizer as decisões aqui documentadas sem que uma nova versão deste volume seja aprovada e todos os volumes dependentes sejam actualizados.

Este volume responde às seguintes perguntas fundamentais:

1. **O que estamos a construir e para quem?** → [product-vision.md](./product-vision.md)
2. **Como está organizado o sistema?** → [architecture.md](./architecture.md)
3. **Quais são as entidades e regras do domínio?** → [domain-model.md](./domain-model.md)
4. **Com que tecnologias e porquê?** → [technology-stack.md](./technology-stack.md)
5. **Quais são os princípios invioláveis de engenharia?** → [principles.md](./principles.md)
6. **Como desenvolvemos correctamente?** → [development-methodology.md](./development-methodology.md)

---

## Índice deste Volume

| Documento | Páginas Est. | Prioridade |
|---|---|---|
| [product-vision.md](./product-vision.md) | ~20 | 🔴 Crítica |
| [architecture.md](./architecture.md) | ~35 | 🔴 Crítica |
| [domain-model.md](./domain-model.md) | ~30 | 🔴 Crítica |
| [technology-stack.md](./technology-stack.md) | ~20 | 🟠 Alta |
| [principles.md](./principles.md) | ~15 | 🟠 Alta |
| [development-methodology.md](./development-methodology.md) | ~15 | 🟠 Alta |
| [checklist.md](./checklist.md) | ~10 | 🟡 Média |
| [diagrams/](./diagrams/) | — | 🟠 Alta |

---

## Decisões Fundamentais deste Volume

As seguintes decisões são **definitivas** até revisão formal com ADR:

| # | Decisão | Justificação |
|---|---|---|
| FD-001 | A plataforma é uma SaaS multi-módulo com arquitectura Clean + DDD | Escalabilidade e manutenibilidade a longo prazo |
| FD-002 | Next.js 15 (App Router) como framework principal | SSR/RSC nativo, performance, ecosistema |
| FD-003 | PostgreSQL como base de dados relacional via Prisma | ACID, relações complexas, extensibilidade |
| FD-004 | Event Bus interno para comunicação entre módulos | Desacoplamento, rastreabilidade, extensibilidade |
| FD-005 | JWT em cookies httpOnly para autenticação | Segurança, stateless, compatibilidade |
| FD-006 | Single Source of Truth: cada entidade tem um único dono | Consistência de dados |
| FD-007 | RBAC com roles ADMIN / COMERCIAL / FINANCEIRO / VIEWER | Segurança granular |
| FD-008 | Cloudinary para gestão de activos binários | CDN global, transformações automáticas |
| FD-009 | Documentação é a fonte de verdade, nunca o código | Governança e qualidade |
| FD-010 | Toda alteração requer documentação prévia aprovada | Qualidade > velocidade |

---

## Estado de Implementação vs. Documentação

| Módulo | Código Existente | Documentado | Auditado |
|---|---|---|---|
| CRM — Leads | ✅ Parcial | 📝 Vol 01 (planeado) | ❌ |
| Cowork — Empresas | ✅ Parcial | 📝 Vol 02 (planeado) | ❌ |
| Reservas — Sala | ✅ Parcial | 📝 Vol 03 (planeado) | ❌ |
| Financeiro | ✅ Parcial | 📝 Vol 04 (planeado) | ❌ |
| Segurança | ✅ Básico | 📝 Vol 05 (planeado) | ❌ |
| Notificações | ✅ Básico | 📝 Vol 07 (planeado) | ❌ |
| Dashboard | ✅ Básico | 📝 Vol 08 (planeado) | ❌ |

> **Nota Arquitectural:** O código existente precede a documentação formal. Todo o código existente deverá ser **auditado e alinhado** com a arquitectura definida neste volume antes de avançar para novos módulos.

---

## Como Usar este Volume

### Para o Product Owner
Leia `product-vision.md` e `domain-model.md`. Valide que as entidades de negócio e as regras reflectem a realidade operacional do Azul Coworking e a visão futura da plataforma.

### Para o Arquiteto
Leia todos os documentos por ordem. Os ADRs em `../adr/` registam as decisões técnicas que suportam cada escolha.

### Para Claude Code
Consulte `../claude-guide/README.md` antes de qualquer acção. Este volume é pré-requisito de leitura obrigatória.

### Para Novos Elementos da Equipa
Leia por esta ordem:
1. `product-vision.md`
2. `principles.md`
3. `architecture.md`
4. `domain-model.md`
5. `development-methodology.md`
6. `technology-stack.md`
