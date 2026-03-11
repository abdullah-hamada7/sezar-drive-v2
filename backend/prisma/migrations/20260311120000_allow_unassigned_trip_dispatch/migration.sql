-- Allow admin to dispatch trips before shift/vehicle assignment.
-- Trip gets linked to shift/vehicle when driver starts it.

ALTER TABLE "trips"
  ALTER COLUMN "shift_id" DROP NOT NULL,
  ALTER COLUMN "vehicle_id" DROP NOT NULL;
