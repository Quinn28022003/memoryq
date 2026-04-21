import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { SupabaseClient } from "@supabase/supabase-js";
import { Logging } from "../../utils/logger.js";

interface RollbackMigration {
    filename: string;
    downScript?: string;
    executedAt: string;
}

export class RollbackManager {
    private migrationsPath: string;
    private downMigrationsPath: string;

    constructor(migrationsPath = "supabase/migrations") {
        this.migrationsPath = migrationsPath;
        this.downMigrationsPath = join(migrationsPath, "down");
    }

    /**
     * Get all down migration files
     */
    private async getDownMigrationFiles(): Promise<string[]> {
        try {
            const files = await readdir(this.downMigrationsPath);
            return files
                .filter((file) => file.endsWith(".sql"))
                .sort()
                .reverse(); // Reverse to get most recent first
        } catch {
            Logging.warn(`Down migrations directory not found: ${this.downMigrationsPath}`);
            return [];
        }
    }

    /**
     * Find the corresponding down migration for a given migration
     */
    private findDownMigration(upMigration: string): string | null {
        // Remove the .sql extension and add _down.sql
        const baseName = upMigration.replace(".sql", "");
        const downMigration = `${baseName}_down.sql`;
        return downMigration;
    }

    /**
     * Check if a down migration exists for a given migration
     */
    async hasDownMigration(migrationName: string): Promise<boolean> {
        const downMigration = this.findDownMigration(migrationName);
        if (!downMigration) return false;

        try {
            const downPath = join(this.downMigrationsPath, downMigration);
            await readFile(downPath, "utf-8");
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get the down migration script for a given migration
     */
    async getDownMigrationScript(migrationName: string): Promise<string | null> {
        const downMigration = this.findDownMigration(migrationName);
        if (!downMigration) return null;

        try {
            const downPath = join(this.downMigrationsPath, downMigration);
            return await readFile(downPath, "utf-8");
        } catch {
            return null;
        }
    }

    /**
     * Get available rollback migrations
     */
    async getAvailableRollbacks(executedMigrations: string[]): Promise<RollbackMigration[]> {
        const rollbacks: RollbackMigration[] = [];

        for (const migration of executedMigrations) {
            const hasDown = await this.hasDownMigration(migration);
            if (hasDown) {
                const downScript = await this.getDownMigrationScript(migration);
                rollbacks.push({
                    filename: migration,
                    downScript: downScript || undefined,
                    executedAt: new Date().toISOString() // This would come from the migration record
                });
            }
        }

        return rollbacks;
    }

    /**
     * Execute a down migration
     */
    async executeDownMigration(
        migrationName: string,
        supabase: SupabaseClient
    ): Promise<{ success: boolean; error?: string }> {
        try {
            const downScript = await this.getDownMigrationScript(migrationName);
            if (!downScript) {
                return {
                    success: false,
                    error: `No down migration script found for ${migrationName}`
                };
            }

            Logging.info(`Executing down migration: ${migrationName}`);

            const { error } = await supabase.rpc("exec_sql", { sql: downScript });

            if (error) {
                return {
                    success: false,
                    error: error.message
                };
            }

            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
}
