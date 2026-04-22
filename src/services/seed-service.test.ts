import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { LocalHashEmbeddingAdapter } from "../adapters/embeddings.js";
import type { PlanningAssistant } from "../adapters/groq.js";
import { executePlanCommand } from "../cli/runner.js";
import { ArtifactManager } from "../core/artifacts.js";
import {
    CAVEMAN_MEMORY_MIN_RECORDS,
    CAVEMAN_MEMORY_RECORDS
} from "../default-data/caveman-memory.js";
import { planOutputSchema } from "../contracts.js";
import { LocalStorageAdapter } from "../storage/local-storage.js";
import { PlanService } from "./plan-service.js";
import { SeedService } from "./seed-service.js";
import {
    assertValidCavemanMemoryCatalog,
    auditCavemanMemoryCatalog,
    CAVEMAN_REQUIRED_CATEGORIES,
    writeCavemanMemoryCatalog
} from "../../scripts/import-caveman-memory.js";

const cavemanAssistant: PlanningAssistant = {
    analyzePlan: async (prompt) => {
        const lower = prompt.toLowerCase();
        const keywords: string[] = [];
        const scope: string[] = [];

        if (lower.includes("compress") || lower.includes("context")) {
            scope.push("compression");
            keywords.push("compress", "code", "blocks");
        }
        if (lower.includes("review")) {
            scope.push("code-review");
            keywords.push("review", "findings");
        }
        if (lower.includes("commit")) {
            scope.push("git", "commit");
            keywords.push("commit", "conventional");
        }
        if (lower.includes("hook") || lower.includes("session")) {
            scope.push("hooks", "agent-integration");
            keywords.push("sessionstart", "hooks");
        }
        if (
            lower.includes("sensitive") ||
            lower.includes("secret") ||
            lower.includes("credential")
        ) {
            scope.push("security");
            keywords.push("sensitive", "credentials");
        }

        return {
            taskType: "general",
            scope,
            keywords,
            verificationPlan: ["npm test"],
            confidence: 0.9
        };
    },
    analyzeReflection: async () => null,
    extractMemoryScenes: async () => null,
    summarizeArtifacts: async () => null
};

describe("Caveman default memory catalog", () => {
    it("contains broad, unique Caveman coverage", async () => {
        expect(CAVEMAN_MEMORY_RECORDS.length).toBeGreaterThanOrEqual(CAVEMAN_MEMORY_MIN_RECORDS);

        const keys = new Set(CAVEMAN_MEMORY_RECORDS.map((record) => record.key));
        expect(keys.size).toBe(CAVEMAN_MEMORY_RECORDS.length);

        const normalizedTexts = new Set(
            CAVEMAN_MEMORY_RECORDS.map((record) =>
                record.text.toLowerCase().replace(/\s+/g, " ").trim()
            )
        );
        expect(normalizedTexts.size).toBe(CAVEMAN_MEMORY_RECORDS.length);

        const requiredKeys = [
            "caveman.mode.persistence",
            "caveman.mode.intensities",
            "caveman.compress.preservation.code",
            "caveman.compress.detection",
            "caveman.compress.security.sensitive-paths",
            "caveman.compress.validation.rules",
            "caveman.hooks.safety",
            "caveman.review.behavior",
            "caveman.commit.standard",
            "caveman.help.behavior",
            "caveman.repo.maintenance",
            "caveman.sync.automation",
            "caveman.hooks.safety",
            "caveman.hooks.config-resolution",
            "caveman.install.behavior",
            "caveman.verify.scope",
            "caveman.evals.methodology"
        ];
        for (const key of requiredKeys) {
            expect(keys.has(key)).toBe(true);
        }

        const coverageTerms = [
            "compression",
            "code-review",
            "commit",
            "help",
            "hooks",
            "install",
            "sync",
            "security",
            "validation",
            "evals",
            "benchmark",
            "agent-integration",
            "verification"
        ];
        for (const term of coverageTerms) {
            expect(CAVEMAN_MEMORY_RECORDS.some((record) => record.scope.includes(term))).toBe(true);
        }
    });

    it("passes the Caveman importer audit categories", async () => {
        const report = await auditCavemanMemoryCatalog(process.cwd());

        expect(report.recordCount).toBe(CAVEMAN_MEMORY_RECORDS.length);
        expect(report.missingCategories).toEqual([]);
        expect(report.presentCategories).toEqual([...CAVEMAN_REQUIRED_CATEGORIES]);
        assertValidCavemanMemoryCatalog(report);
    });

    it("validates and renders without a local Caveman source checkout", async () => {
        const root = await mkdtemp(join(tmpdir(), "memoryq-caveman-import-no-source-"));

        try {
            await mkdir(join(root, "src", "default-data"), { recursive: true });

            const report = await auditCavemanMemoryCatalog(root);

            expect(report.sourceAvailable).toBe(false);
            expect(report.missingCategories).toEqual([]);
            expect(report.presentCategories).toEqual([...CAVEMAN_REQUIRED_CATEGORIES]);
            expect(() => assertValidCavemanMemoryCatalog(report)).not.toThrow();

            await writeCavemanMemoryCatalog(root);
            const generated = await readFile(
                join(root, "src", "default-data", "caveman-memory.ts"),
                "utf8"
            );
            expect(generated).toContain("CAVEMAN_MEMORY_RECORDS");
            expect(generated).toContain("caveman.help.behavior");
        } finally {
            await rm(root, { recursive: true, force: true });
        }
    });
});

