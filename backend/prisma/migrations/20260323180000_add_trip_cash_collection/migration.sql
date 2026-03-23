-- Add cash collection tracking fields to trips

ALTER TABLE trips
  ADD COLUMN cash_collected_at timestamptz NULL,
  ADD COLUMN cash_collected_by uuid NULL,
  ADD COLUMN cash_collected_note varchar(500) NULL;

CREATE INDEX IF NOT EXISTS trips_cash_collection_idx
  ON trips (driver_id, payment_method, cash_collected_at, status);
