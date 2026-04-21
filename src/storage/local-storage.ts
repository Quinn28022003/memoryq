import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

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
    StorageMode
} from "../types.js";

type TableName =
    | "execution_runs"
    | "project_lessons"
    | "project_knowledge"
    | "code_artifact_summaries";

function unique(values: string[]): string[] {
    return [...new Set(values.filter(Boolean))];
}

function intersects(left: string[], right: string[]): boolean {
    if (left.length === 0 || right.length === 0) {
        return false;
    }

    const set = new Set(left.map((item) => item.toLowerCase()));
    return right.some((item) => set.has(item.toLowerCase()));
}

function keywordMatches(text: string, keywords: string[]): boolean {
    if (keywords.length === 0) {
        return true;
    }

    const lower = text.toLowerCase();
    return keywords.some((keyword) => lower.includes(keyword.toLowerCase()));
}

export class LocalStorageAdapter implements MemoryStorage {
    readonly mode: StorageMode = "local-fallback";

    constructor(private readonly rootDir: string = process.cwd()) {}

    getMode(): StorageMode {
        return this.mode;
    }

    private get dbDir(): string {
        return join(this.rootDir, ".memoryq", "local-db");
    }

    private tablePath(table: TableName): string {
        return join(this.dbDir, `${table}.json`);
    }

    private async ensureDbDir(): Promise<void> {
        await mkdir(this.dbDir, { recursive: true });
    }

    private async loadTable<T>(table: TableName): Promise<T[]> {
        await this.ensureDbDir();

        try {
            const content = await readFile(this.tablePath(table), "utf8");
            const parsed = JSON.parse(content) as T[];
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    private async saveTable<T>(table: TableName, rows: T[]): Promise<void> {
        await this.ensureDbDir();
        await writeFile(this.tablePath(table), JSON.stringify(rows, null, 2), "utf8");
    }

    async createExecutionRun(input: ExecutionRunInsert): Promise<ExecutionRunRecord> {
        const runs = await this.loadTable<ExecutionRunRecord>("execution_runs");
        const now = new Date().toISOString();

        const record: ExecutionRunRecord = {
            id: input.id,
            projectId: input.projectId,
            prompt: input.prompt,
            taskType: input.taskType,
            scope: input.scope,
            status: input.status,
            briefPayload: input.briefPayload,
            resultSummary: input.resultSummary ?? null,
            createdAt: now,
            updatedAt: now
        };

        const withoutExisting = runs.filter((run) => run.id !== input.id);
        withoutExisting.push(record);
        await this.saveTable("execution_runs", withoutExisting);
        return record;
    }

    async updateExecutionRun(runId: string, update: ExecutionRunUpdate): Promise<void> {
        const runs = await this.loadTable<ExecutionRunRecord>("execution_runs");
        const index = runs.findIndex((run) => run.id === runId);

        if (index < 0) {
            throw new Error(`Run ${runId} was not found.`);
        }

        runs[index] = {
            ...runs[index],
            ...update,
            updatedAt: new Date().toISOString()
        };

        await this.saveTable("execution_runs", runs);
    }

    async getExecutionRun(runId: string): Promise<ExecutionRunRecord | null> {
        const runs = await this.loadTable<ExecutionRunRecord>("execution_runs");
        return runs.find((run) => run.id === runId) ?? null;
    }

    async queryLessons(query: LessonQuery): Promise<ProjectLessonRecord[]> {
        const lessons = await this.loadTable<ProjectLessonRecord>("project_lessons");

        const filtered = lessons
            .filter((lesson) => lesson.projectId === query.projectId)
            .filter((lesson) => lesson.taskType === query.taskType || lesson.taskType === "general")
            .filter((lesson) => lesson.confidence >= 0.3)
            .filter(
                (lesson) =>
                    query.scope.length === 0 ||
                    intersects(lesson.scope, query.scope) ||
                    keywordMatches(lesson.lessonText, query.keywords)
            )
            .sort((a, b) => b.reuseCount - a.reuseCount || b.confidence - a.confidence)
            .slice(0, query.limit);

        if (filtered.length > 0) {
            const touchedIds = new Set(filtered.map((item) => item.id));
            const now = new Date().toISOString();
            const updated = lessons.map((lesson) => {
                if (!touchedIds.has(lesson.id)) {
                    return lesson;
                }

                return {
                    ...lesson,
                    reuseCount: lesson.reuseCount + 1,
                    updatedAt: now
                };
            });
            await this.saveTable("project_lessons", updated);

            return updated.filter((lesson) => touchedIds.has(lesson.id)).slice(0, query.limit);
        }

        return filtered;
    }

    async queryKnowledge(query: KnowledgeQuery): Promise<ProjectKnowledgeRecord[]> {
        const notes = await this.loadTable<ProjectKnowledgeRecord>("project_knowledge");

        return notes
            .filter((note) => note.projectId === query.projectId)
            .filter((note) => note.confidence >= 0.3)
            .filter(
                (note) =>
                    query.scope.length === 0 ||
                    intersects(note.scope, query.scope) ||
                    keywordMatches(note.noteText, query.keywords)
            )
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, query.limit);
    }

    async queryArtifactSummaries(query: ArtifactQuery): Promise<CodeArtifactSummaryRecord[]> {
        const summaries =
            await this.loadTable<CodeArtifactSummaryRecord>("code_artifact_summaries");

        return summaries
            .filter((summary) => summary.projectId === query.projectId)
            .filter((summary) => summary.confidence >= 0.2)
            .filter(
                (summary) =>
                    query.scope.length === 0 ||
                    intersects(summary.scope, query.scope) ||
                    keywordMatches(`${summary.filePath} ${summary.summary}`, query.keywords)
            )
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, query.limit);
    }

