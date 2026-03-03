-- Ensure users.last_location_at exists (some environments had a failed/marked migration).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_location_at" TIMESTAMPTZ(6);

-- Backfill last-known location fields from the most recent location log.
-- Safe to run multiple times: only fills missing values.
WITH latest AS (
  SELECT DISTINCT ON ("driver_id")
    "driver_id" AS user_id,
    "latitude",
    "longitude",
    "recorded_at"
  FROM "location_logs"
  ORDER BY "driver_id", "recorded_at" DESC
)
UPDATE "users" u
SET
  "last_known_lat" = COALESCE(u."last_known_lat", latest."latitude"),
  "last_known_lng" = COALESCE(u."last_known_lng", latest."longitude"),
  "last_location_at" = COALESCE(u."last_location_at", latest."recorded_at")
FROM latest
WHERE u."id" = latest.user_id
  AND (
    u."last_known_lat" IS NULL OR
    u."last_known_lng" IS NULL OR
    u."last_location_at" IS NULL
  );
