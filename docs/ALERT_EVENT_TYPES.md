# Driver Alert Event Types

**Version:** 1.0  
**Date:** 2026-06-25  
**Status:** Approved  

This document is the **canonical registry** of driver alert event types. When adding or changing an event, update **all** locations listed below in the same change.

---

## 1. Why This Exists

Driver alerts flow through three channels (push, WebSocket, in-app inbox). Clients filter and display events by `type` string. Drift between backend and mobile/frontend causes silent failures (no toast, wrong navigation, missing badge refresh).

---

## 2. Registry

| Type | Trigger | Push | Inbox | WS | Backend emitter |
|------|---------|------|-------|-----|-----------------|
| `trip_assigned` | Admin assigns trip | ✅ | ✅ | ✅ | `trip.notifier.js` |
| `trip_accepted` | Driver accepts trip | ❌ | ❌ | ✅ | `trip.notifier.js` (WS only) |
| `trip_completed` | Trip completed | ❌ | ✅ | ✅ | `trip.notifier.js` (`push: false`) |
| `trip_cancelled` | Admin cancels trip | ✅ | ✅ | ✅ | `trip.notifier.js` |
| `shift_started` | Driver creates shift | ❌ | ❌ | ✅ | `shift.notifier.js` (WS only) |
| `shift_activated` | Shift goes Active | ✅ | ✅ | ✅ | `shift.notifier.js` |
| `shift_closed` | Shift closed (driver/admin) | ✅ | ✅ | ✅ | `shift.notifier.js` |
| `violation_created` | Admin records violation | ✅ | ✅ | ✅ | `violation.notifier.js` |
| `expense_update` | Driver submits expense | ❌ | ❌ | ✅ | `expense.service.js` (WS only) |
| `expense_reviewed` | Admin approves/rejects | ✅ | ✅ | ✅ | `expense.service.js` |
| `damage_update` | Admin reviews damage | ✅ | ✅ | ✅ | `damage.service.js` |
| `identity_update` | Identity approved/rejected | ✅ | ✅ | ✅ | `auth.service.js` |

### Admin-only WebSocket events (not in driver alert registry)

These use `notifyAdmins()` only — no driver push/inbox:

`expense_pending`, `damage_reported`, `identity_upload`, `inspection_created`, `rescue_request`, `trip_started`, `trip_accepted`, `shift_started`, etc.

---

## 3. Files That Must Stay In Sync

| Layer | File |
|-------|------|
| **Backend emitters** | `backend/src/modules/*/*.notifier.js`, `*.service.js` |
| **Backend fan-out** | `backend/src/services/driverAlert.service.js` |
| **Mobile constants** | `mobile/lib/src/core/services/driver_alert_events.dart` |
| **Mobile WS handler** | `mobile/lib/src/core/services/websocket_service.dart` |
| **Mobile local push** | `mobile/lib/src/core/services/local_notification_service.dart` |
| **Frontend WS** | `frontend/src/hooks/useDriverTracking.js` |
| **Docs** | [09-driver-alerts-and-notifications.md](09-driver-alerts-and-notifications.md) |

---

## 4. Adding a New Event Type

1. Choose a `snake_case` type string (e.g. `maintenance_scheduled`)
2. Add a row to the registry table above
3. Emit via `NotificationAdapter.alertDriver()` or `notifyDriverWs()` as appropriate
4. Add to `DriverAlertEvents.alertTypes` and `messages` / `titles` maps in Dart
5. Handle in mobile WebSocket + local notification services
6. Handle in `useDriverTracking.js` if PWA should show toast/navigate
7. Run `cd mobile && flutter test test/driver_alert_events_test.dart`

---

## 5. Mobile Reference (Dart)

```dart
// mobile/lib/src/core/services/driver_alert_events.dart
static const Set<String> alertTypes = {
  'trip_assigned',
  'trip_accepted',
  // … keep aligned with registry
};
```

---

## 6. Backend Reference (JavaScript)

```javascript
// Prefer NotificationAdapter — not raw push/WS calls
NotificationAdapter.alertDriver(driverId, {
  type: 'violation_created',  // must match registry
  title: 'Traffic Violation Recorded',
  body: '…',
  entityId: violation.id,
  wsPayload: { violationId: violation.id },
});
```

---

## Change Log

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-06-25 | Initial registry from production codebase |
