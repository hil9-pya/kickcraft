-- Additive migration; existing jobs continue using Meshroom.
ALTER TABLE scan_jobs
    ADD COLUMN IF NOT EXISTS engine VARCHAR(16) NOT NULL DEFAULT 'meshroom',
    ADD COLUMN IF NOT EXISTS operation VARCHAR(16) NOT NULL DEFAULT 'reconstruct',
    ADD COLUMN IF NOT EXISTS input_video JSON NULL;
