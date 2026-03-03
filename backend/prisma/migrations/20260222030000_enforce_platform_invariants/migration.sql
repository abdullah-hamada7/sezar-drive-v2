-- Enforce "One active shift per driver"
CREATE UNIQUE INDEX "idx_active_shift_driver" ON "shifts" ("driver_id") WHERE "status" IN ('PendingVerification', 'Active');

-- Enforce "One active trip per driver"
CREATE UNIQUE INDEX "idx_active_trip_driver" ON "trips" ("driver_id") WHERE "status" IN ('ASSIGNED', 'ACCEPTED', 'IN_PROGRESS');

-- Enforce "One active driver per vehicle"
CREATE UNIQUE INDEX "idx_active_vehicle_assignment" ON "vehicle_assignments" ("vehicle_id") WHERE "active" = true;

-- Enforce "One active vehicle per driver"
CREATE UNIQUE INDEX "idx_active_driver_assignment" ON "vehicle_assignments" ("driver_id") WHERE "active" = true;
