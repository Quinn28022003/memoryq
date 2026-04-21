export interface EmbeddingAdapter {
    readonly dimensions: number;
    embedText(text: string): Promise<number[]>;
}

const DEFAULT_DIMENSIONS = 384;
const DEFAULT_GROQ_EMBEDDING_DIMENSIONS = 768;
const DEFAULT_GROQ_EMBEDDING_MODEL = "nomic-embed-text-v1_5";
const DEFAULT_GROQ_EMBEDDING_BASE_URL = "https://api.groq.com/openai/v1";

export class ModelEmbeddingAdapter implements EmbeddingAdapter {
    constructor(
        private readonly apiKey: string,
        private readonly model: string,
        readonly dimensions: number,
        private readonly baseUrl: string = DEFAULT_GROQ_EMBEDDING_BASE_URL,
        private readonly includeDimensions: boolean = false
    ) {}

    async embedText(text: string): Promise<number[]> {
        const requestBody: Record<string, unknown> = {
            model: this.model,
            input: text
        };

        if (this.includeDimensions) {
            requestBody.dimensions = this.dimensions;
        }

        const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/embeddings`, {
            method: "POST",
            headers: {
                authorization: `Bearer ${this.apiKey}`,
                "content-type": "application/json"
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error(`Embedding request failed with status ${response.status}.`);
        }

        const responseBody = (await response.json()) as {
            data?: Array<{ embedding?: number[] }>;
        };
        const embedding = responseBody.data?.[0]?.embedding;

        if (!embedding || embedding.length === 0) {
            throw new Error("Embedding model returned an empty vector.");
        }

        if (embedding.length !== this.dimensions) {
            throw new Error(
                `Embedding model returned ${embedding.length} dimensions, expected ${this.dimensions}.`
            );
        }

        return embedding;
    }
}

function hashToken(token: string): number {
    let hash = 2166136261;

    for (let index = 0; index < token.length; index += 1) {
        hash ^= token.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }

    return hash >>> 0;
}

function tokenize(text: string): string[] {
    return text
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .split(/[^a-z0-9_./-]+/i)
        .map((token) => token.trim())
        .filter((token) => token.length > 1);
}

function enrichTokens(tokens: string[]): string[] {
    const enriched = [...tokens];

    for (const token of tokens) {
        if (token.includes("/")) {
            enriched.push(...token.split("/").filter((part) => part.length > 1));
        }

        if (token.includes("-")) {
            enriched.push(...token.split("-").filter((part) => part.length > 1));
        }

        if (token.includes(".")) {
            enriched.push(...token.split(".").filter((part) => part.length > 1));
        }
    }

    for (let index = 0; index < tokens.length - 1; index += 1) {
        enriched.push(`${tokens[index]} ${tokens[index + 1]}`);
    }

    return enriched;
}

export class LocalHashEmbeddingAdapter implements EmbeddingAdapter {
    readonly dimensions: number;

    constructor(dimensions: number = DEFAULT_DIMENSIONS) {
        this.dimensions = dimensions;
    }

    async embedText(text: string): Promise<number[]> {
        const vector = Array.from({ length: this.dimensions }, () => 0);
        const tokens = enrichTokens(tokenize(text));

        for (const token of tokens) {
            const hash = hashToken(token);
            const index = hash % this.dimensions;
            const sign = hash & 1 ? 1 : -1;
            vector[index] += sign;
        }

        const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
        if (magnitude === 0) {
            return vector;
        }

        return vector.map((value) => Number((value / magnitude).toFixed(8)));
    }
}

export function createEmbeddingAdapterFromEnv(): EmbeddingAdapter {
    const configuredDimensions = Number(process.env.MEMORYQ_EMBEDDING_DIMENSIONS);
    const dimensions =
        Number.isInteger(configuredDimensions) && configuredDimensions > 0
            ? configuredDimensions
            : DEFAULT_GROQ_EMBEDDING_DIMENSIONS;

    const apiKey = process.env.MEMORYQ_EMBEDDING_API_KEY ?? process.env.GROQ_API_KEY;
    if (apiKey) {
        return new ModelEmbeddingAdapter(
            apiKey,
            process.env.MEMORYQ_EMBEDDING_MODEL ?? DEFAULT_GROQ_EMBEDDING_MODEL,
            dimensions,
            process.env.MEMORYQ_EMBEDDING_BASE_URL ?? DEFAULT_GROQ_EMBEDDING_BASE_URL,
            process.env.MEMORYQ_EMBEDDING_INCLUDE_DIMENSIONS === "true"
        );
    }

    return new LocalHashEmbeddingAdapter(dimensions);
}
