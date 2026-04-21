import type { TaskType } from "../types.js";

export interface PlanAnalysis {
    taskType: TaskType;
    scope: string[];
    keywords: string[];
    verificationPlan: string[];
    confidence: number;
}

const STOPWORDS = new Set([
    "the",
    "and",
    "for",
    "with",
    "that",
    "this",
    "from",
    "into",
    "about",
    "please",
    "make",
    "build",
    "create",
    "update",
    "fix",
    "route",
    "file",
    "result",
    "reflect",
    "plan"
]);

function detectTaskType(input: string): TaskType {
    const text = input.toLowerCase();

    if (/(fix|bug|error|failure|regression|broken|crash)/.test(text)) {
        return "bugfix";
    }
    if (/(feature|add|implement|support|enable|new command)/.test(text)) {
        return "feature";
    }
    if (/(refactor|cleanup|clean up|simplify|restructure)/.test(text)) {
        return "refactor";
    }
    if (/(test|coverage|assert|integration|unit)/.test(text)) {
        return "test";
    }
    if (/(docs|documentation|readme|guide)/.test(text)) {
        return "docs";
    }
    if (/(infra|ci|deploy|pipeline|docker|k8s|build system)/.test(text)) {
        return "infra";
    }

    return "general";
}

function unique(values: string[]): string[] {
    return [...new Set(values.filter(Boolean))];
}

function extractPathLikeTokens(input: string): string[] {
    const matches = input
        .toLowerCase()
        .match(/[a-z0-9._-]+(?:\/[a-z0-9._/-]+)+|[a-z0-9._-]+\.(?:ts|tsx|js|jsx|json|md|sql|yml|yaml)/g);
    return unique(matches ?? []);
}

function extractKeywords(input: string): string[] {
    const words = input
        .toLowerCase()
        .split(/[^a-z0-9._/-]+/)
        .filter((word) => word.length >= 3 && !STOPWORDS.has(word));

    const score = new Map<string, number>();
    for (const word of words) {
        score.set(word, (score.get(word) ?? 0) + 1);
    }

    return [...score.entries()]
        .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
        .map(([word]) => word)
        .slice(0, 12);
}

function defaultVerification(taskType: TaskType): string[] {
    switch (taskType) {
        case "bugfix":
            return ["pnpm test", "pnpm lint"];
        case "feature":
        case "refactor":
            return ["pnpm test", "pnpm lint", "pnpm build"];
        case "test":
            return ["pnpm test"];
        case "docs":
            return ["pnpm test"];
        case "infra":
            return ["pnpm build", "pnpm test"];
        default:
            return ["pnpm test"];
    }
}

export function classifyPromptFallback(prompt: string): PlanAnalysis {
    const taskType = detectTaskType(prompt);
    const scope = extractPathLikeTokens(prompt).slice(0, 8);
    const keywords = extractKeywords(prompt);

    return {
        taskType,
        scope,
        keywords,
        verificationPlan: defaultVerification(taskType),
        confidence: 0.45
    };
}
