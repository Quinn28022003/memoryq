import type { NormalizedLesson, RunStatus, TaskType } from "../types.js";

export interface PlanAssistantResult {
    taskType?: TaskType;
    scope?: string[];
    keywords?: string[];
    verificationPlan?: string[];
    confidence?: number;
}

export interface ReflectionAssistantResult {
    summary?: string;
    newLessons?: NormalizedLesson[];
    updatedKnowledge?: string[];
    shouldPersist?: boolean;
    confidence?: number;
    status?: RunStatus;
}

export interface PlanningAssistant {
    analyzePlan(prompt: string): Promise<PlanAssistantResult | null>;
    analyzeReflection(input: {
        resultText: string;
        taskType: TaskType;
        scope: string[];
    }): Promise<ReflectionAssistantResult | null>;
}

const TASK_TYPES: TaskType[] = [
    "bugfix",
    "feature",
    "refactor",
    "test",
    "docs",
    "infra",
    "general"
];
const RUN_STATUSES: RunStatus[] = ["planned", "completed", "failed", "partial"];

function extractJson(text: string): unknown {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const payload = fenced?.[1] ?? text;
    return JSON.parse(payload.trim());
}

function toArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.map((item) => String(item).trim()).filter((item) => item.length > 0);
}

function toConfidence(value: unknown): number | undefined {
    const parsed = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(parsed)) {
        return undefined;
    }
    return Math.max(0, Math.min(1, parsed));
}

function toTaskType(value: unknown): TaskType | undefined {
    const normalized = String(value ?? "")
        .trim()
        .toLowerCase();
    return TASK_TYPES.includes(normalized as TaskType) ? (normalized as TaskType) : undefined;
}

function toStatus(value: unknown): RunStatus | undefined {
    const normalized = String(value ?? "")
        .trim()
        .toLowerCase();
    return RUN_STATUSES.includes(normalized as RunStatus) ? (normalized as RunStatus) : undefined;
}

export class GroqAdapter implements PlanningAssistant {
    constructor(
        private readonly apiKey: string | undefined,
        private readonly model: string = "llama-3.3-70b-versatile"
    ) {}

    private isEnabled(): boolean {
        return Boolean(this.apiKey);
    }

    private async call(systemContent: string, userContent: string): Promise<unknown> {
        if (!this.apiKey) {
            throw new Error("Groq is not configured.");
        }

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                authorization: `Bearer ${this.apiKey}`,
                "content-type": "application/json"
            },
            body: JSON.stringify({
                model: this.model,
                temperature: 0.1,
                response_format: { type: "json_object" },
                messages: [
                    { role: "system", content: systemContent },
                    { role: "user", content: userContent }
                ]
            })
        });

        if (!response.ok) {
            throw new Error(`Groq request failed with status ${response.status}.`);
        }

        const body = (await response.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
        };
        const text = body.choices?.[0]?.message?.content ?? "";

        if (!text.trim()) {
            throw new Error("Groq returned an empty response.");
        }

        return extractJson(text);
    }

    async analyzePlan(prompt: string): Promise<PlanAssistantResult | null> {
        if (!this.isEnabled()) {
            return null;
        }

        const systemContent = [
            "You are helping a coding-memory CLI classify a task.",
            "Return strict JSON only with keys: taskType, scope, keywords, verificationPlan, confidence.",
            "taskType must be one of: bugfix, feature, refactor, test, docs, infra, general.",
            "scope, keywords, and verificationPlan must be arrays of concise strings.",
            "confidence must be a number between 0 and 1."
        ].join(" ");
        const userContent = `Task prompt: ${prompt}`;

        try {
            const json = (await this.call(systemContent, userContent)) as Record<string, unknown>;

            return {
                taskType: toTaskType(json.taskType),
                scope: toArray(json.scope).slice(0, 10),
                keywords: toArray(json.keywords).slice(0, 16),
                verificationPlan: toArray(json.verificationPlan).slice(0, 8),
                confidence: toConfidence(json.confidence)
            };
        } catch {
            return null;
        }
    }

    async analyzeReflection(input: {
        resultText: string;
        taskType: TaskType;
        scope: string[];
    }): Promise<ReflectionAssistantResult | null> {
        if (!this.isEnabled()) {
            return null;
        }

        const systemContent = [
            "You are helping a coding-memory CLI normalize reflection output.",
            "Return strict JSON only with keys: summary, newLessons, updatedKnowledge, shouldPersist, confidence, status.",
            "newLessons is an array of objects with keys: lessonText, scope, taskType, severity, confidence.",
            "severity must be low, medium, or high.",
            "status must be planned, completed, failed, or partial.",
            "confidence values must be between 0 and 1."
        ].join(" ");
        const userContent = [
            `taskType: ${input.taskType}`,
            `scope: ${JSON.stringify(input.scope)}`,
            `resultText: ${input.resultText}`
        ].join("\n");

        try {
            const json = (await this.call(systemContent, userContent)) as Record<string, unknown>;
            const lessonsRaw = Array.isArray(json.newLessons) ? json.newLessons : [];
            const newLessons: NormalizedLesson[] = lessonsRaw
                .map((item) => item as Record<string, unknown>)
                .map((item) => {
                    const taskType = toTaskType(item.taskType) ?? input.taskType;
                    const severity = String(item.severity ?? "medium").toLowerCase();
                    const normalizedSeverity =
                        severity === "low" || severity === "medium" || severity === "high"
                            ? severity
                            : "medium";
                    const confidence = toConfidence(item.confidence) ?? 0.6;
                    const lessonText = String(item.lessonText ?? "").trim();
                    const scope = toArray(item.scope);

                    if (!lessonText) {
                        return null;
                    }

                    return {
                        lessonText,
                        scope,
                        taskType,
                        severity: normalizedSeverity,
                        confidence
                    } as NormalizedLesson;
                })
                .filter((lesson): lesson is NormalizedLesson => lesson !== null)
                .slice(0, 8);

            return {
                summary: String(json.summary ?? "").trim() || undefined,
                newLessons,
                updatedKnowledge: toArray(json.updatedKnowledge).slice(0, 8),
                shouldPersist:
                    typeof json.shouldPersist === "boolean" ? json.shouldPersist : undefined,
                confidence: toConfidence(json.confidence),
                status: toStatus(json.status)
            };
        } catch {
            return null;
        }
    }
}

export class NullAssistant implements PlanningAssistant {
    async analyzePlan(): Promise<null> {
        return null;
    }

    async analyzeReflection(): Promise<null> {
        return null;
    }
}
