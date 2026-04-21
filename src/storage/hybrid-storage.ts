import { LocalStorageAdapter } from "./local-storage.js";
import { SupabaseStorageAdapter } from "./supabase-storage.js";
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
    ProjectKnowledgeRecord,
    ProjectLessonRecord,
    StorageMode
} from "../types.js";

export interface HybridStorageOptions {
    rootDir?: string;
    supabaseUrl?: string;
    supabaseServiceRoleKey?: string;
    primary?: MemoryStorage | null;
    local?: MemoryStorage;
}

export class HybridStorage implements MemoryStorage {
    private readonly primary: MemoryStorage | null;
    private readonly local: MemoryStorage;
    private currentMode: StorageMode;

    constructor(options: HybridStorageOptions = {}) {
        this.local = options.local ?? new LocalStorageAdapter(options.rootDir);

        if (options.primary !== undefined) {
            this.primary = options.primary;
        } else if (options.supabaseUrl && options.supabaseServiceRoleKey) {
            this.primary = new SupabaseStorageAdapter(
                options.supabaseUrl,
                options.supabaseServiceRoleKey
            );
        } else {
            this.primary = null;
        }

        this.currentMode = this.primary ? "supabase" : "local-fallback";
    }

    get mode(): StorageMode {
        return this.currentMode;
    }

    getMode(): StorageMode {
        return this.currentMode;
    }

    private async withFallback<T>(
        runPrimary: (() => Promise<T>) | null,
        runLocal: () => Promise<T>
    ): Promise<T> {
        if (!runPrimary) {
            this.currentMode = "local-fallback";
            return runLocal();
        }

        try {
            const value = await runPrimary();
            this.currentMode = "supabase";
            return value;
        } catch {
            this.currentMode = "local-fallback";
            return runLocal();
        }
    }

    async createExecutionRun(input: ExecutionRunInsert): Promise<ExecutionRunRecord> {
        const primary = this.primary;
        return this.withFallback(primary ? () => primary.createExecutionRun(input) : null, () =>
            this.local.createExecutionRun(input)
        );
    }

    async updateExecutionRun(runId: string, update: ExecutionRunUpdate): Promise<void> {
        const primary = this.primary;
        await this.withFallback(
            primary ? () => primary.updateExecutionRun(runId, update) : null,
            () => this.local.updateExecutionRun(runId, update)
        );
    }

    async getExecutionRun(runId: string): Promise<ExecutionRunRecord | null> {
        if (!this.primary) {
            this.currentMode = "local-fallback";
            return this.local.getExecutionRun(runId);
        }

        try {
            const primaryRun = await this.primary.getExecutionRun(runId);
            if (primaryRun) {
                this.currentMode = "supabase";
                return primaryRun;
            }
        } catch {
            this.currentMode = "local-fallback";
            return this.local.getExecutionRun(runId);
        }

        this.currentMode = "local-fallback";
        return this.local.getExecutionRun(runId);
    }

    async queryLessons(query: LessonQuery): Promise<ProjectLessonRecord[]> {
        const primary = this.primary;
        return this.withFallback(primary ? () => primary.queryLessons(query) : null, () =>
            this.local.queryLessons(query)
        );
    }

    async queryKnowledge(query: KnowledgeQuery): Promise<ProjectKnowledgeRecord[]> {
        const primary = this.primary;
        return this.withFallback(primary ? () => primary.queryKnowledge(query) : null, () =>
            this.local.queryKnowledge(query)
        );
    }

    async queryArtifactSummaries(query: ArtifactQuery): Promise<CodeArtifactSummaryRecord[]> {
        const primary = this.primary;
        return this.withFallback(primary ? () => primary.queryArtifactSummaries(query) : null, () =>
            this.local.queryArtifactSummaries(query)
        );
    }

    async queryMemoryEmbeddings(query: MemoryEmbeddingQuery): Promise<MemoryEmbeddingRecord[]> {
        const primary = this.primary;
        return this.withFallback(primary ? () => primary.queryMemoryEmbeddings(query) : null, () =>
            this.local.queryMemoryEmbeddings(query)
        );
    }

    async insertLessons(lessons: LessonInsert[]): Promise<ProjectLessonRecord[]> {
        const primary = this.primary;
        return this.withFallback(primary ? () => primary.insertLessons(lessons) : null, () =>
            this.local.insertLessons(lessons)
        );
    }

    async upsertLessons(lessons: LessonInsert[]): Promise<ProjectLessonRecord[]> {
        const primary = this.primary;
        return this.withFallback(primary ? () => primary.upsertLessons(lessons) : null, () =>
            this.local.upsertLessons(lessons)
        );
    }

    async upsertKnowledge(notes: KnowledgeUpsert[]): Promise<ProjectKnowledgeRecord[]> {
        const primary = this.primary;
        return this.withFallback(primary ? () => primary.upsertKnowledge(notes) : null, () =>
            this.local.upsertKnowledge(notes)
        );
    }

    async upsertArtifactSummaries(
        entries: ArtifactSummaryUpsert[]
    ): Promise<CodeArtifactSummaryRecord[]> {
        const primary = this.primary;
        return this.withFallback(
            primary ? () => primary.upsertArtifactSummaries(entries) : null,
            () => this.local.upsertArtifactSummaries(entries)
        );
    }

    async upsertMemoryEmbeddings(
        entries: MemoryEmbeddingUpsert[]
    ): Promise<MemoryEmbeddingRecord[]> {
        const primary = this.primary;
        return this.withFallback(
            primary ? () => primary.upsertMemoryEmbeddings(entries) : null,
            () => this.local.upsertMemoryEmbeddings(entries)
        );
    }
}

export function createHybridStorageFromEnv(rootDir: string = process.cwd()): HybridStorage {
    return new HybridStorage({
        rootDir,
        supabaseUrl: process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
        supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY
    });
}
