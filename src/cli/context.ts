import { GroqAdapter } from "../adapters/groq.js";
import { ArtifactManager } from "../core/artifacts.js";
import { createHybridStorageFromEnv } from "../storage/hybrid-storage.js";

export function createCliContext(rootDir: string = process.cwd()) {
    const projectId = process.env.MEMORYQ_PROJECT_ID || "default";

    return {
        projectId,
        storage: createHybridStorageFromEnv(rootDir),
        assistant: new GroqAdapter(process.env.GROQ_API_KEY, process.env.GROQ_MODEL),
        artifactManager: new ArtifactManager(rootDir)
    };
}
