import { basename, isAbsolute, join } from "node:path";
import { readFile } from "node:fs/promises";

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
import type {
    ArtifactSummaryUpsert,
    MemoryEmbeddingUpsert,
    MemoryStorage
} from "../storage/types.js";
import { canonicalizePath } from "../utils/paths.js";
import type {
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
    rootDir: string;
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

        const newLessons: NormalizedLesson[] = [];
        const updatedKnowledge = candidateKnowledge;
        const shouldPersist =
            requestedPersist && (candidateLessons.length > 0 || updatedKnowledge.length > 0);

        if (shouldPersist && candidateLessons.length > 0) {
            // Embed all candidate lessons to check for semantic duplicates and for storage
            const lessonsWithEmbeddings = await Promise.all(
                candidateLessons.map(async (lesson) => {
                    const sceneEmbeddings = await this.embedScenes({
                        sourceType: "lesson",
                        text: lesson.lessonText,
                        scope: lesson.scope,
                        taskType: lesson.taskType
                    });
                    return {
                        ...lesson,
                        embedding: sceneEmbeddings[0]?.embedding
                    };
                })
            );

            // Prepare for upsert and identify truly new lessons for the output
            const lessonsToUpsert = await Promise.all(
                lessonsWithEmbeddings.map(async (lesson) => {
                    if (lesson.embedding) {
                        const duplicate = await this.findPersistedSemanticDuplicate({
                            sourceType: "lesson",
                            embeddings: [lesson.embedding]
                        });

                        if (duplicate) {
                            return {
                                ...lesson,
                                projectId: this.deps.projectId,
                                sourceRunId: run.id,
                                lessonKey:
                                    lesson.lessonKey ||
                                    (duplicate.metadata?.lessonKey as string) ||
                                    duplicate.sourceId
                            };
                        }
                    }

                    // If not a duplicate, add to the output.newLessons
                    newLessons.push(lesson);

                    return {
                        ...lesson,
                        projectId: this.deps.projectId,
                        sourceRunId: run.id
                    };
                })
            );

            const upsertedLessons = await this.deps.storage.upsertLessons(lessonsToUpsert);

            // Persist memory embeddings for search (chunked scenes)
            const memoryEntries = await Promise.all(
                upsertedLessons.map((lesson: ProjectLessonRecord) =>
                    this.createMemoryEmbeddings({
                        sourceType: "lesson",
                        sourceId: lesson.id,
                        text: lesson.lessonText,
                        scope: lesson.scope,
                        taskType: lesson.taskType,
                        confidence: lesson.confidence,
                        metadata: {
                            severity: lesson.severity,
                            sourceRunId: lesson.sourceRunId,
                            lessonKey: lesson.lessonKey
                        }
                    })
                )
            );
            await this.persistMemoryEmbeddings(memoryEntries.flat());
        } else if (!shouldPersist) {
            newLessons.push(...candidateLessons);
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

        const rawFiles = unique(run.briefPayload?.filesToInspect ?? []).slice(0, 10);
        if (rawFiles.length > 0) {
            const filesWithContent = await Promise.all(
                rawFiles.map(async (filePath) => {
                    const canonical = canonicalizePath(filePath, this.deps.rootDir);
                    let content: string | undefined;
                    try {
                        const fullPath = isAbsolute(filePath)
                            ? filePath
                            : join(this.deps.rootDir, filePath);
                        content = await readFile(fullPath, "utf8");
                    } catch {
                        // Ignore read errors
                    }
                    return { filePath: canonical, content };
                })
            );

            const artifactSummaries = await this.deps.assistant.summarizeArtifacts({
                files: filesWithContent,
                runSummary: summary,
                taskType: run.taskType,
                scope: run.scope
            });

            const entriesToUpsert: ArtifactSummaryUpsert[] = (artifactSummaries || []).map(
                (art) => ({
                    projectId: this.deps.projectId,
                    filePath: art.filePath,
                    moduleName: art.moduleName,
                    summary: art.summary,
                    scope: art.scope.length > 0 ? unique(art.scope) : run.scope,
                    confidence: art.confidence
                })
            );

            // If AI failed, fallback to generic summaries for all files
            if (entriesToUpsert.length === 0) {
                for (const f of filesWithContent) {
                    entriesToUpsert.push({
                        projectId: this.deps.projectId,
                        filePath: f.filePath,
                        moduleName: basename(f.filePath),
                        summary,
                        scope: run.scope,
                        confidence: 0.5
                    });
                }
            }

            const upsertedArtifacts =
                await this.deps.storage.upsertArtifactSummaries(entriesToUpsert);

            for (const artifact of upsertedArtifacts) {
                // Delete existing memory chunks for this artifact to avoid stale entries
                await this.deps.storage.deleteMemoryEmbeddingsForSource("artifact", artifact.id);

                const memoryEntries = await this.createMemoryEmbeddings({
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
                });
                await this.persistMemoryEmbeddings(memoryEntries);
            }
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
