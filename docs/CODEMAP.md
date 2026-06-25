# Code Map — Sezar Drive

**Version:** 1.0  
**Date:** 2026-06-25  
**Purpose:** Fast navigation for agents and developers  

---

## Repository Root

| Path | Role |
|------|------|
| [README.md](../README.md) | Project overview, quick start, doc index |
| [CLAUDE.md](../CLAUDE.md) | Agent governance & domain invariants |
| [AGENTS.md](../AGENTS.md) | Cursor agent commands & links |
| [compose.yml](../compose.yml) | Local Docker stack |
| [terraform/](../terraform/) | AWS EC2, S3, IAM |

---

## Backend (`backend/`)

### Entry & wiring

| Path | Role |
|------|------|
| `src/server.js` | HTTP + WebSocket startup, migrations on boot |
| `src/app.js` | Express middleware, route mounting |
| `src/config/` | Env config, constants, database |
| `prisma/schema.prisma` | Canonical data model |
| `prisma/migrations/` | SQL migrations (deploy with `migrate deploy`) |

### Cross-cutting services

| Path | Role |
|------|------|
| `src/services/driverAlert.service.js` | Unified driver alert fan-out (WS + push + inbox) |
| `src/services/notificationAdapter.service.js` | Thin facade for notifiers → driverAlert + notifyAdmins |
| `src/services/notification.service.js` | CRUD for `notifications` table |
| `src/services/push.service.js` | Web Push VAPID + orchestrates FCM |
| `src/services/fcm.service.js` | FCM token storage & multicast |
| `src/services/FileService.js` / `S3Service.js` | S3 upload + presigned URLs |
| `src/services/FaceVerificationService.js` | AWS Rekognition CompareFaces |
| `src/services/audit.service.js` | Immutable audit log writes |
| `src/services/state-machine.js` | Trip/shift transition helpers |

### Domain modules (`src/modules/`)

| Module | Key files | Responsibility |
|--------|-----------|----------------|
| `auth/` | `auth.service.js`, `auth.routes.js`, `rescue.service.js` | Login, JWT, device verify, password |
| `driver/` | `driver.service.js`, `driver.routes.js` | Driver CRUD, badge counts, tab views |
| `vehicle/` | `vehicle.service.js`, `vehicle.routes.js` | Vehicles, QR scan, assignments |
| `shift/` | `shift.service.js`, `shift.notifier.js`, `shift.validator.js` | Shift state machine |
| `trip/` | `trip.service.js`, `trip.notifier.js` | Trip lifecycle |
| `inspection/` | `inspection.service.js` | 6-photo + checklist inspections → S3 |
| `expense/` | `expense.service.js` | Expenses + approval |
| `damage/` | `damage.service.js` | Damage reports, vehicle lock |
| `violation/` | `violation.service.js`, `violation.notifier.js` | Traffic violations |
| `verification/` | `verification.service.js`, `verification.routes.js` | Identity upload, shift selfie, admin review |
| `tracking/` | `tracking.ws.js`, `tracking.service.js` | GPS WebSocket, location logs |
| `push/` | `push.routes.js`, `notification.routes.js` | Device registration, notification inbox API |
| `report/` | `report.service.js` | PDF/Excel revenue reports |
| `stats/` | `stats.service.js` | Dashboard cards, driver earnings |

### Real-time

| Path | Role |
|------|------|
| `modules/tracking/tracking.ws.js` | WebSocket server; `notifyDriver()`, `notifyAdmins()` |

---

## Frontend (`frontend/`)

| Path | Role |
|------|------|
| `src/pages/admin/` | Admin dashboard pages |
| `src/pages/driver/` | Driver PWA pages |
| `src/hooks/useDriverTracking.js` | WebSocket + GPS + driver alert toasts |
| `src/hooks/usePushNotifications.js` | Web Push subscription |
| `src/hooks/useNotificationBadge.js` | Notification inbox badge |
| `src/hooks/useDriverBadges.js` | Tab badge counts |
| `src/services/` | HTTP wrappers per domain |
| `public/sw-push.js` | Service worker push handler |

---

## Mobile (`mobile/`)

### Core

| Path | Role |
|------|------|
| `lib/main.dart` | App shell, `IndexedStack` navigation, Bloc providers |
| `lib/src/core/config/app_config.dart` | API URLs, flavors (dev/staging/prod) |
| `lib/src/core/network/dio_client.dart` | JWT, refresh, offline cache |
| `lib/src/core/network/api_endpoints.dart` | REST path constants |
| `lib/src/core/services/service_locator.dart` | get_it DI registration |

### Alerts & real-time

| Path | Role |
|------|------|
| `lib/src/core/services/driver_alert_events.dart` | Alert type constants (sync with backend) |
| `lib/src/core/services/websocket_service.dart` | WebSocket client |
| `lib/src/core/services/mobile_push_service.dart` | FCM + Android 13 permission |
| `lib/src/core/services/local_notification_service.dart` | Foreground OS notifications |

### Features (`lib/src/features/`)

| Feature | Path | Notes |
|---------|------|-------|
| Auth | `auth/` | Login, device verify, password change |
| Shift | `shift/` | Verification flow, silent refresh |
| Inspection | `inspection/` | 6-photo wizard, Hive drafts |
| Trip | `trip/` | Accept/start/complete, map |
| Notifications | `notifications/` | In-app inbox cubit + screen |
| Expenses | `expense/` | Submit + list |
| Damage | `damage/` | Report flow |
| Violations | `violation/` | Driver violation list |

### Tests

| Path | Role |
|------|------|
| `test/journeys/` | ADB UI journey specs + runner |
| `test/driver_alert_events_test.dart` | Alert constant unit tests |

---

## Documentation (`docs/`)

| Doc | Content |
|-----|---------|
| [README.md](README.md) | Documentation index & reading paths |
| [AI_AGENT_CONTEXT.md](AI_AGENT_CONTEXT.md) | Agent onboarding (this repo) |
| [CODEMAP.md](CODEMAP.md) | This file |
| [ALERT_EVENT_TYPES.md](ALERT_EVENT_TYPES.md) | Alert type registry |
| [03-architecture.md](03-architecture.md) | C4, modules, state machines |
| [04-database-schema.md](04-database-schema.md) | Tables & constraints |
| [06-api-specification.md](06-api-specification.md) | REST endpoints |
| [09-driver-alerts-and-notifications.md](09-driver-alerts-and-notifications.md) | Alert architecture |
| [DEVELOPMENT_WORKFLOW.md](DEVELOPMENT_WORKFLOW.md) | Local dev, migrations, Flutter |

---

## Specs (`specs/`)

| Path | Content |
|------|---------|
| `specs/002-fleet-platform-mvp/` | MVP spec, plan, tasks, API contracts |
| `specs/001-doc-prd-requirements/` | Documentation PRD |

---

## Change Log

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-06-25 | Initial code map |
