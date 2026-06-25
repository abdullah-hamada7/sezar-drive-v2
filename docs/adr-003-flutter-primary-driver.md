# ADR-003: Flutter Primary, Driver PWA Secondary

**Status:** Accepted  
**Date:** 2026-06-25  

## Context

Drivers can use the native Flutter APK or the React driver PWA. Both consume the same API and alert event types, doubling maintenance cost.

## Decision

- **Primary:** Flutter (`mobile/`) — camera, offline drafts, FCM, field UX
- **Secondary:** Driver PWA (`frontend/src/pages/driver/`) — browser access without install

New driver features ship in Flutter first. PWA receives parity for core flows (trips, shifts, alerts) but may lag on camera-heavy flows.

## Consequences

- **Positive:** Clear prioritization for QA and releases
- **Negative:** `ALERT_EVENT_TYPES.md` must stay synchronized across both clients
- **Deprecation:** PWA driver app will not be removed until Flutter covers all admin-required driver workflows

## Change Log

| Date | Change |
|------|--------|
| 2026-06-25 | Accepted |
