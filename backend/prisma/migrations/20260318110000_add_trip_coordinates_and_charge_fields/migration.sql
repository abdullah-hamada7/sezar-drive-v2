ALTER TABLE "trips"
ADD COLUMN "pickup_lat" DECIMAL(10, 7),
ADD COLUMN "pickup_lng" DECIMAL(10, 7),
ADD COLUMN "dropoff_lat" DECIMAL(10, 7),
ADD COLUMN "dropoff_lng" DECIMAL(10, 7),
ADD COLUMN "admin_charge" DECIMAL(10, 2) NOT NULL DEFAULT 0,
ADD COLUMN "driver_net_price" DECIMAL(10, 2) NOT NULL DEFAULT 0;

UPDATE "trips"
SET "driver_net_price" = GREATEST("price" - "admin_charge", 0)
WHERE "driver_net_price" = 0;
