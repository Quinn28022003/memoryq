import { basename } from "node:path";

import {
    analyzeReflectionFallback,
    classifyKnowledgeType,
    normalizeMemoryKnowledgeText,
    normalizeMemoryLessonText
} from "../core/reflection.js";
import { renderReflectionMarkdown } from "../core/markdown.js";
import { reflectionOutputSchema } from "../contracts.js";
import type { EmbeddingAdapter } from "../adapters/embeddings.js";
import type { PlanningAssistant } from "../adapters/groq.js";
import type { ArtifactManager } from "../core/artifacts.js";
import type { MemoryEmbeddingUpsert, MemoryStorage } from "../storage/types.js";
import type {
    CodeArtifactSummaryRecord,
    EmbeddingVector,
    MemoryEmbeddingRecord,
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

const SEMANTIC_DUPLICATE_THRESHOLD = 0.88;

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

function cosineSimilarity(left: EmbeddingVector, right: EmbeddingVector): number {
    if (left.length === 0 || right.length === 0 || left.length !== right.length) {
        return 0;
    }

    let dot = 0;
    let leftMagnitude = 0;
    let rightMagnitude = 0;

    for (let index = 0; index < left.length; index += 1) {
        dot += left[index] * right[index];
        leftMagnitude += left[index] * left[index];
        rightMagnitude += right[index] * right[index];
    }

    if (leftMagnitude === 0 || rightMagnitude === 0) {
        return 0;
    }

    return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

function normalizeLessons(
    rawLessons: NormalizedLesson[],
    context: { taskType: NormalizedLesson["taskType"]; scope: string[] }
): NormalizedLesson[] {
    const byText = new Map<string, NormalizedLesson>();

    for (const lesson of rawLessons) {
        const lessonText = normalizeMemoryLessonText(lesson.lessonText);
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

    private async extractScenes(input: {
        sourceType: SourceType;
        text: string;
        scope: string[];
        taskType: TaskType | null;
    }): Promise<MemoryScene[]> {
        const modelScenes = await this.deps.assistant.extractMemoryScenes({
            text: input.text,
            sourceType: input.sourceType,
            scope: input.scope,
            taskType: input.taskType
        });

        return (modelScenes && modelScenes.length > 0 ? modelScenes : defaultScene(input.text))
            .filter((scene) => scene.content.trim().length > 0)
            .slice(0, 8);
    }

    private async embedScenes(input: {
        sourceType: SourceType;
        text: string;
        scope: string[];
        taskType: TaskType | null;
    }): Promise<Array<{ scene: MemoryScene; embedding: EmbeddingVector }>> {
        if (!this.deps.embedder) {
            return [];
        }

        const scenes = await this.extractScenes(input);
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

        return scenes.flatMap((scene, index) => {
            const embedding = embeddings[index];
            return embedding ? [{ scene, embedding }] : [];
        });
    }

    private hasAcceptedSemanticDuplicate(
        candidateEmbeddings: EmbeddingVector[],
        acceptedEmbeddings: EmbeddingVector[]
    ): boolean {
        return candidateEmbeddings.some((candidate) =>
            acceptedEmbeddings.some(
                (accepted) => cosineSimilarity(candidate, accepted) >= SEMANTIC_DUPLICATE_THRESHOLD
            )
        );
    }

    private async findPersistedSemanticDuplicate(input: {
        sourceType: SourceType;
        embeddings: EmbeddingVector[];
    }): Promise<MemoryEmbeddingRecord | null> {
        for (const embedding of input.embeddings) {
            const matches = await this.deps.storage.queryMemoryEmbeddings({
                projectId: this.deps.projectId,
                ownerType: this.deps.ownerType ?? "project",
                ownerId: this.deps.ownerId ?? this.deps.projectId,
                sourceType: input.sourceType,
                embedding,
                limit: 1,
                threshold: SEMANTIC_DUPLICATE_THRESHOLD
            });

            if (matches.length > 0) {
                return matches[0];
            }
        }

        return null;
    }

    private async filterSemanticDuplicateLessons(
        lessons: NormalizedLesson[],
        context: { taskType: TaskType; scope: string[] }
    ): Promise<NormalizedLesson[]> {
        const accepted: NormalizedLesson[] = [];
        const acceptedEmbeddings: EmbeddingVector[] = [];

        for (const lesson of lessons) {
            const sceneEmbeddings = await this.embedScenes({
                sourceType: "lesson",
                text: lesson.lessonText,
                scope: lesson.scope.length > 0 ? lesson.scope : context.scope,
                taskType: lesson.taskType || context.taskType
            });
            const embeddings = sceneEmbeddings.map((entry) => entry.embedding);

            if (
                embeddings.length > 0 &&
                (this.hasAcceptedSemanticDuplicate(embeddings, acceptedEmbeddings) ||
                    (await this.findPersistedSemanticDuplicate({
                        sourceType: "lesson",
                        embeddings
                    })))
            ) {
                continue;
            }

            accepted.push(lesson);
            acceptedEmbeddings.push(...embeddings);
        }

        return accepted;
    }

    private async filterSemanticDuplicateKnowledge(
        notes: string[],
        context: { taskType: TaskType; scope: string[] }
    ): Promise<string[]> {
        const accepted: string[] = [];
        const acceptedEmbeddings: EmbeddingVector[] = [];

        for (const note of notes) {
            const sceneEmbeddings = await this.embedScenes({
                sourceType: "knowledge",
                text: note,
                scope: context.scope,
                taskType: context.taskType
            });
            const embeddings = sceneEmbeddings.map((entry) => entry.embedding);

            if (
                embeddings.length > 0 &&
                (this.hasAcceptedSemanticDuplicate(embeddings, acceptedEmbeddings) ||
                    (await this.findPersistedSemanticDuplicate({
                        sourceType: "knowledge",
                        embeddings
                    })))
            ) {
                continue;
            }

            accepted.push(note);
            acceptedEmbeddings.push(...embeddings);
        }

        return accepted;
    }

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

        const sceneEmbeddings = await this.embedScenes(input);
        const entries: MemoryEmbeddingUpsert[] = [];

        sceneEmbeddings.forEach(({ scene, embedding }, index) => {
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
        const requestedPersist = ai?.shouldPersist ?? fallback.shouldPersist;
        const candidateLessons = normalizeLessons(
            [...(ai?.newLessons ?? []), ...fallback.newLessons],
            {
                taskType: run.taskType,
                scope: run.scope
            }
        );
        const candidateKnowledge = unique(
            [...(ai?.updatedKnowledge ?? []), ...fallback.updatedKnowledge].flatMap((note) => {
                const normalized = normalizeMemoryKnowledgeText(note);
                return normalized ? [normalized] : [];
            })
        ).slice(0, 8);
        const newLessons = requestedPersist
            ? await this.filterSemanticDuplicateLessons(candidateLessons, {
                  taskType: run.taskType,
                  scope: run.scope
              })
            : candidateLessons;
        const updatedKnowledge = requestedPersist
            ? await this.filterSemanticDuplicateKnowledge(candidateKnowledge, {
                  taskType: run.taskType,
                  scope: run.scope
              })
            : candidateKnowledge;
        const shouldPersist =
            requestedPersist && (newLessons.length > 0 || updatedKnowledge.length > 0);

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
