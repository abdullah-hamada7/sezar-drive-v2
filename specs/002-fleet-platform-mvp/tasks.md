# Tasks: Fleet Platform MVP

**Input**: Design documents from `/specs/002-fleet-platform-mvp/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/api-spec.md

**Tests**: Tests are REQUIRED by the constitution. Any waiver MUST be explicitly approved and recorded in the feature specification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and monorepo structure

- [X] T001 Initialize pnpm monorepo structure per implementation plan
- [ ] T002 [P] Create NestJS app in `apps/api/`
- [ ] T003 [P] Create React app in `apps/admin-web/`
- [X] T004 [P] Create React Native (Expo) app in `apps/driver-mobile/`
- [X] T005 Set up `packages/contracts/` and `packages/shared/` workspaces
- [X] T006 Initialize Docker Compose for Postgres, Redis in `infra/docker-compose.yml`
- [X] T007 Configure Nginx reverse proxy template in `infra/nginx.conf`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

- [X] T008 Setup Prisma schema with Core Entities (Driver, Vehicle, Shift, Trip, etc.) in `apps/api/prisma/schema.prisma`
- [X] T009 Implement generic error handling and logging (`AuditLog` interceptor) in `apps/api/src/common/`
- [X] T010 [P] Implement authentication/authorization framework (JWT Guard, Roles Guard) in `apps/api/src/modules/auth/`
- [X] T011 [P] Configure Redis Module (bullmq/ioredis) in `apps/api/src/common/redis/`
- [X] T012 Implement Idempotency Guard/Interceptor backed by Redis in `apps/api/src/common/idempotency/`
- [X] T013 Create AWS SDK providers (S3, Rekognition) in `apps/api/src/common/aws/`

**Checkpoint**: Foundation ready - user story implementation can now begin.

---

## Phase 3: User Story 1 - Admin Provisions Driver Account and Driver Onboards (Priority: P1) 🎯 MVP

**Goal**: Admin creates a driver account with documents, driver logs in and changes temporary password.

**Independent Test**: Admin creates driver → driver logs in → driver changes password → account active.

### Tests for User Story 1

- [X] T014 [P] [US1] E2E test for driver creation flow in `apps/api/test/driver-provision.e2e-spec.ts`
- [X] T015 [P] [US1] E2E test for login and force password change in `apps/api/test/auth.e2e-spec.ts`

### Implementation for User Story 1

- [X] T016 [P] [US1] Create Driver and Auth DTOs in `packages/contracts/src/auth.dto.ts`
- [X] T017 [US1] Implement `POST /auth/login` and `POST /auth/password/change` in `apps/api/src/modules/auth/`
- [X] T018 [US1] Implement `POST /admin/drivers` with S3 upload handling in `apps/api/src/modules/drivers/`
- [X] T019 [US1] Refine `DriverService` to trigger `AuditLog` on driver creation

**Checkpoint**: Driver accounts can be provisioned and secured.

---

## Phase 4: User Story 2 - Driver Starts a Shift with Full Verification (Priority: P1)

**Goal**: Driver scans QR, face matches, does initial inspection, and opens a shift.

**Independent Test**: Driver scans QR -> face match succeeds -> 4-photo upload -> shift becomes ACTIVE.

### Tests for User Story 2

- [X] T020 [P] [US2] E2E test for shift start flow (Mocking Rekognition) in `apps/api/test/shift-start.e2e-spec.ts`

### Implementation for User Story 2

- [X] T021 [P] [US2] Create Shift and Inspection DTOs in `packages/contracts/src/shifts.dto.ts`
- [X] T022 [US2] Implement Face Match validation service calling AWS Rekognition in `apps/api/src/modules/auth/`
- [X] T023 [US2] Implement `POST /driver/shifts/start` encompassing Vehicle check, Face Match, and Inspection creation in `apps/api/src/modules/shifts/`
- [X] T024 [US2] Enforce Partial Unique Index check for single active shift in `ShiftService`

**Checkpoint**: Shifts can be securely started.

---

## Phase 5: User Story 3 - Driver Completes a Trip Lifecycle (Priority: P1)

**Goal**: Admin assigns trip; driver accepts, starts, completes. Concurrency safe.

**Independent Test**: Admin creates trip -> driver accepts (optimistic lock tested) -> starts -> completes.

### Tests for User Story 3

- [X] T025 [P] [US3] E2E state machine test for trip transitions in `apps/api/test/trip-lifecycle.e2e-spec.ts`
- [X] T026 [P] [US3] Unit test for Optimistic Locking concurrency safety in `apps/api/src/modules/trips/trips.service.spec.ts`

### Implementation for User Story 3

- [X] T027 [P] [US3] Create Trip DTOs in `packages/contracts/src/trips.dto.ts`
- [X] T028 [US3] Implement `POST /admin/trips` and `PATCH /admin/trips/:id/override` in `apps/api/src/modules/trips/admin.controller.ts`
- [X] T029 [US3] Implement `PATCH /driver/trips/:id/accept`, `/start`, `/complete` in `apps/api/src/modules/trips/driver.controller.ts`
- [X] T030 [US3] Attach `Idempotency-Key` interceptors to driver trip mutators
- [X] T031 [US3] Wire up `version` check in Prisma for pessimistic update on Trips

**Checkpoint**: Core business loop (Trips) is operational.

---

## Phase 6: User Story 4 - Admin Monitors Fleet in Real Time (Priority: P1)

**Goal**: WebSocket integration for live status updates on trips, shifts, and locations.

**Independent Test**: Dispatch an event via API, observe Socket.IO client receive it (or fallback to polling if WS closed).

### Tests for User Story 4

- [X] T032 [P] [US4] E2E test for WebSocket event dispatching in `apps/api/test/websockets.e2e-spec.ts`

### Implementation for User Story 4

- [X] T033 [US4] Setup `Socket.IO` module with Redis Adapter in `apps/api/src/common/websockets/`
- [X] T034 [US4] Inject `WsEventEmitter` into Shift and Trip services to broadcast `shift:state_change` and `trip:state_change`
- [X] T035 [US4] Implement `POST /driver/location/batch` and broadcast `driver:location_update`
- [X] T036 Create polling fallback endpoint `GET /admin/fleet/live`

**Checkpoint**: Core operational dashboard logic complete.

---

## Phase 7: User Stories 5, 6, 7 & 8 - P2 Features (Damage, Expenses, Reports, Shift Close)

**Goal**: Complete side-flows: Damage reporting, expense tracking, daily revenue, and shift closure.

### Implementation for P2 Stories

- [X] T037 [P] [US5] Implement `POST /driver/damage` in `apps/api/src/modules/vehicles/` (Auto-locks vehicle)
- [X] T038 [P] [US6] Implement `POST /driver/expenses` and `PATCH /admin/expenses/:id/approve` in `apps/api/src/modules/expenses/`
- [X] T039 [P] [US7] Implement `GET /admin/reports/revenue` aggregation logic in `apps/api/src/modules/reports/`
- [X] T040 [US8] Implement `POST /driver/shifts/close` validating no active trips

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T041 Ensure all DTO interfaces are exported correctly from `packages/contracts` to both frontend clients.
- [X] T042 Stand up frontend scaffolding in `admin-web` targeting authentication and live map socket connections.
- [ ] T043 Complete Quickstart deployment verifications.

---

## Dependencies & Execution Order

- **Phase 1 & 2** must be strictly executed first.
- **Phase 3 (Auth)** blocks the remainder.
- **Phases 4 through 6 (Shifts, Trips, Live Dashboard)** can technically be worked on parallelly by 3 different developers as long as the DTO definitions (T021, T027) are merged early.
- **Phase 7** runs at the end as cleanup.

## Implementation Notes

- Tasks marked complete were implemented against existing repo structure in `backend/` and `frontend/` (not duplicated under `apps/api` and `apps/admin-web`).
