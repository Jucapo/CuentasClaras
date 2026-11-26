# Cuentas Claras

App de finanzas personales (PWA) que reemplaza 1Money. **Al iniciar cada fase, lee `docs/finanzas-spec.md` completa**: es la fuente de verdad. Si algo cambia, se actualiza ahí primero. Trabaja solo en la fase pedida (§10).

## Stack

- Angular 22: standalone, zoneless, signals, OnPush por defecto, Signal Forms y Vitest. Angular Material M3 + CDK.
- PWA con `@angular/pwa` (`ngsw-config.json`, `public/manifest.webmanifest`).
- Supabase: Postgres, Auth, RLS y Edge Functions. Producción: proyecto `ryuknhuvydlwtbgruqdt`. Desarrollo: stack local en Docker (`supabase/config.jsonc`, CLI 3).
- Vercel: SPA estático (`vercel.json`); salida en `dist/cuentas-claras/browser`. Deploy automático desde `main`.

## Comandos

- `fnm use`: Node según `.node-version` (26).
- `npm start` (http://localhost:4200) · `npm run lint` · `npm test` · `npm run test:watch` · `npm run build`
- `npm run format` / `npm run format:check`: Prettier.
- `npm run e2e`: smoke tests de Playwright (`e2e/*.e2e.ts`) con el Chrome instalado (sin descargar navegadores). Reutiliza `ng serve` si está corriendo. Supabase siempre simulado (`e2e/support`). Screenshots en `e2e/screenshots/` (ignorada por git).
- Base de datos local (requiere Docker Desktop):
  - `npm run db:start` / `npm run db:stop`: stack local (API `127.0.0.1:54321`, Studio `127.0.0.1:54323`, Mailpit `127.0.0.1:54324`). `ng serve` apunta a él.
  - `npx supabase migration new <nombre>` → editar el SQL → `npm run db:reset` (migraciones + `supabase/seed.sql`) → `npm run db:test` (pgTAP) → `npm run supabase:types`.
  - Usuario dev del seed: `dev@cuentasclaras.test` / `cuentas-claras-dev`.
- Producción: en CLI 3 `db push`, `db reset`, `gen types` y `test db` van a **local** por defecto. A producción solo con ref explícito (`--remote=ryuknhuvydlwtbgruqdt`) y con aprobación. Nunca `test db` ni `db reset` contra producción.

## Estructura

- `src/app/core`: servicios globales (supabase, auth, routing, layout, config).
- `src/app/shared`: pipes y UI reutilizable.
- `src/app/domain`: lógica pura sin Angular, con pruebas.
- `src/app/features/<feature>`: pantallas.
- `src/styles`: tema, tokens (`--cc-*`) y breakpoints. Los componentes hacen `@use 'breakpoints'`.
- `supabase/migrations`, `supabase/tests/database` (pgTAP), `supabase/seed.sql` (solo local).

## Convenciones (§11)

- TypeScript strict. Código e identificadores en inglés; UI y rutas en español (`APP_PATHS`).
- Componente, plantilla y estilos en archivos separados. Estado con signals.
- Nada de valores quemados: constantes en `core/config`, rutas en `core/routing/app-paths.ts`, estilos con tokens `--cc-*` y `--mat-sys-*`.
- Comentarios: solo TSDoc de una línea en exports, notas cortas cuando algo deliberado parece raro, y TODOs.
- Dinero: enteros en unidades menores (nunca float); se formatea solo con el pipe o servicio de moneda.
- Fechas de movimiento: `YYYY-MM-DD` local, sin conversiones de zona horaria.
- BD:
  - Cambios solo con migraciones; RLS en todas las tablas; pruebas de políticas con pgTAP (`npm run db:test`).
  - Toda tabla nueva necesita grants explícitos: Supabase ya no los da por defecto. `revoke all` a `anon`/`authenticated`/`service_role`, `grant select` + `grant update (columnas)` a `authenticated` y CRUD a `service_role`. Cubrirlos en `supabase/tests/database/privileges.test.sql`.
  - Toda función nueva necesita `grant execute` explícito: la migración base revocó el default a PUBLIC. Helpers `security definer` en el esquema `private` con `set search_path = ''`.
- Llaves: en el frontend solo la publishable key. La service role key solo en Edge Functions, nunca en el repo.
- Antes de commit: `npm run lint && npm test && npm run build`, y `npm run e2e` si cambian rutas, layout o pantallas; `npm run db:test` si cambia la BD. Commits pequeños en conventional commits.
