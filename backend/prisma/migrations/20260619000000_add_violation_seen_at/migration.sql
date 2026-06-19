-- Add seen_at column to traffic_violations
-- NULL means the driver has not yet opened/seen this violation (shows badge)
-- Non-null means the driver has viewed it (badge clears)

ALTER TABLE "traffic_violations"
  ADD COLUMN "seen_at" TIMESTAMPTZ(6);

CREATE INDEX "traffic_violations_driver_id_seen_at_idx"
  ON "traffic_violations" ("driver_id", "seen_at");
