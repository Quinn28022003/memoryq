import { basename } from "node:path";

import { analyzeReflectionFallback, classifyKnowledgeType } from "../core/reflection.js";
import { renderReflectionMarkdown } from "../core/markdown.js";
import { reflectionOutputSchema } from "../contracts.js";
import type { EmbeddingAdapter } from "../adapters/embeddings.js";
import type { PlanningAssistant } from "../adapters/groq.js";
import type { ArtifactManager } from "../core/artifacts.js";
import type { MemoryEmbeddingUpsert, MemoryStorage } from "../storage/types.js";
import type {
    CodeArtifactSummaryRecord,
    MemoryOwnerType,
    MemoryScene,
    NormalizedLesson,
    ProjectKnowledgeRecord,
    ProjectLessonRecord,
    ReflectionOutput,
    SourceType,
    TaskType
} from "../types.js";

export interface ReflectServiceDeps {
    storage: MemoryStorage;
    assistant: PlanningAssistant;
    embedder?: EmbeddingAdapter;
    artifactManager: ArtifactManager;
    projectId: string;
    ownerType?: MemoryOwnerType;
    ownerId?: string;
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

function defaultScene(text: string): MemoryScene[] {
    const content = text.trim();
    return content ? [{ label: "Scene", content }] : [];
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
                lesson.severity === "low" ||
                lesson.severity === "medium" ||
                lesson.severity === "high"
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
    constructor(private readonly deps: ReflectServiceDeps) {}

    private async createMemoryEmbeddings(input: {
        sourceType: SourceType;
        sourceId: string;
        text: string;
        scope: string[];
        taskType: TaskType | null;
        confidence: number;
        metadata?: Record<string, unknown>;
    }): Promise<MemoryEmbeddingUpsert[]> {
        if (!this.deps.embedder) {
            return [];
        }

        const modelScenes = await this.deps.assistant.extractMemoryScenes({
            text: input.text,
            sourceType: input.sourceType,
            scope: input.scope,
            taskType: input.taskType
        });
        const scenes = (
            modelScenes && modelScenes.length > 0 ? modelScenes : defaultScene(input.text)
        )
            .filter((scene) => scene.content.trim().length > 0)
            .slice(0, 8);

        const embeddings = await Promise.all(
            scenes.map((scene) =>
                this.deps.embedder?.embedText(
                    unique([
                        scene.label,
                        scene.content,
                        ...input.scope,
                        input.taskType ?? input.sourceType
                    ]).join("\n")
                )
            )
        );

        const entries: MemoryEmbeddingUpsert[] = [];

        scenes.forEach((scene, index) => {
            const embedding = embeddings[index];
            if (!embedding) {
                return;
            }

            entries.push({
                projectId: this.deps.projectId,
                ownerType: this.deps.ownerType ?? "project",
                ownerId: this.deps.ownerId ?? this.deps.projectId,
                sourceType: input.sourceType,
                sourceId: input.sourceId,
                chunkIndex: index,
                sceneLabel: scene.label || `Scene ${index + 1}`,
                content: scene.content,
                scope: input.scope,
                taskType: input.taskType,
                confidence: input.confidence,
                embedding,
                metadata: input.metadata
            });
        });

        return entries;
    }

    private async persistMemoryEmbeddings(entries: MemoryEmbeddingUpsert[]): Promise<void> {
        if (entries.length > 0) {
            await this.deps.storage.upsertMemoryEmbeddings(entries);
        }
    }

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
        const updatedKnowledge = unique([
            ...(ai?.updatedKnowledge ?? []),
            ...fallback.updatedKnowledge
        ]).slice(0, 8);

        if (shouldPersist && newLessons.length > 0) {
            const insertedLessons = await this.deps.storage.insertLessons(
                newLessons.map((lesson) => ({
                    ...lesson,
                    projectId: this.deps.projectId,
                    sourceRunId: run.id
                }))
            );
            const memoryEntries = await Promise.all(
                insertedLessons.map((lesson: ProjectLessonRecord) =>
                    this.createMemoryEmbeddings({
                        sourceType: "lesson",
                        sourceId: lesson.id,
                        text: lesson.lessonText,
                        scope: lesson.scope,
                        taskType: lesson.taskType,
                        confidence: lesson.confidence,
                        metadata: {
                            severity: lesson.severity,
                            sourceRunId: lesson.sourceRunId
                        }
                    })
                )
            );
            await this.persistMemoryEmbeddings(memoryEntries.flat());
        }

        if (shouldPersist && updatedKnowledge.length > 0) {
            const upsertedKnowledge = await this.deps.storage.upsertKnowledge(
                updatedKnowledge.map((note) => ({
                    projectId: this.deps.projectId,
                    noteType: classifyKnowledgeType(note),
                    noteText: note,
                    scope: run.scope,
                    confidence
                }))
            );
            const memoryEntries = await Promise.all(
                upsertedKnowledge.map((note: ProjectKnowledgeRecord) =>
                    this.createMemoryEmbeddings({
                        sourceType: "knowledge",
                        sourceId: note.id,
                        text: note.noteText,
                        scope: note.scope,
                        taskType: run.taskType,
                        confidence: note.confidence,
                        metadata: {
                            noteType: note.noteType,
                            sourceRunId: run.id
                        }
                    })
                )
            );
            await this.persistMemoryEmbeddings(memoryEntries.flat());
        }

        const files = unique(run.briefPayload?.filesToInspect ?? []).slice(0, 6);
        if (files.length > 0) {
            const upsertedArtifacts = await this.deps.storage.upsertArtifactSummaries(
                files.map((filePath) => ({
                    projectId: this.deps.projectId,
                    filePath,
                    moduleName: basename(filePath),
                    summary,
                    scope: run.scope,
                    confidence
                }))
            );
            const memoryEntries = await Promise.all(
                upsertedArtifacts.map((artifact: CodeArtifactSummaryRecord) =>
                    this.createMemoryEmbeddings({
                        sourceType: "artifact",
                        sourceId: artifact.id,
                        text: unique([artifact.filePath, artifact.summary]).join("\n"),
                        scope: artifact.scope,
                        taskType: run.taskType,
                        confidence: artifact.confidence,
                        metadata: {
                            filePath: artifact.filePath,
                            moduleName: artifact.moduleName,
                            sourceRunId: run.id
                        }
                    })
                )
            );
            await this.persistMemoryEmbeddings(memoryEntries.flat());
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
