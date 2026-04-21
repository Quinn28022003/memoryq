export type TaskType = "bugfix" | "feature" | "refactor" | "test" | "docs" | "infra" | "general";

export type RunStatus = "planned" | "completed" | "failed" | "partial";

export type StorageMode = "supabase" | "local-fallback";

export type SourceType = "lesson" | "knowledge" | "artifact";

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
    scope: string[];
    taskType: TaskType;
    severity: LessonSeverity;
    confidence: number;
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
