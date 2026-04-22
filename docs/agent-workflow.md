# MemoryQ Agent Workflow

MemoryQ is designed to sit in front of a coding agent as a two-step memory loop:

```text
user prompt -> memoryq plan -> agent work -> verification -> memoryq reflect
```

## Plan Command

The agent starts every task by passing the user prompt verbatim:

```bash
memoryq plan --prompt "<verbatim user prompt>" --format json
```

`plan` performs intent classification, creates a retrieval embedding with Groq, queries Supabase `memory_embeddings`, hydrates relevant lessons/knowledge/artifacts, creates a verification checklist, stores an `execution_runs` record, and returns a memory brief.

The initial `plan` call is only the minimum required call. Agents may call `memoryq plan` again at
any point during the task when new ambiguity, risk, or an architectural decision appears.

Important fields:

- `runId`: required for `reflect`
- `knownMistakes`: mistakes to avoid
- `architectureNotes`: reusable project knowledge
- `filesToInspect`: files the agent should inspect before editing
- `verificationPlan`: checks/tests the agent should run when applicable
- `sources`: memory records used for the brief
- `storageMode`: `supabase` means real shared memory was used; `local-fallback` means local memory was used

## Uncertainty Gate

Agents must not guess through unclear work. If the task, implementation path, target file, data
model, command, migration, or expected behavior is unclear, the required order is:

This gate applies throughout the working session, including after implementation has started.

1. Re-read the `memoryq plan` output and inspect relevant local files.
2. If still unclear, run a second focused `memoryq plan` prompt that names the ambiguity.
3. Apply the second brief's `knownMistakes`, `architectureNotes`, `filesToInspect`, and
   `verificationPlan`.
4. If MemoryQ still lacks enough reliable guidance, ask the user to confirm before taking the
   risky or ambiguous action.

This gate is mandatory for choices that could cause wrong architecture, data loss, broken
migrations, public API changes, security regressions, overwritten user work, or large refactors.
All run IDs created during uncertainty resolution should be recorded in the reflection result file.

## Reflect Command

After the task is complete, the agent **MUST** write a short result file (this is mandatory):

```bash
mkdir -p .memoryq
cat > .memoryq/last-result.md
```

The file should include:

- original prompt
- `runId`
- files changed
- implementation summary
- tests/checks run
- failures or skipped checks
- lessons that may help future agents

Then the agent runs:

```bash
memoryq reflect --run-id "<runId>" --result-file ".memoryq/last-result.md" && rm .memoryq/last-result.md
```

`reflect` asks Groq whether the result contains reusable memory. If `shouldPersist` is true, MemoryQ first checks candidate lessons and knowledge against existing `memory_embeddings` with a high-similarity semantic dedupe pass. This prevents the same issue or knowledge from being saved again just because it was worded differently.

After dedupe, MemoryQ stores only genuinely new lessons and knowledge, asks Groq to split memory into scene-based chunks, embeds each scene with Groq embeddings, and writes those chunks to Supabase `memory_embeddings` with `owner_type`, `owner_id`, `source_type`, `source_id`, and `chunk_index`.

Agents must always run `reflect`; the model decides whether memory is worth saving. Ensure `.memoryq/last-result.md` is deleted even if reflection fails.

## Seed Command

For projects that want to start with a baseline of token and context optimization rules, MemoryQ provides a `seed` command:

```bash
memoryq seed caveman --format json
```

This imports a broad, self-contained catalog of Caveman-derived token and context optimization
memory, including compression boundaries, review and commit rules, hook behavior, agent
integrations, benchmark notes, and safety constraints. It also stores the canonical raw Caveman
skill source plus heading-based source chunks for preview, highlighting, and source-chunk
embeddings. It is idempotent and can be run multiple times safely. The catalog is generated from
Caveman during MemoryQ development, but normal seeding does not require the `caveman/` source
directory to exist.

During MemoryQ development, `npm run import:caveman-memory` rebuilds that self-contained catalog
and then runs the same Caveman seed path. Use `npm run import:caveman-memory -- --no-seed` for a
catalog-only rebuild.

## Using MemoryQ In Another Project

Recommended setup is local package integration:

1. Add MemoryQ as a local dependency, workspace package, or git dependency.
2. Expose a local `memoryq` binary or npm script in the target project.
3. Configure `.env` in the target project:

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile
MEMORYQ_PROJECT_ID=my-project
MEMORYQ_OWNER_TYPE=project
MEMORYQ_OWNER_ID=my-project
MEMORYQ_EMBEDDING_BASE_URL=https://api.groq.com/openai/v1
MEMORYQ_EMBEDDING_MODEL=nomic-embed-text-v1_5
MEMORYQ_EMBEDDING_DIMENSIONS=768
MEMORYQ_EMBEDDING_INCLUDE_DIMENSIONS=false
```

4. Copy `AGENTS.md` into the target project root.
5. Run migrations once against the shared Supabase database:

```bash
npm run migrate:status
npm run migrate:up
```

6. Agents in the target project follow `AGENTS.md` for every task.

## Supabase Memory Shape

Reusable memory lives in domain tables such as `project_lessons`, `project_knowledge`, and `code_artifact_summaries`.

Embeddings live in `memory_embeddings`:

- `project_id`: target project namespace
- `owner_type`: `project`, `agent`, or `user`
- `owner_id`: owner identity within the project
- `source_type`: `lesson`, `knowledge`, `artifact`, or `source_chunk`
- `source_id`: source record ID
- `chunk_index`: scene order for that source
- `scene_label`: model-created scene title
- `content`: model-created scene content
- `embedding`: Groq `nomic-embed-text-v1_5` vector, 768 dimensions

The agent should not write to this table directly; it should use `memoryq reflect`.
