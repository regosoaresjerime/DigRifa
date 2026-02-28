ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS draw_results JSONB DEFAULT '[]'::jsonb;
