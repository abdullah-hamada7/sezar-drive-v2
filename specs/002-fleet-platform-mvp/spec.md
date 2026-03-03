# Feature Specification: Sezar Drive — Fleet Platform MVP

**Feature Branch**: `002-fleet-platform-mvp`
**Created**: 2026-03-03
**Status**: Draft
**Input**: User description: "Sezar Drive full platform specification — auth, vehicles, shifts, trips, inspections, expenses, damage, reporting, real-time, security, and deployment."

## Clarifications

### Session 2026-03-03

- Q: What data does a Trip contain beyond price and state? → A: Standard dispatch — pickup location, dropoff location, passenger name, optional notes, and price.
- Q: When is the driver’s baseline reference photo established? → A: Admin uploads the reference photo when creating the driver account.
- Q: What language(s) must the apps support? → A: Arabic primary + English secondary (bilingual, user-selectable).
- Q: Are damage reports categorized by severity? → A: Simple tiers — Minor / Major / Critical, selected by driver at submission.
- Q: Does the driver upload identity documents? → A: No, the admin uploads all identity documents (ID front/back, reference photo) when provisioning the driver account.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Admin Provisions Driver Account and Driver Onboards (Priority: P1)

Admin creates a driver account by providing personal details and uploading all necessary identity documents (ID front/back, reference photo for face match) and setting a temporary password. Driver logs in and is forced to change their password before proceeding.

**Why this priority**: No other feature works without authenticated drivers. Centralized admin provisioning ensures compliance before drivers even log in.

**Independent Test**: Admin creates a driver with all documents → driver logs in with temp password → driver changes password → driver can now proceed to operational use.

**Acceptance Scenarios**:

1. **Given** admin is logged in, **When** admin creates a driver account with name, phone, identity documents (ID front/back), reference photo, and temporary password, **Then** the system creates the account, securely stores the documents and reference photo, marks the driver as verified, and records the action in the audit log.
2. **Given** a driver logs in with a temporary password, **When** the driver attempts to access any endpoint other than password change, **Then** the system blocks access and redirects to password change.
3. **Given** a driver changes their temporary password, **When** the change is successful, **Then** the driver gains access to standard operational features.

---

### User Story 2 — Driver Starts a Shift with Full Verification (Priority: P1)

A verified driver scans a vehicle QR code, the system validates vehicle
availability and assignment rules, the driver takes a face-match selfie, and (if
it is the first shift of the day) completes a 4-direction vehicle photo
inspection. The shift transitions from PendingVerification to Active.

**Why this priority**: Shifts gate every downstream operation — trips, expenses,
damage reports. Without shifts, the platform has no operational capability.

**Independent Test**: Driver scans QR, takes selfie, passes face match, completes
inspection, and the shift becomes Active. Driver can now operate.

**Acceptance Scenarios**:

1. **Given** a verified driver with no active shift, **When** the driver scans a
   valid vehicle QR code, **Then** the system assigns the vehicle if it is not
   locked, damaged, in maintenance, or already assigned to another active driver.
2. **Given** a vehicle is assigned, **When** the driver takes a selfie, **Then**
   the system compares the selfie against the driver's reference photo and
   requires a match above a configurable confidence threshold.
3. **Given** face match passes and it is the driver's first shift of the day,
   **When** the system prompts for inspection, **Then** the driver MUST upload 4
   directional photos of the vehicle before the shift can activate.
4. **Given** all pre-conditions are met, **When** the system activates the shift,
   **Then** only one active shift per driver exists (system-enforced), and the
   transition is audit logged.
5. **Given** a driver already has an active shift, **When** the driver tries to
   start another, **Then** the system rejects the request with a clear error.

---

### User Story 3 — Driver Completes a Trip Lifecycle (Priority: P1)

Admin assigns a trip to a driver. The driver accepts, starts (price locks),
completes or cancels the trip. Each transition is validated, concurrency-safe,
and audit logged.

**Why this priority**: Trips are the core revenue-generating activity. Without
trip lifecycle management, the platform serves no business purpose.

**Independent Test**: Admin assigns trip → driver accepts → starts → completes.
Price is locked at start and does not change. Admin can also cancel with a
reason.

**Acceptance Scenarios**:

1. **Given** a driver has an active shift and assigned vehicle, **When** admin
   creates a trip with pickup location, dropoff location, passenger name,
   optional notes, and price, **Then** the trip enters "Assigned" state.
2. **Given** the driver has no other active trip, **When** the driver accepts the
   trip, **Then** the trip transitions to "Accepted."
3. **Given** a trip is accepted, **When** the driver starts the trip, **Then**
   the price becomes immutable, the trip enters "In Progress," and the transition
   is audit logged.
