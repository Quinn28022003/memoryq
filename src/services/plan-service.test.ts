import { access, mkdtemp, rm } from "node:fs/promises";
import { constants } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { PlanningAssistant } from "../adapters/groq.js";
import { executePlanCommand } from "../cli/runner.js";
import { ArtifactManager } from "../core/artifacts.js";
import { planOutputSchema } from "../contracts.js";
import { LocalStorageAdapter } from "../storage/local-storage.js";
import { PlanService } from "./plan-service.js";

const assistant: PlanningAssistant = {
    analyzePlan: async () => ({
        taskType: "bugfix",
        scope: ["src/api/routes.ts"],
        keywords: ["api-gateway", "route"],
        verificationPlan: ["pnpm test", "pnpm lint"],
        confidence: 0.7
    }),
    analyzeReflection: async () => null,
    extractMemoryScenes: async () => null,
    summarizeArtifacts: async () => null
};

async function fileExists(path: string): Promise<boolean> {
    try {
        await access(path, constants.F_OK);
        return true;
    } catch {
        return false;
    }
}

describe("integration: plan", () => {
    it("creates run, retrieves memory, emits valid json, and writes artifacts", async () => {
        const root = await mkdtemp(join(tmpdir(), "memoryq-plan-"));

        try {
            const storage = new LocalStorageAdapter(root);
            await storage.insertLessons([
                {
                    projectId: "default",
                    sourceRunId: "seed-run",
                    taskType: "bugfix",
                    lessonText: "Normalize route IDs before matching.",
                    scope: ["src/api/routes.ts"],
                    severity: "medium",
                    confidence: 0.8
                }
            ]);
            await storage.upsertKnowledge([
                {
                    projectId: "default",
                    noteType: "architecture",
                    noteText: "API gateway route resolution depends on normalized IDs.",
                    scope: ["src/api/routes.ts"],
                    confidence: 0.7
                }
            ]);

            const service = new PlanService({
                storage,
                assistant,
                artifactManager: new ArtifactManager(root),
                projectId: "default",
                rootDir: root
            });

            const jsonOutput = await executePlanCommand(service, {
                prompt: "fix api-gateway route",
                format: "json",
                artifact: true
            });

            const parsed = JSON.parse(jsonOutput) as unknown;
            const validated = planOutputSchema.parse(parsed);

            expect(validated.runId.length).toBeGreaterThan(10);
            expect(validated.knownMistakes.length).toBeGreaterThan(0);
            expect(validated.verificationPlan.length).toBeGreaterThan(0);

            const jsonPath = join(root, ".memoryq", "runs", `${validated.runId}.json`);
            const markdownPath = join(root, ".memoryq", "runs", `${validated.runId}.md`);
            expect(await fileExists(jsonPath)).toBe(true);
            expect(await fileExists(markdownPath)).toBe(true);

            const markdownOutput = await executePlanCommand(service, {
                prompt: "fix api-gateway route",
                format: "markdown",
                artifact: false
            });
            expect(markdownOutput.startsWith("# MemoryQ Plan ")).toBe(true);

            const noArtifactJson = await executePlanCommand(service, {
                prompt: "fix api-gateway route without artifacts",
                format: "json",
                artifact: false
            });
            const noArtifactRun = planOutputSchema.parse(JSON.parse(noArtifactJson));
            const noArtifactPath = join(root, ".memoryq", "runs", `${noArtifactRun.runId}.json`);
            expect(await fileExists(noArtifactPath)).toBe(false);
        } finally {
            await rm(root, { recursive: true, force: true });
        }
    });
});
