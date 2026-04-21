import type { PlanOutput, ReflectionOutput } from "../types.js";

function section(title: string, values: string[]): string {
    if (values.length === 0) {
        return `## ${title}\n\n- (none)`;
    }

    return `## ${title}\n\n${values.map((value) => `- ${value}`).join("\n")}`;
}

export function renderPlanMarkdown(output: PlanOutput): string {
    const sourceLines = output.sources.map(
        (source) => `- ${source.type}:${source.id} (confidence=${source.confidence.toFixed(2)})`
    );

    return [
        `# MemoryQ Plan ${output.runId}`,
        "",
        `- taskType: ${output.taskType}`,
        `- confidence: ${output.confidence.toFixed(2)}`,
        `- storageMode: ${output.storageMode}`,
        `- generatedAt: ${output.generatedAt}`,
        "",
        section("Scope", output.scope),
        "",
        section("Architecture Notes", output.architectureNotes),
        "",
        section("Known Mistakes", output.knownMistakes),
        "",
        section("Files To Inspect", output.filesToInspect),
        "",
        section("Verification Plan", output.verificationPlan),
        "",
        section("Sources", sourceLines)
    ].join("\n");
}

export function renderReflectionMarkdown(output: ReflectionOutput): string {
    const lessonLines = output.newLessons.map(
        (lesson) =>
            `- [${lesson.severity}] ${lesson.lessonText} (taskType=${lesson.taskType}, confidence=${lesson.confidence.toFixed(2)})`
    );

    return [
        `# MemoryQ Reflection ${output.runId}`,
        "",
        `- shouldPersist: ${output.shouldPersist}`,
        `- confidence: ${output.confidence.toFixed(2)}`,
        `- storageMode: ${output.storageMode}`,
        `- generatedAt: ${output.generatedAt}`,
        "",
        "## Summary",
        "",
        output.summary,
        "",
        section("New Lessons", lessonLines),
        "",
        section("Updated Knowledge", output.updatedKnowledge)
    ].join("\n");
}
