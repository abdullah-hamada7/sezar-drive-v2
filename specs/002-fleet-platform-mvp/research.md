# Phase 0: Research & Technical Decisions

**Feature**: 002-fleet-platform-mvp
**Context**: Pre-defined tech stack based on project constitution constraints.

## Tech Stack Decisions

### 1. Framework: NestJS vs. Express

- **Decision**: NestJS
- **Rationale**: The prompt requested a "single modular monolith". NestJS inherently provides a strong architectural module system, dependency injection, and scalable code organization which is essential for a large fleet platform containing shifts, trips, and authentication.
- **Alternatives considered**: Express (too unopinionated for a complex monolith without significant boilerplate).

### 2. Mobile App: React Native vs. Flutter

- **Decision**: React Native (Expo)
- **Rationale**: Since the admin dashboard is written in React (Web), using React Native for the driver app allows for shared logic, types (via monorepo packages), and developer familiarity across the entire stack.
- **Alternatives considered**: Flutter (steeper learning curve given web team is using React).

### 3. Database ORM: Prisma vs. TypeORM

- **Decision**: Prisma
- **Rationale**: Prisma's type-safety integrates perfectly with a TypeScript monorepo, generating strict types that can be shared in the `packages/contracts` directory.
- **Alternatives considered**: TypeORM, raw SQL (more error-prone).

### 4. Real-time Communication: Redis Pub/Sub + Socket.IO

- **Decision**: Socket.IO powered by Redis Adapter
- **Rationale**: Socket.IO handles disconnects and polling fallbacks gracefully (a critical requirement: "polling fallback for admin dashboard"). Redis Adapter fulfills the requirement for horizontal scaling across EC2 instances.
- **Alternatives considered**: Raw WebSockets (no built-in broadcast to rooms / poor fallback mechanism).

### 5. Idempotency Implementation

- **Decision**: Redis-backed Idempotency keys.
- **Rationale**: Fast read/write access. The backend will intercept requests with an `Idempotency-Key` header, check Redis to see if the request is processing/completed, and return the cached response to prevent duplicate state mutations (e.g., driver accepting a trip twice).
- **Alternatives considered**: PostgreSQL idempotency table (slower, adds DB load).

### 6. Face Verification

- **Decision**: AWS Rekognition (`CompareFaces` API)
- **Rationale**: Strictly defined by user constraint. Backend-only integration to keep credentials out of mobile app.
- **Alternatives considered**: N/A (Admin mandate).

### 7. Concurrency Strategy

- **Decision**: Optimistic Locking (Version Column) on Trip and Shift.
- **Rationale**: Ensures that if two operations fetch a trip and modify it simultaneously, the second save fails due to a `version` mismatch. This aligns with standard PostgreSQL patterns for high concurrency without blocking reads via pessimistic row locks.
- **Alternatives considered**: `SELECT FOR UPDATE` Pessimistic locking (higher risk of deadlocks).

*All technical parameters clarified. Proceeding to Data Model.*
