#!/usr/bin/env node
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Attempt to load chalk in a way that supports both CJS and ESM builds.
let _chalk = null;
try {
  const chalkMod = require("chalk");
  _chalk = chalkMod && (chalkMod.default ?? chalkMod);
} catch {
  // If chalk isn't available just fallback to plain text.
  _chalk = null;
}

// Simple logging wrapper for the script. If chalk is unavailable, fall back to plain text.
const Logging = {
  log: (message) => console.log(message),
  error: (message) => console.error(_chalk ? _chalk.red(message) : message),
  warn: (message) => console.log(_chalk ? _chalk.yellow(message) : message),
  success: (message) => console.log(_chalk ? _chalk.green(message) : message),
  info: (message) => console.log(_chalk ? _chalk.blue(message) : message),
  header: (message) => console.log(_chalk ? _chalk.cyan(message) : message),
  critical: (message) =>
    console.error(_chalk ? _chalk.red.bold(message) : message),
};

// Load environment variables from .env.local or .env
// Load environment variables from .env.local and .env
function loadEnvFile() {
  const envFiles = [".env.local", ".env"];

  for (const envFile of envFiles) {
    const envPath = path.join(process.cwd(), envFile);
    if (fs.existsSync(envPath)) {
      Logging.info(`Loading environment from ${envFile}`);
      require("dotenv").config({ path: envPath });
    }
  }
}

// Load environment variables
loadEnvFile();

const command = process.argv[2];
const runnerPath = path.join(__dirname, "../src/lib/migrations/runner.ts");

if (!command || !["up", "up:force", "down", "status"].includes(command)) {
  Logging.error(
    "Usage: npm run migrate:up | npm run migrate:up:force | npm run migrate:down | npm run migrate:status",
  );
  process.exit(1);
}

// Use the local tsx loader through node. This avoids npx network lookups and
// tsx's CLI IPC server, which can fail in restricted shells.
const child = spawn(process.execPath, ["--import", "tsx", runnerPath, command], {
  stdio: "inherit",
  cwd: process.cwd(),
  env: { ...process.env },
});

child.on("close", (code) => {
  process.exit(code);
});

child.on("error", (error) => {
  Logging.error("Failed to start migration process:");
  console.error(error);
  process.exit(1);
});
