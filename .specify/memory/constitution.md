<!--
Sync Impact Report
- Version change: 1.0.0 -> 2.0.0
- Modified principles:
  - "I. Code Quality Is Non-Negotiable" -> "I. Code Quality Is Non-Negotiable" (unchanged)
  - "II. Testing Standards Are Mandatory" -> "II. Testing Standards Are Mandatory" (expanded)
  - "III. User Experience Consistency" -> "III. User Experience Consistency" (unchanged)
  - "IV. Performance Requirements Are Explicit" -> "IV. Performance Requirements Are Explicit" (unchanged)
  - "V. Quality Gates And Review Discipline" -> "V. Quality Gates And Review Discipline" (unchanged)
- Added sections:
  - "VI. State Machine Integrity" (NEW — domain-critical)
  - "VII. Audit Logging Is Immutable" (NEW — domain-critical)
  - "VIII. Concurrency Safety" (NEW — domain-critical)
  - "IX. Security And RBAC Enforcement" (NEW — domain-critical)
  - "Domain Invariants" (NEW — codifies GEMINI.md rules)
- Removed sections: None
- Templates requiring updates:
  - ✅ .specify/templates/plan-template.md (Constitution Check already generic)
  - ✅ .specify/templates/spec-template.md (acceptance scenarios generic)
  - ✅ .specify/templates/tasks-template.md (test requirement already present)
- Follow-up TODOs:
  - None — ratification date resolved.
-->
# Sezar Drive Constitution

## Core Principles

### I. Code Quality Is Non-Negotiable

All changes MUST maintain readable, maintainable, and reviewable code. Refactors in
touched areas are REQUIRED when they reduce complexity or ambiguity. Any exception
to established quality standards MUST be documented with rationale and follow-up.
Rationale: Long-term delivery speed and safety depend on consistent code quality.

### II. Testing Standards Are Mandatory

Every new feature and bug fix MUST include tests that validate the intended
behavior and protect critical user journeys. Tests MUST be deterministic, reviewed
as first-class deliverables, and run in CI as a merge gate. State machine
transitions, negative scenarios, and concurrency edge cases MUST have dedicated
tests. Any test waiver MUST be explicitly approved and recorded with scope and
duration.
Rationale: Product stability depends on predictable, repeatable validation.

### III. User Experience Consistency

User-facing flows MUST remain consistent with approved interaction patterns,
terminology, and visual standards. Any intentional deviation MUST be approved and
documented in the feature spec. Error handling and edge cases MUST preserve the
same UX quality bar as primary flows.
Rationale: Consistency reduces user friction and support costs.

### IV. Performance Requirements Are Explicit

Each feature MUST define measurable performance targets (latency, throughput, or
resource usage as applicable). Regressions against agreed targets MUST block
release until resolved or formally waived with documented risk.
Rationale: Performance is a core part of user experience and system reliability.

### V. Quality Gates And Review Discipline

Every change MUST pass quality gates: code review, test verification, UX
consistency checks, and performance validation. Reviews MUST confirm compliance
with this constitution before merge.
Rationale: Gates prevent silent regressions and enforce shared standards.

### VI. State Machine Integrity

Trip (Assigned → Started → Completed/Cancelled) and Shift (PendingVerification →
Active → Closed) state machines MUST be enforced at API, application, and database
constraint levels. No state transition may bypass validation rules. Admin overrides
MUST be audit logged with actor, previous state, new state, and justification.
Rationale: State integrity is the foundation of operational correctness in fleet
management; inconsistent state leads to financial and safety risks.

### VII. Audit Logging Is Immutable

All lifecycle events (shifts, trips, expenses, vehicle assignments, face
verifications, admin overrides, damage reports) MUST produce immutable audit
records. Each record MUST include actor ID, timestamp, previous state, new state,
and action type. Audit records MUST NOT be editable or deletable.
Rationale: Immutable audit trails are required for operational accountability,
dispute resolution, and regulatory compliance.

### VIII. Concurrency Safety

All state transitions affecting shared resources (driver-to-vehicle assignment,
shift activation, trip start) MUST be concurrency-safe. Partial unique database
indexes MUST enforce one-active-shift-per-driver, one-active-trip-per-driver, and
one-active-driver-per-vehicle invariants. Optimistic or pessimistic locking
strategies MUST be documented and tested.
Rationale: Fleet operations involve concurrent mobile clients; race conditions
directly cause data corruption and operational failures.

### IX. Security And RBAC Enforcement

Authentication MUST use JWT. Authorization MUST enforce role-based access control
at the API layer. Face verification MUST be required at shift start, device change,
and post-logout. Media storage MUST use presigned URLs. All endpoints MUST perform
server-side validation. Admin-only operations MUST be explicitly gated and audit
logged.
Rationale: The platform manages financial, identity, and vehicle data that demand
defense-in-depth security.

## Domain Invariants

These invariants are codified from the project governance specification and MUST
be enforced at all system layers:

- **Driver**: One active shift per driver. One active trip per driver. Face
  verification required at every shift start, device change, and post-logout.
- **Vehicle**: One active driver per vehicle. Vehicle MUST NOT be assignable if
  locked, damaged, or in maintenance.
- **Trip**: MUST NOT start without active shift, valid face verification, valid QR
  vehicle match, and required inspection. Price immutable after start.
- **Shift**: MUST NOT close if trip is active. Auto-timeout policy required.
- **Inspection**: Configurable policy. Full photo inspection at first shift of day;
  checklist-only after trips unless damage/reassignment/admin override.
- **Financial**: Expenses MUST belong to a shift. Categories admin-defined. Revenue
  per driver per day. Reports exportable as PDF and Excel.
- **GPS (iTrack)**: Integration MUST be asynchronous. Core system MUST operate if
  tracking unavailable. Adapter service required.
- **Damage**: Photo evidence required. Vehicle auto-locked. Admin review required.

## Quality Standards

- Feature specs MUST include testing scope, UX consistency notes, and performance
  targets.
- Feature specs MUST identify which domain invariants the feature affects and
  include acceptance scenarios for invariant preservation.
- Release readiness MUST document known quality risks and approved waivers.
- Quality regressions MUST be treated as release blockers by default.

## Compliance Workflow

- Every plan MUST include a Constitution Check aligned to these principles.
- Every spec MUST define measurable quality outcomes.
- Every task list MUST include the required quality validation work.
- Every feature touching state machines MUST include state transition tests.
- Every feature touching financial data MUST include audit logging verification.

## Governance

- This constitution supersedes other process guidance when conflicts arise.
- Amendments require a documented change proposal, rationale, and explicit
  approval by product leadership.
- Versioning follows semantic versioning: MAJOR for incompatible policy changes,
  MINOR for new or expanded guidance, PATCH for clarifications.
- Compliance MUST be verified during reviews and noted in delivery artifacts.

**Version**: 2.0.0 | **Ratified**: 2026-02-17
| **Last Amended**: 2026-03-03
