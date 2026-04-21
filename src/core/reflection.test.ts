import { describe, expect, it } from "vitest";

import { analyzeReflectionFallback } from "./reflection.js";

describe("analyzeReflectionFallback", () => {
    it("extracts reusable lessons and marks failure severity", () => {
        const input = [
            "Deployment failed because route IDs were not normalized.",
            "Lesson: Always normalize route IDs before cache lookup.",
            "Lesson: Always normalize route IDs before cache lookup."
        ].join("\n");

        const result = analyzeReflectionFallback(input, {
            taskType: "bugfix",
            scope: ["src/gateway/routes.ts"]
        });

        expect(result.status).toBe("failed");
        expect(result.shouldPersist).toBe(true);
        expect(result.newLessons.length).toBeGreaterThan(0);
        expect(result.newLessons[0].severity).toBe("high");
    });
});
