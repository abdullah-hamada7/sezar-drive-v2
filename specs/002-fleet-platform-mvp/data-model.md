# Data Model: Fleet Platform MVP

This document outlines the core entities and relationships for the Sezar Drive MVP, mapped for a PostgreSQL database utilizing Prisma ORM.

## Core Entities (Prisma Pseudo-Schema)

```prisma
// ---------------------------------------------------------
// ENUMS
// ---------------------------------------------------------

enum AccountStatus {
  PENDING_PASSWORD_CHANGE
  ACTIVE
  SUSPENDED
}

enum VehicleStatus {
  AVAILABLE
  LOCKED_DAMAGED
  LOCKED_MAINTENANCE
  ASSIGNED
}

enum ShiftState {
  PENDING_VERIFICATION
  ACTIVE
  CLOSED
}

enum TripState {
  ASSIGNED
  ACCEPTED
  IN_PROGRESS
  COMPLETED
  CANCELLED
}

enum InspectionType {
  START_OF_DAY
  END_OF_SHIFT
  CONDITIONAL // Triggered by damage, reassignment
}

enum DamageSeverity {
  MINOR
  MAJOR
  CRITICAL
}

enum ExpenseStatus {
  PENDING
  APPROVED
  REJECTED
}

// ---------------------------------------------------------
// MODELS
// ---------------------------------------------------------

model Driver {
  id                  String        @id @default(uuid())
  name                String
  phone               String        @unique
  passwordHash        String
  accountStatus       AccountStatus @default(PENDING_PASSWORD_CHANGE)
  
  // S3 Object Keys
  idCardFrontUrl      String
  idCardBackUrl       String
  referencePhotoUrl   String        // Uploaded by admin, used for AWS Rekognition
  
  // Relations
  shifts              Shift[]
  trips               Trip[]
  locationPoints      LocationPoint[]

  createdAt           DateTime      @default(now())
  updatedAt           DateTime      @updatedAt
}

model Vehicle {
  id                  String        @id @default(uuid())
  plateNumber         String        @unique
  qrCode              String        @unique
  status              VehicleStatus @default(AVAILABLE)

  // Relations
  shifts              Shift[]
  damageReports       DamageReport[]

  createdAt           DateTime      @default(now())
  updatedAt           DateTime      @updatedAt
}

model Shift {
  id                  String        @id @default(uuid())
  state               ShiftState    @default(PENDING_VERIFICATION)
  startTime           DateTime?
  endTime             DateTime?
  
  // Relations
  driverId            String
  driver              Driver        @relation(fields: [driverId], references: [id])
  vehicleId           String?
  vehicle             Vehicle?      @relation(fields: [vehicleId], references: [id])
  
  inspections         Inspection[]
  expenses            Expense[]

  createdAt           DateTime      @default(now())
  updatedAt           DateTime      @updatedAt

  // Strict constraint: Only one active shift per driver
  // Enforced via Partial Unique Index (where state != 'CLOSED')
}

model Trip {
  id                  String        @id @default(uuid())
  state               TripState     @default(ASSIGNED)
  
  pickupLocation      String
  dropoffLocation     String
  passengerName       String
  notes               String?
  price               Decimal       @db.Decimal(10, 2)
  
  // Optimistic locking for concurrency
  version             Int           @default(1)

  // Relations
  driverId            String
  driver              Driver        @relation(fields: [driverId], references: [id])

  createdAt           DateTime      @default(now())
  updatedAt           DateTime      @updatedAt

  // Strict constraint: Only one active trip per driver
  // Enforced via Partial Unique Index (where state IN ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'])
}

model Inspection {
  id                  String         @id @default(uuid())
  type                InspectionType
  
  // S3 Object Keys
  photoFrontUrl       String
  photoBackUrl        String
  photoLeftUrl        String
  photoRightUrl       String

  // Relations
  shiftId             String
  shift               Shift          @relation(fields: [shiftId], references: [id])

  createdAt           DateTime       @default(now())
}

model Expense {
  id                  String        @id @default(uuid())
  amount              Decimal       @db.Decimal(10, 2)
  category            String
  receiptUrl          String?
  status              ExpenseStatus @default(PENDING)

  // Relations
  shiftId             String
  shift               Shift         @relation(fields: [shiftId], references: [id])

  createdAt           DateTime      @default(now())
  updatedAt           DateTime      @updatedAt
}

model DamageReport {
  id                  String         @id @default(uuid())
  severity            DamageSeverity
  description         String?
  photoUrls           String[]       // Array of S3 keys (1 to 10)
  resolved            Boolean        @default(false)

  // Relations
  vehicleId           String
  vehicle             Vehicle        @relation(fields: [vehicleId], references: [id])

  createdAt           DateTime       @default(now())
  updatedAt           DateTime       @updatedAt
}

model LocationPoint {
  id                  String        @id @default(uuid())
  latitude            Float
  longitude           Float
  speed               Float?
  heading             Float?
  timestamp           DateTime

  // Relations
  driverId            String
  driver              Driver        @relation(fields: [driverId], references: [id])

  createdAt           DateTime      @default(now())
}

model AuditLog {
  id                  String        @id @default(uuid())
  entityType          String        // e.g., 'Trip', 'Shift', 'Driver'
  entityId            String
  actionType          String        // e.g., 'STATE_CHANGE', 'OVERRIDE'
  actorId             String        // ID of Admin or Driver
  previousState       Json?
  newState            Json?
  reason              String?
  
  createdAt           DateTime      @default(now()) // Immutable timestamp
}
```

## Critical Domain Invariants & Constraints

1. **One Active Shift Per Driver**: A PostgreSQL partial unique index will be created: `CREATE UNIQUE INDEX idx_active_shift_driver ON "Shift"("driverId") WHERE state != 'CLOSED';`
2. **One Active Trip Per Driver**: A partial unique index: `CREATE UNIQUE INDEX idx_active_trip_driver ON "Trip"("driverId") WHERE state IN ('ASSIGNED', 'ACCEPTED', 'IN_PROGRESS');`
3. **One Active Driver Per Vehicle**: This will be tracked logically via the assigned `Shift` (where state is `ACTIVE`), preventing reassignment if the given `VehicleId` matches an ongoing shift.
4. **Optimistic Locking**: The `version` column on the `Trip` model prevents lost updates during concurrent accepts/starts (FR-021).
5. **Immutable AuditLog**: Prisma intercepts or explicit service calls will log to `AuditLog`. No `update` or `delete` methods will be exposed or permitted on the `AuditLog` entity.
