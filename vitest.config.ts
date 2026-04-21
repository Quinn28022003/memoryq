import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "node",
        include: [
            "src/contracts.test.ts",
            "src/core/**/*.test.ts",
            "src/services/**/*.test.ts",
            "src/storage/**/*.test.ts"
        ]
    }
});
