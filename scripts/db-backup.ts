// `npm run db:backup`: backs up production (roles, schema, data and the migration history) into
// ~/Backups/CuentasClaras/<date-time>, or CC_BACKUP_DIR. Only reads production. Refuses to write
// inside the repository: a backup is never committed. Run it before every `db push` (CLAUDE.md).
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  BACKUP_FILES,
  backupRoot,
  fail,
  isInsideRepo,
  PRODUCTION_REF,
  supabase,
} from './db-common.ts';
import type { BackupManifest } from './db-common.ts';

interface MigrationListing {
  readonly migrations?: readonly { readonly local?: string; readonly remote?: string }[];
}

function stamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(
    date.getHours(),
  )}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

const root = backupRoot();
if (isInsideRepo(root)) {
  fail(
    `La carpeta de respaldos (${root}) queda dentro del repo. Usa una fuera, con CC_BACKUP_DIR.`,
  );
}
const startedAt = new Date();
const folder = join(root, stamp(startedAt));
const partial = `${folder}.partial`;
if (existsSync(folder) || existsSync(partial)) {
  fail(`Ya existe ${folder}.`);
}
mkdirSync(partial, { recursive: true });
const remote = `--remote=${PRODUCTION_REF}`;
const path = (file: string) => join(partial, file);

console.log(`Respaldando producción (${PRODUCTION_REF}) en ${folder}\n`);
supabase(['db', 'dump', remote, '--role-only', '-f', path(BACKUP_FILES.roles)]);
supabase(['db', 'dump', remote, '-f', path(BACKUP_FILES.schema)]);
supabase(['db', 'dump', remote, '--data-only', '--use-copy', '-f', path(BACKUP_FILES.data)]);

// The data dump leaves out supabase_migrations; the version tells restore-local where to reset to.
const listing = supabase(['migration', 'list', remote, '--output-format', 'json'], {
  capture: true,
});
writeFileSync(path(BACKUP_FILES.migrations), listing);
const applied = ((JSON.parse(listing) as MigrationListing).migrations ?? [])
  .map((migration) => migration.remote ?? '')
  .filter((version) => /^\d+$/.test(version))
  .sort();
const latestMigration = applied.at(-1);
if (!latestMigration) {
  fail('No pude leer la última migración aplicada en producción.');
}

const cliVersion = supabase(['--version'], { capture: true }).trim();
const files = Object.fromEntries(
  [BACKUP_FILES.roles, BACKUP_FILES.schema, BACKUP_FILES.data, BACKUP_FILES.migrations].map(
    (file) => [file, { bytes: statSync(path(file)).size, sha256: sha256(path(file)) }],
  ),
);
const manifest: BackupManifest = {
  projectRef: PRODUCTION_REF,
  createdAt: startedAt.toISOString(),
  cliVersion,
  latestMigration,
  files,
};
writeFileSync(path(BACKUP_FILES.manifest), `${JSON.stringify(manifest, null, 2)}\n`);
renameSync(partial, folder);

console.log(`\n✔ Respaldo completo: ${folder}`);
console.log(`  Última migración en producción: ${latestMigration}`);
for (const [file, info] of Object.entries(files)) {
  console.log(`  ${file.padEnd(16)} ${(info.bytes / 1024).toFixed(1).padStart(10)} kB`);
}
