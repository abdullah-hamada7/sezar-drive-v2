-- Link expenses to trips (optional relation)
ALTER TABLE "expenses"
ADD COLUMN "trip_id" UUID;

CREATE INDEX "expenses_trip_id_idx" ON "expenses"("trip_id");

ALTER TABLE "expenses"
ADD CONSTRAINT "expenses_trip_id_fkey"
FOREIGN KEY ("trip_id") REFERENCES "trips"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
