#!/usr/bin/env node

import { config } from "dotenv";
import { Command, InvalidArgumentError } from "commander";

import { createCliContext } from "./cli/context.js";
import { executePlanCommand, executeReflectCommand, executeSeedCommand } from "./cli/runner.js";
import { PlanService } from "./services/plan-service.js";
import { ReflectService } from "./services/reflect-service.js";
import { SeedService } from "./services/seed-service.js";

config();

function parseFormat(format: string): "json" | "markdown" {
    const normalized = format.trim().toLowerCase();
    if (normalized !== "json" && normalized !== "markdown") {
        throw new InvalidArgumentError("--format must be one of: json, markdown");
    }

    return normalized;
}

async function run(): Promise<void> {
    const program = new Command();

    program
        .name("memoryq")
        .description("MemoryQ CLI for coding-agent memory planning and reflection")
        .showHelpAfterError();

    program
        .command("plan")
        .description("Create a plan brief from a prompt")
        .requiredOption("--prompt <text>", "Prompt for planning")
        .option("--format <format>", "Output format: json|markdown", parseFormat, "json")
        .option("--no-artifact", "Do not write .memoryq/runs artifacts")
        .action(
            async (options: { prompt: string; format: "json" | "markdown"; artifact: boolean }) => {
                const context = createCliContext();
                const planService = new PlanService(context);
                const output = await executePlanCommand(planService, {
                    prompt: options.prompt,
                    format: options.format,
                    artifact: options.artifact
                });
                process.stdout.write(`${output}\n`);
            }
        );

    program
        .command("reflect")
        .description("Reflect on a run result and persist reusable lessons")
        .requiredOption("--run-id <id>", "Run identifier")
        .option("--result <text>", "Reflection result text")
        .option("--result-file <path>", "Path to reflection result text file")
        .option("--no-artifact", "Do not write .memoryq/runs artifacts")
        .action(
            async (options: {
                runId: string;
                result?: string;
                resultFile?: string;
                artifact: boolean;
            }) => {
                const context = createCliContext();
                const reflectService = new ReflectService(context);
                const output = await executeReflectCommand(reflectService, {
                    runId: options.runId,
                    result: options.result,
                    resultFile: options.resultFile,
                    artifact: options.artifact
                });
                process.stdout.write(`${output}\n`);
            }
        );

    program
        .command("seed")
        .description("Seed default project memory with curated knowledge")
        .argument("<target>", "Target dataset to seed (e.g. caveman)")
        .option("--format <format>", "Output format: json|markdown", parseFormat, "json")
        .action(async (target: string, options: { format: "json" | "markdown" }) => {
            const context = createCliContext();
            const seedService = new SeedService(context);
            const output = await executeSeedCommand(seedService, {
                target: target as "caveman",
                format: options.format
            });
            process.stdout.write(`${output}\n`);
        });

    await program.parseAsync(process.argv);
}

run().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
});
