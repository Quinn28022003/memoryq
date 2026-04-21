-- Run this once in the Supabase SQL Editor before using `npm run migrate:*`.
-- PostgREST cannot create arbitrary SQL functions unless this RPC already exists,
-- so the first bootstrap step is intentionally manual.

CREATE OR REPLACE FUNCTION public.exec_sql(sql TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql;
END;
$$;

GRANT EXECUTE ON FUNCTION public.exec_sql(TEXT) TO service_role;
