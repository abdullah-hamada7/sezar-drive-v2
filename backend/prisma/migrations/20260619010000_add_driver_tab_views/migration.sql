-- Add driver_tab_views table.
-- Stores the last time a driver opened each tab so we can count only
-- new/actionable items created AFTER that timestamp and clear the badge
-- the moment the driver views a section.

CREATE TABLE "driver_tab_views" (
  "driver_id" UUID        NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "tab_name"  VARCHAR(20) NOT NULL,
  "viewed_at" TIMESTAMPTZ NOT NULL,
  PRIMARY KEY ("driver_id", "tab_name")
);
