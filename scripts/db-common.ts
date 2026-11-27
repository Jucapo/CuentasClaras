// Shared by `npm run db:backup` and `npm run db:restore-local`: the production ref, where backups
// live (always outside the repo) and how to run the Supabase CLI and psql in the local stack.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, relative, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The production project; every remote command names it explicitly (CLAUDE.md). */
export const PRODUCTION_REF = 'ryuknhuvydlwtbgruqdt';

/** Root of the repository. */
export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const CLI = join(ROOT, 'node_modules', 'supabase', 'dist', 'supabase.js');

/** Files of a backup, inside its folder. */
export const BACKUP_FILES = {
  roles: 'roles.sql',
  schema: 'schema.sql',
  data: 'data.sql',
  migrations: 'migrations.json',
  manifest: 'manifest.json',
} as const;

/** What `db:backup` writes next to the dumps. */
export interface BackupManifest {
  readonly projectRef: string;
  readonly createdAt: string;
  readonly cliVersion: string;
  /** Newest migration applied in production when the backup was taken. */
  readonly latestMigration: string;
  readonly files: Readonly<Record<string, { readonly bytes: number; readonly sha256: string }>>;
}

/** Folder that holds the backups: `CC_BACKUP_DIR`, else ~/Backups/CuentasClaras. */
export function backupRoot(): string {
  return resolve(process.env['CC_BACKUP_DIR'] ?? join(homedir(), 'Backups', 'CuentasClaras'));
}

/** Whether `path` is the repository or inside it: backups never go there. */
export function isInsideRepo(path: string): boolean {
  const fromRoot = relative(ROOT, resolve(path));
  return fromRoot === '' || (!fromRoot.startsWith('..') && !isAbsolute(fromRoot));
}

/** Stops with a message for the user. */
export function fail(message: string): never {
  console.error(`\n✖ ${message}`);
  process.exit(1);
}

/** Runs the Supabase CLI; `capture` returns its standard output instead of showing it. */
export function supabase(args: readonly string[], { capture = false } = {}): string {
  const result = spawnSync(process.execPath, [CLI, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    // The CLI may ask for the database password; the terminal answers it, never this script.
    stdio: capture ? ['inherit', 'pipe', 'inherit'] : 'inherit',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    fail(`Falló: supabase ${args.join(' ')}`);
  }
  return result.stdout ?? '';
}

/** Name of the local database container: supabase_db_<project_id>. */
export function localDatabaseContainer(): string {
  const config = readFileSync(join(ROOT, 'supabase', 'config.jsonc'), 'utf8');
  const projectId = /"project_id"\s*:\s*"([^"]+)"/.exec(config)?.[1];
  if (!projectId) {
    fail('No encontré project_id en supabase/config.jsonc.');
  }
  return `supabase_db_${projectId}`;
}

/** Runs SQL in the local database as the superuser of the container: a script or one query. */
export function localPsql(
  sql: { readonly script: string } | { readonly command: string },
  { singleTransaction = false, capture = false } = {},
): string {
  const args = [
    'exec',
    '-i',
    localDatabaseContainer(),
    'psql',
    '-U',
    'supabase_admin',
    '-d',
    'postgres',
    '-v',
    'ON_ERROR_STOP=1',
    '--quiet',
    ...(singleTransaction ? ['--single-transaction'] : []),
    ...('command' in sql ? ['-At', '-c', sql.command] : ['-f', '-']),
  ];
  const result = spawnSync('docker', args, {
    encoding: 'utf8',
    input: 'script' in sql ? sql.script : undefined,
    stdio: ['pipe', capture ? 'pipe' : 'inherit', 'inherit'],
    maxBuffer: 256 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    fail(
      `Falló psql en ${localDatabaseContainer()}${result.error ? `: ${result.error.message}` : ''}.`,
    );
  }
  return result.stdout ?? '';
}