4. **Given** a trip is in progress, **When** the driver completes the trip,
   **Then** the trip enters "Completed," revenue is recorded, and the event is
   broadcast for real-time dashboard use.
5. **Given** two requests arrive simultaneously to transition the same trip,
   **When** both compete, **Then** exactly one succeeds and the other receives a
   conflict error (concurrency-safe).
6. **Given** an admin needs to override a trip state, **When** admin performs the
   override with a required reason, **Then** the override is allowed and fully
   audit logged with the reason.

---

### User Story 4 — Admin Monitors Fleet in Real Time (Priority: P1)

The admin dashboard receives near-real-time updates for driver locations, driver
status (Active/Stale/Offline), shift and trip state changes, vehicle assignments,
damage reports, and expense changes. The dashboard defaults to current-day stats.

**Why this priority**: Operational visibility is essential for fleet management.
Without it, admins operate blind.

**Independent Test**: Admin opens the dashboard, sees live driver locations
updating, sees status indicators change from Active to Stale when a driver stops
sending location data, and sees trip state changes reflected immediately.

**Acceptance Scenarios**:

1. **Given** an admin opens the dashboard, **When** a driver sends location data,
   **Then** the admin dashboard updates the driver's pin within 5 seconds.
2. **Given** a driver has not sent location data for longer than a configurable
   threshold, **When** the admin views the dashboard, **Then** the driver is
   marked as "Stale" with a last-update timestamp.
3. **Given** a trip state changes, **When** the change is processed, **Then**
   the admin dashboard receives a push event with the new state within 5 seconds.
4. **Given** the real-time connection drops, **When** the admin dashboard cannot
   establish a push connection, **Then** it falls back to periodic polling.
5. **Given** multiple server instances are running, **When** an event occurs on
   instance A, **Then** all admins connected to any instance receive the event.

---

### User Story 5 — Driver Reports Damage (Priority: P2)

A driver reports vehicle damage with at least 1 photo (up to 10). The vehicle
is automatically locked. Admin reviews, manages the damage lifecycle, and
decides when to unlock the vehicle. All actions are audit logged.

**Why this priority**: Damage reporting protects both the company and the driver
from liability disputes, but is secondary to core operational flows.

**Independent Test**: Driver submits damage with photos → vehicle locks
automatically → admin reviews and resolves → vehicle can be unlocked.

**Acceptance Scenarios**:

1. **Given** a driver with an active shift, **When** the driver submits a damage
   report with a severity level (Minor / Major / Critical) and at least 1 photo,
   **Then** the system records the damage and immediately locks the vehicle.
2. **Given** a vehicle is locked due to damage, **When** any driver attempts to
   assign that vehicle, **Then** the system rejects the assignment.
3. **Given** an admin reviews a damage report, **When** the admin resolves it and
   unlocks the vehicle, **Then** the vehicle becomes available again and the
   unlock is audit logged.

---

### User Story 6 — Driver Manages Expenses within a Shift (Priority: P2)

Drivers log expenses against their active shift from admin-defined categories
with optional receipt upload. Admins approve or reject expenses. Only pending
expenses are editable. All mutations are audit logged.

**Why this priority**: Expense tracking is critical for daily revenue calculation
but does not block core trip operations.

**Independent Test**: Driver creates an expense with a receipt → admin sees it in
the approval queue → admin approves → expense is reflected in daily revenue.

**Acceptance Scenarios**:

1. **Given** a driver has an active shift, **When** the driver creates an expense
   with a category and amount, **Then** the expense is linked to the shift and
   enters "Pending" status.
2. **Given** an expense is pending, **When** the driver edits it, **Then** the
   change is accepted.
3. **Given** an expense is approved or rejected, **When** the driver attempts to
   edit it, **Then** the system rejects the edit.
4. **Given** admin views the expense queue, **When** admin approves an expense,
   **Then** it moves to "Approved" and is included in revenue calculations.

---

### User Story 7 — Admin Generates Revenue Reports (Priority: P2)

Admin views a daily revenue dashboard (completed trip prices minus approved
expenses per driver per day) and exports reports as PDF or Excel. Report
generation is audit logged.

**Why this priority**: Reporting enables financial oversight and regulatory
compliance but does not block daily operations.

**Independent Test**: Admin opens reports → sees current-day summary → exports
PDF and Excel — data reflects completed trips and approved expenses.

**Acceptance Scenarios**:

1. **Given** the admin opens the reporting section, **When** no date filter is
   applied, **Then** the dashboard defaults to current-day statistics.
2. **Given** completed trips and approved expenses exist for a date range,
   **When** admin exports as PDF, **Then** a formatted PDF with per-driver
   revenue breakdown is produced.
