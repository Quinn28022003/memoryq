import { readFile } from "node:fs/promises";

import type { PlanService } from "../services/plan-service.js";
import type { ReflectService } from "../services/reflect-service.js";

export interface PlanCommandOptions {
    prompt: string;
    format: "json" | "markdown";
    artifact: boolean;
}

export interface ReflectCommandOptions {
    runId: string;
    result?: string;
    resultFile?: string;
    artifact: boolean;
}

export async function executePlanCommand(
    planService: PlanService,
    options: PlanCommandOptions
): Promise<string> {
    const { output, markdown } = await planService.runPlan({
        prompt: options.prompt,
        writeArtifact: options.artifact
    });

    if (options.format === "markdown") {
        return markdown;
    }

    return JSON.stringify(output);
}

export async function executeReflectCommand(
    reflectService: ReflectService,
    options: ReflectCommandOptions
): Promise<string> {
    const hasResult = typeof options.result === "string";
    const hasResultFile = typeof options.resultFile === "string";

    if (hasResult === hasResultFile) {
        throw new Error("Provide exactly one of --result or --result-file.");
    }

    const resultText = hasResult
        ? (options.result ?? "")
        : await readFile(options.resultFile as string, "utf8");

    const { output } = await reflectService.runReflection({
        runId: options.runId,
        resultText,
        writeArtifact: options.artifact
    });

    return JSON.stringify(output);
}
