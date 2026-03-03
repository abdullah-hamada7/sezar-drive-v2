# Gemini.md

## Fleet Transportation & Trip Management Platform

### Agent Governance Specification (Revised v2.0)

---

## 1. Purpose

This document defines the behavioral, architectural, and procedural rules governing Gemini when participating in the structured multi-role software development lifecycle for the Fleet Transportation & Trip Management Platform.

This is a production system.
All outputs must be implementation-ready, enforce strict invariants, and remain traceable across lifecycle artifacts.

---

## 2. Operating Model

Gemini operates as a **role-bound agent** within a controlled workflow.

Gemini must only act in the role explicitly assigned in the prompt.

Permitted roles:

* Product Manager
* Business Analyst
* Solutions Architect
* Database Administrator
* Project Manager
* Backend Developer
* Frontend Developer
* QA Engineer
* DevOps Engineer
* Team Lead (Code Review)

No cross-role blending is allowed.
No phase skipping is allowed.

---

## 3. Workflow Governance Rules

1. Every phase produces a formal, versioned artifact.
2. No phase proceeds without Product Engineer approval.
3. Outputs from one phase become binding inputs to the next.
4. If defects are discovered:

   * Trace to originating artifact.
   * Propose document correction first.
   * Update implementation only after artifact revision.
5. All artifacts must include:

   * Title
   * Version
   * Author Role
   * Date
   * Change Log

---

## 4. System Scope

The platform is a fleet-based transportation management system with:

* Admin-provisioned driver accounts
* Forced password change on first login
* Face verification at every shift start (rekognition:CompareFaces)
* QR-based vehicle validation
* Configurable inspection policy
* Strict trip and shift state machines
* Expense logging with optional approval
* Daily revenue aggregation
* PDF and Excel reporting
* Asynchronous iTrack GPS integration
* Immutable audit logging
* Damage reporting workflow
* Vehicle locking and maintenance state

All lifecycle constraints must be enforced at:

* API layer
* Application layer
* Database constraint level

---

## 5. Core Domain Invariants (Non-Negotiable)

### 5.1 Driver Constraints

* One active shift per driver.
* One active trip per driver.
* Face verification required at:

  * Every shift start
  * Device change
  * Post logout

---

### 5.2 Vehicle Constraints

* One active driver per vehicle.
* Vehicle cannot be assigned if:

  * Locked
  * Marked damaged
  * In maintenance state

---

### 5.3 Trip State Machine

States:

* Assigned
* Started
* Completed
* Cancelled

Rules:

* Trip cannot start without:

  * Active shift
  * Valid face verification session
  * Valid QR vehicle match
  * Required inspection completed
* Trip price immutable after start.
* Only admin override may alter state post-start (audit logged).
* Concurrency-safe state transitions required.

---

### 5.4 Shift State Machine

States:

* PendingVerification (Face verification required)
* Active
* Closed

Rules:

* Shift cannot close if trip active.
* Admin emergency override allowed (audit logged).
* Auto-timeout policy required.
* Face verification must be 'VERIFIED' for activation.
* Inspection requirements enforced at shift start.

---

### 5.5 Inspection Policy

At first shift of day:

* Face verification
* QR validation
* 4-direction vehicle photos

After each trip:

* Checklist confirmation only
* Full photo inspection only if:

  * Damage reported
  * Vehicle reassigned
  * Admin policy requires

Inspection policy must be configurable.

---

### 5.6 Financial Rules

* Expenses must belong to a shift.
* Expense categories admin-defined.
* Optional receipt upload.
* Optional admin approval workflow.
* Revenue calculated per driver per day.
* Reports exportable as:

  * PDF
  * Excel
* Financial changes must be audit logged.

---

### 5.7 GPS Tracking (iTrack)

* Integration must be asynchronous.
* Core system must operate if tracking unavailable.
* Adapter service required.
* Store:

  * Last known location
  * Historical tracking logs
* Polling or webhook model must be explicitly defined.

---

### 5.8 Damage Reporting

If damage reported:

* Photo evidence required.
* Vehicle auto-locked.
* Admin review required.
* Maintenance workflow supported.

---

### 5.9 Audit Logging

Immutable audit logs required for:

* Shift lifecycle events
* Trip lifecycle events
* Expense mutations
* Vehicle assignments
* Face verifications
* Admin overrides
* Damage reports

Log fields must include:

* Actor ID
* Timestamp
* Previous state
* New state
* Action type

---

## 6. Non-Functional Requirements

Gemini must ensure outputs consider:

* RBAC enforcement
* API-first design
* Idempotent endpoints
* Concurrency-safe transitions
* Partial unique DB indexes for invariants
* Secure image storage
* Horizontal scalability readiness
* Mobile-first UX considerations
* Graceful failure recovery
* Deterministic behavior

---

## 7. Role-Specific Output Constraints

### Product Manager

* Strategy document
* KPIs
* Risk analysis
* Business constraints
* No technical design

### Business Analyst

* PRD
* Acceptance criteria
* Edge cases
* Negative scenarios
* No architecture decisions

### Solutions Architect

* C4 diagrams
* Service boundaries
* Technology justification
* State machines
* Failure handling design
* Security model
* Integration architecture

### Database Administrator

* Full relational schema
* Constraints
* Partial unique indexes:

  * Active shift per driver
  * Active trip per driver
  * Active driver per vehicle
* Audit schema
* Seed data

### Backend Developer

* Strict state enforcement
* RBAC
* Audit logging
* Concurrency handling
* iTrack adapter
* Reporting engine (PDF/Excel)
* OpenAPI compliance

### Frontend Developer

* Admin dashboard
* Driver mobile flow
* QR scanner
* Face capture
* Inspection workflow
* Expense UI
* Report export UI

### QA Engineer

* State transition tests
* Negative tests
* Financial integrity tests
* Security tests
* Load tests

### DevOps Engineer

* CI/CD
* Containerization
* Monitoring
* Logging
* Deployment documentation
* Rollback strategy

### Team Lead

* Architecture compliance review
* Security validation
* Performance review
* Reject non-compliant code

---

## 8. Failure Handling Requirements

Gemini must explicitly design for:

* Face verification failure
* Image upload failure
* Network interruption
* App crash
* GPS outage
* Admin reassignment during active shift

Recovery mechanisms must maintain consistency.

---

## 9. Documentation as System Memory

Required artifacts:

* Strategy
* PRD
* Architecture
* Database Schema
* API Specification
* Test Cases
* Review Reports
* Deployment Documentation

Defect handling protocol:

1. Identify originating artifact.
2. Update document.
3. Re-approve.
4. Update implementation.

No blind patching.

---

## 10. Default Technical Assumptions (Unless Overridden in Architecture Phase)

* API-first design
* JWT-based authentication
* PostgreSQL relational database
* AWS S3 object storage for media (with Presigned URLs)
* Containerized deployment
* HTTPS-only communication
* Server-side validation mandatory

Any deviation must be justified in Architecture documentation.

---

## 11. Prohibited Behaviors

Gemini must not:

* Skip lifecycle phases
* Merge multiple roles in a single response
* Introduce undocumented features
* Bypass invariant enforcement
* Produce informal outputs
* Assume undefined business rules

---

## 12. Quality Standard

All outputs must be:

* Deterministic
* Auditable
* Enforceable
* Secure by design
* Concurrency-safe
* Implementation-ready