describe("SeedService", () => {
    it("seeds broad Caveman memory into local storage and remains idempotent", async () => {
        const root = await mkdtemp(join(tmpdir(), "memoryq-seed-"));

        try {
            const storage = new LocalStorageAdapter(root);
            const embedder = new LocalHashEmbeddingAdapter(384);
            const service = new SeedService({
                storage,
                embedder,
                projectId: "test-project",
                rootDir: root
            });

            const result = await service.seedCaveman();

            expect(result.seedName).toBe("caveman");
            expect(result.createdOrUpdatedLessons + result.createdOrUpdatedKnowledge).toBe(
                CAVEMAN_MEMORY_RECORDS.length
            );
            expect(result.createdOrUpdatedLessons).toBeGreaterThan(15);
            expect(result.createdOrUpdatedKnowledge).toBeGreaterThan(15);
            expect(result.createdOrUpdatedEmbeddings).toBe(
                result.createdOrUpdatedLessons + result.createdOrUpdatedKnowledge
            );
            expect(result.skippedEmbeddings).toBe(0);

            const lessons = await storage.queryLessons({
                projectId: "test-project",
                taskType: "general",
                scope: ["caveman"],
                keywords: [],
                limit: 100
            });
            expect(lessons).toHaveLength(result.createdOrUpdatedLessons);
            expect(lessons.some((lesson) => lesson.lessonKey === "caveman.hooks.safety")).toBe(
                true
            );

            const knowledge = await storage.queryKnowledge({
                projectId: "test-project",
                scope: ["caveman"],
                keywords: [],
                limit: 100
            });
            expect(knowledge).toHaveLength(result.createdOrUpdatedKnowledge);
            expect(knowledge.some((note) => note.noteText.includes("Cursor and Windsurf"))).toBe(
                true
            );

            const embeddings = await storage.queryMemoryEmbeddings({
                projectId: "test-project",
                sourceType: "lesson",
                embedding: await embedder.embedText(
                    "Lesson: Always normalize route keys before cache lookup for the architecture."
                ),
                limit: 100,
                threshold: 0
            });
            expect(embeddings.length).toBeGreaterThan(0);

            const secondResult = await service.seedCaveman();
            expect(secondResult.createdOrUpdatedLessons).toBe(result.createdOrUpdatedLessons);
            expect(secondResult.createdOrUpdatedKnowledge).toBe(result.createdOrUpdatedKnowledge);

            const finalLessons = await storage.queryLessons({
                projectId: "test-project",
                taskType: "general",
                scope: ["caveman"],
                keywords: [],
                limit: 100
            });
            expect(finalLessons).toHaveLength(result.createdOrUpdatedLessons);
        } finally {
            await rm(root, { recursive: true, force: true });
        }
    });

    it("handles seeding without embedder", async () => {
        const root = await mkdtemp(join(tmpdir(), "memoryq-seed-no-embedder-"));

        try {
            const storage = new LocalStorageAdapter(root);
            const service = new SeedService({
                storage,
                projectId: "test-project",
                rootDir: root
            });

            const result = await service.seedCaveman();

            expect(result.createdOrUpdatedEmbeddings).toBe(0);
            expect(result.skippedEmbeddings).toBe(CAVEMAN_MEMORY_RECORDS.length);
        } finally {
            await rm(root, { recursive: true, force: true });
        }
    });

    it("retrieves relevant Caveman memory during planning", async () => {
        const root = await mkdtemp(join(tmpdir(), "memoryq-seed-plan-"));

        try {
            const storage = new LocalStorageAdapter(root);
            const seedService = new SeedService({
                storage,
                projectId: "test-project"
            });
            await seedService.seedCaveman();

            const planService = new PlanService({
                storage,
                assistant: cavemanAssistant,
                artifactManager: new ArtifactManager(root),
                projectId: "test-project",
                rootDir: root
            });

            const prompts = [
                {
                    prompt: "optimize token context compression for memory files",
                    expected: "code blocks"
                },
                {
                    prompt: "write terse code review comments",
                    expected: "one-line findings"
                },
                {
                    prompt: "generate compact conventional commit message",
                    expected: "Conventional Commits"
                },
                {
                    prompt: "sessionstart per-turn reinforcement hooks",
                    expected: "per-turn reinforcement"
                },
                {
                    prompt: "credentials private keys secrets .ssh .aws",
                    expected: "credential"
                }
            ];

            for (const item of prompts) {
                const jsonOutput = await executePlanCommand(planService, {
                    prompt: item.prompt,
                    format: "json",
                    artifact: false
                });
                const plan = planOutputSchema.parse(JSON.parse(jsonOutput));
                const memoryText = [...plan.knownMistakes, ...plan.architectureNotes].join("\n");
                expect(memoryText).toContain(item.expected);
            }
        } finally {
            await rm(root, { recursive: true, force: true });
        }
    });
});
