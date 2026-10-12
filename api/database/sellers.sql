-- Additive seller migration. Run after setup.sql and photo-scanning.sql; no seeds or deletes.
ALTER TABLE users MODIFY role ENUM('customer','owner','seller') NOT NULL DEFAULT 'customer';
CREATE TABLE IF NOT EXISTS seller_profiles (
 user_id INT PRIMARY KEY,
 store_name VARCHAR(160) NOT NULL,
 description TEXT NOT NULL,
 pickup_address VARCHAR(500) NOT NULL,
 contact VARCHAR(160) NOT NULL DEFAULT '',
 status ENUM('pending','approved','rejected','suspended') NOT NULL DEFAULT 'pending',
 review_note VARCHAR(1000) NOT NULL DEFAULT '',
 reviewer_id INT NULL,
 reviewed_at DATETIME NULL,
 tutorial_step INT NOT NULL DEFAULT 0,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY(user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
ALTER TABLE shoes ADD COLUMN IF NOT EXISTS seller_user_id INT NULL,
 ADD COLUMN IF NOT EXISTS publication_state ENUM('draft','pending','approved','rejected') NOT NULL DEFAULT 'approved',
 ADD COLUMN IF NOT EXISTS review_note VARCHAR(1000) NOT NULL DEFAULT '',
 ADD COLUMN IF NOT EXISTS reviewer_id INT NULL,
 ADD COLUMN IF NOT EXISTS reviewed_at DATETIME NULL,
 ADD COLUMN IF NOT EXISTS source_scan_id CHAR(36) NULL,
 ADD COLUMN IF NOT EXISTS sizes JSON NULL;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS seller_user_id INT NULL,
 ADD COLUMN IF NOT EXISTS pickup_store VARCHAR(160) NOT NULL DEFAULT 'KickCraft Flagship Studio',
 ADD COLUMN IF NOT EXISTS pickup_address VARCHAR(500) NOT NULL DEFAULT 'KickCraft Flagship Studio — contact pickup desk for directions';
CREATE INDEX IF NOT EXISTS idx_shoes_seller ON shoes(seller_user_id,publication_state);
CREATE INDEX IF NOT EXISTS idx_reservations_seller ON reservations(seller_user_id,created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_shoes_source_scan ON shoes(source_scan_id);
