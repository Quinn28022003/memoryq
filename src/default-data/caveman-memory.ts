import type { KnowledgeType, LessonSeverity, TaskType } from "../types.js";
import type { KnowledgeUpsert, LessonInsert } from "../storage/types.js";

interface BaseCavemanMemoryRecord {
    key: string;
    text: string;
    scope: string[];
    taskType: TaskType;
    confidence: number;
    parentKey?: string;
    conceptKey?: string;
}

export interface CavemanLessonMemoryRecord extends BaseCavemanMemoryRecord {
    kind: "lesson";
    severity: LessonSeverity;
}

export interface CavemanKnowledgeMemoryRecord extends BaseCavemanMemoryRecord {
    kind: "knowledge";
    noteType: KnowledgeType;
}

export type CavemanMemoryRecord = CavemanLessonMemoryRecord | CavemanKnowledgeMemoryRecord;

export const CAVEMAN_MEMORY_MIN_RECORDS = 35;

export const CAVEMAN_MEMORY_RECORDS: CavemanMemoryRecord[] = [
    {
        key: "caveman.agent.always-on-snippets",
        kind: "knowledge",
        text: "For agents without built-in hooks, Caveman can be made always-on by adding the relevant rule or instruction snippet to that agent's rules or system prompt.",
        scope: ["token-management", "context-management", "caveman", "agent-integration"],
        taskType: "general",
        noteType: "convention",
        confidence: 0.85,
        parentKey: "caveman.agent-integration"
    },
    {
        key: "caveman.agent.cross-platform-support",
        kind: "knowledge",
        text: "Caveman provides instructions or skill files for Claude Code, Codex, Gemini CLI, Cursor, Windsurf, Cline, Copilot, and generic skill-compatible agents.",
        scope: ["token-management", "context-management", "caveman", "agent-integration"],
        taskType: "general",
        noteType: "architecture",
        confidence: 0.9,
        parentKey: "caveman.agent-integration"
    },
    {
        key: "caveman.benchmarks.prompts",
        kind: "knowledge",
        text: "Caveman benchmark prompts exercise explanation, debugging, review, and implementation tasks so token savings are measured across realistic agent responses.",
        scope: ["token-management", "context-management", "caveman", "evals", "benchmark"],
        taskType: "general",
        noteType: "architecture",
        confidence: 0.82,
        parentKey: "caveman.benchmark"
    },
    {
        key: "caveman.benchmarks.real-api-results",
        kind: "lesson",
        text: "Caveman benchmarks should use real Claude API calls and commit raw JSON results instead of hand-written or estimated token savings.",
        scope: ["token-management", "context-management", "caveman", "benchmark", "repo"],
        taskType: "general",
        severity: "high",
        confidence: 0.95,
        parentKey: "caveman.benchmark"
    },
    {
        key: "caveman.benchmarks.update-readme-markers",
        kind: "knowledge",
        text: "Caveman benchmark README updates replace only the table between benchmark markers, preserving the rest of the product README.",
        scope: ["token-management", "context-management", "caveman", "benchmark", "docs"],
        taskType: "general",
        noteType: "architecture",
        confidence: 0.85,
        parentKey: "caveman.benchmark"
    },
    {
        key: "caveman.codex.hooks-setup",
        kind: "knowledge",
        text: "Caveman Codex setup enables hooks through .codex/config.toml, wires SessionStart via hooks.json, and ships a repo-local plugin for auto-activation.",
        scope: ["token-management", "context-management", "caveman", "codex", "agent-integration"],
        taskType: "general",
        noteType: "architecture",
        confidence: 0.85,
        parentKey: "caveman.agent-integration",
        conceptKey: "codex"
    },
    {
        key: "caveman.commands.commit",
        kind: "knowledge",
        text: "The Caveman commit command generates a terse Conventional Commit for staged changes with why-over-what and body only when the subject is not enough.",
        scope: ["token-management", "context-management", "caveman", "commands", "git"],
        taskType: "general",
        noteType: "convention",
        confidence: 0.95,
        parentKey: "caveman.commands"
    },
    {
        key: "caveman.commands.mode-switch",
        kind: "knowledge",
        text: "The Caveman command switches intensity level with lite, full, ultra, or wenyan arguments; no argument defaults to full mode.",
        scope: ["token-management", "context-management", "caveman", "commands"],
        taskType: "general",
        noteType: "convention",
        confidence: 0.95,
        parentKey: "caveman.commands"
    },
    {
        key: "caveman.commands.review",
        kind: "knowledge",
        text: "The Caveman review command asks for current code changes, one-line findings, bug/risk/nit/question severity, no praise, and LGTM only when no issues are found.",
        scope: ["token-management", "context-management", "caveman", "commands", "code-review"],
        taskType: "general",
        noteType: "convention",
        confidence: 0.95,
        parentKey: "caveman.commands"
    },
    {
        key: "caveman.commit.standard",
        kind: "lesson",
        text: "Generate Caveman commit subjects in Conventional Commits format (<= 50 chars), imperative mood, no period. Only add body for non-obvious why, breaking changes, or security fixes.",
        scope: ["token-management", "context-management", "caveman", "git", "commit"],
        taskType: "general",
        severity: "medium",
        confidence: 1,
        parentKey: "caveman.git.commit"
    },
    {
        key: "caveman.commit.no-filler",
        kind: "lesson",
        text: "Do not add AI attribution, filler phrases, or restated filenames to Caveman commit messages.",
        scope: ["token-management", "context-management", "caveman", "git", "commit"],
        taskType: "general",
        severity: "medium",
        confidence: 1,
        parentKey: "caveman.git.commit"
    },
    {
        key: "caveman.compress.backup-original",
        kind: "lesson",
        text: "Before overwriting a compressed memory file, write the readable original to FILE.original.md; abort if backup already exists to avoid overwriting a human-authored version.",
        scope: ["token-management", "context-management", "caveman", "compression", "safety"],
        taskType: "general",
        severity: "high",
        confidence: 1,
        parentKey: "caveman.compress.safety"
    },
    {
        key: "caveman.compress.benchmark-stats",
        kind: "knowledge",
        text: "Caveman compression benchmarks report ~46% token savings using tiktoken o200k_base or word-count fallbacks while preserving markdown structure.",
        scope: ["token-management", "context-management", "caveman", "compression", "benchmark"],
        taskType: "general",
        noteType: "architecture",
        confidence: 0.9,
        parentKey: "caveman.benchmark"
    },
    {
        key: "caveman.compress.cli.skip-logic",
        kind: "lesson",
        text: "Caveman compress CLI exits with error for missing files and skips non-natural-language or large files (> 500 KB) without modification.",
        scope: [
            "token-management",
            "context-management",
            "caveman",
            "compression",
            "cli",
            "verification"
        ],
        taskType: "general",
        severity: "medium",
        confidence: 0.9,
        parentKey: "caveman.compress.safety"
    },
    {
        key: "caveman.compress.detection",
        kind: "knowledge",
        text: "Detect natural-language files by extension and heuristics; skip code and config formats (.py, .js, .json, .yaml, .toml, .env, .lock, .sql, .sh, .html, .xml).",
        scope: ["token-management", "context-management", "caveman", "compression", "detection"],
        taskType: "general",
        noteType: "architecture",
        confidence: 0.95,
        parentKey: "caveman.compress.safety"
    },
    {
        key: "caveman.compress.model-flow",
        kind: "knowledge",
        text: "Compression uses Anthropic API or Claude CLI fallback. Requires Python 3.10+. Model-provided outer markdown fences are stripped during finalization.",
        scope: ["token-management", "context-management", "caveman", "compression", "cli"],
        taskType: "general",
        noteType: "architecture",
        confidence: 0.9,
        parentKey: "caveman.compress.implementation"
    },
    {
        key: "caveman.compress.preservation.markdown",
        kind: "lesson",
        text: "Keep markdown headings, bullet nesting, list numbering, tables, and frontmatter stable while compressing body prose.",
        scope: ["token-management", "context-management", "caveman", "compression", "markdown"],
        taskType: "general",
        severity: "medium",
        confidence: 1,
        parentKey: "caveman.compress.preservation"
    },
    {
        key: "caveman.compress.preservation.code",
        kind: "lesson",
        text: "Copy fenced and indented code blocks and inline backtick content exactly; do not modify comments, spacing, or identifiers inside code regions.",
        scope: ["token-management", "context-management", "caveman", "compression", "markdown"],
        taskType: "general",
        severity: "high",
        confidence: 1,
        parentKey: "caveman.compress.preservation"
    },
    {
        key: "caveman.compress.preservation.entities",
        kind: "lesson",
        text: "Preserve URLs, markdown links, file paths, commands, environment variables, dates, and numeric values exactly during compression.",
        scope: ["token-management", "context-management", "caveman", "compression", "markdown"],
        taskType: "general",
        severity: "high",
        confidence: 1,
        parentKey: "caveman.compress.preservation"
    },
    {
        key: "caveman.compress.security.sensitive-paths",
        kind: "lesson",
        text: "Refuse to compress sensitive paths (credentials, secrets, .ssh, .aws, etc.) or send them to third-party model boundaries.",
        scope: ["token-management", "context-management", "caveman", "compression", "security"],
        taskType: "general",
        severity: "high",
        confidence: 1,
        parentKey: "caveman.compress.safety"
    },
    {
        key: "caveman.compress.style",
        kind: "knowledge",
        text: "Compression removes filler, hedging, and connective fluff ('in order to', etc.) in favor of short synonyms and direct imperative fragments.",
        scope: ["token-management", "context-management", "caveman", "compression"],
        taskType: "general",
        noteType: "convention",
        confidence: 1,
        parentKey: "caveman.compress.implementation"
    },
    {
        key: "caveman.compress.validation.recovery",
        kind: "lesson",
        text: "If validation fails, ask model to fix targeted errors instead of full recompression (max 2 retries). If still failing, restore original file.",
        scope: ["token-management", "context-management", "caveman", "compression", "validation"],
        taskType: "general",
        severity: "high",
        confidence: 1,
        parentKey: "caveman.compress.validation"
    },
    {
        key: "caveman.compress.validation.rules",
        kind: "knowledge",
        text: "Validation checks heading count/order, detects file path changes, and treats lost URLs or code block mismatches as fatal errors.",
        scope: ["token-management", "context-management", "caveman", "compression", "validation"],
        taskType: "general",
        noteType: "architecture",
        confidence: 0.95,
        parentKey: "caveman.compress.validation"
    },
    {
        key: "caveman.agent.integration-configs",
        kind: "knowledge",
        text: "Copilot uses custom instructions. Cursor and Windsurf use skill/rule files. Gemini installs as extension with /caveman commands.",
        scope: ["token-management", "context-management", "caveman", "agent-integration"],
        taskType: "general",
        noteType: "architecture",
        confidence: 0.85,
        parentKey: "caveman.agent-integration"
    },
    {
        key: "caveman.evals.methodology",
        kind: "lesson",
        text: "Measure Caveman skill value against terse control arm, not baseline. Use committed snapshots for offline CI measurement.",
        scope: ["token-management", "context-management", "caveman", "evals", "benchmark"],
        taskType: "general",
        severity: "high",
        confidence: 1,
        parentKey: "caveman.evals"
    },
    {
        key: "caveman.evals.technical-details",
        kind: "knowledge",
        text: "Evals auto-discover SKILL.md directories and use tiktoken o200k_base to approximate tokenization ratios across realism-focused prompts.",
        scope: ["token-management", "context-management", "caveman", "evals", "benchmark"],
        taskType: "general",
        noteType: "architecture",
        confidence: 0.82,
        parentKey: "caveman.evals"
    },
    {
        key: "caveman.help.behavior",
        kind: "knowledge",
        text: "Help summarizes modes and configuration (CAVEMAN_DEFAULT_MODE) as a one-shot response without changing active state.",
        scope: ["token-management", "context-management", "caveman", "help", "commands"],
        taskType: "general",
        noteType: "convention",
        confidence: 0.95,
        parentKey: "caveman.help"
    },
    {
        key: "caveman.hooks.config-resolution",
        kind: "knowledge",
        text: "Hooks respect CLAUDE_CONFIG_DIR, pin CommonJS for compatibility, and resolve mode via env, config file, then full mode fallback.",
        scope: ["token-management", "context-management", "caveman", "hooks", "config"],
        taskType: "general",
        noteType: "architecture",
        confidence: 0.95,
        parentKey: "caveman.hooks.implementation"
    },
    {
        key: "caveman.hooks.logic-flow",
        kind: "knowledge",
        text: "SessionStart hooks write flags and rule context. UserPromptSubmit detects activation/deactivation. Statusline scripts show active badges.",
        scope: ["token-management", "context-management", "caveman", "hooks", "agent-integration"],
        taskType: "general",
        noteType: "architecture",
        confidence: 0.95,
        parentKey: "caveman.hooks.implementation"
    },
    {
        key: "caveman.hooks.safety",
        kind: "lesson",
        text: "Hooks must silent-fail on errors. Read/write flag files with symlink refusal (O_NOFOLLOW), size caps, and 0600 permissions to prevent blocking or injection.",
        scope: ["token-management", "context-management", "caveman", "hooks", "security"],
        taskType: "general",
        severity: "high",
        confidence: 1,
        parentKey: "caveman.hooks.security"
    },
    {
        key: "caveman.hooks.reinforcement",
        kind: "lesson",
        text: "Emit compact per-turn reinforcement while Caveman is active to prevent session context from erasing terse behavior.",
        scope: ["token-management", "context-management", "caveman", "hooks", "agent-integration"],
        taskType: "general",
        severity: "medium",
        confidence: 0.95,
        parentKey: "caveman.hooks.implementation"
    },
    {
        key: "caveman.install.behavior",
        kind: "lesson",
        text: "Install must be idempotent, preserve existing statusline config, and avoid newer PowerShell flags. Uninstall must restore non-Caveman settings.",
        scope: ["token-management", "context-management", "caveman", "hooks", "install"],
        taskType: "general",
        severity: "high",
        confidence: 1,
        parentKey: "caveman.hooks.implementation",
        conceptKey: "install"
    },
    {
        key: "caveman.mode.clarity",
        kind: "lesson",
        text: "Drop terse style for security, irreversible actions, or ambiguous steps. Use normal style for code, commits, and PRs when fragments risk clarity.",
        scope: ["token-management", "context-management", "caveman", "safety"],
        taskType: "general",
        severity: "high",
        confidence: 1,
        parentKey: "caveman.mode"
    },
    {
        key: "caveman.mode.persistence",
        kind: "lesson",
        text: "Keep Caveman active until explicit 'stop' or 'normal mode'. Preserve technical terms and commands exactly while dropping filler/hedging.",
        scope: ["token-management", "context-management", "caveman", "agent-style"],
        taskType: "general",
        severity: "medium",
        confidence: 1,
        parentKey: "caveman.mode"
    },
    {
        key: "caveman.mode.intensities",
        kind: "knowledge",
        text: "Lite (no filler), Full (fragments OK), Ultra (abbreviations/arrows), and Wenyan (classical Chinese) provide granular token savings.",
        scope: ["token-management", "context-management", "caveman", "intensity"],
        taskType: "general",
        noteType: "convention",
        confidence: 1,
        parentKey: "caveman.mode"
    },
    {
        key: "caveman.repo.maintenance",
        kind: "lesson",
        text: "Edit canonical sources (SKILL.md, rules/) and use real metrics. Sync automation generates agent-specific copies; do not edit them directly.",
        scope: ["token-management", "context-management", "caveman", "repo", "sync"],
        taskType: "general",
        severity: "high",
        confidence: 1,
        parentKey: "caveman.repo"
    },
    {
        key: "caveman.review.behavior",
        kind: "lesson",
        text: "Use one-line findings with bug/risk/nit prefixes. Skip praise and throat-clearing. Use normal paragraphs only for critical security or architecture issues.",
        scope: ["token-management", "context-management", "caveman", "code-review"],
        taskType: "general",
        severity: "medium",
        confidence: 1,
        parentKey: "caveman.commands",
        conceptKey: "review"
    },
    {
        key: "caveman.sync.automation",
        kind: "knowledge",
        text: "Sync workflow runs on main, rebuilds caveman.skill zip, and pushes generated copies to distribution surfaces with skip-ci.",
        scope: ["token-management", "context-management", "caveman", "sync", "ci"],
        taskType: "general",
        noteType: "architecture",
        confidence: 0.95,
        parentKey: "caveman.repo",
        conceptKey: "sync"
    },
    {
        key: "caveman.verify.scope",
        kind: "knowledge",
        text: "Verification covers compression CLI, hook flow (install/activation/cleanup), JSON manifest syntax, and synced file parity.",
        scope: ["token-management", "context-management", "caveman", "verification"],
        taskType: "general",
        noteType: "architecture",
        confidence: 0.95,
        parentKey: "caveman.repo",
        conceptKey: "verification"
    }
];

export const CAVEMAN_LESSONS: Omit<LessonInsert, "projectId" | "sourceRunId">[] =
    CAVEMAN_MEMORY_RECORDS.flatMap((record) =>
        record.kind === "lesson"
            ? [
                  {
                      lessonKey: record.key,
                      lessonText: record.text,
                      scope: record.scope,
                      taskType: record.taskType,
                      severity: record.severity,
                      confidence: record.confidence
                  }
              ]
            : []
    );

export const CAVEMAN_KNOWLEDGE: Omit<KnowledgeUpsert, "projectId">[] =
    CAVEMAN_MEMORY_RECORDS.flatMap((record) =>
        record.kind === "knowledge"
            ? [
                  {
                      noteType: record.noteType,
                      noteText: record.text,
                      scope: record.scope,
                      confidence: record.confidence
                  }
              ]
            : []
    );
