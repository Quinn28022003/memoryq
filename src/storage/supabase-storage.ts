import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type {
    ArtifactQuery,
    ArtifactSummaryUpsert,
    ExecutionRunInsert,
    ExecutionRunUpdate,
    KnowledgeQuery,
    KnowledgeUpsert,
    LessonInsert,
    LessonQuery,
    MemoryStorage
} from "./types.js";
import type {
    CodeArtifactSummaryRecord,
    ExecutionRunRecord,
    ProjectKnowledgeRecord,
    ProjectLessonRecord,
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

function normalizeTaskType(value: string): TaskType {
    const allowed: TaskType[] = ["bugfix", "feature", "refactor", "test", "docs", "infra", "general"];
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
        scope: asArray(row["scope"]),
        taskType: normalizeTaskType(stringValue(row, "task_type")),
        severity: (stringValue(row, "severity") as ProjectLessonRecord["severity"]) || "medium",
        confidence: numberValue(row, "confidence"),
        sourceRunId: stringValue(row, "source_run_id"),
        reuseCount: numberValue(row, "reuse_count"),
        createdAt: stringValue(row, "created_at"),
        updatedAt: stringValue(row, "updated_at")
    };
}

function mapKnowledge(row: JsonObject): ProjectKnowledgeRecord {
    return {
        id: stringValue(row, "id"),
        projectId: stringValue(row, "project_id"),
        noteType: (stringValue(row, "note_type") as ProjectKnowledgeRecord["noteType"]) || "architecture",
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
            throw new Error(`Supabase createExecutionRun failed: ${error?.message ?? "unknown error"}`);
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
        const { data, error } = await this.client.from("execution_runs").select("*").eq("id", runId).maybeSingle();

        if (error) {
            throw new Error(`Supabase getExecutionRun failed: ${error.message}`);
        }

        return data ? mapRun(data as JsonObject) : null;
    }

    async queryLessons(query: LessonQuery): Promise<ProjectLessonRecord[]> {
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
        const filtered = mapped.filter((row) => keywordMatches(row.lessonText, query.keywords)).slice(0, query.limit);

        if (filtered.length > 0) {
            const ids = filtered.map((item) => item.id);
            await this.client.rpc("increment_lesson_reuse_count", { lesson_ids: ids }).throwOnError();
        }

        return filtered;
    }

    async queryKnowledge(query: KnowledgeQuery): Promise<ProjectKnowledgeRecord[]> {
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
                    scope: lesson.scope,
                    task_type: lesson.taskType,
                    severity: lesson.severity,
                    confidence: lesson.confidence,
                    source_run_id: lesson.sourceRunId
                }))
            )
            .select("*");

        if (error) {
            throw new Error(`Supabase insertLessons failed: ${error.message}`);
        }

        return (data ?? []).map((row) => mapLesson(row as JsonObject));
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

    async upsertArtifactSummaries(entries: ArtifactSummaryUpsert[]): Promise<CodeArtifactSummaryRecord[]> {
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
}
