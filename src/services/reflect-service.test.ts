import { access, mkdtemp, rm } from "node:fs/promises";
import { constants } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

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
    })
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
                projectId: "default"
            });
            const reflectService = new ReflectService({
                storage,
                assistant,
                artifactManager,
                projectId: "default"
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
                    projectId: "default"
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
});
