import { randomUUID } from "node:crypto";

import { CAVEMAN_MEMORY_RECORDS } from "../default-data/caveman-memory.js";
import type { EmbeddingAdapter } from "../adapters/embeddings.js";
import type {
    KnowledgeUpsert,
    LessonInsert,
    MemoryEmbeddingUpsert,
    MemoryStorage
} from "../storage/types.js";
import type { MemoryOwnerType, StorageMode } from "../types.js";

export interface SeedServiceDeps {
    storage: MemoryStorage;
    embedder?: EmbeddingAdapter;
    projectId: string;
    ownerType?: MemoryOwnerType;
    ownerId?: string;
    rootDir?: string;
    now?: () => Date;
}

export interface SeedResult {
    seedRunId: string;
    seedName: "caveman";
    createdOrUpdatedLessons: number;
    createdOrUpdatedKnowledge: number;
    createdOrUpdatedEmbeddings: number;
    skippedEmbeddings: number;
    storageMode: StorageMode;
    generatedAt: string;
}

export class SeedService {
    constructor(private readonly deps: SeedServiceDeps) {}

    async seedCaveman(): Promise<SeedResult> {
        const runId = randomUUID();
        const now = (this.deps.now?.() ?? new Date()).toISOString();
        const lessonRecords = CAVEMAN_MEMORY_RECORDS.filter((record) => record.kind === "lesson");
        const knowledgeRecords = CAVEMAN_MEMORY_RECORDS.filter(
            (record) => record.kind === "knowledge"
        );

        await this.deps.storage.createExecutionRun({
            id: runId,
            projectId: this.deps.projectId,
            prompt: "Seed Caveman token and context optimization memory catalog",
            taskType: "general",
            scope: ["token-management", "context-management", "caveman"],
            status: "completed",
            briefPayload: null,
            resultSummary: "Seeded broad Caveman-derived lessons and knowledge."
        });

        const lessonsToInsert: LessonInsert[] = lessonRecords.map((record) => ({
            projectId: this.deps.projectId,
            sourceRunId: runId,
            lessonKey: record.key,
            lessonText: record.text,
            scope: record.scope,
            taskType: record.taskType,
            severity: record.severity,
            confidence: record.confidence
        }));
        const seededLessons = await this.deps.storage.upsertLessons(lessonsToInsert);

        const knowledgeToUpsert: KnowledgeUpsert[] = knowledgeRecords.map((record) => ({
            projectId: this.deps.projectId,
            noteType: record.noteType,
            noteText: record.text,
            scope: record.scope,
            confidence: record.confidence
        }));
        const seededKnowledge = await this.deps.storage.upsertKnowledge(knowledgeToUpsert);

        let createdEmbeddings = 0;
        let skippedEmbeddings = 0;

        if (this.deps.embedder) {
            const embeddingEntries: MemoryEmbeddingUpsert[] = [];

            for (const lesson of seededLessons) {
                const record = CAVEMAN_MEMORY_RECORDS.find((r) => r.key === lesson.lessonKey);
                const embeddingContent = [
                    `Lesson: ${lesson.lessonText}`,
                    `Scope: ${lesson.scope.join(", ")}`,
                    `Task: ${lesson.taskType}`
                ].join("\n");

                const embedding = await this.deps.embedder.embedText(embeddingContent);
                embeddingEntries.push({
                    projectId: this.deps.projectId,
                    ownerType: this.deps.ownerType ?? "project",
                    ownerId: this.deps.ownerId ?? this.deps.projectId,
                    sourceType: "lesson",
                    sourceId: lesson.id,
                    chunkIndex: 0,
                    sceneLabel: lesson.lessonKey || "lesson",
                    content: embeddingContent,
                    scope: lesson.scope,
                    taskType: lesson.taskType,
                    confidence: lesson.confidence,
                    embedding,
                    metadata: {
                        key: lesson.lessonKey,
                        seedRunId: runId,
                        parentKey: record?.parentKey,
                        conceptKey: record?.conceptKey
                    }
                });
            }

            for (const knowledge of seededKnowledge) {
                const record = CAVEMAN_MEMORY_RECORDS.find(
                    (r) => r.kind === "knowledge" && r.text === knowledge.noteText
                );
                const embeddingContent = [
                    `Knowledge: ${knowledge.noteText}`,
                    `Type: ${knowledge.noteType}`,
                    `Scope: ${knowledge.scope.join(", ")}`
                ].join("\n");

                const embedding = await this.deps.embedder.embedText(embeddingContent);
                embeddingEntries.push({
                    projectId: this.deps.projectId,
                    ownerType: this.deps.ownerType ?? "project",
                    ownerId: this.deps.ownerId ?? this.deps.projectId,
                    sourceType: "knowledge",
                    sourceId: knowledge.id,
                    chunkIndex: 0,
                    sceneLabel: "knowledge",
                    content: embeddingContent,
                    scope: knowledge.scope,
                    taskType: null,
                    confidence: knowledge.confidence,
                    embedding,
                    metadata: {
                        seedRunId: runId,
                        noteType: knowledge.noteType,
                        parentKey: record?.parentKey,
                        conceptKey: record?.conceptKey
                    }
                });
            }

            if (embeddingEntries.length > 0) {
                await this.deps.storage.upsertMemoryEmbeddings(embeddingEntries);
                createdEmbeddings = embeddingEntries.length;
            }
        } else {
            skippedEmbeddings = seededLessons.length + seededKnowledge.length;
        }

        return {
            seedRunId: runId,
            seedName: "caveman",
            createdOrUpdatedLessons: seededLessons.length,
            createdOrUpdatedKnowledge: seededKnowledge.length,
            createdOrUpdatedEmbeddings: createdEmbeddings,
            skippedEmbeddings,
            storageMode: this.deps.storage.getMode(),
            generatedAt: now
        };
    }
}
