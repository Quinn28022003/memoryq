/**
 * Load environment variables from .env file for CLI scripts
 * Import this at the top of any script that needs .env vars
 */
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env from project root
config({ path: resolve(__dirname, '../.env') });

console.log('✅ Environment variables loaded from .env');
