import { createEmbeddingAdapterFromEnv } from "../adapters/embeddings.js";
import { GroqAdapter } from "../adapters/groq.js";
import { ArtifactManager } from "../core/artifacts.js";
import { createHybridStorageFromEnv } from "../storage/hybrid-storage.js";
import type { MemoryOwnerType } from "../types.js";

function parseOwnerType(value: string | undefined): MemoryOwnerType {
    return value === "agent" || value === "user" || value === "project" ? value : "project";
}

export function createCliContext(rootDir: string = process.cwd()) {
    const projectId = process.env.MEMORYQ_PROJECT_ID || "default";
    const ownerType = parseOwnerType(process.env.MEMORYQ_OWNER_TYPE);
    const ownerId = process.env.MEMORYQ_OWNER_ID || projectId;

    return {
        rootDir,
        projectId,
        ownerType,
        ownerId,
        storage: createHybridStorageFromEnv(rootDir),
        assistant: new GroqAdapter(process.env.GROQ_API_KEY, process.env.GROQ_MODEL),
        embedder: createEmbeddingAdapterFromEnv(),
        artifactManager: new ArtifactManager(rootDir)
    };
}
