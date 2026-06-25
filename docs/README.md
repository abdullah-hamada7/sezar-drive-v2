# Sezar Drive — Documentation Index

**Version:** 2.0  
**Date:** 2026-06-25  
**Maintainer:** Technical Documentation  

This index is the canonical map of project documentation. Documents are versioned artifacts; prefer updating an existing doc over creating ad-hoc notes.

---

## Executive Summary

Sezar Drive documentation spans **strategy → requirements → architecture → schema → API → operations**. The platform is a modular monolith with React web clients (admin + driver PWA), a Flutter native driver app, PostgreSQL, S3 media, and unified driver alerting (FCM + Web Push + WebSocket + in-app inbox).

---

## Document Map

### Lifecycle & Product

| Doc | Version | Description |
|-----|---------|-------------|
| [01-strategy.md](01-strategy.md) | 1.0 | Business strategy, KPIs, risks |
| [02-prd.md](02-prd.md) | 1.2 | Product requirements & acceptance criteria |
| [adr-001-device-verification.md](adr-001-device-verification.md) | — | Device binding ADR |

### Architecture & Design

| Doc | Version | Description |
|-----|---------|-------------|
| [03-architecture.md](03-architecture.md) | 1.4 | C4 diagrams, modules, security, real-time |
| [04-database-schema.md](04-database-schema.md) | 1.2 | Tables, indexes, invariants, seed data |
| [06-api-specification.md](06-api-specification.md) | 1.2 | REST API modules & endpoints |
| [09-driver-alerts-and-notifications.md](09-driver-alerts-and-notifications.md) | 1.0 | Push, WebSocket, notification inbox |
| [AI_AGENT_CONTEXT.md](AI_AGENT_CONTEXT.md) | 1.0 | Agent onboarding, invariants, task recipes |
| [CODEMAP.md](CODEMAP.md) | 1.0 | File/module navigation map |
| [ALERT_EVENT_TYPES.md](ALERT_EVENT_TYPES.md) | 1.0 | Driver alert type registry (sync checklist) |

### Operations & DevOps

| Doc | Version | Description |
|-----|---------|-------------|
| [05-devops.md](05-devops.md) | — | CI/CD, monitoring |
| [07-deployment-guide.md](07-deployment-guide.md) | 3.0 | Terraform → EC2 → Docker → Caddy |
| [08-database-backups.md](08-database-backups.md) | — | pg_dump, S3 retention |
| [DEVELOPMENT_WORKFLOW.md](DEVELOPMENT_WORKFLOW.md) | 1.1 | Local Docker, Prisma, seed, Flutter mobile |
| [../recovery.md](../recovery.md) | — | Disaster recovery runbook |

### Client Applications

| Doc | Description |
|-----|-------------|
| [../frontend/README.md](../frontend/README.md) | Admin + driver PWA |
| [../mobile/README.md](../mobile/README.md) | Flutter driver app |
| [../mobile/PRODUCT.md](../mobile/PRODUCT.md) | Mobile product & UX principles |
| [../mobile/DESIGN.md](../mobile/DESIGN.md) | Design tokens & patterns |
| [../mobile/docs/FCM_SETUP.md](../mobile/docs/FCM_SETUP.md) | Firebase / FCM setup |
| [../mobile/test/journeys/README.md](../mobile/test/journeys/README.md) | Android UI journey tests (ADB) |

### Specifications (Feature Plans)

| Path | Description |
|------|-------------|
| [../specs/002-fleet-platform-mvp/](../specs/002-fleet-platform-mvp/) | MVP spec, plan, tasks, API contracts |
| [../specs/001-doc-prd-requirements/](../specs/001-doc-prd-requirements/) | Documentation PRD |

### Agent & Tooling

| Doc | Description |
|-----|-------------|
| [AI_AGENT_CONTEXT.md](AI_AGENT_CONTEXT.md) | **Start here for AI agents** — invariants, patterns, pitfalls |
| [CODEMAP.md](CODEMAP.md) | Where backend/frontend/mobile code lives |
| [ALERT_EVENT_TYPES.md](ALERT_EVENT_TYPES.md) | Alert type strings — keep in sync across clients |
| [../CLAUDE.md](../CLAUDE.md) | Agent governance, invariants, roles |
| [../AGENTS.md](../AGENTS.md) | Cursor agent guidelines |

---

## Reading Paths by Audience

### Backend developer (onboarding)

1. [03-architecture.md](03-architecture.md) — module boundaries & data flow  
2. [04-database-schema.md](04-database-schema.md) — constraints & partial unique indexes  
3. [06-api-specification.md](06-api-specification.md) — endpoints  
4. [09-driver-alerts-and-notifications.md](09-driver-alerts-and-notifications.md) — `driverAlert.service.js`  
5. [DEVELOPMENT_WORKFLOW.md](DEVELOPMENT_WORKFLOW.md) — run locally  

**Key code paths:** `backend/src/app.js`, `backend/src/services/driverAlert.service.js`, `backend/src/modules/*/`

### Mobile developer

1. [../mobile/README.md](../mobile/README.md)  
2. [09-driver-alerts-and-notifications.md](09-driver-alerts-and-notifications.md)  
3. [../mobile/PRODUCT.md](../mobile/PRODUCT.md)  
4. [../mobile/docs/FCM_SETUP.md](../mobile/docs/FCM_SETUP.md)  

**Key code paths:** `mobile/lib/main.dart`, `mobile/lib/src/core/services/`, `mobile/lib/src/features/`

### Frontend developer

1. [../frontend/README.md](../frontend/README.md)  
2. [06-api-specification.md](06-api-specification.md)  
3. [09-driver-alerts-and-notifications.md](09-driver-alerts-and-notifications.md) — PWA push & WebSocket  

### DevOps / SRE

1. [07-deployment-guide.md](07-deployment-guide.md)  
2. [08-database-backups.md](08-database-backups.md)  
3. [05-devops.md](05-devops.md)  
4. [../recovery.md](../recovery.md)  

### QA / Product

1. [02-prd.md](02-prd.md)  
2. [../specs/002-fleet-platform-mvp/spec.md](../specs/002-fleet-platform-mvp/spec.md)  
3. [../mobile/test/journeys/README.md](../mobile/test/journeys/README.md)  

---

## Documentation Standards

Each formal artifact should include:

- **Title**, **Version**, **Author Role**, **Date**, **Change Log**
- Rationale for design decisions (the *why*, not only the *what*)
- Cross-links to related docs and code modules

When implementation diverges from docs:

1. Identify originating artifact  
2. Update document → re-approve → update code  

---

## Change Log

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-02-17 | Initial index |
| 2.0 | 2026-06-25 | Added alerts doc, mobile journeys, client README links, reading paths |
| 2.1 | 2026-06-25 | Added AI_AGENT_CONTEXT, CODEMAP, ALERT_EVENT_TYPES for agents |
