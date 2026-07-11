-- Migration: Add nick_name and goal columns to webcoach_user_profile table
-- Date: 2026-02-07
-- Description:
--   1. Add nick_name column (VARCHAR(256)) - User's nickname
--   2. Add goal column (TEXT) - User's goal

-- Add nick_name column
ALTER TABLE webcoach_user_profile
ADD COLUMN nick_name VARCHAR(256) NULL;

-- Add goal column
ALTER TABLE webcoach_user_profile
ADD COLUMN goal TEXT NULL;

-- Verify the changes
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'webcoach_user_profile'
-- ORDER BY ordinal_position;
