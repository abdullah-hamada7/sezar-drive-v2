# ADR-002: NotificationAdapter as Sole Alert Entry Point

**Status:** Accepted  
**Date:** 2026-06-25  

## Context

Driver alerts fan out to WebSocket, FCM/Web Push, and the in-app `notifications` table. Multiple modules previously called `tracking.ws` or `push.service` directly, causing channel drift.

## Decision

All domain modules call **`NotificationAdapter`**, which delegates to:

- `driverAlert.service.js` — driver alerts (WS + push + inbox)
- `wsBroadcast.service.js` — admin WebSocket toasts (via `notifyAdmins`)

## Consequences

- **Positive:** Single place to extend alert behavior; agents documented in `AI_AGENT_CONTEXT.md`
- **Negative:** Thin facade layer; acceptable for stable call sites
- **Rule:** Do not import `push.service` or `wsBroadcast` from domain modules

## Change Log

| Date | Change |
|------|--------|
| 2026-06-25 | Accepted |