3. **Given** the same data, **When** admin exports as Excel, **Then** a
   structured spreadsheet with per-driver revenue breakdown is produced.
4. **Given** any report is generated, **Then** the generation event is audit
   logged with actor, timestamp, and filter parameters.

---

### User Story 8 — Driver Closes Shift with End-of-Shift Inspection (Priority: P2)

The driver performs end-of-shift inspection (4-photo directional), then closes
the shift. The shift cannot close if an active trip exists unless an admin
performs an emergency close. Shifts auto-timeout after a configurable duration
(default 14 hours).

**Why this priority**: Proper shift closure ensures vehicle accountability and
transitions, but is a terminal operation rather than a gate.

**Independent Test**: Driver completes end inspection → closes shift → vehicle
becomes unassigned. If trip is active, closure is blocked.

**Acceptance Scenarios**:

1. **Given** a driver has an active shift with no active trip, **When** the
   driver completes a 4-photo end inspection and requests closure, **Then** the
   shift transitions to "Closed" and the vehicle assignment is released.
2. **Given** a driver has an active trip, **When** the driver attempts to close
   the shift, **Then** the system blocks closure with an error.
3. **Given** a shift has been active for longer than the configured timeout
   (default 14h), **When** the timeout is reached, **Then** the system
   automatically closes the shift and audit logs the auto-close event.
4. **Given** an emergency situation, **When** admin performs an emergency close on
   a shift with an active trip, **Then** the trip enters a terminal state and the
   shift closes, with both transitions fully audit logged.

---

### Edge Cases

- What happens when a driver's device changes mid-shift? (Face re-verification
  is required.)
- What happens when photo upload fails mid-inspection? (The inspection remains
  incomplete; the driver must retry.)
- What happens when the face match confidence is below threshold? (The shift
  activation is blocked; the driver can retry.)
- What happens when the GPS/tracking service is unavailable? (The core system
  MUST continue to operate; GPS is non-blocking.)
- What happens when an admin reassigns a vehicle that has an active driver?
  (The system MUST reject the reassignment.)
- What happens when the network drops during a trip state transition? (The
  client retries with the same idempotency key; the system returns the same
  result.)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow admins to create verified driver accounts by uploading personal details, identity documents (ID front/back), a reference photo, and setting a temporary password.
- **FR-002**: System MUST force drivers to change their password on first login and block all other operations until changed.
- **FR-004**: System MUST enforce one active shift per driver at the database
  constraint level.
- **FR-005**: System MUST enforce one active trip per driver at the database
  constraint level.
- **FR-006**: System MUST enforce one active driver per vehicle at the database
  constraint level.
- **FR-007**: System MUST validate face match between driver selfie and reference
  photo at every shift start, device change, and post-logout.
- **FR-008**: System MUST require 4-directional vehicle photo inspection at first
  shift of day and at shift close.
- **FR-009**: System MUST support configurable inspection policy (conditions that
  force full inspection: damage reported, vehicle reassigned, admin policy).
- **FR-010**: Trip price MUST be immutable after the trip enters "In Progress"
  state.
- **FR-011**: System MUST support admin override of trip and shift states with
  required reason and full audit logging.
- **FR-012**: System MUST lock vehicle automatically when damage is reported.
- **FR-013**: System MUST enforce that expenses belong to a shift with
  admin-defined categories.
- **FR-014**: System MUST calculate daily revenue as completed trip prices minus
  approved expenses per driver per day.
- **FR-015**: System MUST export reports as PDF and Excel.
- **FR-016**: System MUST provide near-real-time push updates to the admin
  dashboard for driver locations, status changes, trip/shift state changes,
  vehicle assignments, damage reports, and expense status changes.
- **FR-017**: System MUST mark a driver as "Stale" when location data has not
  been received within a configurable threshold.
- **FR-018**: System MUST provide a polling fallback for the admin dashboard when
  push connections are unavailable.
- **FR-019**: System MUST support horizontal scaling of the push delivery
  mechanism so events reach all connected admins regardless of which server
  instance processes the event.
- **FR-020**: System MUST produce immutable audit records for every state
  transition, account mutation, financial change, and admin override.
- **FR-021**: All state-changing operations MUST support idempotency so that
  retried requests with the same key return identical results.
- **FR-022**: System MUST enforce role-based access control on every endpoint
  with deny-by-default permissions.
- **FR-023**: System MUST use short-lived access tokens (≤ 15 minutes) with
  refresh token rotation.
- **FR-024**: System MUST rate-limit login and sensitive endpoints.
- **FR-025**: System MUST validate file type, size, and content before accepting
  uploads, and MUST NOT expose storage credentials to clients.
