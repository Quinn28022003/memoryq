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
        const lessonMetadataByKey = new Map(lessonRecords.map((record) => [record.key, record]));
        const knowledgeMetadataByText = new Map(
            knowledgeRecords.map((record) => [record.text.toLowerCase(), record])
        );

        await this.deps.storage.createExecutionRun({
            id: runId,
            projectId: this.deps.projectId,
            prompt: "Seed Caveman token and context optimization memory catalog",
            taskType: "general",
            scope: ["token-management", "context-management", "caveman"],
            status: "completed",
            briefPayload: null,
            resultSummary: "Seeded broad Caveman-derived lessons, knowledge, and source metadata."
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
                const source = lesson.lessonKey
                    ? lessonMetadataByKey.get(lesson.lessonKey)
                    : undefined;
                const embeddingContent = [
                    source ? `Source: ${source.sourcePath}` : undefined,
                    lesson.lessonText
                ]
                    .filter(Boolean)
                    .join("\n");
                const embedding = await this.deps.embedder.embedText(embeddingContent);
                embeddingEntries.push({
                    projectId: this.deps.projectId,
                    ownerType: this.deps.ownerType ?? "project",
                    ownerId: this.deps.ownerId ?? this.deps.projectId,
                    sourceType: "lesson",
                    sourceId: lesson.id,
                    chunkIndex: 0,
                    sceneLabel: source ? source.key : "lesson",
                    content: embeddingContent,
                    scope: lesson.scope,
                    taskType: lesson.taskType,
                    confidence: lesson.confidence,
                    embedding,
                    metadata: {
                        key: source?.key ?? lesson.lessonKey,
                        sourcePath: source?.sourcePath,
                        seedRunId: runId
                    }
                });
            }

            for (const knowledge of seededKnowledge) {
                const source = knowledgeMetadataByText.get(knowledge.noteText.toLowerCase());
                const embeddingContent = [
                    source ? `Source: ${source.sourcePath}` : undefined,
                    knowledge.noteText
                ]
                    .filter(Boolean)
                    .join("\n");
                const embedding = await this.deps.embedder.embedText(embeddingContent);
                embeddingEntries.push({
                    projectId: this.deps.projectId,
                    ownerType: this.deps.ownerType ?? "project",
                    ownerId: this.deps.ownerId ?? this.deps.projectId,
                    sourceType: "knowledge",
                    sourceId: knowledge.id,
                    chunkIndex: 0,
                    sceneLabel: source ? source.key : "knowledge",
                    content: embeddingContent,
                    scope: knowledge.scope,
                    taskType: null,
                    confidence: knowledge.confidence,
                    embedding,
                    metadata: {
                        key: source?.key,
                        sourcePath: source?.sourcePath,
                        seedRunId: runId,
                        noteType: knowledge.noteType
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
