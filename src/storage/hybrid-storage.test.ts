import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { HybridStorage } from "./hybrid-storage.js";
import { LocalStorageAdapter } from "./local-storage.js";
import type { MemoryStorage } from "./types.js";

function failingStorage(): MemoryStorage {
    return {
        mode: "supabase",
        getMode: () => "supabase",
        createExecutionRun: async () => {
            throw new Error("supabase unavailable");
        },
        updateExecutionRun: async () => {
            throw new Error("supabase unavailable");
        },
        getExecutionRun: async () => {
            throw new Error("supabase unavailable");
        },
        queryLessons: async () => {
            throw new Error("supabase unavailable");
        },
        queryKnowledge: async () => {
            throw new Error("supabase unavailable");
        },
        queryArtifactSummaries: async () => {
            throw new Error("supabase unavailable");
        },
        queryMemoryEmbeddings: async () => {
            throw new Error("supabase unavailable");
        },
        insertLessons: async () => {
            throw new Error("supabase unavailable");
        },
        upsertLessons: async () => {
            throw new Error("supabase unavailable");
        },
        upsertKnowledge: async () => {
            throw new Error("supabase unavailable");
        },
        upsertArtifactSummaries: async () => {
            throw new Error("supabase unavailable");
        },
        upsertMemoryEmbeddings: async () => {
            throw new Error("supabase unavailable");
        }
    };
}

describe("HybridStorage", () => {
    it("falls back to local mode when supabase is unavailable", async () => {
        const root = await mkdtemp(join(tmpdir(), "memoryq-storage-"));

        try {
            const local = new LocalStorageAdapter(root);
            const storage = new HybridStorage({
                primary: failingStorage(),
                local
            });

            await storage.createExecutionRun({
                id: "run-local-1",
                projectId: "default",
                prompt: "fix route",
                taskType: "bugfix",
                scope: ["src/api/routes.ts"],
                status: "planned",
                briefPayload: null,
                resultSummary: null
            });

            expect(storage.getMode()).toBe("local-fallback");
            const loaded = await local.getExecutionRun("run-local-1");
            expect(loaded?.id).toBe("run-local-1");
        } finally {
            await rm(root, { recursive: true, force: true });
        }
    });

    it("delegates upsertLessons to local storage when primary is null", async () => {
        const root = await mkdtemp(join(tmpdir(), "memoryq-storage-"));

        try {
            const local = new LocalStorageAdapter(root);
            const storage = new HybridStorage({
                primary: null,
                local
            });

            const lessons = await storage.upsertLessons([
                {
                    projectId: "p1",
                    lessonText: "Always use strict mode",
                    lessonKey: "strict-mode",
                    scope: ["typescript"],
                    taskType: "general",
                    severity: "medium",
                    confidence: 0.9,
                    sourceRunId: "run-1"
                }
            ]);

            expect(lessons).toHaveLength(1);
            expect(lessons[0].lessonKey).toBe("strict-mode");
            expect(storage.getMode()).toBe("local-fallback");

            const localLessons = await local.queryLessons({
                projectId: "p1",
                taskType: "general",
                scope: [],
                keywords: ["strict"],
                limit: 1
            });
            expect(localLessons).toHaveLength(1);
            expect(localLessons[0].lessonKey).toBe("strict-mode");
        } finally {
            await rm(root, { recursive: true, force: true });
        }
    });
});
