import { z } from "zod";

const taskTypeSchema = z.enum([
    "bugfix",
    "feature",
    "refactor",
    "test",
    "docs",
    "infra",
    "general"
]);
const sourceTypeSchema = z.enum(["lesson", "knowledge", "artifact", "source_chunk"]);
const lessonSeveritySchema = z.enum(["low", "medium", "high"]);
const storageModeSchema = z.enum(["supabase", "local-fallback"]);

export const briefSourceSchema = z.object({
    type: sourceTypeSchema,
    id: z.string().min(1),
    confidence: z.number().min(0).max(1)
});

export const planBriefSchema = z.object({
    runId: z.string().min(1),
    taskType: taskTypeSchema,
    scope: z.array(z.string()),
    architectureNotes: z.array(z.string()),
    knownMistakes: z.array(z.string()),
    filesToInspect: z.array(z.string()),
    verificationPlan: z.array(z.string()),
    confidence: z.number().min(0).max(1),
    sources: z.array(briefSourceSchema)
});

export const normalizedLessonSchema = z.object({
    lessonText: z.string().min(1),
    scope: z.array(z.string()),
    taskType: taskTypeSchema,
    severity: lessonSeveritySchema,
    confidence: z.number().min(0).max(1)
});

export const reflectionResultSchema = z.object({
    runId: z.string().min(1),
    summary: z.string().min(1),
    newLessons: z.array(normalizedLessonSchema),
    updatedKnowledge: z.array(z.string()),
    shouldPersist: z.boolean(),
    confidence: z.number().min(0).max(1)
});

export const planOutputSchema = planBriefSchema.extend({
    storageMode: storageModeSchema,
    generatedAt: z.string().min(1)
});

export const reflectionOutputSchema = reflectionResultSchema.extend({
    storageMode: storageModeSchema,
    generatedAt: z.string().min(1)
});

export type PlanOutputContract = z.infer<typeof planOutputSchema>;
export type ReflectionOutputContract = z.infer<typeof reflectionOutputSchema>;
