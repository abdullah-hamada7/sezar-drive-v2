# Product Requirements Document (PRD) — Fleet Transportation & Trip Management Platform

**Version:** 1.2  
**Author Role:** Business Analyst  
5: **Date:** 2026-02-17  
6: **Status:** Approved  
7: **Input Artifact:** `01-strategy.md` v1.0  

---

## Requirements

### Summary
The Product Requirements Document (PRD) is the single source of truth for all project requirements. All requirements documented in this section MUST be testable and unambiguous.

### 1. Functional Requirements

#### 1.1 Authentication & User Management
- **FR-AUTH-001**: Admin MUST be able to provision driver accounts with temporary passwords.
- **FR-AUTH-002**: System MUST force password change on first login.
- **FR-AUTH-003**: Identity verification (photo upload) MUST be required before shift activation.
- **FR-AUTH-004**: Audit logs MUST be created for all account mutations.

#### 1.2 Vehicle & Shift Management
- **FR-VEH-001**: Admin MUST be able to manage vehicle records (CRUD).
- **FR-VEH-002**: Vehicle assignment MUST be validated via QR code scan.
- **FR-SFT-001**: Only one active shift permitted per driver.
- **FR-SFT-002**: Facial verification (AWS Rekognition) MUST be required for shift start.
- **FR-SFT-003**: 4-direction vehicle inspection MUST be required for the first shift of the day.

#### 1.3 Trip & Expense Management
- **FR-TRP-001**: Trip state transitions MUST follow the defined state machine: ASSIGNED -> ACCEPTED -> IN_PROGRESS -> COMPLETED/CANCELLED.
- **FR-TRP-002**: Trip price MUST be immutable once the trip is IN_PROGRESS.
- **FR-EXP-001**: Expenses MUST be linked to a valid shift.
- **FR-EXP-002**: Admin approval workflow MUST be supported for expenses.

#### 1.4 Damage & GPS Tracking
- **FR-DMG-001**: Damage reports MUST include at least one photo.
- **FR-DMG-002**: Vehicle MUST be automatically locked upon damage report.
- **FR-GPS-001**: Driver location MUST be tracked every 30 seconds (configurable).

### 2. Non-Functional Requirements

- **NFR-PERF-001 (Performance)**: All key user actions (Login, Shift Start, Trip Accept) MUST have a response time of < 2 seconds under normal load.
- **NFR-SEC-001 (Security)**: All data in transit MUST be encrypted via HTTPS.
- **NFR-SEC-002 (Security)**: JWT-based authentication MUST be enforced for all API endpoints.
- **NFR-RELY-001 (Reliability)**: The core system MUST remain functional even if external GPS tracking (iTrack) is unavailable.
- **NFR-SCALE-001 (Scalability)**: System architecture MUST support horizontal scaling for high concurrent driver activity.

### 3. Testing Scope
- **Unit Testing**: Core state machines (Shift, Trip) and validation logic.
- **Integration Testing**: AWS Rekognition, iTrack GPS, and Database constraints.
- **E2E Testing**: Full driver flow from login to shift close, including admin approval queues.
- **Security Testing**: RBAC enforcement and token validation.

### 4. UX Consistency Notes
- All driver interactions MUST be mobile-first.
- All errors MUST appear as Top Right Toast Notifications (auto-dismiss after 5s).
- Consistent branding (**Sezar Drive**) MUST be applied across all user-facing interfaces.

---

## 1. Authentication & User Management

### 1.1 Admin Creates Driver Account

**Description:** Admin provisions a driver account with a temporary password.

**Acceptance Criteria:**
- AC-1.1.1: Admin can create driver with: name, email, phone, temporary password, license number
- AC-1.1.2: Driver record is created with `must_change_password = true`
- AC-1.1.3: Driver record has `identity_verified = false` until admin approves identity photo
- AC-1.1.4: Audit log entry created for driver account creation

**Edge Cases:**
- Duplicate email/phone → reject with 409 Conflict
- Password doesn't meet policy (min 8 chars, 1 number, 1 uppercase) → reject with 400

**Negative Scenarios:**
- Non-admin attempts to create driver → 403 Forbidden
- Missing required fields → 400 Bad Request with field-level errors

---

### 1.2 Driver First Login & Password Change

**Description:** Driver logs in with temporary password and is forced to set a new password.

**Acceptance Criteria:**
- AC-1.2.1: Login returns JWT with `must_change_password = true` flag
- AC-1.2.2: All endpoints except `/auth/change-password` blocked when flag is true
- AC-1.2.3: After password change, `must_change_password` set to false
- AC-1.2.4: New password cannot match temporary password
- AC-1.2.5: Audit log for password change event

