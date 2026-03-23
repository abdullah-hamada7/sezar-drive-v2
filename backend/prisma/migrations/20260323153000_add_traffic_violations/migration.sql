-- CreateTable
CREATE TABLE "traffic_violations" (
    "id" UUID NOT NULL,
    "driver_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "violation_number" VARCHAR(50) NOT NULL,
    "date" DATE NOT NULL,
    "time" VARCHAR(10) NOT NULL,
    "location" VARCHAR(255) NOT NULL,
    "fine_amount" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "traffic_violations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "traffic_violations_driver_id_idx" ON "traffic_violations"("driver_id");
CREATE INDEX "traffic_violations_vehicle_id_idx" ON "traffic_violations"("vehicle_id");
CREATE INDEX "traffic_violations_date_idx" ON "traffic_violations"("date");

-- AddForeignKey
ALTER TABLE "traffic_violations" ADD CONSTRAINT "traffic_violations_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "traffic_violations" ADD CONSTRAINT "traffic_violations_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
