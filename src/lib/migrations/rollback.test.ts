// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RollbackManager } from "./rollback";
import { readFile } from "fs/promises";

vi.mock("fs/promises", () => ({
    readdir: vi.fn(),
    readFile: vi.fn()
}));

vi.mock("../utils/logger", () => ({
    Logging: {
        warn: vi.fn(),
        info: vi.fn(),
        log: vi.fn(),
        success: vi.fn(),
        error: vi.fn()
    }
}));

describe("RollbackManager", () => {
    let manager: RollbackManager;
    const mockSupabase = {
        rpc: vi.fn()
    } as any;

    beforeEach(() => {
        vi.clearAllMocks();
        manager = new RollbackManager("migrations");
    });

    describe("hasDownMigration", () => {
        it("returns true if down file exists", async () => {
            (readFile as any).mockResolvedValue("sql content");
            const result = await manager.hasDownMigration("001_test.sql");
            expect(result).toBe(true);
            expect(readFile).toHaveBeenCalledWith(
                expect.stringContaining("001_test_down.sql"),
                "utf-8"
            );
        });

        it("returns false if down file missing", async () => {
            (readFile as any).mockRejectedValue(new Error("ENOENT"));
            const result = await manager.hasDownMigration("001_test.sql");
            expect(result).toBe(false);
        });
    });

    describe("getDownMigrationScript", () => {
        it("returns script content", async () => {
            (readFile as any).mockResolvedValue("DROP TABLE x");
            const result = await manager.getDownMigrationScript("001_test.sql");
            expect(result).toBe("DROP TABLE x");
        });

        it("returns null if error reading", async () => {
            (readFile as any).mockRejectedValue(new Error("Read error"));
            const result = await manager.getDownMigrationScript("001_test.sql");
            expect(result).toBeNull();
        });
    });

    describe("executeDownMigration", () => {
        it("returns error if script not found", async () => {
            vi.spyOn(manager, "getDownMigrationScript").mockResolvedValue(null);
            const result = await manager.executeDownMigration("001_test.sql", mockSupabase);
            expect(result.success).toBe(false);
            expect(result.error).toContain("No down migration script found");
        });

        it("executes rpc successfully", async () => {
            vi.spyOn(manager, "getDownMigrationScript").mockResolvedValue("DROP TABLE x");
            mockSupabase.rpc.mockResolvedValue({ error: null });

            const result = await manager.executeDownMigration("001_test.sql", mockSupabase);

            expect(result.success).toBe(true);
            expect(mockSupabase.rpc).toHaveBeenCalledWith("exec_sql", { sql: "DROP TABLE x" });
        });

        it("returns error if rpc fails", async () => {
            vi.spyOn(manager, "getDownMigrationScript").mockResolvedValue("DROP TABLE x");
            mockSupabase.rpc.mockResolvedValue({ error: { message: "RPC Error" } });

            const result = await manager.executeDownMigration("001_test.sql", mockSupabase);

            expect(result.success).toBe(false);
            expect(result.error).toBe("RPC Error");
        });

        it("catches unexpected errors", async () => {
            vi.spyOn(manager, "getDownMigrationScript").mockRejectedValue(new Error("Boom"));
            const result = await manager.executeDownMigration("001_test.sql", mockSupabase);

            expect(result.success).toBe(false);
            expect(result.error).toBe("Boom");
        });
    });
});
