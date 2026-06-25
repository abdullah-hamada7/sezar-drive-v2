# Sezar Drive — Agent & Developer Guidelines

Last updated: 2026-06-25

## Active Technologies

| Layer | Stack |
|-------|-------|
| Backend | Node.js, Express, Prisma, PostgreSQL 16, Jest |
| Frontend | React 19, Vite, Playwright |
| Mobile | Flutter 3.10+, Dart, flutter_bloc, Firebase FCM |
| Infra | Docker Compose, AWS EC2, S3, Caddy, Terraform |
| Docs | Markdown lifecycle artifacts in `docs/` |

## Project Structure

```text
backend/     # API server, Prisma, migrations, services
frontend/    # Admin + driver PWA (React)
mobile/      # Flutter driver app
docs/        # Architecture, PRD, API, deployment
specs/       # Feature specifications
infra/       # Ops scripts
```

## Commands

### Backend

```bash
cd backend && npm install && npm run dev
npm run prisma:migrate:prod   # production-safe migrations
npm run seed
npm test
```

### Frontend

```bash
cd frontend && npm install && npm run dev
npm run build && npm run test:e2e
```

### Mobile

```bash
cd mobile && flutter pub get && flutter analyze && flutter test
flutter run --dart-define=FLAVOR=dev --dart-define=DEV_HOST=10.0.2.2
flutter build apk --release
```

### Docker (full stack)

```bash
docker compose up -d
```

## Documentation

- **Start here:** [README.md](README.md) and [docs/README.md](docs/README.md)
- **AI agent onboarding:** [docs/AI_AGENT_CONTEXT.md](docs/AI_AGENT_CONTEXT.md)
- **Code navigation:** [docs/CODEMAP.md](docs/CODEMAP.md)
- **Alert type registry:** [docs/ALERT_EVENT_TYPES.md](docs/ALERT_EVENT_TYPES.md)
- **Domain invariants & agent roles:** [CLAUDE.md](CLAUDE.md)
- **Driver alerts:** [docs/09-driver-alerts-and-notifications.md](docs/09-driver-alerts-and-notifications.md)

## Code Style

- Match existing conventions in each package; minimal focused diffs
- Backend: enforce invariants at API + service + DB constraint level
- Mobile: use `DriverAlertEvents` constants for alert types; do not duplicate strings
- Use Context7 for library documentation when needed
- Markdown documentation: follow standards in `docs/README.md`

## Recent Changes

- 2026-06-25: Unified driver alert service; Flutter inspection draft persistence; notifications migration; documentation overhaul
- 2026-02-17: Initial documentation PRD (001-doc-prd-requirements)

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
