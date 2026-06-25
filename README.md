# Sezar Drive — Fleet Transportation & Trip Management Platform

Production fleet operations platform for admin-provisioned drivers: shift verification, trip lifecycle, vehicle inspections, expenses, damage reporting, traffic violations, real-time tracking, and multi-channel driver alerts.

**Production host:** [https://abdullahamada.me](https://abdullahamada.me)

---

## Executive Summary

Sezar Drive is a **modular monolith** (Node.js + PostgreSQL) with:

| Layer | Technology | Audience |
|-------|------------|----------|
| **Backend API** | Express.js, Prisma, PostgreSQL 16 | All clients |
| **Admin dashboard** | React 19 + Vite (PWA-capable) | Fleet administrators |
| **Driver web app** | React mobile-first PWA | Drivers (browser) |
| **Driver native app** | Flutter (Android primary) | Drivers (APK) |
| **Media storage** | AWS S3 (presigned URLs) | Photos, receipts, inspections |
| **Face verification** | AWS Rekognition | Shift start |
| **Push alerts** | FCM (mobile) + Web Push VAPID (PWA) | Drivers |
| **Real-time** | WebSocket (`/ws/tracking`) | GPS + live events |

Core invariants (enforced at API, application, and DB levels):

- One active shift per driver · one active trip per driver · one active driver per vehicle
- Face verification at shift start · QR vehicle validation · configurable inspection policy
- Immutable audit logging · daily S3 database backups with retention policy

---

## Repository Structure

```text
sezar-drive-v2/
├── backend/          # Express API, Prisma schema, migrations, services
├── frontend/         # React admin + driver PWA (Vite)
├── mobile/           # Flutter driver app (Android/iOS)
├── docs/             # Architecture, PRD, API, deployment, runbooks
├── infra/            # Docker, backup scripts, ops tooling
├── specs/            # Feature specs and checklists
├── compose.yml       # Local Docker Compose stack
└── terraform/        # AWS infrastructure (EC2, S3, IAM)
```

---

## Quick Start (Local)

### Prerequisites

- Docker & Docker Compose
- Node.js 20+ (optional, for running services outside Docker)
- Flutter 3.10+ (only for mobile development)

### 1. Environment

Create `.env` at repo root (see `docs/DEVELOPMENT_WORKFLOW.md`):

```bash
POSTGRES_PASSWORD=postgres
JWT_SECRET=dev-secret-change-me-dev-secret-change-me-dev-secret
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/sezar_drive?schema=public
```

### 2. Start stack

```bash
docker compose up -d
```

Migrations and seed run on backend startup by default. Seed prints admin credentials in non-production.

### 3. Access

| Service | URL |
|---------|-----|
| API | http://localhost:3000/api/v1 |
| Health | http://localhost:3000/api/v1/health |
| Frontend (if built/served) | See `frontend/README.md` |

### 4. Mobile app (optional)

```bash
cd mobile
flutter pub get
flutter run --dart-define=FLAVOR=dev --dart-define=DEV_HOST=10.0.2.2
```

See [mobile/README.md](mobile/README.md) and [mobile/docs/FCM_SETUP.md](mobile/docs/FCM_SETUP.md).

---

## Documentation Index

Full documentation lives in [`docs/README.md`](docs/README.md). Key entry points:

| Document | Purpose |
|----------|---------|
| [docs/01-strategy.md](docs/01-strategy.md) | Business strategy & KPIs |
| [docs/02-prd.md](docs/02-prd.md) | Product requirements |
| [docs/03-architecture.md](docs/03-architecture.md) | System architecture (C4, modules, security) |
| [docs/04-database-schema.md](docs/04-database-schema.md) | Relational schema & constraints |
| [docs/06-api-specification.md](docs/06-api-specification.md) | REST API reference |
| [docs/07-deployment-guide.md](docs/07-deployment-guide.md) | Production deployment |
| [docs/09-driver-alerts-and-notifications.md](docs/09-driver-alerts-and-notifications.md) | Push, WebSocket, in-app alerts |
| [docs/DEVELOPMENT_WORKFLOW.md](docs/DEVELOPMENT_WORKFLOW.md) | Migrations, seeding, local dev |
| [CLAUDE.md](CLAUDE.md) | Agent governance & domain invariants |

### Reading paths

- **New backend developer:** `03-architecture` → `04-database-schema` → `06-api-specification` → `DEVELOPMENT_WORKFLOW`
- **Mobile developer:** `mobile/README.md` → `09-driver-alerts-and-notifications` → `mobile/PRODUCT.md`
- **DevOps:** `07-deployment-guide` → `docs/08-database-backups.md` → `docs/05-devops.md`
- **Product / QA:** `02-prd` → `specs/002-fleet-platform-mvp/spec.md`

---

## Common Commands

### Backend

```bash
cd backend
npm install
npm run dev                    # Development server
npm run prisma:migrate:prod    # Apply migrations (production-safe)
npm run seed                   # Idempotent seed
npm test                       # Jest tests
```

### Frontend

```bash
cd frontend
npm install
npm run dev                    # Vite dev server (proxies /api/v1)
npm run build
npm run test:e2e               # Playwright
```

### Mobile

```bash
cd mobile
flutter analyze
flutter test
flutter build apk --release    # Production APK
python3 test/journeys/run_journey.py test/journeys/driver_login_smoke.xml  # Device UI journey (requires adb)
```

### Database migration (production)

```bash
cd backend && npx prisma migrate deploy
```

> **Important:** Run migrations after pulling changes. The `notifications` table and related push infrastructure require migration `20260625120000_add_notifications`.

---

## Driver Alert Channels

When admin or system events affect a driver, alerts are delivered through three channels (see [docs/09-driver-alerts-and-notifications.md](docs/09-driver-alerts-and-notifications.md)):

1. **Push** — FCM (Flutter APK) + Web Push (driver PWA)
2. **WebSocket** — Real-time UI refresh while app is open
3. **In-app notifications** — Persisted inbox with badge counts (`GET /api/v1/notifications`)

Events include: trip assigned/cancelled, shift activated/closed, expense reviewed, damage reviewed, identity verification, traffic violations.

---

## Inspection Photos & S3

Pre-shift vehicle inspections upload **six directional photos** (`front`, `back`, `left`, `right`, `dashboard`, `tank`) via `POST /api/v1/inspections/:id/photos`. The backend stores files in **AWS S3** under the `inspections/` prefix; the database holds S3 keys; clients receive **presigned URLs** for display.

---

## Contributing & Governance

- Lifecycle artifacts and role boundaries: [CLAUDE.md](CLAUDE.md)
- Agent / tooling notes: [AGENTS.md](AGENTS.md)
- Do not skip documented invariants; trace defects to originating artifacts before patching.

---

## Change Log

| Date | Change |
|------|--------|
| 2026-06-25 | Root README, driver alerts doc, mobile/frontend README overhaul, API & schema updates |
