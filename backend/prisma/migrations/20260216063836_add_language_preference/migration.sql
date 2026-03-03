/*
  Warnings:

  - The `status` column on the `trips` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "DriverVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'FAILED_MATCH', 'MANUAL_REVIEW');

-- CreateEnum
CREATE TYPE "TripState" AS ENUM ('ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'OFFLINE_PENDING_SYNC');

-- AlterTable
ALTER TABLE "identity_verifications" ADD COLUMN     "id_card_back" VARCHAR(500),
ADD COLUMN     "id_card_front" VARCHAR(500);

-- AlterTable
ALTER TABLE "shifts" ADD COLUMN     "rejection_reason" VARCHAR(500),
ADD COLUMN     "start_selfie_url" VARCHAR(500),
ADD COLUMN     "verification_status" "DriverVerificationStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "trips" DROP COLUMN "status",
ADD COLUMN     "status" "TripState" NOT NULL DEFAULT 'ASSIGNED';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "id_card_back" VARCHAR(500),
ADD COLUMN     "id_card_front" VARCHAR(500),
ADD COLUMN     "language_preference" VARCHAR(5) NOT NULL DEFAULT 'en',
ADD COLUMN     "profile_photo_url" VARCHAR(500);
