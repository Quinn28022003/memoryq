import type {
    CodeArtifactSummaryRecord,
    ExecutionRunRecord,
    KnowledgeType,
    NormalizedLesson,
    PlanBrief,
    ProjectKnowledgeRecord,
    ProjectLessonRecord,
    RunStatus,
    StorageMode,
    TaskType
} from "../types.js";

export interface ExecutionRunInsert {
    id: string;
    projectId: string;
    prompt: string;
    taskType: TaskType;
    scope: string[];
    status: RunStatus;
    briefPayload: PlanBrief | null;
    resultSummary?: string | null;
}

export interface ExecutionRunUpdate {
    status?: RunStatus;
    resultSummary?: string | null;
    briefPayload?: PlanBrief | null;
}

export interface LessonQuery {
    projectId: string;
    taskType: TaskType;
    scope: string[];
    keywords: string[];
    limit: number;
}

export interface KnowledgeQuery {
    projectId: string;
    scope: string[];
    keywords: string[];
    limit: number;
}

export interface ArtifactQuery {
    projectId: string;
    scope: string[];
    keywords: string[];
    limit: number;
}

export interface LessonInsert extends NormalizedLesson {
    projectId: string;
    sourceRunId: string;
}

export interface KnowledgeUpsert {
    projectId: string;
    noteType: KnowledgeType;
    noteText: string;
    scope: string[];
    confidence: number;
}

export interface ArtifactSummaryUpsert {
    projectId: string;
    filePath: string;
    moduleName: string;
    summary: string;
    scope: string[];
    confidence: number;
}

export interface MemoryStorage {
    readonly mode: StorageMode;
    getMode(): StorageMode;
    createExecutionRun(input: ExecutionRunInsert): Promise<ExecutionRunRecord>;
    updateExecutionRun(runId: string, update: ExecutionRunUpdate): Promise<void>;
    getExecutionRun(runId: string): Promise<ExecutionRunRecord | null>;
    queryLessons(query: LessonQuery): Promise<ProjectLessonRecord[]>;
    queryKnowledge(query: KnowledgeQuery): Promise<ProjectKnowledgeRecord[]>;
    queryArtifactSummaries(query: ArtifactQuery): Promise<CodeArtifactSummaryRecord[]>;
    insertLessons(lessons: LessonInsert[]): Promise<ProjectLessonRecord[]>;
    upsertKnowledge(notes: KnowledgeUpsert[]): Promise<ProjectKnowledgeRecord[]>;
    upsertArtifactSummaries(entries: ArtifactSummaryUpsert[]): Promise<CodeArtifactSummaryRecord[]>;
}
