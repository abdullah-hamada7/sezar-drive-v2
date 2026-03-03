# Product Strategy — Sezar Drive (Fleet Management Platform)

**Version:** 1.1  
**Author Role:** Product Manager  
**Date:** 2026-02-17  
**Status:** Draft — Pending Approval  

---

## 1. Product Vision

Deliver a centralized fleet management platform that enables transportation companies to manage their entire driver-vehicle-trip lifecycle with full operational visibility, financial accountability, and audit compliance.

**Core Value Proposition:**
- Eliminate paper-based driver/vehicle tracking
- Enforce operational rules through system constraints (not manual processes)
- Provide real-time fleet visibility for admins
- Ensure financial integrity with automated revenue aggregation and auditable expense reporting

**Target Users:**
| User | Role | Primary Needs |
|------|------|---------------|
| Fleet Admin | Operations Manager | Driver provisioning, vehicle management, trip oversight, reporting, driver tracking |
| Driver | Field Operator | Shift/trip workflow, vehicle inspection, expense logging |
| Finance | Back-office | Revenue reports, expense approval, PDF/Excel exports |

---

## 2. Key Performance Indicators (KPIs)

### Operational KPIs
| KPI | Target | Measurement |
|-----|--------|-------------|
| Driver onboarding time | < 5 minutes | Account creation → first shift capable |
| Shift start time | < 3 minutes | Open app → shift active (including identity verification + vehicle scan) |
| Trip assignment to start | < 60 seconds | Trip assigned → trip started |
| Vehicle inspection completion | < 5 minutes | All required photos + checklist |
| System uptime | 99.5% | Monthly availability |

### Financial KPIs
| KPI | Target | Measurement |
|-----|--------|-------------|
| Revenue reconciliation accuracy | 100% | Daily computed revenue vs manual audit |
| Expense processing time | < 24 hours | Submission → approval/rejection |
| Report generation time | < 10 seconds | Request → downloadable file |

### Compliance KPIs
| KPI | Target | Measurement |
|-----|--------|-------------|
| Audit log completeness | 100% | All state transitions logged |
| Identity verification compliance | 100% | No active shifts without approved identity |
| Constraint violation rate | 0% | No duplicate active shifts/trips/assignments in DB |

---

## 3. Risk Matrix

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|-----------|--------|------------|
| R1 | Driver operates without identity verification | Medium | High | System prevents shift start until admin-approved identity photo exists |
| R2 | Duplicate active trips/shifts | Low | Critical | Partial unique indexes at DB level + application-level checks |
| R3 | Financial data manipulation | Medium | Critical | Immutable audit logs + admin approval workflow for expenses |
| R4 | Vehicle damage unreported | Medium | High | Post-trip checklist required; damage locks vehicle automatically |
| R5 | GPS tracking unavailable | Medium | Low | Tracking is non-blocking; core operations work independently |
| R6 | Driver app crash mid-trip | Medium | Medium | Trip state persists server-side; app resumes from last known state |
| R7 | Network loss during inspection upload | High | Medium | Retry queue; partial uploads preserved; timeout policy defined |
| R8 | Admin reassigns vehicle mid-shift | Low | High | System prevents reassignment while active trip exists; emergency override available with audit |
| R9 | Unauthorized access to financial data | Low | Critical | RBAC enforcement at API layer; JWT with short expiry |

---

## 4. Operational Model

### 4.1 Driver Lifecycle

```
Admin creates driver account (temporary password)
        ↓
Driver first login → forced password change
        ↓
Driver uploads identity photo
        ↓
Admin reviews & approves identity
        ↓
Driver is now shift-capable
        ↓
[Daily cycle begins]
        ↓
Driver starts shift → QR vehicle scan → 4-direction photos → shift active
        ↓
Trip assigned → Trip started → Trip completed
        ↓
(Repeat trips within shift)
        ↓
Driver closes shift (no active trips allowed)
```

### 4.2 Admin Operational Flow

```
Manage Drivers: Create accounts, review identity photos, approve/reject
        ↓
Manage Vehicles: Add vehicles, assign QR codes, track maintenance status
        ↓
Manage Trips: Assign trips, monitor status, emergency overrides
        ↓
Track Drivers: Real-time GPS location on map
        ↓
Review Expenses: Approve/reject driver expense submissions
        ↓
Generate Reports: Daily/weekly/monthly revenue & expense reports (PDF/Excel)
        ↓
Audit: Review immutable system logs
```

### 4.3 Vehicle State Model

```
Available → Assigned (to driver)
    ↑           ↓
    |      In Use (active trip)
    |           ↓
    └── Released (trip/shift end)
    
At any point:
    → Damaged (driver reports) → Locked → Admin Review → Maintenance → Available
```

### 4.4 Shift + Trip State Machines

**Shift States:**
```
PendingVerification → Active → Closed
                        ↑
              (Admin emergency close allowed, audit logged)
```

**Trip States:**
```
Assigned → Started → Completed
    ↓                    
 Cancelled              
```

**Preconditions for Trip Start:**
1. Active shift exists
2. Identity verified (admin-approved photo on file)
3. Vehicle validated (QR scan match)
4. Required inspection completed

---

## 5. Feature Priority (MoSCoW)

| Priority | Feature |
|----------|---------|
| **Must Have** | Auth with forced password reset |
| **Must Have** | Identity photo upload + admin approval |
| **Must Have** | Shift state machine |
| **Must Have** | Trip state machine |
| **Must Have** | Vehicle QR validation |
| **Must Have** | Vehicle inspection (photos + checklist) |
| **Must Have** | Expense management |
| **Must Have** | Audit logging |
| **Must Have** | RBAC |
| **Should Have** | PDF/Excel reports |
| **Should Have** | Real-time GPS tracking |
| **Should Have** | Damage reporting workflow |
| **Should Have** | Configurable inspection policy |
| **Could Have** | Auto-timeout for shifts |
| **Could Have** | Expense receipt OCR |
| **Won't Have (v1)** | Driver-to-admin chat |
| **Won't Have (v1)** | Passenger-facing features |

---

## Change Log

| Version | Date | Change | Author |
|---------|------|--------|--------|
| 1.0 | 2026-02-14 | Initial strategy document | Product Manager |
| 1.1 | 2026-02-17 | Updated branding to Sezar Drive and synced state machines | Product Manager |
