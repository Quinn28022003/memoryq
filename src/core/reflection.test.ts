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

    it("canonicalizes concrete migration rollback conventions", () => {
        const result = analyzeReflectionFallback(
            "mỗi lần viết 1 file migration thì cần phải viết thêm file down đi cùng đặt ở /Users/quinn/project/MemoryQ/supabase/migrations/down",
            {
                taskType: "infra",
                scope: ["supabase/migrations"]
            }
        );

        expect(result.shouldPersist).toBe(true);
        expect(result.newLessons).toEqual([
            expect.objectContaining({
                lessonText:
                    "When adding a Supabase migration under `supabase/migrations/*.sql`, add the matching rollback file under `supabase/migrations/down/*.down.sql`."
            })
        ]);
    });

    it("ignores generic workflow reminders", () => {
        const result = analyzeReflectionFallback(
            "Agents must always run memoryq reflect after work. Implementation summary: updated files.",
            {
                taskType: "general",
                scope: ["src"]
            }
        );

        expect(result.shouldPersist).toBe(false);
        expect(result.newLessons).toHaveLength(0);
        expect(result.updatedKnowledge).toHaveLength(0);
    });

    it("ignores test-result narration even when it mentions conventions", () => {
        const result = analyzeReflectionFallback(
            "Initial targeted test run failed because the migration convention was saved twice, once canonicalized and once as the raw Vietnamese sentence.",
            {
                taskType: "refactor",
                scope: ["src/core/reflection.ts"]
            }
        );

        expect(result.shouldPersist).toBe(false);
        expect(result.newLessons).toHaveLength(0);
        expect(result.updatedKnowledge).toHaveLength(0);
    });

    it("extracts long architectural rules and layered architecture constraints", () => {
        const input = [
            "Enforce layered architecture: composition -> services -> repository -> platform-contracts.",
            "Strict rule: api-gateway must NOT import repositories directly; it must go through platform-contracts.",
            "Only repository layer is allowed to interact with database directly."
        ].join("\n");

        const result = analyzeReflectionFallback(input, {
            taskType: "refactor",
            scope: ["src"]
        });

        expect(result.shouldPersist).toBe(true);
        expect(result.newLessons.length).toBeGreaterThanOrEqual(2);
        expect(result.newLessons.map((l) => l.lessonText)).toContain(
            "Enforce layered architecture: composition -> services -> repository -> platform-contracts."
        );
        expect(result.newLessons.map((l) => l.lessonText)).toContain(
            "Strict rule: api-gateway must NOT import repositories directly; it must go through platform-contracts."
        );
    });
});
