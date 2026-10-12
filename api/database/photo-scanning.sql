CREATE TABLE IF NOT EXISTS scan_jobs (
 id CHAR(36) PRIMARY KEY,
 owner_id INT NOT NULL,
 state ENUM('uploading','queued','processing','ready','failed','finalized') NOT NULL DEFAULT 'uploading',
 stage VARCHAR(255) NOT NULL DEFAULT 'Add photographs',
 images JSON NOT NULL,
 output_glb VARCHAR(100) NULL,
 error_message VARCHAR(500) NULL,
 finalized_path VARCHAR(500) NULL,
 finalized_payload JSON NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 started_at DATETIME NULL,
 heartbeat_at DATETIME NULL,
 completed_at DATETIME NULL,
 INDEX scan_owner_state (owner_id, state),
 INDEX scan_queue (state, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
