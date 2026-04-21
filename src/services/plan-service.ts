import { randomUUID } from "node:crypto";

import { classifyPromptFallback } from "../core/classification.js";
import { renderPlanMarkdown } from "../core/markdown.js";
import { planOutputSchema } from "../contracts.js";
import type { PlanningAssistant } from "../adapters/groq.js";
import type { ArtifactManager } from "../core/artifacts.js";
import type { MemoryStorage } from "../storage/types.js";
import type { BriefSource, PlanBrief, PlanOutput, TaskType } from "../types.js";

export interface PlanServiceDeps {
    storage: MemoryStorage;
    assistant: PlanningAssistant;
    artifactManager: ArtifactManager;
    projectId: string;
    now?: () => Date;
}

export interface PlanRequest {
    prompt: string;
    writeArtifact?: boolean;
}

export interface PlanResponse {
    output: PlanOutput;
    markdown: string;
}

function unique(values: string[]): string[] {
    return [...new Set(values.filter(Boolean))];
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function looksLikeFilePath(value: string): boolean {
    return /\//.test(value) || /\.[a-z0-9]+$/i.test(value);
}

function defaultVerification(taskType: TaskType): string[] {
    switch (taskType) {
        case "bugfix":
            return ["pnpm test", "pnpm lint"];
        case "feature":
        case "refactor":
            return ["pnpm test", "pnpm lint", "pnpm build"];
        case "infra":
            return ["pnpm build", "pnpm test"];
        default:
            return ["pnpm test"];
    }
}

export class PlanService {
    constructor(private readonly deps: PlanServiceDeps) {}

    async runPlan(request: PlanRequest): Promise<PlanResponse> {
        const runId = randomUUID();
        const fallback = classifyPromptFallback(request.prompt);
        const ai = await this.deps.assistant.analyzePlan(request.prompt);

        const taskType = ai?.taskType ?? fallback.taskType;
        const scope = unique([...(ai?.scope ?? []), ...fallback.scope]).slice(0, 10);
        const keywords = unique([...(ai?.keywords ?? []), ...fallback.keywords]).slice(0, 16);
        const verificationPlan = unique([
            ...(ai?.verificationPlan ?? []),
            ...fallback.verificationPlan,
            ...defaultVerification(taskType)
        ]).slice(0, 8);

        const [lessons, knowledge, artifacts] = await Promise.all([
            this.deps.storage.queryLessons({
                projectId: this.deps.projectId,
                taskType,
                scope,
                keywords,
                limit: 6
            }),
            this.deps.storage.queryKnowledge({
                projectId: this.deps.projectId,
                scope,
                keywords,
                limit: 6
            }),
            this.deps.storage.queryArtifactSummaries({
                projectId: this.deps.projectId,
                scope,
                keywords,
                limit: 8
            })
        ]);

        const architectureNotes = unique(knowledge.map((item) => item.noteText)).slice(0, 8);
        const knownMistakes = unique(lessons.map((item) => item.lessonText)).slice(0, 8);

        const filesToInspect = unique([
            ...artifacts.map((item) => item.filePath),
            ...scope.filter(looksLikeFilePath),
            ...keywords.filter(looksLikeFilePath)
        ]).slice(0, 10);

        const sources: BriefSource[] = [
            ...lessons.map((item) => ({
                type: "lesson" as const,
                id: item.id,
                confidence: item.confidence
            })),
            ...knowledge.map((item) => ({
                type: "knowledge" as const,
                id: item.id,
                confidence: item.confidence
            })),
            ...artifacts.map((item) => ({
                type: "artifact" as const,
                id: item.id,
                confidence: item.confidence
            }))
        ];

        const retrievalSignal = Math.min(
            0.35,
            lessons.length * 0.08 + knowledge.length * 0.05 + artifacts.length * 0.04
        );
        const baseConfidence = ai?.confidence ?? fallback.confidence;
        const confidence = clamp(baseConfidence + retrievalSignal, 0.15, 0.97);

        const brief: PlanBrief = {
            runId,
            taskType,
            scope,
            architectureNotes,
            knownMistakes,
            filesToInspect,
            verificationPlan,
            confidence,
            sources
        };

        await this.deps.storage.createExecutionRun({
            id: runId,
            projectId: this.deps.projectId,
            prompt: request.prompt,
            taskType,
            scope,
            status: "planned",
            briefPayload: brief,
            resultSummary: null
        });

        const output: PlanOutput = {
            ...brief,
            storageMode: this.deps.storage.getMode(),
            generatedAt: (this.deps.now?.() ?? new Date()).toISOString()
        };

        planOutputSchema.parse(output);

        if (request.writeArtifact ?? true) {
            await this.deps.artifactManager.writePlanArtifact(output);
        }

        return {
            output,
            markdown: renderPlanMarkdown(output)
        };
    }
}
