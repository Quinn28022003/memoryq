# MemoryQ

MemoryQ is a TypeScript CLI that gives coding agents a structured long-term memory loop.

## Commands

- `memoryq plan --prompt "..." --format json|markdown --no-artifact`
- `memoryq reflect --run-id <id> --result "..."`
- `memoryq reflect --run-id <id> --result-file <path>`
- `memoryq seed caveman --format json|markdown`
- `npm run import:caveman-memory` to rebuild the Caveman catalog and seed it into storage

## Environment Variables

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GROQ_API_KEY`
- `GROQ_MODEL` (optional, defaults to `llama-3.3-70b-versatile`)
- `MEMORYQ_OWNER_TYPE` (optional: `project`, `agent`, or `user`; defaults to `project`)
- `MEMORYQ_OWNER_ID` (optional, defaults to `MEMORYQ_PROJECT_ID`)
- `MEMORYQ_EMBEDDING_BASE_URL` (optional, defaults to Groq's OpenAI-compatible endpoint)
- `MEMORYQ_EMBEDDING_API_KEY` (optional, defaults to `GROQ_API_KEY`)
- `MEMORYQ_EMBEDDING_MODEL` (optional, defaults to `nomic-embed-text-v1_5`)
- `MEMORYQ_EMBEDDING_DIMENSIONS` (optional, defaults to `768`; keep this aligned with the Supabase vector migration)
- `MEMORYQ_EMBEDDING_INCLUDE_DIMENSIONS` (optional, set `true` only for providers that support a `dimensions` parameter)
- `MEMORYQ_PROJECT_ID` (optional)

## Development

```bash
npm install
npm test
npm run memoryq -- plan --prompt "fix api-gateway route"
npm run import:caveman-memory
```

`npm run import:caveman-memory` rebuilds the self-contained Caveman catalog, validates coverage,
then seeds the records into MemoryQ storage through `SeedService`. Use
`npm run import:caveman-memory -- --no-seed` when you only want to regenerate
`src/default-data/caveman-memory.ts` without writing storage records.

`memoryq seed caveman` seeds the already-generated catalog directly. The catalog is generated from
the Caveman repo during MemoryQ development, but runtime seeding does not require the `caveman/`
directory to exist.

## Agent workflow

MemoryQ is intended to be used by coding agents as a required loop:

```text
user prompt -> memoryq plan -> agent work -> verification -> memoryq reflect
```

Every agent should read [AGENTS.md](./AGENTS.md) before working in this repository. The short version:

```bash
memoryq plan --prompt "<verbatim user prompt>" --format json
# do the task and run relevant checks
memoryq reflect --run-id "<runId>" --result-file ".memoryq/last-result.md"
```

During `reflect`, MemoryQ uses semantic dedupe against `memory_embeddings` before persisting. If the
same lesson or knowledge already exists with different wording, it is skipped instead of being saved
again.

For the full lifecycle and local-package setup in another project, see
[docs/agent-workflow.md](./docs/agent-workflow.md).

## Using MemoryQ in another project

Recommended integration is a local package or workspace dependency:

1. Add MemoryQ to the target project as a local package, workspace package, or git dependency.
2. Expose the `memoryq` binary or an npm script in the target project.
3. Configure Supabase and Groq env vars in the target project's `.env`.
4. Copy `AGENTS.md` into the target project root so agents automatically follow the MemoryQ loop.
5. Run `memoryq plan` before implementation and `memoryq reflect` after every task.

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
