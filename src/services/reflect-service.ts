import { basename } from "node:path";

import { analyzeReflectionFallback, classifyKnowledgeType } from "../core/reflection.js";
import { renderReflectionMarkdown } from "../core/markdown.js";
import { reflectionOutputSchema } from "../contracts.js";
import type { PlanningAssistant } from "../adapters/groq.js";
import type { ArtifactManager } from "../core/artifacts.js";
import type { MemoryStorage } from "../storage/types.js";
import type { NormalizedLesson, ReflectionOutput } from "../types.js";

export interface ReflectServiceDeps {
    storage: MemoryStorage;
    assistant: PlanningAssistant;
    artifactManager: ArtifactManager;
    projectId: string;
    now?: () => Date;
}

export interface ReflectRequest {
    runId: string;
    resultText: string;
    writeArtifact?: boolean;
}

export interface ReflectResponse {
    output: ReflectionOutput;
    markdown: string;
}

function unique(values: string[]): string[] {
    return [...new Set(values.filter(Boolean))];
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function normalizeLessons(
    rawLessons: NormalizedLesson[],
    context: { taskType: NormalizedLesson["taskType"]; scope: string[] }
): NormalizedLesson[] {
    const byText = new Map<string, NormalizedLesson>();

    for (const lesson of rawLessons) {
        const lessonText = lesson.lessonText.trim();
        if (!lessonText) {
            continue;
        }

        const key = lessonText.toLowerCase();
        if (!byText.has(key)) {
            const severity =
                lesson.severity === "low" || lesson.severity === "medium" || lesson.severity === "high"
                    ? lesson.severity
                    : "medium";

            byText.set(key, {
                lessonText,
                scope: lesson.scope.length > 0 ? unique(lesson.scope) : context.scope,
                taskType: lesson.taskType || context.taskType,
                severity,
                confidence: clamp(lesson.confidence, 0, 1)
            });
        }
    }

    return [...byText.values()].slice(0, 8);
}

export class ReflectService {
    constructor(private readonly deps: ReflectServiceDeps) { }

    async runReflection(request: ReflectRequest): Promise<ReflectResponse> {
        const run = await this.deps.storage.getExecutionRun(request.runId);
        if (!run) {
            throw new Error(`Run ${request.runId} was not found.`);
        }

        const fallback = analyzeReflectionFallback(request.resultText, {
            taskType: run.taskType,
            scope: run.scope
        });
        const ai = await this.deps.assistant.analyzeReflection({
            resultText: request.resultText,
            taskType: run.taskType,
            scope: run.scope
        });

        const summary = ai?.summary?.trim() || fallback.summary;
        const status = ai?.status ?? fallback.status;
        const confidence = clamp(ai?.confidence ?? fallback.confidence, 0, 1);
        const shouldPersist = ai?.shouldPersist ?? fallback.shouldPersist;
        const newLessons = normalizeLessons([...(ai?.newLessons ?? []), ...fallback.newLessons], {
            taskType: run.taskType,
            scope: run.scope
        });
        const updatedKnowledge = unique([...(ai?.updatedKnowledge ?? []), ...fallback.updatedKnowledge]).slice(0, 8);

        if (shouldPersist && newLessons.length > 0) {
            await this.deps.storage.insertLessons(
                newLessons.map((lesson) => ({
                    ...lesson,
                    projectId: this.deps.projectId,
                    sourceRunId: run.id
                }))
            );
        }

        if (shouldPersist && updatedKnowledge.length > 0) {
            await this.deps.storage.upsertKnowledge(
                updatedKnowledge.map((note) => ({
                    projectId: this.deps.projectId,
                    noteType: classifyKnowledgeType(note),
                    noteText: note,
                    scope: run.scope,
                    confidence
                }))
            );
        }

        const files = unique(run.briefPayload?.filesToInspect ?? []).slice(0, 6);
        if (files.length > 0) {
            await this.deps.storage.upsertArtifactSummaries(
                files.map((filePath) => ({
                    projectId: this.deps.projectId,
                    filePath,
                    moduleName: basename(filePath),
                    summary,
                    scope: run.scope,
                    confidence
                }))
            );
        }

        await this.deps.storage.updateExecutionRun(request.runId, {
            status,
            resultSummary: summary
        });

        const output: ReflectionOutput = {
            runId: request.runId,
            summary,
            newLessons,
            updatedKnowledge,
            shouldPersist,
            confidence,
            storageMode: this.deps.storage.getMode(),
            generatedAt: (this.deps.now?.() ?? new Date()).toISOString()
        };

        reflectionOutputSchema.parse(output);

        if (request.writeArtifact ?? true) {
            await this.deps.artifactManager.writeReflectionArtifact(output);
        }

        return {
            output,
            markdown: renderReflectionMarkdown(output)
        };
    }
}