    async insertLessons(lessons: LessonInsert[]): Promise<ProjectLessonRecord[]> {
        if (lessons.length === 0) {
            return [];
        }

        const rows = await this.loadTable<ProjectLessonRecord>("project_lessons");
        const now = new Date().toISOString();

        const inserted = lessons.map((lesson) => ({
            id: randomUUID(),
            projectId: lesson.projectId,
            lessonText: lesson.lessonText,
            scope: unique(lesson.scope),
            taskType: lesson.taskType,
            severity: lesson.severity,
            confidence: lesson.confidence,
            sourceRunId: lesson.sourceRunId,
            reuseCount: 0,
            createdAt: now,
            updatedAt: now
        }));

        rows.push(...inserted);
        await this.saveTable("project_lessons", rows);
        return inserted;
    }

    async upsertKnowledge(notes: KnowledgeUpsert[]): Promise<ProjectKnowledgeRecord[]> {
        if (notes.length === 0) {
            return [];
        }

        const rows = await this.loadTable<ProjectKnowledgeRecord>("project_knowledge");
        const now = new Date().toISOString();
        const result: ProjectKnowledgeRecord[] = [];

        for (const note of notes) {
            const index = rows.findIndex(
                (row) =>
                    row.projectId === note.projectId &&
                    row.noteType === note.noteType &&
                    row.noteText.toLowerCase() === note.noteText.toLowerCase()
            );

            if (index >= 0) {
                rows[index] = {
                    ...rows[index],
                    scope: unique([...rows[index].scope, ...note.scope]),
                    confidence: Math.max(rows[index].confidence, note.confidence),
                    updatedAt: now
                };
                result.push(rows[index]);
            } else {
                const created: ProjectKnowledgeRecord = {
                    id: randomUUID(),
                    projectId: note.projectId,
                    noteType: note.noteType,
                    noteText: note.noteText,
                    scope: unique(note.scope),
                    confidence: note.confidence,
                    createdAt: now,
                    updatedAt: now
                };
                rows.push(created);
                result.push(created);
            }
        }

        await this.saveTable("project_knowledge", rows);
        return result;
    }

    async upsertArtifactSummaries(
        entries: ArtifactSummaryUpsert[]
    ): Promise<CodeArtifactSummaryRecord[]> {
        if (entries.length === 0) {
            return [];
        }

        const rows = await this.loadTable<CodeArtifactSummaryRecord>("code_artifact_summaries");
        const now = new Date().toISOString();
        const result: CodeArtifactSummaryRecord[] = [];

        for (const entry of entries) {
            const index = rows.findIndex(
                (row) => row.projectId === entry.projectId && row.filePath === entry.filePath
            );

            if (index >= 0) {
                rows[index] = {
                    ...rows[index],
                    moduleName: entry.moduleName,
                    summary: entry.summary,
                    scope: unique([...rows[index].scope, ...entry.scope]),
                    confidence: Math.max(rows[index].confidence, entry.confidence),
                    updatedAt: now
                };
                result.push(rows[index]);
            } else {
                const created: CodeArtifactSummaryRecord = {
                    id: randomUUID(),
                    projectId: entry.projectId,
                    filePath: entry.filePath,
                    moduleName: entry.moduleName,
                    summary: entry.summary,
                    scope: unique(entry.scope),
                    confidence: entry.confidence,
                    updatedAt: now
                };
                rows.push(created);
                result.push(created);
            }
        }

        await this.saveTable("code_artifact_summaries", rows);
        return result;
    }
}
