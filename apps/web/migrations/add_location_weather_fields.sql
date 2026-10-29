-- Add location and weather fields to journals table
-- Run this in your Supabase SQL Editor

ALTER TABLE journals
ADD COLUMN IF NOT EXISTS location TEXT,
ADD COLUMN IF NOT EXISTS weather TEXT;

-- Add comment to document the new fields
COMMENT ON COLUMN journals.location IS 'Location where the journal entry was written (e.g., Home, Office, Coffee Shop)';
COMMENT ON COLUMN journals.weather IS 'Weather conditions when the journal entry was written (e.g., Sunny, Rainy, Cloudy)';

-- Update the journals table to allow NULL for title and content (if not already)
-- This allows users to create entries with just media files
ALTER TABLE journals
ALTER COLUMN title DROP NOT NULL,
ALTER COLUMN content DROP NOT NULL;

-- Add index for location-based queries (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_journals_location ON journals(location) WHERE location IS NOT NULL;

-- Verify the changes
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'journals' 
AND column_name IN ('location', 'weather', 'title', 'content')
ORDER BY ordinal_position;
