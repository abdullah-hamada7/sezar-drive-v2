# Implementation Plan: Fleet Platform MVP

**Branch**: `002-fleet-platform-mvp` | **Date**: 2026-03-03 | **Spec**: [002-fleet-platform-mvp/spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-fleet-platform-mvp/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Implementation of the complete Sezar Drive Fleet Platform MVP. This encompasses driver onboarding, shift activation with face verification, strict state-machine-driven trip execution, expense and damage reporting, and a real-time admin monitoring dashboard. The backend will be a modular monolith driven by stringent non-functional requirements including concurrent safety, immutable audit logging, and RBAC security.

## Technical Context

**Language/Version**: TypeScript (Node.js 20+)
**Primary Dependencies**: NestJS (for modular monolith architecture), Prisma ORM (or TypeORM), Socket.IO (WebSockets), AWS SDK (Rekognition, S3)
**Storage**: Amazon RDS PostgreSQL (Primary SQL), Redis (rate limiting, pubsub, last-known location), Amazon S3 (media storage)
**Testing**: Jest (Unit and E2E for state machine execution)
**Target Platform**: AWS EC2 (Docker Compose for backend, Nginx), Web (React), Android Native (React Native)
**Project Type**: Monorepo encompassing backend, web admin, and mobile clients
**Performance Goals**: <5s real-time dashboard updates, <2min driver processing, <2s face match verification.
**Constraints**: Backend-only Rekognition face verification, S3 pre-signed URLs only, Clients cannot communicate directly, strictly enforced single active shift/trip per driver.
**Scale/Scope**: Supports at least 500 concurrent active drivers reliably.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Code quality**: Modular monolith limits cross-domain spillage. Strict TS configs required.
- **Testing standards**: E2E testing mandated for Trip and Shift state machines. Negative scenarios for concurrency.
- **UX consistency**: Layout supports RTL/LTR switches dynamically (Arabic primary).
- **Performance**: Redis pub/sub handles WebSocket horizontal scaling.
- **State machine integrity**: Strict validations in NestJS service layer; DB constraints ensure invariants.
- **Audit logging**: `AuditLog` entity modeled. Interceptors/middleware will automatically catch mutations and append records.
- **Concurrency safety**: `version` field introduced on `Trip` enables optimistic locking to prevent double-accepts.
- **Security/RBAC**: JWT with 15m expiry. Face-match verifications evaluated via AWS Rekognition.

## Project Structure

### Documentation (this feature)

```text
specs/002-fleet-platform-mvp/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
apps/
├── api/                   # NestJS backend monorepo app
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── drivers/
│   │   │   ├── shifts/
│   │   │   ├── trips/
│   │   │   ├── vehicles/
│   │   │   └── tracking/
│   │   └── main.ts
│   └── test/              # e2e tests
├── admin-web/             # React dashboard
└── driver-mobile/         # Native Android driver app (React Native)
packages/
├── contracts/             # Shared TS interfaces and DTOs
└── shared/                # Common utilities
infra/                     # Docker Compose & Nginx configs
```

**Structure Decision**: Monorepo structure grouping the Modular Monolith (`api`), web client (`admin-web`), and mobile client (`driver-mobile`) while sharing domain rules and contracts via `packages/`. This adheres to the isolation constraints while maximizing type safety.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| *None*    | N/A | Structure naturally adheres to constraints. |
