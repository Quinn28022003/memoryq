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

## Quality checks

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
```

Use `npm run lint:fix` and `npm run format` before larger commits. Husky runs `lint-staged`
on pre-commit, and GitHub Actions runs the full validation pipeline on pushes and pull requests
to `main`.

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
