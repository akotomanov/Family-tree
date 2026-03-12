import { config as loadEnv } from 'dotenv';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env if it exists, otherwise fall back to defaults (sample-family)
const envPath = resolve(__dirname, '.env');
if (existsSync(envPath)) {
  loadEnv({ path: envPath });
}

const vaultPath = resolve(__dirname, process.env.VAULT_PATH || '../sample-family');

export const CONFIG = {
  gedcomPath: process.env.GEDCOM_PATH || '',
  obsidianVaultPath: vaultPath,
  obsidianTemplatePath: join(vaultPath, 'Templates', 'Template.md'),
  photosPath: join(vaultPath, 'Photos'),
  conflictsReportPath: './conflicts.md',
  syncReportPath: './sync-report.md',
  excludeDirs: (process.env.EXCLUDE_DIRS || 'Archive,Templates,.obsidian,Photos').split(','),
  rootPerson: process.env.ROOT_PERSON || 'Brian Johnson',
};
