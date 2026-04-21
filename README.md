# MemoryQ

MemoryQ is a TypeScript CLI that gives coding agents a structured long-term memory loop.

## Commands

- `memoryq plan --prompt "..." --format json|markdown --no-artifact`
- `memoryq reflect --run-id <id> --result "..."`
- `memoryq reflect --run-id <id> --result-file <path>`

## Environment Variables

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GROQ_API_KEY`
- `GROQ_MODEL` (optional, defaults to `llama-3.3-70b-versatile`)
- `MEMORYQ_PROJECT_ID` (optional)

## Development

```bash
npm install
npm test
npm run memoryq -- plan --prompt "fix api-gateway route"
```

## Supabase migrations

Before running migrations for the first time, open the Supabase SQL Editor and run:

```sql
-- supabase/bootstrap/0000_exec_sql.sql
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
```

Then run:

```bash
npm run migrate:status
npm run migrate:up
```