**Edge Cases:**
- Driver tries to use old password after change → rejected
- Token expires during password change → must re-login

**Negative Scenarios:**
- Driver attempts to access any endpoint before changing password → 403 with `MUST_CHANGE_PASSWORD` error code

---

### 1.3 Identity Verification (Photo Upload + Admin Approval)

**Description:** Driver uploads a face/identity photo + ID card photos. Admin manually reviews and approves or rejects.

**Acceptance Criteria:**
- AC-1.3.1: Driver can upload a generic profile photo (avatar) as personal info.
- AC-1.3.2: Driver MUST upload: "Identity Verification" photo (face close-up), ID Card Front, and ID Card Back for admin review.
- AC-1.3.3: Photos stored securely.
- AC-1.3.4: Admin views "Verification Queue" to manually approve/reject identity photos.
- AC-1.3.5: On approval: `identity_verified = true`, driver can start shifts.
- AC-1.3.6: On rejection: driver notified, must re-upload.
- AC-1.3.7: Audit log for all upload/review events.
- AC-1.3.8: **Verification Filters**: Admin can filter queue by status (Pending/Approved/Rejected) and Driver Name.

**Edge Cases:**
- Driver uploads new photo while previous is pending → replaces pending photo
- Admin approves but driver already has active approved identity → keep latest

**Negative Scenarios:**
- Driver tries to start shift without approved identity → 403 with `IDENTITY_NOT_VERIFIED`
- Upload exceeds 5MB → 413 Payload Too Large
- Invalid file type → 400 Bad Request

---

## 2. Vehicle Management

### 2.1 Vehicle CRUD

**Acceptance Criteria:**
- AC-2.1.1: Admin can create vehicle with: plate number, model, year, QR code identifier, capacity
- AC-2.1.2: Admin can update vehicle details
- AC-2.1.3: Admin can deactivate (soft delete) vehicle
- AC-2.1.4: Plate number and QR code must be unique
- AC-2.1.5: **QR Search**: Admin can search for vehicles by scanning or typing QR code.

**Negative Scenarios:**
- Duplicate plate number → 409 Conflict
- Deactivate vehicle with active assignment → 409 Conflict

---

### 2.2 Vehicle Assignment & QR Validation

**Acceptance Criteria:**
- AC-2.2.1: **Matchmaking**: Driver scans Vehicle QR code via mobile app -> System validates match and assigns vehicle to driver.
- AC-2.2.2: System verifies vehicle is "Available" and not "Locked/Damaged".
- AC-2.2.2: Only one active driver per vehicle (DB constraint)
- AC-2.2.3: Only one active vehicle per driver (DB constraint)
- AC-2.2.4: Vehicle cannot be assigned if status is: `damaged`, `maintenance`, `locked`
- AC-2.2.5: Assignment creates audit log entry

**Edge Cases:**
- QR code scan returns unknown vehicle → 404
- Vehicle is valid but already assigned → 409 with assigned driver info (admin only)
- Admin force-reassigns vehicle → previous assignment ended, audit logged

**Negative Scenarios:**
- Driver scans QR of locked vehicle → 409 with reason
- Driver attempts assignment without active shift → 400

---

## 3. Shift Management

### 3.1 Shift State Machine

**States:** `PendingVerification` → `Active` → `Closed`

**Acceptance Criteria:**
- AC-3.1.1: Driver can create shift → starts in `PendingVerification`
- AC-3.1.2: Shift transitions to `Active` when all verifications complete:
  - Identity verified (approved photo on file)
  - Vehicle QR scanned and validated
  - **Facial Verification**: AWS Rekognition match between live selfie and identity photo.
  - **Inspection**: Full 4-direction photo inspection required for first shift of day.
- AC-3.1.3: Only one active shift per driver (partial unique index)
- AC-3.1.4: Shift cannot close if active trip exists
- AC-3.1.5: **End-of-Shift Inspection**: Full 4-direction photo inspection required *before* closing shift.
- AC-3.1.6: Admin can emergency close shift (bypasses active trip check, audit logged)
- AC-3.1.7: Auto-timeout: shift auto-closes after configurable hours (default: 14h)
- AC-3.1.8: All shift transitions audit logged

**Edge Cases:**
- Driver creates shift, app crashes, resumes → shift is in `PendingVerification`, resume from last step
- Shift auto-timeout while trip active → trip force-completed, then shift closed, both audit logged
- Driver tries to create new shift while previous is `PendingVerification` → reject (already exists)

**Negative Scenarios:**
- Driver without approved identity starts shift → 403
- Driver with existing active shift creates another → 409
- Driver tries to close shift with active trip → 409

---

## 4. Trip Management

