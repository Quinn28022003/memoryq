import type { NormalizedLesson, RunStatus, TaskType } from "../types.js";

export interface ReflectionAnalysis {
    summary: string;
    newLessons: NormalizedLesson[];
    updatedKnowledge: string[];
    shouldPersist: boolean;
    confidence: number;
    status: RunStatus;
}

const LESSON_TRIGGERS = [
    "because",
    "root cause",
    "lesson",
    "avoid",
    "next time",
    "fixed by",
    "should",
    "must",
    "always",
    "need to",
    "requires",
    "required",
    "enforce",
    "rule",
    "strictly",
    "cần",
    "phải",
    "luôn"
];

const KNOWLEDGE_TRIGGERS = [
    "architecture",
    "convention",
    "constraint",
    "pattern",
    "module boundary",
    "dependency",
    "layer",
    "boundary",
    "strict rule"
];

const ACTIONABLE_MODAL_RE =
    /\b(must|should|always|never|required|requires?|need(?:s|ed)? to|have to|cannot|forbidden|strictly)\b|(?:cần|phải|luôn|không được)/i;
const IMPERATIVE_RE =
    /^(always\s+)?(add|avoid|create|drop|ensure|keep|normalize|place|prefer|put|store|update|use|write|enforce|follow|restrict|forbid|strictly)\b/i;
const SPECIFIC_CONTEXT_RE =
    /(`[^`]+`|\/|[a-z0-9_.-]+\.(ts|tsx|js|jsx|sql|md|json|yml|yaml)\b|\b(api|cache|database|embedding|function|index|migration|policy|route|schema|supabase|table|vector|repository|service|contract|adapter|core|port|boundary|layer|dependency|architecture)\b)/i;
const META_NOISE_RE =
    /\b(memoryq reflect|reflect after work|shouldpersist|runid|storageMode|original prompt|files changed|implementation summary|tests\/checks run|lessons that may help|final response|agent workflow)\b/i;
const MIGRATION_DOWN_RE = /\bmigration\b/i;
const DOWN_FILE_RE =
    /(?:\bdown\b|rollback|roll back|revert|supabase\/migrations\/down|\.down\.sql)/i;

function normalizeSentence(sentence: string): string {
    return sentence
        .replace(/\s+/g, " ")
        .trim()
        .replace(/^[-*\d.\s]+/, "");
}

function splitSentences(input: string): string[] {
    return input
        .split(/(?<=[.!?])\s+|\n+/)
        .map(normalizeSentence)
        .filter((sentence) => sentence.length > 0);
}

function inferStatus(text: string): RunStatus {
    const lower = text.toLowerCase();

    if (/(failed|error|unable|blocked|did not|didn't|regression persists)/.test(lower)) {
        return "failed";
    }

    if (/(partial|partially|remaining issue|some tests failing)/.test(lower)) {
        return "partial";
    }

    return "completed";
}

function severityFromStatus(status: RunStatus): "low" | "medium" | "high" {
    if (status === "failed") {
        return "high";
    }

    if (status === "partial") {
        return "medium";
    }

    return "low";
}

function unique(values: string[]): string[] {
    return [...new Set(values.filter(Boolean))];
}

function canonicalProjectRule(sentence: string): string | null {
    if (MIGRATION_DOWN_RE.test(sentence) && DOWN_FILE_RE.test(sentence)) {
        return "When adding a Supabase migration under `supabase/migrations/*.sql`, add the matching rollback file under `supabase/migrations/down/*.down.sql`.";
    }

    return null;
}

export function isActionableMemoryText(text: string): boolean {
    const normalized = normalizeSentence(text);

    if (canonicalProjectRule(normalized)) {
        return true;
    }

    if (normalized.length < 12 || normalized.length > 500) {
        return false;
    }

    if (META_NOISE_RE.test(normalized)) {
        return false;
    }

    const hasAction = ACTIONABLE_MODAL_RE.test(normalized) || IMPERATIVE_RE.test(normalized);
    return hasAction && SPECIFIC_CONTEXT_RE.test(normalized);
}

function normalizeLessons(
    sentences: string[],
    taskType: TaskType,
    scope: string[],
    status: RunStatus
): NormalizedLesson[] {
    const picked = unique([
        ...sentences.flatMap((sentence) => {
            const canonical = canonicalProjectRule(sentence);
            return canonical ? [canonical] : [];
        }),
        ...sentences
            .filter((sentence) => {
                if (canonicalProjectRule(sentence)) {
                    return false;
                }

                if (!isActionableMemoryText(sentence)) {
                    return false;
                }

                const lower = sentence.toLowerCase();
                return LESSON_TRIGGERS.some((trigger) => lower.includes(trigger));
            })
            .map((sentence) => normalizeSentence(sentence))
    ])
        .filter((sentence) => sentence.length >= 12)
        .slice(0, 6);

    const severity = severityFromStatus(status);

    return picked.map((lessonText) => ({
        lessonText,
        scope,
        taskType,
        severity,
        confidence: 0.6
    }));
}

function normalizeKnowledge(sentences: string[]): string[] {
    return unique(
        sentences
            .flatMap((sentence) => {
                const canonical = canonicalProjectRule(sentence);
                return canonical ? [canonical] : [sentence];
            })
            .filter((sentence) => {
                if (!isActionableMemoryText(sentence)) {
                    return false;
                }

                const lower = sentence.toLowerCase();
                return KNOWLEDGE_TRIGGERS.some((trigger) => lower.includes(trigger));
            })
            .map((sentence) => normalizeSentence(sentence))
            .slice(0, 6)
    );
}

export function normalizeMemoryLessonText(text: string): string | null {
    const normalized = normalizeSentence(text);
    const canonical = canonicalProjectRule(normalized);
    const candidate = canonical ?? normalized;

    return canonical || isActionableMemoryText(candidate) ? candidate : null;
}

export function normalizeMemoryKnowledgeText(text: string): string | null {
    const normalized = normalizeSentence(text);
    const canonical = canonicalProjectRule(normalized);
    const candidate = canonical ?? normalized;

    return canonical || isActionableMemoryText(candidate) ? candidate : null;
}

export function classifyKnowledgeType(note: string): "architecture" | "convention" | "constraint" {
    const lower = note.toLowerCase();

    if (/(naming|format|style|convention)/.test(lower)) {
        return "convention";
    }

    if (/(constraint|limit|must|cannot|forbidden|requires)/.test(lower)) {
        return "constraint";
    }

    return "architecture";
}

export function analyzeReflectionFallback(
    resultText: string,
    context: { taskType: TaskType; scope: string[] }
): ReflectionAnalysis {
    const sentences = splitSentences(resultText);
    const status = inferStatus(resultText);
    const summary = sentences[0] ?? "No summary provided.";
    const newLessons = normalizeLessons(sentences, context.taskType, context.scope, status);
    const updatedKnowledge = normalizeKnowledge(sentences);

    return {
        summary,
        newLessons,
        updatedKnowledge,
        shouldPersist: newLessons.length > 0 || updatedKnowledge.length > 0,
        confidence: 0.55,
        status
    };
}
