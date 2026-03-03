# API Contracts: Fleet Platform MVP

This document outlines the primary REST API endpoints and real-time WebSocket events. All requests MUST include standard security headers and, where required, an `Idempotency-Key`.

## 1. Authentication & Onboarding

- `POST /auth/login` — Returns JWT access and refresh tokens.
- `POST /auth/refresh` — Rotates short-lived access token.
- `POST /auth/password/change` — Enforces password reset for new drivers (blocks other operations).

## 2. Admin Operations (RBAC Enforced)

- `POST /admin/drivers` — Provisions a new driver Account (Accepts `multipart/form-data` for ID documents and reference photo).
- `GET /admin/drivers` — Lists drivers with filters.
- `POST /admin/trips` — Dispatches a new trip to a driver's active shift.
- `PATCH /admin/trips/:id/override` — Force-modifies a trip state; requires `reason` payload.
- `PATCH /admin/expenses/:id/approve` — Marks an expense approved.
- `GET /admin/reports/revenue` — Fetches daily generated revenue (PDF/Excel query params).

## 3. Driver Operations (JWT + Active Shift Validations)

- `POST /driver/shifts/start`
  - **Payload**: QR code data, Base64 face selfie, 4x vehicle photos (if first shift).
  - **Validation**: Rejects if vehicle locked/damaged, or face match fails via Rekognition.
- `POST /driver/shifts/close`
  - **Payload**: 4x end-of-shift vehicle photos.
  - **Validation**: Fails if an active trip exists.
- `PATCH /driver/trips/:id/accept`
  - **Headers**: `Idempotency-Key`
- `PATCH /driver/trips/:id/start`
  - **Headers**: `Idempotency-Key`. Locks the trip price.
- `PATCH /driver/trips/:id/complete`
  - **Headers**: `Idempotency-Key`
- `POST /driver/expenses`
  - **Payload**: Amount, Category, Receipt Image.
- `POST /driver/damage`
  - **Payload**: Severity, description, 1-10 photos. Auto-locks the vehicle.
- `POST /driver/location/batch`
  - **Payload**: Array of GPS points. Stores to TSDB/History and updates Redis last-known location.

## 4. Real-time Events (Socket.IO)

**Namespace:** `/admin`
**Authentication:** Handshake requires Admin JWT.
**Adapter:** Redis adapter enabling horizontal scaling across API instances.

### Push Events (Server → Admin Client)

- `driver:location_update`: Payload contains `{ driverId, lat, lng, speed, heading, timestamp }`. Used to animate map pins.
- `driver:status_change`: Payload contains `{ driverId, status: 'ACTIVE' | 'STALE' | 'OFFLINE', lastSeen }`.
- `trip:state_change`: Payload contains `{ tripId, driverId, oldState, newState, timestamp }`.
- `shift:state_change`: Payload contains `{ shiftId, driverId, oldState, newState, timestamp }`.
- `damage:reported`: Alerts admins immediately of a newly locked vehicle.
- `expense:created`: Adds to pending approval badge.

*Note: If Socket.IO drops, the Admin client falls back to pulling `/admin/fleet/live` via HTTP.*