### 4.1 Trip State Machine

**States:** `ASSIGNED` → `ACCEPTED` → `IN_PROGRESS` → `COMPLETED` | `CANCELLED` | `OFFLINE_PENDING_SYNC`

**Acceptance Criteria:**
- AC-4.1.1: Admin assigns trip to driver with: pickup, dropoff, scheduled time, price
- AC-4.1.2: Trip can be started only if ALL conditions met:
  - Active shift exists
  - Identity verified
  - Vehicle validated (active assignment)
  - Required inspection completed for current shift
- AC-4.1.3: Only one active/assigned trip per driver (partial unique index)
- AC-4.1.4: Trip price becomes immutable after status = `IN_PROGRESS`
- AC-4.1.5: Admin can modify trip state with override (fully audit logged)
- AC-4.1.6: Cancellation allowed in `ASSIGNED` state only (no override needed)
- AC-4.1.7: Cancellation in `IN_PROGRESS` state requires admin override
- AC-4.1.8: Completed trip requires: actual dropoff time recorded, optional post-trip checklist
- AC-4.1.9: All state transitions are concurrency-safe (optimistic locking)
- AC-4.1.10: **Passenger Bags**: Trip passenger list must include "Number of Bags" for each passenger.

**Edge Cases:**
- Network loss during trip start → client retries; server idempotent (same trip ID)
- Admin reassigns trip to different driver → original trip cancelled, new trip created, both audit logged
- Trip started but driver switches vehicles → not permitted during active trip

**Negative Scenarios:**
- Start trip without shift → 409 with error `NO_ACTIVE_SHIFT`
- Start trip without vehicle → 409 with error `NO_VEHICLE_ASSIGNED`
- Start second trip while one active → 409 with error `ACTIVE_TRIP_EXISTS`
- Complete already-completed trip → 409 with error `INVALID_STATE_TRANSITION`

---

## 5. Vehicle Inspection

### 5.1 Inspection Policy

**Acceptance Criteria:**
- AC-5.1.1: **Shift Start**: First shift of the day requires full inspection:
  - 4 vehicle photos (front, back, left, right)
  - QR scan verification
  - Mileage recording
- AC-5.1.2: **Shift End**: Closing shift requires full inspection (4-direction photos).
- AC-5.1.3: Subsequent trips within same shift require post-trip checklist only
- AC-5.1.4: Full photo inspection required in these cases (even after first shift):
  - Damage was reported on previous trip
  - Vehicle was reassigned since last inspection
  - Admin inspection policy flag is set
- AC-5.1.5: Inspection policy configurable by admin (global settings)
- AC-5.1.6: Inspection record linked to shift + vehicle
- AC-5.1.7: Photos stored securely with metadata (timestamp)

**Edge Cases:**
- Photo upload partially fails → inspection incomplete, cannot start trip
- Admin changes policy mid-shift → applies to next trip, not current

**Negative Scenarios:**
- Skip required photo → 400 with missing photos detail
- Upload photo to completed inspection → 400

---

## 6. Expense Management

### 6.1 Expense CRUD & Approval

**Acceptance Criteria:**
- AC-6.1.1: Expense must belong to an active or closed shift
- AC-6.1.2: Expense includes: amount, category (admin-defined), description, optional receipt photo
- AC-6.1.3: Expense categories managed by admin (CRUD)
- AC-6.1.4: If admin approval workflow enabled: expense starts as `pending`, admin approves/rejects
- AC-6.1.5: If approval not required: expense auto-approved on creation
- AC-6.1.6: Approved expenses included in daily revenue calculation
- AC-6.1.7: Expense creation, modification, approval/rejection all audit logged
- AC-6.1.8: Driver can only modify `pending` expenses

**Edge Cases:**
- Driver submits expense after shift closed → allowed (shift_id still valid)
- Admin rejects expense, driver re-submits → new expense, old one remains rejected

**Negative Scenarios:**
- Expense for non-existent shift → 400
- Expense amount ≤ 0 → 400
- Driver modifies approved expense → 403

---

## 7. Damage Reporting

### 7.1 Damage Workflow

**Acceptance Criteria:**
- AC-7.1.1: Driver reports damage with: description, minimum 1 photo (max 10)
- AC-7.1.2: Vehicle automatically locked on damage report
- AC-7.1.3: Admin receives damage notification (via dashboard indicator)
- AC-7.1.4: Admin reviews and can: acknowledge, assign to maintenance, resolve (unlock vehicle)
- AC-7.1.5: Vehicle remains locked until admin explicitly unlocks
- AC-7.1.6: Damage report linked to trip (if during trip) or shift
- AC-7.1.7: Full audit trail for damage lifecycle

