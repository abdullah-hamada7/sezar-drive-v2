-- Allow admins to assign multiple trips to the same driver
-- as long as they are not simultaneously in progress.

DROP INDEX IF EXISTS "idx_active_trip_driver";

CREATE UNIQUE INDEX IF NOT EXISTS "idx_in_progress_trip_driver"
ON "trips" ("driver_id")
WHERE "status" = 'IN_PROGRESS';
