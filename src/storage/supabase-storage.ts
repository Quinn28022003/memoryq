import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type {
    ArtifactQuery,
    ArtifactSummaryUpsert,
    ExecutionRunInsert,
    ExecutionRunUpdate,
    KnowledgeQuery,
    KnowledgeUpsert,
    MemoryEmbeddingQuery,
    MemoryEmbeddingUpsert,
    LessonInsert,
    LessonQuery,
    MemoryStorage
} from "./types.js";
import type {
    CodeArtifactSummaryRecord,
    ExecutionRunRecord,
    MemoryEmbeddingRecord,
    MemoryOwnerType,
    ProjectKnowledgeRecord,
    ProjectLessonRecord,
    SourceType,
    StorageMode,
    TaskType
} from "../types.js";

type JsonObject = Record<string, unknown>;

function asArray(value: unknown): string[] {
    return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function stringValue(row: JsonObject, key: string): string {
    const value = row[key];
    return value === null || value === undefined ? "" : String(value);
}

function numberValue(row: JsonObject, key: string): number {
    const value = row[key];
    if (typeof value === "number") {
        return value;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function embeddingValue(row: JsonObject, key: string): number[] {
    const value = row[key];
    if (Array.isArray(value)) {
        return value.map((item) => Number(item)).filter((item) => Number.isFinite(item));
    }

    if (typeof value !== "string") {
        return [];
    }

    const trimmed = value.trim();
    if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
        return [];
    }

    const parsed = trimmed
        .slice(1, -1)
        .split(",")
        .map((item) => Number(item.trim()))
        .filter((item) => Number.isFinite(item));

    return parsed;
}

function normalizeTaskType(value: string): TaskType {
    const allowed: TaskType[] = [
        "bugfix",
        "feature",
        "refactor",
        "test",
        "docs",
        "infra",
        "general"
    ];
    return allowed.includes(value as TaskType) ? (value as TaskType) : "general";
}

function keywordMatches(text: string, keywords: string[]): boolean {
    if (keywords.length === 0) {
        return true;
    }

    const lower = text.toLowerCase();
    return keywords.some((keyword) => lower.includes(keyword.toLowerCase()));
}

function mapRun(row: JsonObject): ExecutionRunRecord {
    return {
        id: stringValue(row, "id"),
        projectId: stringValue(row, "project_id"),
        prompt: stringValue(row, "prompt"),
        taskType: normalizeTaskType(stringValue(row, "task_type")),
        scope: asArray(row["scope"]),
        status: (stringValue(row, "status") as ExecutionRunRecord["status"]) || "planned",
        briefPayload: (row["brief_payload"] as ExecutionRunRecord["briefPayload"]) ?? null,
        resultSummary: (row["result_summary"] as string | null) ?? null,
        createdAt: stringValue(row, "created_at"),
        updatedAt: stringValue(row, "updated_at")
    };
}

function mapLesson(row: JsonObject): ProjectLessonRecord {
    return {
        id: stringValue(row, "id"),
        projectId: stringValue(row, "project_id"),
        lessonText: stringValue(row, "lesson_text"),
        lessonKey: row["lesson_key"] ? stringValue(row, "lesson_key") : undefined,
        scope: asArray(row["scope"]),
        taskType: normalizeTaskType(stringValue(row, "task_type")),
        severity: (stringValue(row, "severity") as ProjectLessonRecord["severity"]) || "medium",
        confidence: numberValue(row, "confidence"),
        sourceRunId: stringValue(row, "source_run_id"),
        reuseCount: numberValue(row, "reuse_count"),
        embedding: row["embedding"] ? embeddingValue(row, "embedding") : undefined,
        createdAt: stringValue(row, "created_at"),
        updatedAt: stringValue(row, "updated_at")
    };
}

function mapKnowledge(row: JsonObject): ProjectKnowledgeRecord {
    return {
        id: stringValue(row, "id"),
        projectId: stringValue(row, "project_id"),
        noteType:
            (stringValue(row, "note_type") as ProjectKnowledgeRecord["noteType"]) || "architecture",
        noteText: stringValue(row, "note_text"),
        scope: asArray(row["scope"]),
        confidence: numberValue(row, "confidence"),
        createdAt: stringValue(row, "created_at"),
        updatedAt: stringValue(row, "updated_at")
    };
}

function mapArtifact(row: JsonObject): CodeArtifactSummaryRecord {
    return {
        id: stringValue(row, "id"),
        projectId: stringValue(row, "project_id"),
        filePath: stringValue(row, "file_path"),
        moduleName: stringValue(row, "module_name"),
        summary: stringValue(row, "summary"),
        scope: asArray(row["scope"]),
        confidence: numberValue(row, "confidence"),
        updatedAt: stringValue(row, "updated_at")
    };
}

function normalizeOwnerType(value: string): MemoryOwnerType {
    const allowed: MemoryOwnerType[] = ["project", "agent", "user"];
    return allowed.includes(value as MemoryOwnerType) ? (value as MemoryOwnerType) : "project";
}

function mapMemoryEmbedding(row: JsonObject): MemoryEmbeddingRecord {
    return {
        id: stringValue(row, "id"),
        projectId: stringValue(row, "project_id"),
        ownerType: normalizeOwnerType(stringValue(row, "owner_type")),
        ownerId: stringValue(row, "owner_id"),
        sourceType:
            (stringValue(row, "source_type") as MemoryEmbeddingRecord["sourceType"]) || "lesson",
        sourceId: stringValue(row, "source_id"),
        chunkIndex: numberValue(row, "chunk_index"),
        sceneLabel: stringValue(row, "scene_label"),
        content: stringValue(row, "content"),
        scope: asArray(row["scope"]),
        taskType: stringValue(row, "task_type")
            ? normalizeTaskType(stringValue(row, "task_type"))
            : null,
        confidence: numberValue(row, "confidence"),
        embedding: embeddingValue(row, "embedding"),
        metadata: (row["metadata"] as Record<string, unknown> | null) ?? {},
        createdAt: stringValue(row, "created_at"),
        updatedAt: stringValue(row, "updated_at")
    };
}

export class SupabaseStorageAdapter implements MemoryStorage {
    readonly mode: StorageMode = "supabase";

    private readonly client: SupabaseClient;

    constructor(url: string, serviceRoleKey: string) {
        this.client = createClient(url, serviceRoleKey, {
            auth: {
                persistSession: false
            }
        });
    }

    getMode(): StorageMode {
        return this.mode;
    }

    async createExecutionRun(input: ExecutionRunInsert): Promise<ExecutionRunRecord> {
        const { data, error } = await this.client
            .from("execution_runs")
            .insert({
                id: input.id,
                project_id: input.projectId,
                prompt: input.prompt,
                task_type: input.taskType,
                scope: input.scope,
                status: input.status,
                brief_payload: input.briefPayload,
                result_summary: input.resultSummary ?? null
            })
            .select("*")
            .single();

        if (error || !data) {
            throw new Error(
                `Supabase createExecutionRun failed: ${error?.message ?? "unknown error"}`
            );
        }

        return mapRun(data as JsonObject);
    }

    async updateExecutionRun(runId: string, update: ExecutionRunUpdate): Promise<void> {
        const patch: JsonObject = {
            updated_at: new Date().toISOString()
        };

        if (update.status !== undefined) {
            patch.status = update.status;
        }
        if (update.resultSummary !== undefined) {
            patch.result_summary = update.resultSummary;
        }
        if (update.briefPayload !== undefined) {
            patch.brief_payload = update.briefPayload;
        }

        const { error } = await this.client.from("execution_runs").update(patch).eq("id", runId);

        if (error) {
            throw new Error(`Supabase updateExecutionRun failed: ${error.message}`);
        }
    }

    async getExecutionRun(runId: string): Promise<ExecutionRunRecord | null> {
        const { data, error } = await this.client
            .from("execution_runs")
            .select("*")
            .eq("id", runId)
            .maybeSingle();

        if (error) {
            throw new Error(`Supabase getExecutionRun failed: ${error.message}`);
        }

        return data ? mapRun(data as JsonObject) : null;
    }

    async queryLessons(query: LessonQuery): Promise<ProjectLessonRecord[]> {
        if (query.embedding) {
            const matchedMemory = await this.queryMemoryEmbeddings({
                projectId: query.projectId,
                ownerType: query.ownerType,
                ownerId: query.ownerId,
                sourceType: "lesson",
                embedding: query.embedding,
                limit: query.limit * 2, // Query more to allow for grouping
                threshold: 0.1
            });

            if (matchedMemory.length > 0) {
                // Group by parentKey and pick the best (first) one
                const bestPerParent = new Map<string, MemoryEmbeddingRecord>();
                const finalMemory: MemoryEmbeddingRecord[] = [];

                for (const memory of matchedMemory) {
                    const parentKey = memory.metadata?.parentKey as string | undefined;
                    if (parentKey) {
                        if (!bestPerParent.has(parentKey)) {
                            bestPerParent.set(parentKey, memory);
                            finalMemory.push(memory);
                        }
                    } else {
                        finalMemory.push(memory);
                    }

                    if (finalMemory.length >= query.limit) {
                        break;
                    }
                }

                const ids = finalMemory.map((memory) => memory.sourceId);
                const { data, error } = await this.client
                    .from("project_lessons")
                    .select("*")
                    .in("id", ids);

                if (!error && data) {
                    const order = new Map(ids.map((id, index) => [id, index]));
                    const matched = data
                        .map((row) => mapLesson(row as JsonObject))
                        .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

                    if (matched.length > 0) {
                        const lessonIds = matched.map((item) => item.id);
                        await this.client
                            .rpc("increment_lesson_reuse_count", { lesson_ids: lessonIds })
                            .throwOnError();
                        return matched;
                    }
                }
            }
        }

        let request = this.client
            .from("project_lessons")
            .select("*")
            .eq("project_id", query.projectId)
            .gte("confidence", 0.3)
            .order("reuse_count", { ascending: false })
            .order("confidence", { ascending: false })
            .limit(query.limit * 2);

        if (query.taskType !== "general") {
            request = request.in("task_type", [query.taskType, "general"]);
        }

        if (query.scope.length > 0) {
            request = request.overlaps("scope", query.scope);
        }

        const { data, error } = await request;

        if (error) {
            throw new Error(`Supabase queryLessons failed: ${error.message}`);
        }

        const mapped = (data ?? []).map((row) => mapLesson(row as JsonObject));
        const filtered = mapped
            .filter((row) => keywordMatches(row.lessonText, query.keywords))
            .slice(0, query.limit);

        if (filtered.length > 0) {
            const ids = filtered.map((item) => item.id);
            await this.client
                .rpc("increment_lesson_reuse_count", { lesson_ids: ids })
                .throwOnError();
        }

        return filtered;
    }

    async queryKnowledge(query: KnowledgeQuery): Promise<ProjectKnowledgeRecord[]> {
        if (query.embedding) {
            const matchedMemory = await this.queryMemoryEmbeddings({
                projectId: query.projectId,
                ownerType: query.ownerType,
                ownerId: query.ownerId,
                sourceType: "knowledge",
                embedding: query.embedding,
                limit: query.limit * 2, // Query more to allow for grouping
                threshold: 0.1
            });

            if (matchedMemory.length > 0) {
                // Group by parentKey and pick the best (first) one
                const bestPerParent = new Map<string, MemoryEmbeddingRecord>();
                const finalMemory: MemoryEmbeddingRecord[] = [];

                for (const memory of matchedMemory) {
                    const parentKey = memory.metadata?.parentKey as string | undefined;
                    if (parentKey) {
                        if (!bestPerParent.has(parentKey)) {
                            bestPerParent.set(parentKey, memory);
                            finalMemory.push(memory);
                        }
                    } else {
                        finalMemory.push(memory);
                    }

                    if (finalMemory.length >= query.limit) {
                        break;
                    }
                }

                const ids = finalMemory.map((memory) => memory.sourceId);
                const { data, error } = await this.client
                    .from("project_knowledge")
                    .select("*")
                    .in("id", ids);

                if (!error && data) {
                    const order = new Map(ids.map((id, index) => [id, index]));
                    const matched = data
                        .map((row) => mapKnowledge(row as JsonObject))
                        .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

                    if (matched.length > 0) {
                        return matched;
                    }
                }
            }
        }

        let request = this.client
            .from("project_knowledge")
            .select("*")
            .eq("project_id", query.projectId)
            .gte("confidence", 0.3)
            .order("confidence", { ascending: false })
            .limit(query.limit * 2);

        if (query.scope.length > 0) {
            request = request.overlaps("scope", query.scope);
        }

        const { data, error } = await request;

        if (error) {
            throw new Error(`Supabase queryKnowledge failed: ${error.message}`);
        }

        return (data ?? [])
            .map((row) => mapKnowledge(row as JsonObject))
            .filter((row) => keywordMatches(row.noteText, query.keywords))
            .slice(0, query.limit);
    }

    async queryArtifactSummaries(query: ArtifactQuery): Promise<CodeArtifactSummaryRecord[]> {
        if (query.embedding) {
            const matchedMemory = await this.queryMemoryEmbeddings({
                projectId: query.projectId,
                ownerType: query.ownerType,
                ownerId: query.ownerId,
                sourceType: "artifact",
                embedding: query.embedding,
                limit: query.limit,
                threshold: 0.1
            });

            if (matchedMemory.length > 0) {
                const ids = matchedMemory.map((memory) => memory.sourceId);
                const { data, error } = await this.client
                    .from("code_artifact_summaries")
                    .select("*")
                    .in("id", ids);

                if (!error && data) {
                    const order = new Map(ids.map((id, index) => [id, index]));
                    const matched = data
                        .map((row) => mapArtifact(row as JsonObject))
                        .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
                        .slice(0, query.limit);

                    if (matched.length > 0) {
                        return matched;
                    }
                }
            }
        }

        let request = this.client
            .from("code_artifact_summaries")
            .select("*")
            .eq("project_id", query.projectId)
            .gte("confidence", 0.2)
            .order("updated_at", { ascending: false })
            .limit(query.limit * 2);

        if (query.scope.length > 0) {
            request = request.overlaps("scope", query.scope);
        }

        const { data, error } = await request;

        if (error) {
            throw new Error(`Supabase queryArtifactSummaries failed: ${error.message}`);
        }

        return (data ?? [])
            .map((row) => mapArtifact(row as JsonObject))
            .filter((row) => keywordMatches(`${row.filePath} ${row.summary}`, query.keywords))
            .slice(0, query.limit);
    }

    async queryMemoryEmbeddings(query: MemoryEmbeddingQuery): Promise<MemoryEmbeddingRecord[]> {
        try {
            const { data, error } = await this.client.rpc("match_memory_embeddings", {
                match_project_id: query.projectId,
                match_owner_type: query.ownerType ?? null,
                match_owner_id: query.ownerId ?? null,
                match_source_type: query.sourceType,
                match_task_type: query.taskType ?? null,
                query_embedding: query.embedding,
                match_count: query.limit,
                match_threshold: query.threshold ?? 0.1
            });

            if (error) {
                throw error;
            }

            const rows = (data ?? []) as unknown[];
            return rows.map((row) => mapMemoryEmbedding(row as JsonObject));
        } catch {
            return [];
        }
    }

    async insertLessons(lessons: LessonInsert[]): Promise<ProjectLessonRecord[]> {
        if (lessons.length === 0) {
            return [];
        }

        const { data, error } = await this.client
            .from("project_lessons")
            .insert(
                lessons.map((lesson) => ({
                    project_id: lesson.projectId,
                    lesson_text: lesson.lessonText,
                    lesson_key: lesson.lessonKey || null,
                    scope: lesson.scope,
                    task_type: lesson.taskType,
                    severity: lesson.severity,
                    confidence: lesson.confidence,
                    source_run_id: lesson.sourceRunId,
                    embedding: lesson.embedding || null
                }))
            )
            .select("*");

        if (error) {
            throw new Error(`Supabase insertLessons failed: ${error.message}`);
        }

        return (data ?? []).map((row) => mapLesson(row as JsonObject));
    }

    async upsertLessons(lessons: LessonInsert[]): Promise<ProjectLessonRecord[]> {
        if (lessons.length === 0) {
            return [];
        }

        const results: ProjectLessonRecord[] = [];

        for (const lesson of lessons) {
            const { data, error } = await this.client.rpc("upsert_project_lesson", {
                p_project_id: lesson.projectId,
                p_lesson_text: lesson.lessonText,
                p_lesson_key: lesson.lessonKey || null,
                p_scope: lesson.scope,
                p_task_type: lesson.taskType,
                p_severity: lesson.severity,
                p_confidence: lesson.confidence,
                p_source_run_id: lesson.sourceRunId,
                p_embedding: lesson.embedding || null
            });

            if (error) {
                throw new Error(`Supabase upsert_project_lesson failed: ${error.message}`);
            }

            if (data) {
                results.push(mapLesson(data as JsonObject));
            }
        }

        return results;
    }

    async upsertKnowledge(notes: KnowledgeUpsert[]): Promise<ProjectKnowledgeRecord[]> {
        if (notes.length === 0) {
            return [];
        }

        const { data, error } = await this.client
            .from("project_knowledge")
            .upsert(
                notes.map((note) => ({
                    project_id: note.projectId,
                    note_type: note.noteType,
                    note_text: note.noteText,
                    scope: note.scope,
                    confidence: note.confidence,
                    updated_at: new Date().toISOString()
                })),
                { onConflict: "project_id,note_type,note_text" }
            )
            .select("*");

        if (error) {
            throw new Error(`Supabase upsertKnowledge failed: ${error.message}`);
        }

        return (data ?? []).map((row) => mapKnowledge(row as JsonObject));
    }

    async upsertArtifactSummaries(
        entries: ArtifactSummaryUpsert[]
    ): Promise<CodeArtifactSummaryRecord[]> {
        if (entries.length === 0) {
            return [];
        }

        const { data, error } = await this.client
            .from("code_artifact_summaries")
            .upsert(
                entries.map((entry) => ({
                    project_id: entry.projectId,
                    file_path: entry.filePath,
                    module_name: entry.moduleName,
                    summary: entry.summary,
                    scope: entry.scope,
                    confidence: entry.confidence,
                    updated_at: new Date().toISOString()
                })),
                { onConflict: "project_id,file_path" }
            )
            .select("*");

        if (error) {
            throw new Error(`Supabase upsertArtifactSummaries failed: ${error.message}`);
        }

        return (data ?? []).map((row) => mapArtifact(row as JsonObject));
    }

    async upsertMemoryEmbeddings(
        entries: MemoryEmbeddingUpsert[]
    ): Promise<MemoryEmbeddingRecord[]> {
        if (entries.length === 0) {
            return [];
        }

        const { data, error } = await this.client
            .from("memory_embeddings")
            .upsert(
                entries.map((entry) => ({
                    project_id: entry.projectId,
                    owner_type: entry.ownerType,
                    owner_id: entry.ownerId,
                    source_type: entry.sourceType,
                    source_id: entry.sourceId,
                    chunk_index: entry.chunkIndex,
                    scene_label: entry.sceneLabel,
                    content: entry.content,
                    scope: entry.scope,
                    task_type: entry.taskType,
                    confidence: entry.confidence,
                    embedding: entry.embedding,
                    metadata: entry.metadata ?? {},
                    updated_at: new Date().toISOString()
                })),
                {
                    onConflict: "project_id,owner_type,owner_id,source_type,source_id,chunk_index"
                }
            )
            .select("*");

        if (error) {
            throw new Error(`Supabase upsertMemoryEmbeddings failed: ${error.message}`);
        }

        return (data ?? []).map((row) => mapMemoryEmbedding(row as JsonObject));
    }

    async deleteMemoryEmbeddingsForSource(sourceType: SourceType, sourceId: string): Promise<void> {
        const { error } = await this.client
            .from("memory_embeddings")
            .delete()
            .eq("source_type", sourceType)
            .eq("source_id", sourceId);

        if (error) {
            throw new Error(`Supabase deleteMemoryEmbeddingsForSource failed: ${error.message}`);
        }
    }
}