**Edge Cases:**
- Damage reported mid-trip → trip can be completed, but vehicle locked after trip ends
- Multiple damage reports on same vehicle → all tracked, vehicle stays locked

**Negative Scenarios:**
- Report damage without photos → 400
- Driver assigns vehicle that has open damage report → 409

---

## 8. GPS Tracking

### 8.1 Real-Time Driver Tracking

**Acceptance Criteria:**
- AC-8.1.1: Driver app sends GPS coordinates at configurable interval (default: 30 seconds)
- AC-8.1.2: Admin dashboard shows all active drivers on a map (real-time updates via WebSocket)
- AC-8.1.3: Location history stored per driver per shift
- AC-8.1.4: Admin can view historical route for a completed trip
- AC-8.1.5: Tracking is non-blocking — all core operations work if tracking unavailable
- AC-8.1.6: Last known location stored in driver record

**Edge Cases:**
- GPS unavailable on device → last known location persists, no new updates
- Driver in tunnel/underground → gap in tracking, resumes automatically
- WebSocket connection drops → admin dashboard reconnects and fetches latest positions

**Negative Scenarios:**
- Tracking data with invalid coordinates → silently discarded
- Unauthorized access to tracking data → 403

---

## 9. Reporting

### 9.1 Revenue & Expense Reports

**Acceptance Criteria:**
- AC-9.1.1: Daily revenue computed per driver: sum of completed trip prices minus approved expenses
- AC-9.1.2: Reports filterable by: date range, driver, vehicle
- AC-9.1.3: Export as PDF with company header, summary table, and totals
- AC-9.1.4: Export as Excel with raw data sheets and summary sheet
- AC-9.1.5: Only admin can generate reports
- AC-9.1.6: Report generation audit logged
- AC-9.1.7: **Daily Dashboard**: Admin and Driver dashboards must show stats (revenue/activity) for the **current day only** by default (reset daily).

**Negative Scenarios:**
- Date range exceeds 90 days → 400 (configurable limit)
- Non-admin access → 403

---

## 10. Audit Logging

### 10.1 Immutable Audit Trail

**Acceptance Criteria:**
- AC-10.1.1: Insert-only table (no UPDATE/DELETE at application level)
- AC-10.1.2: Every log entry includes: actor_id, action_type, entity_type, entity_id, previous_state, new_state, timestamp, ip_address
- AC-10.1.3: Admin can query audit logs with filters: actor, date range, action type, entity
- AC-10.1.4: Audit logs exportable (admin only)

**Events that MUST be logged:**
| Event | Entity Type |
|-------|-------------|
| Driver created/updated | driver |
| Password changed | auth |
| Identity photo uploaded/approved/rejected | identity |
| Shift created/activated/closed | shift |
| Trip assigned/started/completed/cancelled | trip |
| Vehicle created/assigned/released/locked/unlocked | vehicle |
| Inspection completed | inspection |
| Expense created/modified/approved/rejected | expense |
| Damage reported/reviewed/resolved | damage |
| Admin override executed | override |
| Report generated | report |

## 11. User Interface Requirements

### 11.1 Driver Dashboard
- **Branding:** App Name updated to **Sezar Drive**.
- **Charts:**
    - Daily Earnings (Bar/Line chart) - Current Day View.
    - Trip History (Recent 5 trips).
- **Contact Info:**
    - Display Passenger Phone Number directly (No "Call" button that triggers dialer automatically, just text).
- **Features:**
    - "Scan Vehicle QR" prominent button for matchmaking.
    - "Upload Identity Photo" section (if not verified).
    - "Upload Profile Photo" section.

### 11.2 Admin Dashboard
- **Branding:** App Name updated to **Sezar Drive**.
- **Charts:**
    - Daily Revenue (Line chart) - Current Day View.
    - Active Drivers vs Total Drivers (Pie/Donut).
    - Verification Queue Widget (Count of pending approvals).
- **Verification:**
    - Dedicated view to compare Uploaded Photo vs Driver Details manually.
    - **Filters:** Filter queue by Status, Name.

### 11.3 General UI
- **Error Handling:**
    - All errors MUST appear as **Top Right Toast Notifications**.
    - Toasts should auto-dismiss after 5 seconds unless critical.

---

## Change Log

| Version | Date | Change | Author |
|---------|------|--------|--------|
| 1.0 | 2026-02-14 | Initial PRD | Business Analyst |
| 1.1 | 2026-02-15 | Added Sezar Drive branding, Bags, QR Search, Daily Stats, Verification Filters | Business Analyst |
| 1.2 | 2026-02-17 | Fixed duplication, synced TripState enums, refined verification & inspection rules | Business Analyst |

---
