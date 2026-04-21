// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MigrationRunner } from "./runner";
import { createClient } from "../supabase/cli";
import { readdir, readFile } from "fs/promises";

// Mocks
vi.mock("../supabase/cli", () => ({
    createClient: vi.fn()
}));

vi.mock("fs/promises", () => ({
    readdir: vi.fn(),
    readFile: vi.fn()
}));

vi.mock("./rollback", () => {
    return {
        RollbackManager: class {
            hasDownMigration = vi.fn();
            executeDownMigration = vi.fn();
        }
    };
});

vi.mock("../utils/logger", () => ({
    Logging: {
        warn: vi.fn(),
        info: vi.fn(),
        log: vi.fn(),
        success: vi.fn(),
        error: vi.fn(),
        header: vi.fn(),
        critical: vi.fn()
    }
}));

describe("MigrationRunner", () => {
    let runner: MigrationRunner;
    let mockSupabase: any;
    let mockBuilder: any;

    beforeEach(() => {
        vi.clearAllMocks();

        mockBuilder = {
            select: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            insert: vi.fn().mockReturnThis(),
            delete: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockReturnThis(),
            then: (resolve: any) => resolve({ data: [], error: null })
        };

        mockSupabase = {
            rpc: vi.fn().mockResolvedValue({ error: null }),
            from: vi.fn().mockReturnValue(mockBuilder)
        };

        (createClient as any).mockReturnValue(mockSupabase);
        runner = new MigrationRunner();
    });

    // Helper to mock data return
    const mockData = (data: any) => {
        mockBuilder.then = (resolve: any) => resolve({ data, error: null });
    };

    describe("init", () => {
        it("creates client and ensures table", async () => {
            (readFile as any).mockResolvedValue("SQL");

            await runner.init();

            expect(createClient).toHaveBeenCalled();
            expect(mockSupabase.rpc).toHaveBeenCalledWith("exec_sql", { sql: "SELECT 1" });
            expect(readFile).toHaveBeenCalledWith(
                expect.stringContaining("create-migration-table.sql"),
                "utf-8"
            );
            expect(mockSupabase.rpc).toHaveBeenCalledWith("exec_sql", { sql: "SQL" });
        });
    });

    describe("runMigrations", () => {
        it("skips if no pending migrations", async () => {
            (readdir as any).mockResolvedValue(["001.sql", "002.sql"]);

            mockData([
                { filename: "001.sql", executed_at: "now" },
                { filename: "002.sql", executed_at: "now" }
            ]);

            const results = await runner.runMigrations();

            expect(results).toHaveLength(0);
            expect(mockSupabase.rpc).toHaveBeenCalledWith("exec_sql", { sql: "SELECT 1" });
        });

        it("runs pending migrations", async () => {
            (readdir as any).mockResolvedValue(["001.sql", "002.sql"]);

            // 001 executed, 002 pending
            mockData([{ filename: "001.sql", executed_at: "now" }]);
            (readFile as any).mockResolvedValue("CREATE TABLE foo");

            const results = await runner.runMigrations();

            expect(results).toHaveLength(1);
            expect(results[0].filename).toBe("002.sql");
            expect(results[0].success).toBe(true);

            expect(mockBuilder.insert).toHaveBeenCalledWith({ filename: "002.sql" });
        });

        it("stops on error", async () => {
            (readdir as any).mockResolvedValue(["001.sql", "002.sql"]);
            mockData([]);

            mockSupabase.rpc
                .mockResolvedValueOnce({ error: null }) // select 1 check
                .mockResolvedValueOnce({ error: null }) // table creation
                .mockResolvedValueOnce({ error: null }) // policies
                .mockResolvedValueOnce({ error: { message: "SQL Error" } }); // executed migration

            const results = await runner.runMigrations();

            expect(results).toHaveLength(1);
            expect(results[0].success).toBe(false);
            expect(results[0].error).toBe("SQL Error");
            expect(results.some((r) => r.filename === "002.sql")).toBe(false);
        });
    });

    describe("rollbackLastMigration", () => {
        it("does nothing if no migrations", async () => {
            mockData([]);
            await runner.rollbackLastMigration();
            expect(mockBuilder.delete).not.toHaveBeenCalled();
        });

        it("rolls back last migration with down script", async () => {
            mockData([{ filename: "002.sql" }]);

            // Get instance of RollbackManager mock
            const rollbackMock = (runner as any).rollbackManager;
            rollbackMock.hasDownMigration.mockResolvedValue(true);
            rollbackMock.executeDownMigration.mockResolvedValue({ success: true });

            await runner.rollbackLastMigration();

            expect(rollbackMock.executeDownMigration).toHaveBeenCalledWith("002.sql", mockSupabase);
            expect(mockBuilder.delete).toHaveBeenCalled();
        });

        it("deletes record only if no down script", async () => {
            mockData([{ filename: "002.sql" }]);

            const rollbackMock = (runner as any).rollbackManager;
            rollbackMock.hasDownMigration.mockResolvedValue(false);

            await runner.rollbackLastMigration();

            expect(rollbackMock.executeDownMigration).not.toHaveBeenCalled();
            expect(mockBuilder.delete).toHaveBeenCalled();
        });
    });
});
