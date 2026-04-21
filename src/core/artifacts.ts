import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { renderPlanMarkdown, renderReflectionMarkdown } from "./markdown.js";
import type { PlanOutput, ReflectionOutput } from "../types.js";

interface PlanArtifactEnvelope {
    plan: PlanOutput;
    reflection?: ReflectionOutput;
}

export class ArtifactManager {
    constructor(private readonly rootDir: string = process.cwd()) {}

    private get runsDir(): string {
        return join(this.rootDir, ".memoryq", "runs");
    }

    private runJsonPath(runId: string): string {
        return join(this.runsDir, `${runId}.json`);
    }

    private runMarkdownPath(runId: string): string {
        return join(this.runsDir, `${runId}.md`);
    }

    private async ensureRunsDir(): Promise<void> {
        await mkdir(this.runsDir, { recursive: true });
    }

    async writePlanArtifact(planOutput: PlanOutput): Promise<void> {
        await this.ensureRunsDir();
        const jsonPath = this.runJsonPath(planOutput.runId);
        const markdownPath = this.runMarkdownPath(planOutput.runId);
        const payload: PlanArtifactEnvelope = { plan: planOutput };

        await writeFile(jsonPath, JSON.stringify(payload, null, 2), "utf8");
        await writeFile(markdownPath, renderPlanMarkdown(planOutput), "utf8");
    }

    async writeReflectionArtifact(reflectionOutput: ReflectionOutput): Promise<void> {
        await this.ensureRunsDir();
        const jsonPath = this.runJsonPath(reflectionOutput.runId);
        const markdownPath = this.runMarkdownPath(reflectionOutput.runId);

        let envelope: PlanArtifactEnvelope = {
            plan: {
                runId: reflectionOutput.runId,
                taskType: "general",
                scope: [],
                architectureNotes: [],
                knownMistakes: [],
                filesToInspect: [],
                verificationPlan: [],
                confidence: reflectionOutput.confidence,
                sources: [],
                storageMode: reflectionOutput.storageMode,
                generatedAt: reflectionOutput.generatedAt
            }
        };

        try {
            const current = await readFile(jsonPath, "utf8");
            envelope = JSON.parse(current) as PlanArtifactEnvelope;
        } catch {
            // Reflection can still write its artifact if plan artifact is absent.
        }

        envelope.reflection = reflectionOutput;
        await writeFile(jsonPath, JSON.stringify(envelope, null, 2), "utf8");

        const planMd = envelope.plan ? renderPlanMarkdown(envelope.plan) : "";
        const reflectionMd = renderReflectionMarkdown(reflectionOutput);
        const merged = planMd ? `${planMd}\n\n---\n\n${reflectionMd}` : reflectionMd;
        await writeFile(markdownPath, merged, "utf8");
    }
}
