-- Add optional photo URL to traffic violations
ALTER TABLE "traffic_violations" ADD COLUMN "photo_url" VARCHAR(500);
