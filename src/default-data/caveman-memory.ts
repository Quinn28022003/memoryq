import type { KnowledgeType, LessonSeverity, TaskType } from "../types.js";
import type { KnowledgeUpsert, LessonInsert } from "../storage/types.js";

interface BaseCavemanMemoryRecord {
    key: string;
    text: string;
    scope: string[];
    taskType: TaskType;
    confidence: number;
    sourcePath: string;
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

export const CAVEMAN_MEMORY_MIN_RECORDS = 80;

export const CAVEMAN_MEMORY_RECORDS: CavemanMemoryRecord[] = [
    {
        key: "caveman.agent.always-on-snippets",
        kind: "knowledge",
        text: "For agents without built-in hooks, Caveman can be made always-on by adding the relevant rule or instruction snippet to that agent's rules or system prompt.",
        scope: ["token-management", "context-management", "caveman", "agent-integration"],
        taskType: "general",
        noteType: "convention",
        confidence: 0.85,
        sourcePath: "caveman://README.md"
    },
    {
        key: "caveman.agent.cross-platform-support",
        kind: "knowledge",
        text: "Caveman provides instructions or skill files for Claude Code, Codex, Gemini CLI, Cursor, Windsurf, Cline, Copilot, and generic skill-compatible agents.",
        scope: ["token-management", "context-management", "caveman", "agent-integration"],
        taskType: "general",
        noteType: "architecture",
        confidence: 0.9,
        sourcePath: "caveman://README.md"
    },
    {
        key: "caveman.benchmarks.prompts",
        kind: "knowledge",
        text: "Caveman benchmark prompts exercise explanation, debugging, review, and implementation tasks so token savings are measured across realistic agent responses.",
        scope: ["token-management", "context-management", "caveman", "evals", "benchmark"],
        taskType: "general",
        noteType: "architecture",
        confidence: 0.82,
        sourcePath: "caveman://benchmarks/prompts.json"
    },
    {
        key: "caveman.benchmarks.real-api-results",
        kind: "lesson",
        text: "Caveman benchmarks should use real Claude API calls and commit raw JSON results instead of hand-written or estimated token savings.",
        scope: ["token-management", "context-management", "caveman", "benchmark", "repo"],
        taskType: "general",
        severity: "high",
        confidence: 0.95,
        sourcePath: "caveman://benchmarks/run.py"
    },
    {
        key: "caveman.benchmarks.update-readme-markers",
        kind: "knowledge",
        text: "Caveman benchmark README updates replace only the table between benchmark markers, preserving the rest of the product README.",
        scope: ["token-management", "context-management", "caveman", "benchmark", "docs"],
        taskType: "general",
        noteType: "architecture",
        confidence: 0.85,
        sourcePath: "caveman://benchmarks/run.py"
    },
    {
        key: "caveman.codex.hooks-config",
        kind: "knowledge",
        text: "Caveman Codex setup enables hooks through .codex/config.toml and wires SessionStart behavior through .codex/hooks.json.",
        scope: ["token-management", "context-management", "caveman", "codex", "agent-integration"],
        taskType: "general",
        noteType: "architecture",
        confidence: 0.85,
        sourcePath: "caveman://.codex/config.toml"
    },
    {
        key: "caveman.codex.plugin-install",
        kind: "knowledge",
        text: "The Codex Caveman plugin ships skills and a repo-local hook configuration so running Codex inside the Caveman repo can auto-activate Caveman mode.",
        scope: ["token-management", "context-management", "caveman", "codex", "agent-integration"],
        taskType: "general",
        noteType: "architecture",
        confidence: 0.85,
        sourcePath: "caveman://plugins/caveman/.codex-plugin/plugin.json"
    },
    {
        key: "caveman.commands.commit",
        kind: "knowledge",
        text: "The Caveman commit command generates a terse Conventional Commit for staged changes with why-over-what and body only when the subject is not enough.",
        scope: ["token-management", "context-management", "caveman", "commands", "git"],
        taskType: "general",
        noteType: "convention",
        confidence: 0.95,
        sourcePath: "caveman://commands/caveman-commit.toml"
    },
    {
        key: "caveman.commands.mode-switch",
        kind: "knowledge",
        text: "The Caveman command switches intensity level with lite, full, ultra, or wenyan arguments; no argument defaults to full mode.",
        scope: ["token-management", "context-management", "caveman", "commands"],
        taskType: "general",
        noteType: "convention",
        confidence: 0.95,
        sourcePath: "caveman://commands/caveman.toml"
    },
    {
        key: "caveman.commands.review",
        kind: "knowledge",
        text: "The Caveman review command asks for current code changes, one-line findings, bug/risk/nit/question severity, no praise, and LGTM only when no issues are found.",
        scope: ["token-management", "context-management", "caveman", "commands", "code-review"],
        taskType: "general",
        noteType: "convention",
        confidence: 0.95,
        sourcePath: "caveman://commands/caveman-review.toml"
    },
    {
        key: "caveman.commit.body-only-when-needed",
        kind: "lesson",
        text: "Only include a Caveman commit body for non-obvious why, breaking changes, migrations, security fixes, reverts, or linked issues.",
        scope: ["token-management", "context-management", "caveman", "git", "commit"],
        taskType: "general",
        severity: "medium",
        confidence: 1,
        sourcePath: "caveman://skills/caveman-commit/SKILL.md"
    },
    {
        key: "caveman.commit.conventional-subject",
        kind: "lesson",
        text: "Generate Caveman commit subjects in Conventional Commits format, imperative mood, no trailing period, and preferably <= 50 characters with 72 as hard cap.",
        scope: ["token-management", "context-management", "caveman", "git", "commit"],
        taskType: "general",
        severity: "medium",
        confidence: 1,
        sourcePath: "caveman://skills/caveman-commit/SKILL.md"
    },
    {
        key: "caveman.commit.no-ai-attribution",
        kind: "lesson",
        text: "Do not add AI attribution, filler phrases, or restated filenames to Caveman commit messages unless the project convention requires it.",
        scope: ["token-management", "context-management", "caveman", "git", "commit"],
        taskType: "general",
        severity: "medium",
        confidence: 1,
        sourcePath: "caveman://skills/caveman-commit/SKILL.md"
    },
    {
        key: "caveman.compress.backup-exists-abort",
        kind: "lesson",
        text: "Abort Caveman compression when the .original.md backup already exists to avoid overwriting a potentially important readable original.",
        scope: ["token-management", "context-management", "caveman", "compression", "safety"],
        taskType: "general",
        severity: "high",
        confidence: 0.95,
        sourcePath: "caveman://caveman-compress/scripts/compress.py"
    },
    {
        key: "caveman.compress.backup-original",
        kind: "lesson",
        text: "Before overwriting a compressed memory file, write the readable original to FILE.original.md and never compress existing .original.md backups.",
        scope: ["token-management", "context-management", "caveman", "compression"],
        taskType: "general",
        severity: "high",
        confidence: 1,
        sourcePath: "caveman://skills/compress/SKILL.md"
    },
    {
        key: "caveman.compress.benchmark-average",
        kind: "knowledge",
        text: "Caveman compression benchmarks report about 46 percent average token savings on project memory files while preserving validated markdown structure.",
        scope: ["token-management", "context-management", "caveman", "compression", "benchmark"],
        taskType: "general",
        noteType: "architecture",
        confidence: 0.9,
        sourcePath: "caveman://caveman-compress/README.md"
    },
    {
        key: "caveman.compress.benchmark-token-counter",
        kind: "knowledge",
        text: "The compression benchmark uses tiktoken o200k_base when available and falls back to word count when tokenization dependencies are absent.",
        scope: ["token-management", "context-management", "caveman", "compression", "benchmark"],
        taskType: "general",
        noteType: "architecture",
        confidence: 0.85,
        sourcePath: "caveman://caveman-compress/scripts/benchmark.py"
    },
    {
        key: "caveman.compress.cli.missing-file-exit",
        kind: "lesson",
        text: "Caveman compress CLI exits with error for a missing filepath and prints a clear file-not-found message.",
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
        sourcePath: "caveman://caveman-compress/scripts/cli.py"
    },
    {
        key: "caveman.compress.cli.skip-non-natural-language",
        kind: "lesson",
        text: "Caveman compress CLI should detect non-natural-language files, print a skip message, and exit successfully without modifying the file.",
        scope: ["token-management", "context-management", "caveman", "compression", "cli"],
        taskType: "general",
        severity: "medium",
        confidence: 0.9,
        sourcePath: "caveman://caveman-compress/scripts/cli.py"
    },
    {
        key: "caveman.compress.detect-natural-language",
        kind: "knowledge",
        text: "The compressor detects natural-language files by extension and extensionless content heuristics, while classifying JSON, YAML, and code-like line patterns as non-compressible.",
        scope: ["token-management", "context-management", "caveman", "compression", "detection"],
        taskType: "general",
        noteType: "architecture",
        confidence: 0.95,
        sourcePath: "caveman://caveman-compress/scripts/detect.py"
    },
    {
        key: "caveman.compress.limit-file-size",
        kind: "lesson",
        text: "Refuse compression for very large files; Caveman caps compression input at 500 KB to keep third-party model calls bounded.",
        scope: ["token-management", "context-management", "caveman", "compression", "security"],
        taskType: "general",
        severity: "medium",
        confidence: 0.95,
        sourcePath: "caveman://caveman-compress/scripts/compress.py"
    },
    {
        key: "caveman.compress.model-fallback",
        kind: "knowledge",
        text: "Caveman compression uses the Anthropic API when ANTHROPIC_API_KEY is available and falls back to the authenticated Claude CLI otherwise.",
        scope: ["token-management", "context-management", "caveman", "compression", "cli"],
        taskType: "general",
        noteType: "architecture",
        confidence: 0.9,
        sourcePath: "caveman://caveman-compress/scripts/compress.py"
    },
    {
        key: "caveman.compress.natural-language-only",
        kind: "lesson",
        text: "Only compress natural-language memory files such as markdown, text, and reStructuredText; skip code, config, environment, lock, SQL, shell, HTML, and generated files.",
        scope: ["token-management", "context-management", "caveman", "compression"],
        taskType: "general",
        severity: "high",
        confidence: 1,
        sourcePath: "caveman://skills/compress/SKILL.md"
    },
    {
        key: "caveman.compress.preserve-code-blocks",
        kind: "lesson",
        text: "Copy fenced and indented code blocks exactly during compression; do not remove comments, spacing, commands, or reorder lines inside code regions.",
        scope: ["token-management", "context-management", "caveman", "compression", "markdown"],
        taskType: "general",
        severity: "high",
        confidence: 1,
        sourcePath: "caveman://skills/compress/SKILL.md"
    },
    {
        key: "caveman.compress.preserve-inline-code",
        kind: "lesson",
        text: "Preserve inline backtick content exactly during compression, including commands, identifiers, flags, paths, and examples.",
        scope: ["token-management", "context-management", "caveman", "compression", "markdown"],
        taskType: "general",
        severity: "high",
        confidence: 1,
        sourcePath: "caveman://skills/compress/SKILL.md"
    },
    {
        key: "caveman.compress.preserve-markdown-structure",
        kind: "lesson",
        text: "Keep markdown heading text, bullet nesting, list numbering, tables, and frontmatter structure stable while compressing body prose.",
        scope: ["token-management", "context-management", "caveman", "compression", "markdown"],
        taskType: "general",
        severity: "medium",
        confidence: 1,
        sourcePath: "caveman://skills/compress/SKILL.md"
    },
    {
        key: "caveman.compress.preserve-urls-paths",
        kind: "lesson",
        text: "Preserve URLs, markdown links, file paths, commands, environment variables, dates, versions, and numeric values exactly during compression.",
        scope: ["token-management", "context-management", "caveman", "compression", "markdown"],
        taskType: "general",
        severity: "high",
        confidence: 1,
        sourcePath: "caveman://skills/compress/SKILL.md"
    },
    {
        key: "caveman.compress.python-requirement",
        kind: "knowledge",
        text: "Caveman-compress requires Python 3.10 or newer for the local compression scripts.",
        scope: ["token-management", "context-management", "caveman", "compression", "cli"],
        taskType: "general",
        noteType: "constraint",
        confidence: 0.85,
        sourcePath: "caveman://caveman-compress/README.md"
    },
    {
        key: "caveman.compress.refuse-sensitive-paths",
        kind: "lesson",
        text: "Refuse to compress files whose names or path components look sensitive, including credentials, secrets, passwords, private keys, .ssh, .aws, .gnupg, .kube, and .docker.",
        scope: ["token-management", "context-management", "caveman", "compression", "security"],
        taskType: "general",
        severity: "high",
        confidence: 1,
        sourcePath: "caveman://caveman-compress/scripts/compress.py"
    },
    {
        key: "caveman.compress.remove-phrasing",
        kind: "knowledge",
        text: "Caveman compression removes filler, hedging, redundant phrasing, and connective fluff such as 'in order to', 'happy to', and 'furthermore'.",
        scope: ["token-management", "context-management", "caveman", "compression"],
        taskType: "general",
        noteType: "convention",
        confidence: 1,
        sourcePath: "caveman://skills/compress/SKILL.md"
    },
    {
        key: "caveman.compress.restore-on-failure",
        kind: "lesson",
        text: "If compression still fails after retries, restore the original file and remove the backup to avoid leaving corrupted compressed output.",
        scope: ["token-management", "context-management", "caveman", "compression", "validation"],
        taskType: "general",
        severity: "high",
        confidence: 1,
        sourcePath: "caveman://caveman-compress/scripts/compress.py"
    },
    {
        key: "caveman.compress.retry-targeted-fixes",
        kind: "lesson",
        text: "When compression validation fails, ask the model to fix only listed validation errors instead of recompressing the entire file; retry at most twice.",
        scope: ["token-management", "context-management", "caveman", "compression", "validation"],
        taskType: "general",
        severity: "high",
        confidence: 1,
        sourcePath: "caveman://caveman-compress/scripts/compress.py"
    },
    {
        key: "caveman.compress.short-synonyms",
        kind: "knowledge",
        text: "Caveman compression prefers short synonyms and direct imperative fragments: use 'fix' over 'implement a solution for' and 'use' over 'utilize'.",
        scope: ["token-management", "context-management", "caveman", "compression"],
        taskType: "general",
        noteType: "convention",
        confidence: 1,
        sourcePath: "caveman://skills/compress/SKILL.md"
    },
    {
        key: "caveman.compress.skip-code-config-extensions",
        kind: "lesson",
        text: "Skip compression for code and config extensions including .py, .js, .ts, .json, .yaml, .toml, .env, .lock, .sql, .sh, .html, .xml, and similar source formats.",
        scope: ["token-management", "context-management", "caveman", "compression", "detection"],
        taskType: "general",
        severity: "high",
        confidence: 0.95,
        sourcePath: "caveman://caveman-compress/scripts/detect.py"
    },
    {
        key: "caveman.compress.strip-outer-wrapper",
        kind: "knowledge",
        text: "The compressor strips an outer markdown fence only when it wraps the entire model output, while preserving inner code blocks from the original file.",
        scope: ["token-management", "context-management", "caveman", "compression", "markdown"],
        taskType: "general",
        noteType: "architecture",
        confidence: 0.92,
        sourcePath: "caveman://caveman-compress/scripts/compress.py"
    },
    {
        key: "caveman.compress.validate-bullets",
        kind: "knowledge",
        text: "Compression validation warns when bullet count changes by more than 15 percent, preserving rough markdown list structure without blocking all summarization.",
        scope: ["token-management", "context-management", "caveman", "compression", "validation"],
        taskType: "general",
        noteType: "architecture",
        confidence: 0.9,
        sourcePath: "caveman://caveman-compress/scripts/validate.py"
    },
    {
        key: "caveman.compress.validate-code-blocks",
        kind: "lesson",
        text: "Treat any code block mismatch after compression as a validation error because code blocks must be preserved exactly.",
        scope: ["token-management", "context-management", "caveman", "compression", "validation"],
        taskType: "general",
        severity: "high",
        confidence: 1,
        sourcePath: "caveman://caveman-compress/scripts/validate.py"
    },
    {
        key: "caveman.compress.validate-headings",
        kind: "knowledge",
        text: "Compression validation checks heading count and warns when heading text or order changes.",
        scope: ["token-management", "context-management", "caveman", "compression", "validation"],
        taskType: "general",
        noteType: "architecture",
        confidence: 0.95,
        sourcePath: "caveman://caveman-compress/scripts/validate.py"
    },
    {
        key: "caveman.compress.validate-paths",
        kind: "knowledge",
        text: "Compression validation detects file path changes with a conservative path regex and reports path differences as warnings.",
        scope: ["token-management", "context-management", "caveman", "compression", "validation"],
        taskType: "general",
        noteType: "architecture",
        confidence: 0.9,
        sourcePath: "caveman://caveman-compress/scripts/validate.py"
    },
    {
        key: "caveman.compress.validate-urls",
        kind: "lesson",
        text: "Treat lost or added URLs after compression as validation errors; URLs must survive compression exactly.",
        scope: ["token-management", "context-management", "caveman", "compression", "validation"],
        taskType: "general",
        severity: "high",
        confidence: 1,
        sourcePath: "caveman://caveman-compress/scripts/validate.py"
    },
    {
        key: "caveman.copilot-instructions",
        kind: "knowledge",
        text: "Copilot integration uses custom instructions and AGENTS.md-style guidance to activate Caveman behavior in chat, edits, and coding-agent contexts.",
        scope: [
            "token-management",
            "context-management",
            "caveman",
            "copilot",
            "agent-integration"
        ],
        taskType: "general",
        noteType: "architecture",
        confidence: 0.8,
        sourcePath: "caveman://.github/copilot-instructions.md"
    },
    {
        key: "caveman.cursor-windsurf-rules",
        kind: "knowledge",
        text: "Cursor and Windsurf receive Caveman skill or rule files, but always-on behavior requires agent-specific rules because npx skills installs only skill files.",
        scope: [
            "token-management",
            "context-management",
            "caveman",
            "cursor",
            "windsurf",
            "agent-integration"
        ],
        taskType: "general",
        noteType: "architecture",
        confidence: 0.85,
        sourcePath: "caveman://.cursor/rules/caveman.mdc"
    },
    {
        key: "caveman.evals.auto-discover-skills",
        kind: "knowledge",
        text: "Caveman eval harness auto-discovers skill directories that contain SKILL.md, so adding a skill automatically adds an eval arm.",
        scope: ["token-management", "context-management", "caveman", "evals"],
        taskType: "general",
        noteType: "architecture",
        confidence: 0.9,
        sourcePath: "caveman://evals/llm_run.py"
    },
    {
        key: "caveman.evals.skill-vs-terse",
        kind: "lesson",
        text: "Measure Caveman skill value against the terse control arm, not against baseline, because baseline comparison conflates skill behavior with generic brevity.",
        scope: ["token-management", "context-management", "caveman", "evals", "benchmark"],
        taskType: "general",
        severity: "high",
        confidence: 1,
        sourcePath: "caveman://evals/llm_run.py"
    },
    {
        key: "caveman.evals.snapshot-committed",
        kind: "knowledge",
        text: "Caveman eval snapshots are committed so CI can measure token counts offline without making API calls.",
        scope: ["token-management", "context-management", "caveman", "evals", "ci"],
        taskType: "general",
        noteType: "architecture",
        confidence: 0.9,
        sourcePath: "caveman://CLAUDE.md"
    },
    {
        key: "caveman.evals.snapshot-results",
        kind: "knowledge",
        text: "Caveman evals use prompt files, measurement scripts, and snapshot results to compare terse outputs and token savings over time.",
        scope: ["token-management", "context-management", "caveman", "evals", "benchmark"],
        taskType: "general",
        noteType: "architecture",
        confidence: 0.82,
        sourcePath: "caveman://evals/README.md"
    },
    {
        key: "caveman.evals.tokenizer-approximation",
        kind: "knowledge",
        text: "Caveman eval measurement uses tiktoken o200k_base as an approximation of Claude tokenization; ratios are meaningful but absolute counts are approximate.",
        scope: ["token-management", "context-management", "caveman", "evals", "benchmark"],
        taskType: "general",
        noteType: "constraint",
        confidence: 0.9,
        sourcePath: "caveman://evals/measure.py"
    },
    {
        key: "caveman.gemini.extension",
        kind: "knowledge",
        text: "Gemini integration installs as an extension, auto-activates through GEMINI.md context, and exposes /caveman, /caveman-commit, and /caveman-review commands.",
        scope: ["token-management", "context-management", "caveman", "gemini", "agent-integration"],
        taskType: "general",
        noteType: "architecture",
        confidence: 0.85,
        sourcePath: "caveman://gemini-extension.json"
    },
    {
        key: "caveman.help.command-reference",
        kind: "knowledge",
        text: "Caveman help summarizes available modes, independent skills, deactivation phrases, default-mode configuration, and the upstream docs link.",
        scope: ["token-management", "context-management", "caveman", "help", "commands"],
        taskType: "general",
        noteType: "convention",
        confidence: 0.95,
        sourcePath: "caveman://skills/caveman-help/SKILL.md"
    },
    {
        key: "caveman.help.default-mode-config",
        kind: "knowledge",
        text: "Caveman default mode is configurable through CAVEMAN_DEFAULT_MODE or config.json, with full mode as the fallback and off disabling auto-activation.",
        scope: ["token-management", "context-management", "caveman", "help", "config"],
        taskType: "general",
        noteType: "convention",
        confidence: 0.95,
        sourcePath: "caveman://skills/caveman-help/SKILL.md"
    },
    {
        key: "caveman.help.one-shot",
        kind: "lesson",
        text: "Caveman help is a one-shot quick-reference response; displaying it must not change mode, write flag files, or persist state.",
        scope: ["token-management", "context-management", "caveman", "help", "commands"],
        taskType: "general",
        severity: "medium",
        confidence: 1,
        sourcePath: "caveman://skills/caveman-help/SKILL.md"
    },
    {
        key: "caveman.hooks.commonjs-marker",
        kind: "knowledge",
        text: "Caveman hooks/package.json pins the hook directory to CommonJS so hook require() calls work even under an ancestor package with type module.",
        scope: ["token-management", "context-management", "caveman", "hooks", "config"],
        taskType: "general",
        noteType: "constraint",
        confidence: 0.95,
        sourcePath: "caveman://CLAUDE.md"
    },
    {
        key: "caveman.hooks.default-mode-resolution",
        kind: "knowledge",
        text: "Caveman resolves default mode from CAVEMAN_DEFAULT_MODE, then XDG or platform config file, then full mode.",
        scope: ["token-management", "context-management", "caveman", "hooks", "config"],
        taskType: "general",
        noteType: "architecture",
        confidence: 0.95,
        sourcePath: "caveman://hooks/caveman-config.js"
    },
    {
        key: "caveman.hooks.independent-modes",
        kind: "knowledge",
        text: "Commit, review, and compress are independent Caveman modes; hooks emit a short activation line and let each skill define its own behavior.",
        scope: ["token-management", "context-management", "caveman", "hooks", "commands"],
        taskType: "general",
        noteType: "architecture",
        confidence: 0.9,
        sourcePath: "caveman://hooks/caveman-activate.js"
    },
    {
        key: "caveman.hooks.mode-tracker",
        kind: "knowledge",
        text: "Caveman UserPromptSubmit hooks detect slash commands and natural-language activation or deactivation, then update the active mode flag.",
        scope: ["token-management", "context-management", "caveman", "hooks", "agent-integration"],
        taskType: "general",
        noteType: "architecture",
        confidence: 0.95,
        sourcePath: "caveman://hooks/README.md"
    },
    {
        key: "caveman.hooks.per-turn-reinforcement",
        kind: "lesson",
        text: "Emit compact per-turn reinforcement while Caveman mode is active so competing plugin context or long sessions do not erase terse-mode behavior.",
        scope: ["token-management", "context-management", "caveman", "hooks", "agent-integration"],
        taskType: "general",
        severity: "medium",
        confidence: 0.95,
        sourcePath: "caveman://hooks/caveman-mode-tracker.js"
    },
    {
        key: "caveman.hooks.respect-claude-config-dir",
        kind: "lesson",
        text: "Caveman hooks, installers, uninstallers, and statusline scripts must respect CLAUDE_CONFIG_DIR instead of hardcoding ~/.claude.",
        scope: ["token-management", "context-management", "caveman", "hooks", "install"],
        taskType: "general",
        severity: "high",
        confidence: 1,
        sourcePath: "caveman://CLAUDE.md"
    },
    {
        key: "caveman.hooks.safe-flag-read",
        kind: "lesson",
        text: "Read Caveman flag files with symlink refusal, file-size cap, O_NOFOLLOW when available, and whitelist validation to avoid injecting untrusted bytes into context.",
        scope: ["token-management", "context-management", "caveman", "hooks", "security"],
        taskType: "general",
        severity: "high",
        confidence: 1,
        sourcePath: "caveman://hooks/caveman-config.js"
    },
    {
        key: "caveman.hooks.safe-flag-write",
        kind: "lesson",
        text: "Write Caveman mode flag files with symlink checks, O_NOFOLLOW when available, temporary file plus rename, and 0600 permissions.",
        scope: ["token-management", "context-management", "caveman", "hooks", "security"],
        taskType: "general",
        severity: "high",
        confidence: 1,
        sourcePath: "caveman://hooks/caveman-config.js"
    },
    {
        key: "caveman.hooks.session-start",
        kind: "knowledge",
        text: "Caveman SessionStart hooks write the active mode flag, emit the ruleset as hidden context, and optionally nudge statusline setup.",
        scope: ["token-management", "context-management", "caveman", "hooks", "agent-integration"],
        taskType: "general",
        noteType: "architecture",
        confidence: 0.95,
        sourcePath: "caveman://hooks/README.md"
    },
    {
        key: "caveman.hooks.silent-fail",
        kind: "lesson",
        text: "Caveman hooks must silent-fail on filesystem errors so activation, statusline, and mode tracking never block agent session startup.",
        scope: ["token-management", "context-management", "caveman", "hooks", "safety"],
        taskType: "general",
        severity: "high",
        confidence: 1,
        sourcePath: "caveman://CLAUDE.md"
    },
    {
        key: "caveman.hooks.statusline",
        kind: "knowledge",
        text: "Caveman statusline scripts read the active mode flag and show badges such as CAVEMAN, CAVEMAN:ULTRA, CAVEMAN:COMMIT, or CAVEMAN:REVIEW.",
        scope: ["token-management", "context-management", "caveman", "hooks", "statusline"],
        taskType: "general",
        noteType: "architecture",
        confidence: 0.9,
        sourcePath: "caveman://hooks/README.md"
    },
    {
        key: "caveman.install.fresh-configures-statusline",
        kind: "knowledge",
        text: "A fresh Caveman standalone hook install should configure statusline automatically when no custom statusline already exists.",
        scope: [
            "token-management",
            "context-management",
            "caveman",
            "hooks",
            "install",
            "statusline"
        ],
        taskType: "general",
        noteType: "architecture",
        confidence: 0.9,
        sourcePath: "caveman://tests/verify_repo.py"
    },
    {
        key: "caveman.install.idempotent",
        kind: "lesson",
        text: "Caveman hook install should be idempotent; reinstalling an already-wired setup should report nothing to do instead of duplicating settings.",
        scope: [
            "token-management",
            "context-management",
            "caveman",
            "hooks",
            "install",
            "verification"
        ],
        taskType: "general",
        severity: "medium",
        confidence: 0.95,
        sourcePath: "caveman://tests/verify_repo.py"
    },
    {
        key: "caveman.install.powershell-compat",
        kind: "knowledge",
        text: "Caveman PowerShell install scripts avoid newer-only flags such as -AsHashtable to stay compatible with Windows PowerShell 5.1.",
        scope: ["token-management", "context-management", "caveman", "hooks", "install", "windows"],
        taskType: "general",
        noteType: "constraint",
        confidence: 0.9,
        sourcePath: "caveman://tests/verify_repo.py"
    },
    {
        key: "caveman.install.preserve-custom-statusline",
        kind: "lesson",
        text: "Caveman install and uninstall must preserve a user's existing custom statusline rather than clobbering or deleting unrelated statusline configuration.",
        scope: [
            "token-management",
            "context-management",
            "caveman",
            "hooks",
            "install",
            "statusline"
        ],
        taskType: "general",
        severity: "high",
        confidence: 1,
        sourcePath: "caveman://tests/test_hooks.py"
    },
    {
        key: "caveman.install.uninstall-restores-settings",
        kind: "lesson",
        text: "Caveman uninstall should remove Caveman hook files and hook entries while restoring non-Caveman settings that existed before install.",
        scope: [
            "token-management",
            "context-management",
            "caveman",
            "hooks",
            "install",
            "verification"
        ],
        taskType: "general",
        severity: "high",
        confidence: 0.95,
        sourcePath: "caveman://tests/verify_repo.py"
    },
    {
        key: "caveman.mode.auto-clarity",
        kind: "lesson",
        text: "Temporarily drop terse Caveman style for security warnings, irreversible confirmations, ambiguous multi-step instructions, or explicit clarification requests.",
        scope: ["token-management", "context-management", "caveman", "safety"],
        taskType: "general",
        severity: "high",
        confidence: 1,
        sourcePath: "caveman://skills/caveman/SKILL.md"
    },
    {
        key: "caveman.mode.boundaries",
        kind: "lesson",
        text: "Write code, commit messages, PR text, and safety-critical explanations in normal project style when terse fragments would reduce clarity.",
        scope: ["token-management", "context-management", "caveman", "safety"],
        taskType: "general",
        severity: "medium",
        confidence: 0.95,
        sourcePath: "caveman://skills/caveman/SKILL.md"
    },
    {
        key: "caveman.mode.drop-filler",
        kind: "lesson",
        text: "Drop articles, filler words, pleasantries, hedging, and redundant connective phrasing when the user asks for token-efficient communication.",
        scope: ["token-management", "context-management", "caveman", "agent-style"],
        taskType: "general",
        severity: "medium",
        confidence: 1,
        sourcePath: "caveman://skills/caveman/SKILL.md"
    },
    {
        key: "caveman.mode.intensity.full",
        kind: "knowledge",
        text: "Caveman full drops articles, allows fragments, and prefers short synonyms while preserving technical accuracy.",
        scope: ["token-management", "context-management", "caveman", "intensity"],
        taskType: "general",
        noteType: "convention",
        confidence: 1,
        sourcePath: "caveman://skills/caveman/SKILL.md"
    },
    {
        key: "caveman.mode.intensity.lite",
        kind: "knowledge",
        text: "Caveman lite removes filler and hedging but keeps articles and full professional sentences.",
        scope: ["token-management", "context-management", "caveman", "intensity"],
        taskType: "general",
        noteType: "convention",
        confidence: 1,
        sourcePath: "caveman://skills/caveman/SKILL.md"
    },
    {
        key: "caveman.mode.intensity.ultra",
        kind: "knowledge",
        text: "Caveman ultra abbreviates common technical words and uses arrows for causality when the shorter notation remains clear.",
        scope: ["token-management", "context-management", "caveman", "intensity"],
        taskType: "general",
        noteType: "convention",
        confidence: 1,
        sourcePath: "caveman://skills/caveman/SKILL.md"
    },
    {
        key: "caveman.mode.intensity.wenyan",
        kind: "knowledge",
        text: "Wenyan Caveman modes use compact classical Chinese-style phrasing and are separate intensity choices from lite, full, and ultra.",
        scope: ["token-management", "context-management", "caveman", "intensity", "wenyan"],
        taskType: "general",
        noteType: "convention",
        confidence: 0.92,
        sourcePath: "caveman://skills/caveman/SKILL.md"
    },
    {
        key: "caveman.mode.pattern",
        kind: "knowledge",
        text: "Caveman communication pattern is '[thing] [action] [reason]. [next step].' It preserves the fix and reason while removing social filler.",
        scope: ["token-management", "context-management", "caveman", "agent-style"],
        taskType: "general",
        noteType: "convention",
        confidence: 1,
        sourcePath: "caveman://skills/caveman/SKILL.md"
    },
    {
        key: "caveman.mode.persistence",
        kind: "lesson",
        text: "Keep Caveman mode active across responses until the user explicitly says stop caveman or normal mode; do not drift back to verbose filler after several turns.",
        scope: ["token-management", "context-management", "caveman", "agent-style"],
        taskType: "general",
        severity: "medium",
        confidence: 1,
        sourcePath: "caveman://skills/caveman/SKILL.md"
    },
    {
        key: "caveman.mode.preserve-technical-terms",
        kind: "lesson",
        text: "Keep technical terms, symbol names, error text, code blocks, and exact commands unchanged even when compressing surrounding prose.",
        scope: ["token-management", "context-management", "caveman", "technical-accuracy"],
        taskType: "general",
        severity: "high",
        confidence: 1,
        sourcePath: "caveman://skills/caveman/SKILL.md"
    },
    {
        key: "caveman.repo.preserve-brand-voice",
        kind: "lesson",
        text: "Preserve Caveman README voice and examples intentionally; do not normalize branded caveman-style copy unless the product intent changes.",
        scope: ["token-management", "context-management", "caveman", "repo", "docs"],
        taskType: "general",
        severity: "medium",
        confidence: 0.9,
        sourcePath: "caveman://CLAUDE.md"
    },
    {
        key: "caveman.repo.readme-product-artifact",
        kind: "knowledge",
        text: "Caveman README is treated as the product front door and should stay readable to non-agent users, with install paths and feature tables kept accurate.",
        scope: ["token-management", "context-management", "caveman", "repo", "docs"],
        taskType: "general",
        noteType: "convention",
        confidence: 0.95,
        sourcePath: "caveman://CLAUDE.md"
    },
    {
        key: "caveman.repo.real-metrics-only",
        kind: "lesson",
        text: "Never invent Caveman benchmark or eval numbers; re-run the benchmark or eval harness when numbers are doubtful or changed.",
        scope: ["token-management", "context-management", "caveman", "repo", "benchmark", "evals"],
        taskType: "general",
        severity: "high",
        confidence: 1,
        sourcePath: "caveman://CLAUDE.md"
    },
    {
        key: "caveman.repo.source-of-truth",
        kind: "lesson",
        text: "For Caveman behavior changes, edit canonical source files such as skills/caveman/SKILL.md and rules/caveman-activate.md, not synced agent-specific copies.",
        scope: ["token-management", "context-management", "caveman", "repo", "sync"],
        taskType: "general",
        severity: "high",
        confidence: 1,
        sourcePath: "caveman://CLAUDE.md"
    },
    {
        key: "caveman.repo.synced-copy-warning",
        kind: "lesson",
        text: "Treat Caveman agent-specific SKILL.md and rule copies as generated artifacts; direct edits will be overwritten by sync automation.",
        scope: ["token-management", "context-management", "caveman", "repo", "sync"],
        taskType: "general",
        severity: "high",
        confidence: 1,
        sourcePath: "caveman://CLAUDE.md"
    },
    {
        key: "caveman.review.full-context-exceptions",
        kind: "lesson",
        text: "Use normal explanatory review paragraphs for CVE-class security issues, architectural disagreements, or onboarding contexts where a one-liner would be unclear.",
        scope: ["token-management", "context-management", "caveman", "code-review", "safety"],
        taskType: "general",
        severity: "high",
        confidence: 0.95,
        sourcePath: "caveman://skills/caveman-review/SKILL.md"
    },
    {
        key: "caveman.review.one-line-findings",
        kind: "lesson",
        text: "Write Caveman review findings as one line per finding with location, problem, and fix: file or line, severity, concise problem, concrete fix.",
        scope: ["token-management", "context-management", "caveman", "code-review"],
        taskType: "general",
        severity: "medium",
        confidence: 1,
        sourcePath: "caveman://skills/caveman-review/SKILL.md"
    },
    {
        key: "caveman.review.severity-prefixes",
        kind: "knowledge",
        text: "Caveman review comments use severity prefixes for bug, risk, nit, and question so terse comments remain scannable.",
        scope: ["token-management", "context-management", "caveman", "code-review"],
        taskType: "general",
        noteType: "convention",
        confidence: 1,
        sourcePath: "caveman://skills/caveman-review/SKILL.md"
    },
    {
        key: "caveman.review.skip-praise",
        kind: "lesson",
        text: "In Caveman review mode, skip per-comment praise, throat-clearing, hedging, and restating what the diff already shows.",
        scope: ["token-management", "context-management", "caveman", "code-review"],
        taskType: "general",
        severity: "medium",
        confidence: 1,
        sourcePath: "caveman://skills/caveman-review/SKILL.md"
    },
    {
        key: "caveman.security.subprocess-risk",
        kind: "knowledge",
        text: "Caveman-compress is flagged as high risk by static analysis because it uses subprocess and file I/O, but the documented behavior is bounded to explicit local files and model calls.",
        scope: ["token-management", "context-management", "caveman", "compression", "security"],
        taskType: "general",
        noteType: "constraint",
        confidence: 0.9,
        sourcePath: "caveman://caveman-compress/SECURITY.md"
    },
    {
        key: "caveman.security.third-party-boundary",
        kind: "lesson",
        text: "Treat compression as a third-party model boundary; do not send credential-like files or private key material to the compression model.",
        scope: ["token-management", "context-management", "caveman", "compression", "security"],
        taskType: "general",
        severity: "high",
        confidence: 1,
        sourcePath: "caveman://caveman-compress/SECURITY.md"
    },
    {
        key: "caveman.sync.agent-frontmatter",
        kind: "knowledge",
        text: "Caveman sync prepends agent-specific frontmatter to generated rule files, such as Cursor alwaysApply and Windsurf always_on trigger metadata.",
        scope: ["token-management", "context-management", "caveman", "sync", "cursor", "windsurf"],
        taskType: "general",
        noteType: "architecture",
        confidence: 0.9,
        sourcePath: "caveman://CLAUDE.md"
    },
    {
        key: "caveman.sync.generated-copies",
        kind: "knowledge",
        text: "Caveman sync automation copies canonical skill and activation-rule sources into Claude, Codex, Cursor, Windsurf, Cline, and Copilot distribution surfaces.",
        scope: ["token-management", "context-management", "caveman", "sync", "agent-integration"],
        taskType: "general",
        noteType: "architecture",
        confidence: 0.95,
        sourcePath: "caveman://CLAUDE.md"
    },
    {
        key: "caveman.sync.rebuild-skill-zip",
        kind: "knowledge",
        text: "Caveman sync rebuilds caveman.skill as a zip payload containing the canonical caveman skill directory.",
        scope: ["token-management", "context-management", "caveman", "sync", "agent-integration"],
        taskType: "general",
        noteType: "architecture",
        confidence: 0.9,
        sourcePath: "caveman://CLAUDE.md"
    },
    {
        key: "caveman.sync.workflow-trigger",
        kind: "knowledge",
        text: "Caveman sync workflow runs on main when canonical skill or activation-rule files change, then commits generated copies back with skip-ci to avoid loops.",
        scope: ["token-management", "context-management", "caveman", "sync", "ci"],
        taskType: "general",
        noteType: "architecture",
        confidence: 0.9,
        sourcePath: "caveman://.github/workflows/sync-skill.yml"
    },
    {
        key: "caveman.verify.compress-cli",
        kind: "knowledge",
        text: "Caveman verification exercises compression CLI skip and missing-file paths to ensure code/config files skip cleanly and absent files exit with an error.",
        scope: ["token-management", "context-management", "caveman", "verification", "compression"],
        taskType: "general",
        noteType: "architecture",
        confidence: 0.95,
        sourcePath: "caveman://tests/verify_repo.py"
    },
    {
        key: "caveman.verify.compress-fixtures",
        kind: "lesson",
        text: "Validate Caveman compression fixtures by pairing each .original.md file with its compressed markdown and running the compression validator against both.",
        scope: [
            "token-management",
            "context-management",
            "caveman",
            "verification",
            "compression",
            "validation"
        ],
        taskType: "general",
        severity: "medium",
        confidence: 0.95,
        sourcePath: "caveman://tests/verify_repo.py"
    },
    {
        key: "caveman.verify.hook-flow",
        kind: "knowledge",
        text: "Caveman hook-flow verification covers install, activation, mode tracking, normal-mode deactivation, statusline output, reinstall idempotency, and uninstall cleanup.",
        scope: [
            "token-management",
            "context-management",
            "caveman",
            "verification",
            "hooks",
            "install"
        ],
        taskType: "general",
        noteType: "architecture",
        confidence: 0.95,
        sourcePath: "caveman://tests/verify_repo.py"
    },
    {
        key: "caveman.verify.manifests-syntax",
        kind: "knowledge",
        text: "Caveman verification checks JSON manifests, JavaScript hook syntax, bash script syntax, and installer references to required hook files.",
        scope: [
            "token-management",
            "context-management",
            "caveman",
            "verification",
            "agent-integration"
        ],
        taskType: "general",
        noteType: "architecture",
        confidence: 0.95,
        sourcePath: "caveman://tests/verify_repo.py"
    },
    {
        key: "caveman.verify.synced-files",
        kind: "lesson",
        text: "Verify Caveman synced copies match canonical skill and rule sources, including plugin copies, Cursor/Windsurf skill copies, Cline/Copilot rules, and caveman.skill payload.",
        scope: ["token-management", "context-management", "caveman", "verification", "sync"],
        taskType: "general",
        severity: "high",
        confidence: 1,
        sourcePath: "caveman://tests/verify_repo.py"
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
