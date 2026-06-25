# ADR-004: WebSocket Redis Relay for Horizontal Scaling

**Status:** Accepted  
**Date:** 2026-06-25  

## Context

WebSocket client maps (`adminClients`, `driverClients`) were in-memory per Node process. A second API instance would miss notifications and live position updates for clients connected elsewhere.

## Decision

Introduce **`wsBroadcast.service.js`**:

1. Deliver to local connected clients immediately
2. Publish to Redis channel `sezar:ws:relay` when `REDIS_URL` is set
3. Other instances subscribe and deliver to their local clients

When Redis is unavailable, behavior degrades to single-instance delivery (unchanged from before).

## Auth

WebSocket JWT auth prefers `Sec-WebSocket-Protocol: bearer, <token>` to avoid tokens in URL access logs. Query param `?token=` remains supported for backward compatibility.

## Consequences

- **Positive:** Ready for multiple API replicas behind a load balancer
- **Negative:** Requires Redis in multi-instance deployments; sticky sessions still help for connection longevity
- **Not in scope:** Shared presence registry or WS connection migration

## Change Log

| Date | Change |
|------|--------|
| 2026-06-25 | Accepted |
