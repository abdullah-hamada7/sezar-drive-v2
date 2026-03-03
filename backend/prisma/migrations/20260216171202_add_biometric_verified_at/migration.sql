/*
  Warnings:

  - You are about to drop the column `last_location_at` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "users" DROP COLUMN "last_location_at",
ADD COLUMN     "last_biometric_verified_at" TIMESTAMPTZ(6);

-- CreateIndex
CREATE INDEX "damage_reports_vehicle_id_idx" ON "damage_reports"("vehicle_id");

-- CreateIndex
CREATE INDEX "damage_reports_driver_id_idx" ON "damage_reports"("driver_id");

-- CreateIndex
CREATE INDEX "damage_reports_shift_id_idx" ON "damage_reports"("shift_id");

-- CreateIndex
CREATE INDEX "expenses_shift_id_idx" ON "expenses"("shift_id");

-- CreateIndex
CREATE INDEX "expenses_driver_id_idx" ON "expenses"("driver_id");

-- CreateIndex
CREATE INDEX "expenses_category_id_idx" ON "expenses"("category_id");

-- CreateIndex
CREATE INDEX "expenses_status_idx" ON "expenses"("status");

-- CreateIndex
CREATE INDEX "identity_verifications_driver_id_idx" ON "identity_verifications"("driver_id");

-- CreateIndex
CREATE INDEX "identity_verifications_status_idx" ON "identity_verifications"("status");

-- CreateIndex
CREATE INDEX "inspections_shift_id_idx" ON "inspections"("shift_id");

-- CreateIndex
CREATE INDEX "inspections_vehicle_id_idx" ON "inspections"("vehicle_id");

-- CreateIndex
CREATE INDEX "inspections_driver_id_idx" ON "inspections"("driver_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "shifts_driver_id_idx" ON "shifts"("driver_id");

-- CreateIndex
CREATE INDEX "shifts_status_idx" ON "shifts"("status");

-- CreateIndex
CREATE INDEX "shifts_created_at_idx" ON "shifts"("created_at");

-- CreateIndex
CREATE INDEX "trips_driver_id_idx" ON "trips"("driver_id");

-- CreateIndex
CREATE INDEX "trips_shift_id_idx" ON "trips"("shift_id");

-- CreateIndex
CREATE INDEX "trips_vehicle_id_idx" ON "trips"("vehicle_id");

-- CreateIndex
CREATE INDEX "trips_status_idx" ON "trips"("status");

-- CreateIndex
CREATE INDEX "trips_actual_end_time_idx" ON "trips"("actual_end_time");

-- CreateIndex
CREATE INDEX "vehicle_assignments_vehicle_id_idx" ON "vehicle_assignments"("vehicle_id");

-- CreateIndex
CREATE INDEX "vehicle_assignments_driver_id_idx" ON "vehicle_assignments"("driver_id");

-- CreateIndex
CREATE INDEX "vehicle_assignments_shift_id_idx" ON "vehicle_assignments"("shift_id");
