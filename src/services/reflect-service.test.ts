import { access, mkdtemp, rm } from "node:fs/promises";
import { constants } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { EmbeddingAdapter } from "../adapters/embeddings.js";
import type { PlanningAssistant } from "../adapters/groq.js";
import { executePlanCommand, executeReflectCommand } from "../cli/runner.js";
import { ArtifactManager } from "../core/artifacts.js";
import { reflectionOutputSchema } from "../contracts.js";
import { LocalStorageAdapter } from "../storage/local-storage.js";
import { PlanService } from "./plan-service.js";
import { ReflectService } from "./reflect-service.js";

const assistant: PlanningAssistant = {
    analyzePlan: async () => ({
        taskType: "bugfix",
        scope: ["src/api/routes.ts"],
        keywords: ["route"],
        verificationPlan: ["pnpm test"],
        confidence: 0.7
    }),
    analyzeReflection: async () => ({
        summary: "Route lookup now normalizes keys before map access.",
        shouldPersist: true,
        confidence: 0.8,
        status: "completed",
        updatedKnowledge: ["Gateway cache keys must be normalized route IDs."],
        newLessons: [
            {
                lessonText: "Normalize route keys before cache lookup.",
                scope: ["src/api/routes.ts"],
                taskType: "bugfix",
                severity: "medium",
                confidence: 0.78
            }
        ]
    }),
    extractMemoryScenes: async ({ text }) => [{ label: "Route normalization", content: text }],
    summarizeArtifacts: async ({ files }) =>
        files.map((f) => ({
            filePath: f.filePath,
            moduleName: "routes.ts",
            summary: "Normalized route keys.",
            scope: ["src/api/routes.ts"],
            confidence: 0.9
        }))
};

const semanticDuplicateAssistant: PlanningAssistant = {
    analyzePlan: async () => ({
        taskType: "bugfix",
        scope: ["src/api/routes.ts"],
        keywords: ["route"],
        verificationPlan: ["pnpm test"],
        confidence: 0.7
    }),
    analyzeReflection: async ({ resultText }) => {
        const secondPass = resultText.includes("second pass");

        return {
            summary: secondPass
                ? "Route IDs are canonicalized before lookup."
                : "Route lookup now normalizes keys before map access.",
            shouldPersist: true,
            confidence: 0.8,
            status: "completed",
            updatedKnowledge: [
                secondPass
                    ? "Gateway route identifiers need canonical normalization before cache reads."
                    : "Gateway cache keys must be normalized route IDs."
            ],
            newLessons: [
                {
                    lessonText: secondPass
                        ? "Route IDs should be normalized before lookup."
                        : "Normalize route keys before cache lookup.",
                    scope: ["src/api/routes.ts"],
                    taskType: "bugfix",
                    severity: "medium",
                    confidence: 0.78
                }
            ]
        };
    },
    extractMemoryScenes: async ({ text }) => [{ label: "Route normalization", content: text }],
    summarizeArtifacts: async ({ files }) =>
        files.map((f) => ({
            filePath: f.filePath,
            moduleName: "routes.ts",
            summary: "Normalized route keys.",
            scope: ["src/api/routes.ts"],
            confidence: 0.9
        }))
};

const routeEmbeddingAdapter: EmbeddingAdapter = {
    dimensions: 3,
    embedText: async (text) => {
        const normalized = text.toLowerCase();
        if (
            normalized.includes("route") ||
            normalized.includes("gateway") ||
            normalized.includes("normaliz")
        ) {
            return [1, 0, 0];
        }

        return [0, 1, 0];
    }
};

async function fileExists(path: string): Promise<boolean> {
    try {
        await access(path, constants.F_OK);
        return true;
    } catch {
        return false;
    }
}

