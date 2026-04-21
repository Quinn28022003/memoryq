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

Important fields:

- `runId`: required for `reflect`
- `knownMistakes`: mistakes to avoid
- `architectureNotes`: reusable project knowledge
- `filesToInspect`: files the agent should inspect before editing
- `verificationPlan`: checks/tests the agent should run when applicable
- `sources`: memory records used for the brief
- `storageMode`: `supabase` means real shared memory was used; `local-fallback` means local memory was used

## Reflect Command

After the task is complete, the agent writes a short result file:

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
memoryq reflect --run-id "<runId>" --result-file ".memoryq/last-result.md"
```

`reflect` asks Groq whether the result contains reusable memory. If `shouldPersist` is true, MemoryQ stores lessons and knowledge, asks Groq to split memory into scene-based chunks, embeds each scene with Groq embeddings, and writes those chunks to Supabase `memory_embeddings` with `owner_type`, `owner_id`, `source_type`, `source_id`, and `chunk_index`.

Agents must always run `reflect`; the model decides whether memory is worth saving.

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
- `source_type`: `lesson`, `knowledge`, or `artifact`
- `source_id`: source record ID
- `chunk_index`: scene order for that source
- `scene_label`: model-created scene title
- `content`: model-created scene content
- `embedding`: Groq `nomic-embed-text-v1_5` vector, 768 dimensions

The agent should not write to this table directly; it should use `memoryq reflect`.
