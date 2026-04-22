import { createHash } from "node:crypto";
import { access, readdir, readFile, writeFile } from "node:fs/promises";
import { extname, join, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { config } from "dotenv";

import {
    CAVEMAN_MEMORY_MIN_RECORDS,
    CAVEMAN_MEMORY_RECORDS,
    type CavemanMemoryRecord
} from "../src/default-data/caveman-memory.js";
import { createCliContext } from "../src/cli/context.js";
import { SeedService, type SeedResult } from "../src/services/seed-service.js";

const DEFAULT_ROOT_DIR = process.cwd();

const INCLUDED_EXTENSIONS = new Set([
    ".md",
    ".mdc",
    ".toml",
    ".json",
    ".yaml",
    ".yml",
    ".js",
    ".py"
]);
const INCLUDED_BASENAMES = new Set([
    "SKILL.md",
    "AGENTS.md",
    "GEMINI.md",
    "README.md",
    "SECURITY.md"
]);
const EXCLUDED_SEGMENTS = new Set([
    ".git",
    "assets",
    "docs",
    "node_modules",
    "results",
    "__pycache__"
]);
const EXCLUDED_SUFFIXES = [".svg", ".html", ".lock", ".original.md"];

export const CAVEMAN_REQUIRED_CATEGORIES = [
    "mode",
    "compress",
    "review",
    "commit",
    "help",
    "hooks",
    "install",
    "sync",
    "agent-integration",
    "security",
    "validation",
    "evals",
    "benchmarks",
    "verification"
] as const;

export interface DuplicateSource {
    sourcePath: string;
    duplicateOf: string;
}

export interface CavemanMemoryAuditReport {
    sourceAvailable: boolean;
    sourceFiles: string[];
    uniqueSourceFiles: string[];
    duplicateSources: DuplicateSource[];
    coveredSourceLabels: string[];
    uncoveredSourceFiles: string[];
    missingSourceLabels: string[];
    presentCategories: string[];
    missingCategories: string[];
    recordCount: number;
}

export interface CavemanMemoryImportOptions {
    seedDatabase?: boolean;
    seedService?: Pick<SeedService, "seedCaveman">;
    output?: NodeJS.WritableStream;
}

export interface CavemanMemoryImportResult {
    auditReport: CavemanMemoryAuditReport;
    seedResult: SeedResult | null;
}

function normalizePath(path: string): string {
    return path.split(sep).join("/");
}

async function pathExists(path: string): Promise<boolean> {
    try {
        await access(path);
        return true;
    } catch {
        return false;
    }
}

function sourcePathToRepoPath(sourcePath: string): string {
    if (sourcePath.startsWith("caveman://")) {
        return `caveman/${sourcePath.slice("caveman://".length)}`;
    }

    return sourcePath;
}

function repoPathToSourceLabel(sourcePath: string): string {
    return sourcePath.startsWith("caveman/")
        ? `caveman://${sourcePath.slice("caveman/".length)}`
        : sourcePath;
}

function isMeaningfulSource(path: string): boolean {
    const normalized = normalizePath(path);
    const segments = normalized.split("/");
    const basename = segments[segments.length - 1] ?? "";
    const extension = extname(basename);

    if (segments.some((segment) => EXCLUDED_SEGMENTS.has(segment))) {
        return false;
    }

    if (EXCLUDED_SUFFIXES.some((suffix) => basename.endsWith(suffix))) {
        return false;
    }

    if (normalized.includes("/tests/caveman-compress/")) {
        return false;
    }

    return INCLUDED_BASENAMES.has(basename) || INCLUDED_EXTENSIONS.has(extension);
}

async function listFiles(dir: string): Promise<string[]> {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = await Promise.all(
        entries.map(async (entry) => {
            const fullPath = join(dir, entry.name);
            if (entry.isDirectory()) {
                return listFiles(fullPath);
            }
            return [fullPath];
        })
    );

    return files.flat();
}

function contentHash(content: string): string {
    const normalized = content.replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim();
    return createHash("sha256").update(normalized).digest("hex");
}

function quote(value: string): string {
    return JSON.stringify(value);
}

function categoryPresent(category: string, records: CavemanMemoryRecord[]): boolean {
    return records.some((record) => {
        const key = record.key.toLowerCase();
        const scope = record.scope.map((item) => item.toLowerCase());

        switch (category) {
            case "mode":
                return key.startsWith("caveman.mode.");
            case "compress":
                return key.startsWith("caveman.compress.") || scope.includes("compression");
            case "review":
                return key.startsWith("caveman.review.") || scope.includes("code-review");
            case "commit":
                return key.startsWith("caveman.commit.") || scope.includes("commit");
            case "benchmarks":
                return key.startsWith("caveman.benchmarks.") || scope.includes("benchmark");
            default:
                return key.startsWith(`caveman.${category}.`) || scope.includes(category);
        }
    });
}

function renderRecord(record: CavemanMemoryRecord): string {
    const common = [
        `key: ${quote(record.key)}`,
        `kind: ${quote(record.kind)}`,
        `text: ${quote(record.text)}`,
        `scope: [${record.scope.map(quote).join(", ")}]`,
        `taskType: ${quote(record.taskType)}`
    ];

    const specific =
        record.kind === "lesson"
            ? [`severity: ${quote(record.severity)}`]
            : [`noteType: ${quote(record.noteType)}`];

    return [
        "    {",
        [
            ...common,
            ...specific,
            `confidence: ${record.confidence}`,
            `sourcePath: ${quote(record.sourcePath)}`
        ]
            .map((line) => `        ${line}`)
            .join(",\n"),
        "    }"
    ].join("\n");
}

function renderCatalog(records: CavemanMemoryRecord[]): string {
    return `import type { KnowledgeType, LessonSeverity, TaskType } from "../types.js";
import type { KnowledgeUpsert, LessonInsert } from "../storage/types.js";

interface BaseCavemanMemoryRecord {
    key: string;
    text: string;
    scope: string[];
    taskType: TaskType;
    confidence: number;
    sourcePath: string;
}

export interface CavemanLessonMemoryRecord extends BaseCavemanMemoryRecord {
    kind: "lesson";
    severity: LessonSeverity;
}

export interface CavemanKnowledgeMemoryRecord extends BaseCavemanMemoryRecord {
    kind: "knowledge";
    noteType: KnowledgeType;
}

export type CavemanMemoryRecord = CavemanLessonMemoryRecord | CavemanKnowledgeMemoryRecord;

export const CAVEMAN_MEMORY_MIN_RECORDS = ${CAVEMAN_MEMORY_MIN_RECORDS};

export const CAVEMAN_MEMORY_RECORDS: CavemanMemoryRecord[] = [
${records.map(renderRecord).join(",\n")}
];

export const CAVEMAN_LESSONS: Omit<LessonInsert, "projectId" | "sourceRunId">[] =
    CAVEMAN_MEMORY_RECORDS.flatMap((record) =>
        record.kind === "lesson"
            ? [
                  {
                      lessonKey: record.key,
                      lessonText: record.text,
                      scope: record.scope,
                      taskType: record.taskType,
                      severity: record.severity,
                      confidence: record.confidence
                  }
              ]
            : []
    );

export const CAVEMAN_KNOWLEDGE: Omit<KnowledgeUpsert, "projectId">[] =
    CAVEMAN_MEMORY_RECORDS.flatMap((record) =>
        record.kind === "knowledge"
            ? [
                  {
                      noteType: record.noteType,
                      noteText: record.text,
                      scope: record.scope,
                      confidence: record.confidence
                  }
              ]
            : []
    );
`;
}

export async function auditCavemanMemoryCatalog(
    rootDir: string = DEFAULT_ROOT_DIR
): Promise<CavemanMemoryAuditReport> {
    const cavemanDir = join(rootDir, "caveman");
    const sourceAvailable = await pathExists(cavemanDir);
    const sourceFiles = sourceAvailable
        ? (await listFiles(cavemanDir))
              .map((path) => normalizePath(relative(rootDir, path)))
              .filter(isMeaningfulSource)
              .sort()
        : [];

    const seenHashes = new Map<string, string>();
    const uniqueSourceFiles: string[] = [];
    const duplicateSources: DuplicateSource[] = [];

    for (const sourcePath of sourceFiles) {
        const content = await readFile(join(rootDir, sourcePath), "utf8");
        const hash = contentHash(content);
        const duplicateOf = seenHashes.get(hash);

        if (duplicateOf) {
            duplicateSources.push({ sourcePath, duplicateOf });
        } else {
            seenHashes.set(hash, sourcePath);
            uniqueSourceFiles.push(sourcePath);
        }
    }

    const coveredSourceLabels = [
        ...new Set(CAVEMAN_MEMORY_RECORDS.map((record) => record.sourcePath))
    ].sort();
    const coveredRepoPaths = new Set(coveredSourceLabels.map(sourcePathToRepoPath));
    const sourceSet = new Set(sourceFiles);
    const duplicateSet = new Set(duplicateSources.map((source) => source.sourcePath));
    const missingSourceLabels = sourceAvailable
        ? coveredSourceLabels.filter(
              (sourceLabel) => !sourceSet.has(sourcePathToRepoPath(sourceLabel))
          )
        : [];
    const uncoveredSourceFiles = sourceAvailable
        ? uniqueSourceFiles.filter(
              (sourcePath) => !coveredRepoPaths.has(sourcePath) && !duplicateSet.has(sourcePath)
          )
        : [];
    const presentCategories = CAVEMAN_REQUIRED_CATEGORIES.filter((category) =>
        categoryPresent(category, CAVEMAN_MEMORY_RECORDS)
    );
    const missingCategories = CAVEMAN_REQUIRED_CATEGORIES.filter(
        (category) => !presentCategories.includes(category)
    );

    return {
        sourceAvailable,
        sourceFiles,
        uniqueSourceFiles,
        duplicateSources,
        coveredSourceLabels,
        uncoveredSourceFiles,
        missingSourceLabels,
        presentCategories,
        missingCategories,
        recordCount: CAVEMAN_MEMORY_RECORDS.length
    };
}

export function assertValidCavemanMemoryCatalog(report: CavemanMemoryAuditReport): void {
    const uniqueKeys = new Set(CAVEMAN_MEMORY_RECORDS.map((record) => record.key));
    if (uniqueKeys.size !== CAVEMAN_MEMORY_RECORDS.length) {
        throw new Error("Caveman memory record keys must be unique.");
    }

    if (CAVEMAN_MEMORY_RECORDS.length < CAVEMAN_MEMORY_MIN_RECORDS) {
        throw new Error(
            `Caveman memory catalog has ${CAVEMAN_MEMORY_RECORDS.length} records; expected at least ${CAVEMAN_MEMORY_MIN_RECORDS}.`
        );
    }

    if (report.sourceAvailable && report.missingSourceLabels.length > 0) {
        throw new Error(
            `Caveman memory records reference missing sources: ${report.missingSourceLabels.join(", ")}`
        );
    }

    if (report.missingCategories.length > 0) {
        throw new Error(
            `Caveman memory catalog is missing categories: ${report.missingCategories.join(", ")}`
        );
    }
}

function renderAuditReport(report: CavemanMemoryAuditReport): string {
    if (!report.sourceAvailable) {
        return [
            "Caveman source directory not found; validated the self-contained catalog only.",
            `Covered source labels retained in records: ${report.coveredSourceLabels.length}.`,
            `Required categories present: ${report.presentCategories.join(", ")}.`
        ].join("\n");
    }

    return [
        `Scanned ${report.sourceFiles.length} meaningful source files.`,
        `Unique after content-hash dedupe: ${report.uniqueSourceFiles.length}.`,
        `Ignored duplicate sources: ${report.duplicateSources.length}.`,
        `Covered source labels: ${report.coveredSourceLabels.length}.`,
        `Uncovered unique meaningful sources: ${report.uncoveredSourceFiles.length}.`,
        `Required categories present: ${report.presentCategories.join(", ")}.`,
        report.duplicateSources.length > 0
            ? `Duplicate sample: ${report.duplicateSources
                  .slice(0, 8)
                  .map((source) => `${source.sourcePath} -> ${source.duplicateOf}`)
                  .join("; ")}.`
            : "Duplicate sample: none.",
        report.uncoveredSourceFiles.length > 0
            ? `Uncovered sample: ${report.uncoveredSourceFiles
                  .slice(0, 12)
                  .map(repoPathToSourceLabel)
                  .join(", ")}.`
            : "Uncovered sample: none."
    ].join("\n");
}

export async function writeCavemanMemoryCatalog(rootDir: string = DEFAULT_ROOT_DIR): Promise<void> {
    const report = await auditCavemanMemoryCatalog(rootDir);
    assertValidCavemanMemoryCatalog(report);

    const sortedRecords = [...CAVEMAN_MEMORY_RECORDS].sort((a, b) => a.key.localeCompare(b.key));
    const outputPath = join(rootDir, "src", "default-data", "caveman-memory.ts");
    await writeFile(outputPath, renderCatalog(sortedRecords), "utf8");

    process.stdout.write(
        [
            `Wrote ${sortedRecords.length} Caveman memory records to ${normalizePath(relative(rootDir, outputPath))}.`,
            renderAuditReport(report)
        ].join("\n") + "\n"
    );
}

function renderSeedResult(result: SeedResult): string {
    return [
        `Seeded ${result.createdOrUpdatedLessons + result.createdOrUpdatedKnowledge} Caveman memory records into ${result.storageMode} storage.`,
        JSON.stringify(result)
    ].join("\n");
}

function createDefaultSeedService(rootDir: string): SeedService {
    config();
    return new SeedService(createCliContext(rootDir));
}

export async function importCavemanMemoryCatalog(
    rootDir: string = DEFAULT_ROOT_DIR,
    options: CavemanMemoryImportOptions = {}
): Promise<CavemanMemoryImportResult> {
    const output = options.output ?? process.stdout;
    const seedDatabase = options.seedDatabase ?? true;
    const auditReport = await auditCavemanMemoryCatalog(rootDir);
    assertValidCavemanMemoryCatalog(auditReport);

    const sortedRecords = [...CAVEMAN_MEMORY_RECORDS].sort((a, b) => a.key.localeCompare(b.key));
    const outputPath = join(rootDir, "src", "default-data", "caveman-memory.ts");
    await writeFile(outputPath, renderCatalog(sortedRecords), "utf8");

    output.write(
        [
            `Wrote ${sortedRecords.length} Caveman memory records to ${normalizePath(relative(rootDir, outputPath))}.`,
            renderAuditReport(auditReport)
        ].join("\n") + "\n"
    );

    if (!seedDatabase) {
        output.write("Skipped database seed because --no-seed was provided.\n");
        return {
            auditReport,
            seedResult: null
        };
    }

    const seedService = options.seedService ?? createDefaultSeedService(rootDir);
    const seedResult = await seedService.seedCaveman();
    output.write(`${renderSeedResult(seedResult)}\n`);

    return {
        auditReport,
        seedResult
    };
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === invokedPath) {
    const seedDatabase = !process.argv.includes("--no-seed");
    importCavemanMemoryCatalog(DEFAULT_ROOT_DIR, { seedDatabase }).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`${message}\n`);
        process.exitCode = 1;
    });
}
