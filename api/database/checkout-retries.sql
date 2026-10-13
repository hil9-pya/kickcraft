-- Additive retry protection. Existing reservations retain NULL request IDs.
ALTER TABLE reservations
 ADD COLUMN IF NOT EXISTS checkout_request_id CHAR(36) NULL,
 ADD COLUMN IF NOT EXISTS checkout_request_hash CHAR(64) NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_reservations_checkout_request ON reservations(checkout_request_id);
