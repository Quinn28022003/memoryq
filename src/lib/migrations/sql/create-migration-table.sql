-- Create the migration tracking table
CREATE TABLE IF NOT EXISTS public._migration (
  id SERIAL PRIMARY KEY,
  filename TEXT NOT NULL UNIQUE,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public._migration ENABLE ROW LEVEL SECURITY; 