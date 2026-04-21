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
    "should"
];

const KNOWLEDGE_TRIGGERS = [
    "architecture",
    "convention",
    "constraint",
    "pattern",
    "module boundary",
    "dependency"
];

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

function normalizeLessons(
    sentences: string[],
    taskType: TaskType,
    scope: string[],
    status: RunStatus
): NormalizedLesson[] {
    const picked = sentences
        .filter((sentence) => {
            const lower = sentence.toLowerCase();
            return LESSON_TRIGGERS.some((trigger) => lower.includes(trigger));
        })
        .map((sentence) => normalizeSentence(sentence))
        .filter((sentence) => sentence.length >= 12)
        .slice(0, 6);

    const severity = severityFromStatus(status);

    return unique(picked).map((lessonText) => ({
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
            .filter((sentence) => {
                const lower = sentence.toLowerCase();
                return KNOWLEDGE_TRIGGERS.some((trigger) => lower.includes(trigger));
            })
            .slice(0, 6)
    );
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
