export type TaskType = "bugfix" | "feature" | "refactor" | "test" | "docs" | "infra" | "general";

export type RunStatus = "planned" | "completed" | "failed" | "partial";

export type StorageMode = "supabase" | "local-fallback";

export type SourceType = "lesson" | "knowledge" | "artifact";

export type EmbeddingVector = number[];

export type MemoryOwnerType = "project" | "agent" | "user";

export interface MemoryScene {
    label: string;
    content: string;
}

export interface BriefSource {
    type: SourceType;
    id: string;
    confidence: number;
}

export interface PlanBrief {
    runId: string;
    taskType: TaskType;
    scope: string[];
    architectureNotes: string[];
    knownMistakes: string[];
    filesToInspect: string[];
    verificationPlan: string[];
    confidence: number;
    sources: BriefSource[];
}

export interface ReflectionResult {
    runId: string;
    summary: string;
    newLessons: NormalizedLesson[];
    updatedKnowledge: string[];
    shouldPersist: boolean;
    confidence: number;
}

export interface PlanOutput extends PlanBrief {
    storageMode: StorageMode;
    generatedAt: string;
}

export interface ReflectionOutput extends ReflectionResult {
    storageMode: StorageMode;
    generatedAt: string;
}

export interface ExecutionRunRecord {
    id: string;
    projectId: string;
    prompt: string;
    taskType: TaskType;
    scope: string[];
    status: RunStatus;
    briefPayload: PlanBrief | null;
    resultSummary: string | null;
    createdAt: string;
    updatedAt: string;
}

export type LessonSeverity = "low" | "medium" | "high";

export interface NormalizedLesson {
    lessonText: string;
    lessonKey?: string;
    scope: string[];
    taskType: TaskType;
    severity: LessonSeverity;
    confidence: number;
    embedding?: EmbeddingVector;
}

export interface ProjectLessonRecord extends NormalizedLesson {
    id: string;
    projectId: string;
    sourceRunId: string;
    reuseCount: number;
    createdAt: string;
    updatedAt: string;
}

export type KnowledgeType = "architecture" | "convention" | "constraint";

export interface ProjectKnowledgeRecord {
    id: string;
    projectId: string;
    noteType: KnowledgeType;
    noteText: string;
    scope: string[];
    confidence: number;
    createdAt: string;
    updatedAt: string;
}

export interface CodeArtifactSummaryRecord {
    id: string;
    projectId: string;
    filePath: string;
    moduleName: string;
    summary: string;
    scope: string[];
    confidence: number;
    updatedAt: string;
}

export interface MemoryEmbeddingRecord {
    id: string;
    projectId: string;
    ownerType: MemoryOwnerType;
    ownerId: string;
    sourceType: SourceType;
    sourceId: string;
    chunkIndex: number;
    sceneLabel: string;
    content: string;
    scope: string[];
    taskType: TaskType | null;
    confidence: number;
    embedding: EmbeddingVector;
    metadata: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
}
