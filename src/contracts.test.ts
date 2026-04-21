import { describe, expect, it } from "vitest";

import { planOutputSchema, reflectionOutputSchema } from "./contracts.js";
import { renderPlanMarkdown, renderReflectionMarkdown } from "./core/markdown.js";
import type { PlanOutput, ReflectionOutput } from "./types.js";

describe("contracts and markdown", () => {
    it("validates plan output schema", () => {
        const output: PlanOutput = {
            runId: "run-1",
            taskType: "bugfix",
            scope: ["src/api/routes.ts"],
            architectureNotes: ["Gateway validates route keys"],
            knownMistakes: ["Route regex was too permissive"],
            filesToInspect: ["src/api/routes.ts"],
            verificationPlan: ["pnpm test", "pnpm lint"],
            confidence: 0.72,
            sources: [{ type: "lesson", id: "lesson-1", confidence: 0.6 }],
            storageMode: "local-fallback",
            generatedAt: new Date().toISOString()
        };

        expect(() => planOutputSchema.parse(output)).not.toThrow();
        const markdown = renderPlanMarkdown(output);
        expect(markdown).toContain("# MemoryQ Plan run-1");
        expect(markdown).toContain("## Verification Plan");
    });

    it("validates reflection output schema", () => {
        const output: ReflectionOutput = {
            runId: "run-1",
            summary: "Route normalization fixed the gateway mismatch.",
            newLessons: [
                {
                    lessonText: "Normalize route keys before lookup.",
                    scope: ["src/api/routes.ts"],
                    taskType: "bugfix",
                    severity: "medium",
                    confidence: 0.7
                }
            ],
            updatedKnowledge: ["Gateway routing depends on normalized route IDs."],
            shouldPersist: true,
            confidence: 0.75,
            storageMode: "supabase",
            generatedAt: new Date().toISOString()
        };

        expect(() => reflectionOutputSchema.parse(output)).not.toThrow();
        const markdown = renderReflectionMarkdown(output);
        expect(markdown).toContain("# MemoryQ Reflection run-1");
        expect(markdown).toContain("## Updated Knowledge");
    });
});