describe("integration: reflect", () => {
    it("updates run and persists reusable lessons", async () => {
        const root = await mkdtemp(join(tmpdir(), "memoryq-reflect-"));

        try {
            const storage = new LocalStorageAdapter(root);
            const artifactManager = new ArtifactManager(root);
            const planService = new PlanService({
                storage,
                assistant,
                artifactManager,
                projectId: "default",
                rootDir: root
            });
            const reflectService = new ReflectService({
                storage,
                assistant,
                artifactManager,
                projectId: "default",
                rootDir: root
            });

            const planJson = await executePlanCommand(planService, {
                prompt: "fix api-gateway route",
                format: "json",
                artifact: true
            });
            const runId = (JSON.parse(planJson) as { runId: string }).runId;

            const reflectionJson = await executeReflectCommand(reflectService, {
                runId,
                result: "Implementation completed because route keys are normalized.",
                artifact: true
            });
            const reflection = reflectionOutputSchema.parse(JSON.parse(reflectionJson));

            expect(reflection.runId).toBe(runId);
            expect(reflection.newLessons.length).toBeGreaterThan(0);
            expect(reflection.shouldPersist).toBe(true);

            const run = await storage.getExecutionRun(runId);
            expect(run?.status).toBe("completed");

            const lessons = await storage.queryLessons({
                projectId: "default",
                taskType: "bugfix",
                scope: ["src/api/routes.ts"],
                keywords: ["normalize"],
                limit: 10
            });
            expect(lessons.length).toBeGreaterThan(0);

            const jsonPath = join(root, ".memoryq", "runs", `${runId}.json`);
            expect(await fileExists(jsonPath)).toBe(true);

            const rootNoArtifact = await mkdtemp(join(tmpdir(), "memoryq-reflect-no-artifact-"));
            try {
                const storageNoArtifact = new LocalStorageAdapter(rootNoArtifact);
                await storageNoArtifact.createExecutionRun({
                    id: "run-no-artifact",
                    projectId: "default",
                    prompt: "manual run",
                    taskType: "bugfix",
                    scope: ["src/api/routes.ts"],
                    status: "planned",
                    briefPayload: null,
                    resultSummary: null
                });

                const reflectNoArtifact = new ReflectService({
                    storage: storageNoArtifact,
                    assistant,
                    artifactManager: new ArtifactManager(rootNoArtifact),
                    projectId: "default",
                    rootDir: rootNoArtifact
                });

                await executeReflectCommand(reflectNoArtifact, {
                    runId: "run-no-artifact",
                    result: "Done. Lesson: normalize route keys.",
                    artifact: false
                });

                const noArtifactJsonPath = join(
                    rootNoArtifact,
                    ".memoryq",
                    "runs",
                    "run-no-artifact.json"
                );
                expect(await fileExists(noArtifactJsonPath)).toBe(false);
            } finally {
                await rm(rootNoArtifact, { recursive: true, force: true });
            }
        } finally {
            await rm(root, { recursive: true, force: true });
        }
    });

    it("skips semantically duplicate lessons and knowledge before persisting", async () => {
        const root = await mkdtemp(join(tmpdir(), "memoryq-reflect-dedupe-"));

        try {
            const storage = new LocalStorageAdapter(root);
            const artifactManager = new ArtifactManager(root);
            const planService = new PlanService({
                storage,
                assistant: semanticDuplicateAssistant,
                embedder: routeEmbeddingAdapter,
                artifactManager,
                projectId: "default",
                rootDir: root
            });
            const reflectService = new ReflectService({
                storage,
                assistant: semanticDuplicateAssistant,
                embedder: routeEmbeddingAdapter,
                artifactManager,
                projectId: "default",
                rootDir: root
            });

            const planJson = await executePlanCommand(planService, {
                prompt: "fix api-gateway route normalization",
                format: "json",
                artifact: false
            });
            const runId = (JSON.parse(planJson) as { runId: string }).runId;

            const firstReflectionJson = await executeReflectCommand(reflectService, {
                runId,
                result: "first pass completed route normalization",
                artifact: false
            });
            const firstReflection = reflectionOutputSchema.parse(JSON.parse(firstReflectionJson));
            expect(firstReflection.newLessons).toHaveLength(1);
            expect(firstReflection.updatedKnowledge).toHaveLength(1);

            const secondReflectionJson = await executeReflectCommand(reflectService, {
                runId,
                result: "second pass completed the same route normalization differently",
                artifact: false
            });
            const secondReflection = reflectionOutputSchema.parse(JSON.parse(secondReflectionJson));
            expect(secondReflection.newLessons).toHaveLength(0);
            expect(secondReflection.updatedKnowledge).toHaveLength(0);

            const lessons = await storage.queryLessons({
                projectId: "default",
                taskType: "bugfix",
                scope: ["src/api/routes.ts"],
                keywords: ["route"],
                embedding: [1, 0, 0],
                limit: 10
            });
            expect(lessons).toHaveLength(1);

            const knowledge = await storage.queryKnowledge({
                projectId: "default",
                scope: ["src/api/routes.ts"],
                keywords: ["route"],
                embedding: [1, 0, 0],
                limit: 10
            });
            expect(knowledge).toHaveLength(1);
        } finally {
            await rm(root, { recursive: true, force: true });
        }
    });
});
