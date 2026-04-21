# MemoryQ Agent Workflow

This repository uses MemoryQ as the long-term memory loop for coding agents. For every user task, run the MemoryQ loop exactly as described here.

## 1. Plan First

Before editing files or running implementation commands, pass the user's original prompt to MemoryQ:

```bash
memoryq plan --prompt "<verbatim user prompt>" --format json
```

If the local binary is not linked, use the project script while working inside this repository:

```bash
npm run memoryq -- plan --prompt "<verbatim user prompt>" --format json
```

Keep the returned `runId`; it is required for reflection.

## 2. Use The Memory Brief

Read the plan output before making changes:

- Treat `knownMistakes` as warnings to avoid.
- Treat `architectureNotes` as project memory and design constraints.
- Inspect `filesToInspect` before editing when any files are listed.
- Use `verificationPlan` as the checklist for checks/tests to run when applicable.
- Prefer `storageMode: "supabase"` for real project memory. If `storageMode` is `local-fallback`, continue only when local fallback is acceptable and mention it in the final response.

## 3. Execute And Verify

Implement the task using the project conventions. Run the applicable checks from `verificationPlan`. If a listed check is impossible or irrelevant, record why it was skipped.

## 4. Reflect Always

Before the final response, you **MUST** create `.memoryq/last-result.md`. This step is mandatory and cannot be skipped. Include:

- original prompt
- `runId`
- files changed
- implementation summary
- tests/checks run
- failures or skipped checks
- lessons that may help future agents avoid mistakes

Then run:

```bash
memoryq reflect --run-id "<runId>" --result-file ".memoryq/last-result.md" && rm .memoryq/last-result.md
```

Inside this repository, if the local binary is not linked:

```bash
npm run memoryq -- reflect --run-id "<runId>" --result-file ".memoryq/last-result.md" && rm .memoryq/last-result.md
```

Do not manually decide whether a result is worth saving. Always call `reflect`; MemoryQ decides through `shouldPersist`.

If reflection fails, do not hide the task result. Mention the reflection failure in the final response and include the checks that were run. Ensure the result file is deleted even if reflection fails.
