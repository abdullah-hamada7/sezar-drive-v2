-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'ADMIN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "admin_role" "AdminRole";
