# AI Agent Context — Sezar Drive

**Version:** 1.0  
**Date:** 2026-06-25  
**Audience:** Cursor / Claude agents working in this repository  

---

## 1. What This System Is

Sezar Drive is a **production fleet transportation platform**. Admins provision drivers, assign trips, manage vehicles, and review expenses/damage/violations. Drivers use a **Flutter APK** (primary) or **React PWA** to:

- Start shifts (face verification → QR scan → vehicle inspection)
- Accept and complete trips
- Log expenses, report damage, view violations
- Receive real-time alerts (WebSocket + push + in-app inbox)

**Production:** https://abdullahamada.me  
**Architecture:** Modular monolith (Node.js + PostgreSQL + S3 + Rekognition)

---

## 2. Read These First

| Priority | Document | Why |
|----------|----------|-----|
| 1 | [CLAUDE.md](../CLAUDE.md) | Domain invariants, role boundaries, prohibited behaviors |
| 2 | [CODEMAP.md](CODEMAP.md) | Where code lives — avoid blind search |
| 3 | [03-architecture.md](03-architecture.md) | Modules, state machines, security |
| 4 | [ALERT_EVENT_TYPES.md](ALERT_EVENT_TYPES.md) | Alert type strings must stay in sync |
| 5 | [09-driver-alerts-and-notifications.md](09-driver-alerts-and-notifications.md) | Push / WebSocket / inbox flow |

---

## 3. Non-Negotiable Invariants

Enforce at **API + service + DB constraint** levels:

| Rule | Detail |
|------|--------|
| One active shift per driver | Partial unique index on `shifts` |
| One active trip per driver | Partial unique index on `trips` |
| One active driver per vehicle | Partial unique index on `vehicle_assignments` |
| Face verification | Required at shift start; score > 80% or manual review |
| Trip price immutable | After `IN_PROGRESS` |
| Inspection policy | First shift of day: 6 photos; subsequent: checklist unless damage/reassign |
| Audit logging | Immutable; all admin overrides and state changes |
| Damage report | Auto-locks vehicle |

Do not bypass these for convenience. If a requirement conflicts, update the lifecycle artifact first ([CLAUDE.md](../CLAUDE.md) §9).

---

## 4. Package Boundaries

```text
backend/    Express API, Prisma, WebSocket, FCM/Web Push, S3 uploads
frontend/   React admin dashboard + driver PWA (same repo, role-based routes)
mobile/     Flutter driver app (Android primary)
docs/       Versioned architecture & API artifacts
specs/      Feature specs (002-fleet-platform-mvp is the MVP reference)
```

**Do not** mix concerns across packages without explicit need. Backend owns all business rules; clients are thin.

---

## 5. Common Agent Tasks

### Add a driver-facing alert

1. Add event type to [ALERT_EVENT_TYPES.md](ALERT_EVENT_TYPES.md)
2. Call `NotificationAdapter.alertDriver()` from the domain service or a notifier module
3. Add constant to `mobile/lib/src/core/services/driver_alert_events.dart`
4. Handle in `mobile/.../websocket_service.dart` and `local_notification_service.dart`
5. Handle in `frontend/src/hooks/useDriverTracking.js` if PWA should react
6. Update [09-driver-alerts-and-notifications.md](09-driver-alerts-and-notifications.md)

### Add an API endpoint

1. Route in `backend/src/modules/<domain>/`
2. Service layer with validation + audit log
3. Update [06-api-specification.md](06-api-specification.md)
4. Prisma migration if schema changes → [04-database-schema.md](04-database-schema.md)

### Fix mobile shift/inspection flow

Key files:

- `mobile/lib/main.dart` — `IndexedStack` tabs; inspection opens as **pushed route**
- `mobile/lib/src/features/shift/cubit/shift_cubit.dart` — `fetchActiveShift(silent: true)`
- `mobile/lib/src/features/inspection/cubit/inspection_cubit.dart` — Hive draft persistence

---

## 6. Notification Call Pattern (Backend)

**Do not** call `push.service` or `tracking.ws` directly from domain modules for driver alerts.

```javascript
const NotificationAdapter = require('../../services/notificationAdapter.service');

// Full alert (WebSocket + inbox + push)
NotificationAdapter.alertDriver(driverId, {
  type: 'trip_assigned',
  title: 'New Trip Assigned',
  body: '…',
  entityId: trip.id,
  wsPayload: { tripId: trip.id },
});

// WebSocket only (driver-initiated, UI already open)
NotificationAdapter.notifyDriverWs(driverId, { type: 'expense_update', expenseId });

// Admin dashboard toast
NotificationAdapter.notifyAdmins('expense_pending', 'Title', 'Message', { expenseId });
```

Implementation chain: `notificationAdapter.service.js` → `driverAlert.service.js` → `wsBroadcast.service.js` → local WS clients + Redis relay.

---

## 7. Database & Migrations

- Schema: `backend/prisma/schema.prisma`
- Apply in prod: `cd backend && npx prisma migrate deploy`
- Recent critical migration: `20260625120000_add_notifications` (notification inbox)

Never skip migrations on production — missing tables cause API 500s (e.g. notifications screen).

---

## 8. Testing Commands

```bash
# Backend
cd backend && npm test

# Frontend E2E
cd frontend && npm run test:e2e

# Mobile
cd mobile && flutter analyze && flutter test
cd mobile && python3 test/journeys/run_journey.py test/journeys/driver_login_smoke.xml  # needs adb
```

---

## 9. What Agents Should Avoid

- Skipping lifecycle phases or merging PM/Architect/Dev roles in one response ([CLAUDE.md](../CLAUDE.md))
- Duplicating alert type strings instead of using shared constants
- Tab-switch navigation for shift inspection (use pushed route)
- Committing `.env`, credentials, or `mobile/android/.kotlin/` build artifacts
- Force-pushing `main`
- Large refactors unrelated to the task (especially validator/event-bus extractions unless requested)

---

## 10. Change Log

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-06-25 | Initial agent context document |
