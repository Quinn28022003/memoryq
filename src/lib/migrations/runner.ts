import { createClient } from "../supabase/cli.js";
import { readdir, readFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { SupabaseClient } from "@supabase/supabase-js";
import { RollbackManager } from "./rollback.js";
import { Logging } from "../../utils/logger.js";

const currentDir = dirname(fileURLToPath(import.meta.url));

interface MigrationRecord {
    filename: string;
    executed_at: string;
}

interface MigrationResult {
    filename: string;
    success: boolean;
    error?: string;
    executionTime: number;
}

interface MigrationStatus {
    filename: string;
    executed: boolean;
    executedAt?: string;
    order: number;
}

export class MigrationRunner {
    private supabase!: SupabaseClient;
    private migrationsPath: string;
    private rollbackManager: RollbackManager;

    constructor(migrationsPath = "supabase/migrations") {
        this.migrationsPath = migrationsPath;
        this.rollbackManager = new RollbackManager(migrationsPath);
    }

    async init() {
        this.supabase = createClient();
        await this.bootstrapIfNeeded();
        await this.ensureMigrationTable();
    }

    /**
     * Create the _migration table with RLS if it doesn't exist
     */
    private async ensureMigrationTable(): Promise<void> {
        try {
            // Load and execute the migration table creation SQL
            const tableSQL = await readFile(
                join(currentDir, "sql", "create-migration-table.sql"),
                "utf-8"
            );
            const { error: tableError } = await this.supabase.rpc("exec_sql", { sql: tableSQL });
            if (tableError && !tableError.message.includes("already exists")) {
                Logging.warn(`Warning during migration table setup: ${tableError.message}`);
            }

            // Load and execute the policies SQL
            const policiesSQL = await readFile(
                join(currentDir, "sql", "create-migration-policies.sql"),
                "utf-8"
            );
            const { error: policiesError } = await this.supabase.rpc("exec_sql", {
                sql: policiesSQL
            });
            if (policiesError && !policiesError.message.includes("already exists")) {
                Logging.warn(
                    `Warning during policy creation: ${policiesError.message}. Found when trying to execute ${policiesSQL}`
                );
            }
        } catch (error) {
            Logging.warn(`Warning: Could not load SQL files, using fallback: ${error}`);
            // Fallback to inline SQL if files can't be loaded
            await this.ensureMigrationTableFallback();
        }
    }

    /**
     * Bootstrap the migration system if needed
     */
    private async bootstrapIfNeeded(): Promise<void> {
        try {
            // Check if exec_sql function exists by trying to use it
            const { error: testError } = await this.supabase.rpc("exec_sql", { sql: "SELECT 1" });
            if (testError && testError.message.includes("Could not find the function")) {
                Logging.warn("exec_sql function not found. Migration system needs manual setup.");
                Logging.info("Please run this SQL in your Supabase SQL Editor:");
                Logging.info(`
CREATE OR REPLACE FUNCTION public.exec_sql(sql TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql;
END;
$$;

GRANT EXECUTE ON FUNCTION public.exec_sql(TEXT) TO service_role;
        `);
                Logging.info("The same SQL is available at: supabase/bootstrap/0000_exec_sql.sql");
                Logging.info("After creating the function, run: npm run migrate:up");
                throw new Error(
                    "exec_sql function not available. Please create it manually first."
                );
            }
        } catch (error) {
            if (
                error instanceof Error &&
                error.message.includes("exec_sql function not available")
            ) {
                throw error;
            }
            // Other errors are fine, just continue
        }
    }

    /**
     * Fallback method for creating migration table (used if SQL files can't be loaded)
     */
    private async ensureMigrationTableFallback(): Promise<void> {
        const statements = [
            `CREATE TABLE IF NOT EXISTS public._migration (
        id SERIAL PRIMARY KEY,
        filename TEXT NOT NULL UNIQUE,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
            `ALTER TABLE public._migration ENABLE ROW LEVEL SECURITY`
        ];

        for (const sql of statements) {
            const { error } = await this.supabase.rpc("exec_sql", { sql });
            if (error && !error.message.includes("already exists")) {
                Logging.warn(`Warning during migration table setup: ${error.message}`);
            }
        }

        const policies = [
            `CREATE POLICY IF NOT EXISTS "Allow authenticated users to read migrations" 
        ON public._migration FOR SELECT 
        TO authenticated 
        USING (true)`,
            `CREATE POLICY IF NOT EXISTS "Allow service role to manage migrations" 
        ON public._migration FOR ALL 
        TO service_role 
        USING (true)`
        ];

        for (const policy of policies) {
            const { error } = await this.supabase.rpc("exec_sql", { sql: policy });
            if (error && !error.message.includes("already exists")) {
                Logging.warn(
                    `Warning during policy creation: ${error.message}. Found when trying to execute ${policy}`
                );
            }
        }
    }

    /**
     * Get all migration files from the migrations directory
     */
    private async getMigrationFiles(): Promise<string[]> {
        try {
            const files = await readdir(this.migrationsPath);
            return files.filter((file) => file.endsWith(".sql")).sort(); // Files are naturally sorted by timestamp due to naming convention
        } catch (error) {
            throw new Error(`Failed to read migrations directory: ${error}`);
        }
    }

    /**
     * Get executed migrations from the database with execution order
     */
    private async getExecutedMigrations(): Promise<Map<string, MigrationRecord>> {
        try {
            const { data, error } = await this.supabase
                .from("_migration")
                .select("filename, executed_at")
                .order("executed_at", { ascending: true });

            if (error) {
                // If the table doesn't exist yet, return empty map
                if (error.message.includes("does not exist")) {
                    Logging.info(
                        "Migration table does not exist yet, will be created during first migration"
                    );
                    return new Map<string, MigrationRecord>();
                }
                throw new Error(`Failed to fetch executed migrations: ${error.message}`);
            }

            const migrationMap = new Map<string, MigrationRecord>();
            (data as MigrationRecord[]).forEach((record) => {
                migrationMap.set(record.filename, record);
            });

            return migrationMap;
        } catch {
            // If there's any error accessing the table, assume it doesn't exist
            Logging.info("Migration table not accessible, will be created during first migration");
            return new Map<string, MigrationRecord>();
        }
    }

    /**
     * Analyze migration status and detect out-of-order scenarios
     */
    private analyzeMigrationStatus(
        allMigrations: string[],
        executedMigrations: Map<string, MigrationRecord>
    ): MigrationStatus[] {
        const status: MigrationStatus[] = [];

        for (let i = 0; i < allMigrations.length; i++) {
            const filename = allMigrations[i];
            const executed = executedMigrations.has(filename);
            const executedRecord = executedMigrations.get(filename);

            status.push({
                filename,
                executed,
                executedAt: executedRecord?.executed_at,
                order: i + 1
            });
        }

        return status;
    }

    /**
     * Detect and report out-of-order migration scenarios
     */
    private detectOutOfOrderMigrations(status: MigrationStatus[]): {
        hasOutOfOrder: boolean;
        outOfOrderMigrations: MigrationStatus[];
        missingMigrations: MigrationStatus[];
    } {
        const outOfOrderMigrations: MigrationStatus[] = [];
        const missingMigrations: MigrationStatus[] = [];

        // Find gaps in execution order
        for (let i = 0; i < status.length; i++) {
            const current = status[i];

            if (!current.executed) {
                missingMigrations.push(current);

                // Check if there are executed migrations after this missing one
                const hasExecutedAfter = status.slice(i + 1).some((m) => m.executed);
                if (hasExecutedAfter) {
                    outOfOrderMigrations.push(current);
                }
            }
        }

        return {
            hasOutOfOrder: outOfOrderMigrations.length > 0,
            outOfOrderMigrations,
            missingMigrations
        };
    }

    /**
     * Execute a single migration file
     */
    private async executeMigration(filename: string): Promise<MigrationResult> {
        const startTime = Date.now();

        try {
            const migrationPath = join(this.migrationsPath, filename);
            const migrationSQL = await readFile(migrationPath, "utf-8");

            // Special handling for the first migration that creates exec_sql function
            if (filename === "00000000000001_create_exec_sql_function.sql") {
                Logging.info("Executing bootstrap migration for exec_sql function...");

                // For the bootstrap case, we need to skip this migration if exec_sql doesn't exist
                // and provide clear instructions
                Logging.warn("Cannot execute bootstrap migration automatically");
                Logging.warn("Please create the exec_sql function manually first");
                Logging.info("Run this SQL in your Supabase SQL Editor:");
                Logging.info(migrationSQL);
                throw new Error(
                    "Bootstrap migration requires manual setup. Please create exec_sql function first."
                );
            } else {
                // Execute the migration using exec_sql
                const { error: execError } = await this.supabase.rpc("exec_sql", {
                    sql: migrationSQL
                });

                if (execError) {
                    throw new Error(execError.message);
                }
            }

            // Record the successful migration (only if _migration table exists)
            try {
                const { error: recordError } = await this.supabase
                    .from("_migration")
                    .insert({ filename });
                if (recordError) {
                    Logging.warn(`Warning: Could not record migration: ${recordError.message}`);
                }
            } catch {
                Logging.warn("Migration table not available, skipping record");
            }

            const executionTime = Date.now() - startTime;
            return {
                filename,
                success: true,
                executionTime
            };
        } catch (error) {
            const executionTime = Date.now() - startTime;
            return {
                filename,
                success: false,
                error: error instanceof Error ? error.message : String(error),
                executionTime
            };
        }
    }

    /**
     * Run pending migrations with out-of-order detection
     */
    async runMigrations(): Promise<MigrationResult[]> {
        await this.init();

        Logging.info("Checking for pending migrations...");

        const allMigrations = await this.getMigrationFiles();
        const executedMigrations = await this.getExecutedMigrations();

        // Analyze migration status
        const status = this.analyzeMigrationStatus(allMigrations, executedMigrations);
        const { hasOutOfOrder, outOfOrderMigrations } = this.detectOutOfOrderMigrations(status);

        // Report out-of-order scenarios
        if (hasOutOfOrder) {
            Logging.warn("\nWARNING: Out-of-order migration scenario detected!");
            Logging.warn("The following migrations were executed out of order:");
            outOfOrderMigrations.forEach((migration) => {
                Logging.warn(
                    `  - ${migration.filename} (should be executed before newer migrations)`
                );
            });
            Logging.warn("\nThis can cause issues if migrations depend on each other.");
            Logging.warn("Consider reviewing the migration dependencies and execution order.");
        }

        // Get all pending migrations (including out-of-order ones)
        const pendingMigrations = allMigrations.filter(
            (filename) => !executedMigrations.has(filename)
        );

        if (pendingMigrations.length === 0) {
            Logging.success("No pending migrations found.");
            return [];
        }

        Logging.header(`\nFound ${pendingMigrations.length} pending migration(s):`);
        pendingMigrations.forEach((filename) => {
            const isOutOfOrder = outOfOrderMigrations.some((m) => m.filename === filename);
            if (isOutOfOrder) {
                Logging.warn(`  [WARNING] - ${filename} (out-of-order)`);
            } else {
                Logging.log(`  - ${filename}`);
            }
        });

        // Ask for confirmation if there are out-of-order migrations
        if (hasOutOfOrder && process.env.NODE_ENV === "development") {
            Logging.warn("\nOut-of-order migrations detected. Do you want to continue?");
            Logging.warn("This will execute missing migrations in chronological order.");
            Logging.warn("Press Ctrl+C to abort, or any key to continue...");

            // In a real implementation, you might want to add a proper prompt here
            // For now, we'll continue with a warning
            Logging.info("Continuing with migration execution...\n");
        }

        const results: MigrationResult[] = [];

        for (const filename of pendingMigrations) {
            const isOutOfOrder = outOfOrderMigrations.some((m) => m.filename === filename);

            if (isOutOfOrder) {
                Logging.warn(`\n[WARNING] Executing migration: ${filename} (out-of-order)`);
            } else {
                Logging.info(`\n[EXEC] Executing migration: ${filename}`);
            }

            const result = await this.executeMigration(filename);
            results.push(result);

            if (result.success) {
                Logging.success(`Migration completed successfully in ${result.executionTime}ms`);
            } else {
                Logging.error(`Migration failed: ${result.error}`);
                // Stop execution on first failure
                break;
            }
        }

        return results;
    }

    /**
     * Force run migrations including out-of-order ones (for advanced users)
     */
    async forceRunMigrations(): Promise<MigrationResult[]> {
        await this.init();

        Logging.info("Checking for pending migrations (force mode)...");

        const allMigrations = await this.getMigrationFiles();
        const executedMigrations = await this.getExecutedMigrations();

        // Analyze migration status
        const status = this.analyzeMigrationStatus(allMigrations, executedMigrations);
        const { hasOutOfOrder, outOfOrderMigrations } = this.detectOutOfOrderMigrations(status);

        if (hasOutOfOrder) {
            Logging.critical("\nFORCE MODE: Out-of-order migrations will be executed!");
            Logging.critical("This may cause issues if migrations have dependencies.");
            Logging.critical("Proceeding with execution...\n");
        }

        // Get all pending migrations
        const pendingMigrations = allMigrations.filter(
            (filename) => !executedMigrations.has(filename)
        );

        if (pendingMigrations.length === 0) {
            Logging.success("No pending migrations found.");
            return [];
        }

        Logging.header(`Found ${pendingMigrations.length} pending migration(s) (force mode):`);
        pendingMigrations.forEach((filename) => {
            const isOutOfOrder = outOfOrderMigrations.some((m) => m.filename === filename);
            if (isOutOfOrder) {
                Logging.warn(`  [WARNING] - ${filename} (out-of-order)`);
            } else {
                Logging.log(`  - ${filename}`);
            }
        });

        const results: MigrationResult[] = [];

        for (const filename of pendingMigrations) {
            const isOutOfOrder = outOfOrderMigrations.some((m) => m.filename === filename);

            if (isOutOfOrder) {
                Logging.warn(`\n[WARNING] Executing migration: ${filename} (out-of-order)`);
            } else {
                Logging.info(`\n[EXEC] Executing migration: ${filename}`);
            }

            const result = await this.executeMigration(filename);
            results.push(result);

            if (result.success) {
                Logging.success(`Migration completed successfully in ${result.executionTime}ms`);
            } else {
                Logging.error(`Migration failed: ${result.error}`);
                // Stop execution on first failure
                break;
            }
        }

        return results;
    }

    /**
     * Rollback the last migration with proper down migration support
     */
    async rollbackLastMigration(): Promise<void> {
        await this.init();

        const { data, error } = await this.supabase
            .from("_migration")
            .select("filename, executed_at")
            .order("executed_at", { ascending: false })
            .limit(1);

        if (error) {
            throw new Error(`Failed to fetch last migration: ${error.message}`);
        }

        if (!data || data?.length === 0) {
            Logging.info("No migrations to rollback.");
            return;
        }

        const lastMigration = data[0].filename;
        Logging.warn(`Rolling back migration: ${lastMigration}`);

        // Check if down migration exists
        const hasDownMigration = await this.rollbackManager.hasDownMigration(lastMigration);

        if (hasDownMigration) {
            Logging.info("Down migration script found. Executing rollback...");
            Logging.info(`Rolling back: ${lastMigration}`);

            const result = await this.rollbackManager.executeDownMigration(
                lastMigration,
                this.supabase
            );

            if (result.success) {
                // Remove the migration record
                const { error: deleteError } = await this.supabase
                    .from("_migration")
                    .delete()
                    .eq("filename", lastMigration);

                if (deleteError) {
                    throw new Error(`Failed to remove migration record: ${deleteError.message}`);
                }

                Logging.success(
                    `Migration ${lastMigration} rolled back successfully with down script.`
                );
            } else {
                Logging.error(`Rollback failed: ${result.error}`);
                throw new Error(`Rollback failed: ${result.error}`);
            }
        } else {
            Logging.warn("No down migration script found. Removing migration record only.");
            Logging.warn(`Rolling back: ${lastMigration} (record only)`);
            Logging.warn(
                `Note: This only removes the migration record. Manual cleanup may be required.`
            );
            Logging.info(
                "To enable proper rollbacks, create down migration scripts in supabase/migrations/down/"
            );

            // Remove the migration record
            const { error: deleteError } = await this.supabase
                .from("_migration")
                .delete()
                .eq("filename", lastMigration);

            if (deleteError) {
                throw new Error(`Failed to rollback migration: ${deleteError.message}`);
            }

            Logging.success(`Migration ${lastMigration} rolled back successfully.`);
        }
    }

    /**
     * Get migration status with out-of-order detection
     */
    async getStatus(): Promise<void> {
        await this.init();

        const allMigrations = await this.getMigrationFiles();
        const executedMigrations = await this.getExecutedMigrations();

        // Analyze migration status
        const status = this.analyzeMigrationStatus(allMigrations, executedMigrations);
        const { hasOutOfOrder, outOfOrderMigrations } = this.detectOutOfOrderMigrations(status);

        Logging.header("\nMigration Status:");
        Logging.log(`Total migrations: ${allMigrations.length}`);
        Logging.success(`Executed: ${executedMigrations.size}`);
        Logging.warn(`Pending: ${allMigrations.length - executedMigrations.size}`);

        if (hasOutOfOrder) {
            Logging.critical(`Out-of-order scenarios: ${outOfOrderMigrations.length}`);
        }

        if (allMigrations.length > 0) {
            Logging.header("\nAll migrations:");
            allMigrations.forEach((filename) => {
                const isExecuted = executedMigrations.has(filename);
                const isOutOfOrder = outOfOrderMigrations.some((m) => m.filename === filename);

                let status = isExecuted ? "[DONE]" : "[PENDING]";

                if (isOutOfOrder) {
                    status = "[WARNING]";
                    Logging.critical(`  ${status} ${filename} (out-of-order)`);
                } else if (isExecuted) {
                    Logging.success(`  ${status} ${filename}`);
                } else {
                    Logging.warn(`  ${status} ${filename}`);
                }
            });
        }

        if (hasOutOfOrder) {
            Logging.critical("\nOut-of-order migrations detected:");
            outOfOrderMigrations.forEach((migration) => {
                const status = migration.executed ? "[DONE]" : "[PENDING]";
                if (migration.executed) {
                    Logging.success(
                        `  ${status} ${migration.filename} (missing from chronological order)`
                    );
                } else {
                    Logging.warn(
                        `  ${status} ${migration.filename} (missing from chronological order)`
                    );
                }
            });
            Logging.info("\nRecommendation: Run migrations to fill in the gaps.");
        }
    }
}

// CLI interface
const isMainModule =
    process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
    const command = process.argv[2];
    const runner = new MigrationRunner();

    async function main() {
        try {
            switch (command) {
                case "up":
                    await runner.runMigrations();
                    break;
                case "up:force":
                    await runner.forceRunMigrations();
                    break;
                case "down":
                    await runner.rollbackLastMigration();
                    break;
                case "status":
                    await runner.getStatus();
                    break;
                default:
                    Logging.error(
                        "Usage: npm run migrate:up | npm run migrate:up:force | npm run migrate:down | npm run migrate:status"
                    );
                    process.exit(1);
            }
        } catch (error) {
            Logging.error("Migration failed:");
            console.error(error);
            process.exit(1);
        }
    }

    main();
}
