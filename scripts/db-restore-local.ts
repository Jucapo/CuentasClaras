// `npm run db:restore-local -- <backup folder or a file in it> [--yes] [--no-migrate]`: loads a
// production backup into the LOCAL Supabase stack to try migrations with real data (CLAUDE.md).
// Never touches production. Steps: reset the local database to the migration production had, load
// the data (without triggers, as the dump says), apply the pending migrations of the repo unless
// --no-migrate, and print how many rows each table has.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { BACKUP_FILES, fail, localPsql, supabase } from './db-common.ts';
import type { BackupManifest } from './db-common.ts';

/**
 * Tables restored: the app's data, plus the users and identities needed to sign in. The rest of
 * auth (sessions, tokens, audit log) and storage stay in the backup only: they depend on the
 * version of the local services and are not needed to try migrations.
 */
function restores(schema: string, table: string): boolean {
  return schema === 'public' || (schema === 'auth' && ['users', 'identities'].includes(table));
}

/** The data dump without the COPY blocks of the tables that are not restored. */
function restorableData(dump: string): { script: string; skipped: Map<string, number> } {
  const kept: string[] = [];
  const skipped = new Map<string, number>();
  let skipping: string | null = null;
  for (const line of dump.split('\n')) {
    if (skipping) {
      if (line === '\\.') {
        skipping = null;
      } else {
        skipped.set(skipping, (skipped.get(skipping) ?? 0) + 1);
      }
      continue;
    }
    const copy = /^COPY "([^"]+)"\."([^"]+)"/.exec(line);
    if (copy && !restores(copy[1], copy[2])) {
      skipping = `${copy[1]}.${copy[2]}`;
      skipped.set(skipping, 0);
      continue;
    }
    kept.push(line);
  }
  return { script: kept.join('\n'), skipped };
}

const args = process.argv.slice(2);
const target = args.find((arg) => !arg.startsWith('--'));
const assumeYes = args.includes('--yes');
const migrate = !args.includes('--no-migrate');
if (!target) {
  fail('Uso: npm run db:restore-local -- <carpeta del respaldo> [--yes] [--no-migrate]');
}

const given = resolve(target);
if (!existsSync(given)) {
  fail(`No existe ${given}.`);
}
const folder = statSync(given).isDirectory() ? given : dirname(given);
const manifestPath = join(folder, BACKUP_FILES.manifest);
const dataPath = join(folder, BACKUP_FILES.data);
if (!existsSync(manifestPath) || !existsSync(dataPath)) {
  fail(`${folder} no parece un respaldo de db:backup (faltan manifest.json o data.sql).`);
}
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as BackupManifest;

// The local stack must be up; `status` fails otherwise.
supabase(['status', '-o', 'json'], { capture: true });

console.log(`Respaldo de ${manifest.projectRef} del ${manifest.createdAt}`);
console.log(`Migración de producción: ${manifest.latestMigration}`);
if (!assumeYes) {
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await prompt.question(
    'Esto BORRA la base de datos local y carga el respaldo. ¿Continuar? (s/N) ',
  );
  prompt.close();
  if (answer.trim().toLowerCase() !== 's') {
    fail('Cancelado.');
  }
}

console.log('\n1/4 · Base local con el esquema de producción');
supabase(['db', 'reset', '--version', manifest.latestMigration, '--no-seed']);

console.log('\n2/4 · Datos del respaldo (public, auth.users y auth.identities)');
const { script, skipped } = restorableData(readFileSync(dataPath, 'utf8'));
localPsql({ script }, { singleTransaction: true });
const leftOut = [...skipped].filter(([, rows]) => rows > 0);
if (leftOut.length > 0) {
  console.log(
    `  Quedan solo en el respaldo: ${leftOut.map(([table, rows]) => `${table} (${rows})`).join(', ')}`,
  );
}

if (migrate) {
  console.log('\n3/4 · Migraciones pendientes del repo, sobre los datos reales');
  supabase(['migration', 'up']);
} else {
  console.log('\n3/4 · Sin migrar (--no-migrate): la base queda como producción');
}

console.log('\n4/4 · Filas por tabla');
const counts = localPsql(
  {
    command: `
      select 'auth.users' as name, count(*)::int from auth.users
      union all
      select 'public.' || table_name,
        (xpath('/row/c/text()', query_to_xml(
          format('select count(*) as c from public.%I', table_name), false, true, '')))[1]::text::int
      from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE'
      order by 1`,
  },
  { capture: true },
);
for (const line of counts.trim().split('\n')) {
  const [name, rows] = line.split('|');
  console.log(`  ${name.padEnd(32)} ${rows.padStart(8)}`);
}
console.log('\n✔ Listo. `npm start` usa esta base local.');