- **FR-026**: System MUST assign a correlation ID to every request and include it
  in response headers and logs.
- **FR-027**: System MUST auto-timeout shifts after a configurable duration
  (default 14 hours).
- **FR-028**: System MUST support driver GPS location batch ingestion without
  blocking core operations.
- **FR-029**: System MUST store last-known driver location for real-time queries
  separately from location history.
- **FR-030**: Every real-time push event MUST include a unique event ID, type,
  timestamp, actor, entity type, entity ID, and event-specific data payload.
- **FR-031**: System MUST reject vehicle assignment if the vehicle is locked,
  damaged, or in maintenance state.
- **FR-032**: System MUST prevent shift closure if an active trip exists (except
  admin emergency close).
- **FR-033**: Both the driver app and admin dashboard MUST support Arabic
  (primary) and English (secondary) with user-selectable language and proper
  RTL/LTR layout switching.

### Key Entities

- **Driver**: Represents a fleet operator. Has identity documents and reference photo (uploaded securely by admin at account creation), account status, and credential state (temp vs. permanent password).
- **Vehicle**: Represents a fleet vehicle. Has plate number (unique), QR code
  (unique), lock status, damage status, maintenance status, and current
  assignment.
- **Shift**: Represents a driver's operational session. Has state
  (PendingVerification → Active → Closed), assigned vehicle, start/end time,
  inspection records, and timeout policy.
- **Trip**: Represents a revenue-generating passenger journey. Has pickup
  location, dropoff location, passenger name, optional notes, state
  (Assigned → Accepted → In Progress → Completed/Cancelled), price (immutable
  after start), assigned driver, and concurrency version.
- **Inspection**: Represents a vehicle safety check. Has type
  (start-of-day/end-of-shift/conditional), 4 directional photos, linked shift
  and vehicle, completion status.
- **Expense**: Represents a shift-related cost. Has amount, category
  (admin-defined), receipt document, approval status, and linked shift.
- **DamageReport**: Represents reported vehicle damage. Has photos (1–10),
  severity (Minor / Major / Critical, selected by driver), linked vehicle,
  resolution status, and associated vehicle lock.
- **AuditLog**: Immutable record of every significant action. Has actor, action
  type, entity, previous state, new state, timestamp, and optional reason.
- **LocationPoint**: Represents a GPS coordinate from a driver. Has latitude,
  longitude, timestamp, speed, heading, and linked driver/shift.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Drivers complete the onboarding flow (first login → password change) in under 2 minutes.
- **SC-002**: Admin can provision a complete driver account with all document uploads in under 3 minutes.
- **SC-003**: Shift activation (QR scan → face match → inspection → Active) takes
  under 3 minutes for the driver.
- **SC-004**: Trip state changes are reflected on the admin dashboard within
  5 seconds of occurrence.
- **SC-005**: Driver GPS locations update on the admin dashboard within
  5 seconds of receipt.
- **SC-006**: System supports at least 500 concurrent active drivers without
  degradation in state transition reliability.
- **SC-007**: Report export (PDF/Excel) completes within 10 seconds for up to
  30 days of data covering 500 drivers.
- **SC-008**: All critical state transitions (shift start/close, trip
  accept/start/complete/cancel) succeed with 99.9% reliability under concurrent
  load.
- **SC-009**: Face match verification returns a pass/fail result within
  5 seconds.
- **SC-010**: No audit log gaps — 100% of state transitions, admin overrides,
  and financial changes produce immutable audit records.
- **SC-011**: Real-time push events reach all connected admin dashboards
  regardless of which server instance processes the originating event.
- **SC-012**: System remains fully operational for core flows (shifts, trips,
  expenses) when GPS tracking service is unavailable.
- **SC-013**: Duplicate requests with the same idempotency key return identical
  results without creating duplicate records.
- **SC-014**: 95% of driver operations (trip accept, expense create, damage
  report) succeed on first attempt from a mobile device on a standard cellular
  connection.

### Assumptions

- The platform serves a single fleet operator (multi-tenancy is out of scope
  for MVP).
- Driver accounts are admin-provisioned; self-registration is not supported.
- The admin role is a single permission tier for MVP; granular admin roles can
  be added later.
- Offline trip sync ("OFFLINE_PENDING_SYNC" state) is a deferred capability
  noted in the trip states but not required for MVP launch.
- Payment processing is out of scope; trip prices are recorded but not charged
  through the platform.
- Vehicle maintenance workflow beyond lock/unlock is out of scope for MVP.
- Notification delivery (push notifications, SMS) to drivers is out of scope
  for MVP; the driver app polls or uses REST.
