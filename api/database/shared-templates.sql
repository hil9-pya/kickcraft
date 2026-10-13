-- Additive, rerunnable; no seeds or deletes.
CREATE TABLE IF NOT EXISTS shoe_templates (
 id VARCHAR(100) PRIMARY KEY,
 creator_user_id INT NOT NULL,
 source_product_id VARCHAR(100) NOT NULL UNIQUE,
 source_scan_id CHAR(36) NOT NULL,
 name VARCHAR(160) NOT NULL,
 description TEXT NOT NULL,
 asset JSON NOT NULL,
 status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
 review_note VARCHAR(1000) NOT NULL DEFAULT '',
 reuse_allowed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 reviewer_id INT NULL,
 reviewed_at DATETIME NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 INDEX template_status (status,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
ALTER TABLE shoes ADD COLUMN IF NOT EXISTS source_template_id VARCHAR(100) NULL;
