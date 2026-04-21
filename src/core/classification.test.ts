import { describe, expect, it } from "vitest";

import { classifyPromptFallback } from "./classification.js";

describe("classifyPromptFallback", () => {
    it("detects bugfix task type and scope tokens", () => {
        const result = classifyPromptFallback("fix api-gateway route in src/server/routes.ts");

        expect(result.taskType).toBe("bugfix");
        expect(result.scope).toContain("src/server/routes.ts");
        expect(result.verificationPlan).toContain("pnpm test");
    });

    it("returns deterministic defaults when no obvious scope exists", () => {
        const result = classifyPromptFallback("improve reliability and cleanup code");

        expect(result.taskType).toBe("refactor");
        expect(result.keywords.length).toBeGreaterThan(0);
        expect(result.confidence).toBe(0.45);
    });
});
