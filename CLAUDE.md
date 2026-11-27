# Cuentas Claras

App de finanzas personales (PWA) que reemplaza 1Money. **Al iniciar cada fase, lee `docs/finanzas-spec.md` completa**: es la fuente de verdad. Si algo cambia, se actualiza ahí primero. Trabaja solo en la fase pedida (§10).

## Stack

- Angular 22: standalone, zoneless, signals, OnPush por defecto, Signal Forms y Vitest. Angular Material M3 + CDK.
- PWA con `@angular/pwa` (`ngsw-config.json`, `public/manifest.webmanifest`).
- Supabase: Postgres, Auth, RLS y Edge Functions. Producción: proyecto `ryuknhuvydlwtbgruqdt`. Desarrollo: stack local en Docker (`supabase/config.jsonc`, CLI 3).
- Vercel: SPA estático (`vercel.json`); salida en `dist/cuentas-claras/browser`. Deploy automático desde `main`.

## Comandos

- `fnm use`: Node según `.node-version` (26). Si el shell trae `NODE_ENV=production` (pasa en el host de extensiones de VS Code), `npm install` omite las devDependencies: quita la variable o usa `npm install --include=dev`.
- `npm start` (http://localhost:4200) · `npm run lint` · `npm test` · `npm run test:watch` · `npm run build`
- `npm run format` / `npm run format:check`: Prettier.
- `npm run icons:build`: regenera el subset de Material Symbols (`public/fonts`) y `icon-codepoints.generated.ts` desde el catálogo de íconos. Correrlo al cambiar `icon-catalog.ts` y commitear ambos resultados; el build no lo ejecuta ni necesita red.
- `npm run brand:build`: genera los PNG de la PWA, el `apple-touch-icon` y los favicons (`.ico` y `.svg`) desde los logos de `public/brand/`. Correrlo al cambiar un logo y commitear los resultados.
- Tema: las paletas de `src/styles/_theme-colors.scss` salen del schematic `ng generate @angular/material:theme-color` con las semillas de marca (el comando exacto está en el archivo). Se regeneran, nunca se editan a mano.
- `npm run e2e`: smoke tests de Playwright (`e2e/*.e2e.ts`).
  - Corre en 4 proyectos con el Chrome instalado, más `iphone-webkit` (solo invitación y login), que requiere `npx playwright install webkit` una vez.
  - Reutiliza `ng serve` si está corriendo, y Supabase siempre está simulado (`e2e/support`).
  - Screenshots en `e2e/screenshots/` (ignorada por git).
- `npm run e2e:local`: flujos contra el stack local real (`e2e/local/*.local.ts`, iPhone WebKit): invitar, el correo en Mailpit, reenviar y aceptar. Requiere `npm run db:start` y `npm run functions:serve`.
- `npm run functions:serve`: sirve las Edge Functions (`supabase/functions`) con `supabase/functions/local.env`, que no tiene secretos. En producción, los secretos y el despliegue siguen `docs/runbooks/f1f-compartir.md`.
- Base de datos local (requiere Docker Desktop):
  - `npm run db:start` / `npm run db:stop`: stack local (API `127.0.0.1:54321`, Studio `127.0.0.1:54323`, Mailpit `127.0.0.1:54324`). `ng serve` apunta a él.
  - `npx supabase migration new <nombre>` → editar el SQL → `npm run db:reset` (migraciones + `supabase/seed.sql`) → `npm run db:test` (pgTAP) → `npm run supabase:types`.
  - Usuarios del seed (contraseña `cuentas-claras-dev`): `dev@cuentasclaras.test` y `ana@cuentasclaras.test`, una cuenta sin espacio para probar invitar a una cuenta existente.
  - Los correos de Auth (plantillas en `supabase/templates`) se ven en Mailpit. Cambiar una plantilla requiere `npm run db:stop` y `npm run db:start`.
  - `npm run db:backup`: respalda producción (roles, esquema, datos e historial de migraciones) en `~/Backups/CuentasClaras/<fecha-hora>` (o `CC_BACKUP_DIR`), fuera del repo; el script se niega a escribir dentro. Solo lee producción.
  - `npm run db:restore-local -- <carpeta del respaldo> [--yes] [--no-migrate]`: resetea el **local** a la migración que tenía producción, carga los datos (`public`, `auth.users` y `auth.identities`) y aplica las migraciones pendientes del repo. `npm run db:reset` vuelve al seed.
- Producción: en CLI 3 `db push`, `db reset`, `gen types` y `test db` van a **local** por defecto. A producción solo con ref explícito (`--remote=ryuknhuvydlwtbgruqdt`) y con aprobación. Desde la F1d hay datos reales:
  - Antes de cada `db push` a producción, `npm run db:backup`.
  - Las migraciones nunca borran ni renombran tablas o columnas con datos sin migrar esos datos en la misma migración.
  - Una migración que transforma datos se prueba antes en local con `npm run db:restore-local`.
  - Nunca `db reset`, seed ni `test db` contra producción. Los arreglos de datos van como migraciones, no como ediciones a mano.
  - Nunca se commitea un respaldo.

## Estructura

- `src/app/core`: servicios globales (supabase, auth, spaces, invitations, profiles, user-settings, onboarding, catálogos, budgets, transactions, periods, totals, reports, exchange-rates, theme, pwa, routing, layout, config).
- `src/app/shared/ui`: sistema de diseño (`atoms`, `molecules`, `organisms`, `templates`, `services`). Fuentes únicas: `icons/icon-catalog.ts` (catálogo de íconos e íconos de la interfaz) y `colors/color-palette.ts` (paleta con variante clara y oscura).
- `src/app/domain`: lógica pura sin Angular, con pruebas.
- `src/app/features/<feature>`: pantallas. `ui-catalog` (ruta `/ui`) solo existe en desarrollo (`dev.routes.ts`).
- `src/styles`: tema, tokens (`--cc-*`) y breakpoints. Los componentes hacen `@use 'breakpoints'`.
- `supabase/migrations`, `supabase/tests/database` (pgTAP), `supabase/seed.sql` (solo local).
- `supabase/functions` (Edge Functions, Deno) y `supabase/templates` (correos de Auth).
- `docs/plans` (un plan por fase) y `docs/runbooks` (pasos manuales en producción).

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
- Sistema de diseño (§13):
  - Atomic design en `shared/ui` con prefijo `cc-`; antes de crear un componente, busca uno que se pueda reutilizar o extender, y agrega cada componente nuevo al catálogo `/ui`.
  - Las páginas componen componentes `cc-`: nada de Angular Material (ESLint lo bloquea fuera de `atoms`, `molecules` y `services`) ni estilos propios salvo layout.
  - Los campos son controles de Signal Forms (`FormValueControl`) con `label` obligatorio; átomos y moléculas son presentacionales.
  - Nada de colores, tamaños, radios, sombras ni z-index sueltos (Stylelint lo bloquea): tema en `_theme.scss`, tokens en `_tokens.scss`.
  - Cada cambio de UI se revisa con los screenshots de `npm run e2e` (móvil y escritorio, claro y oscuro).
- Flujos y layouts adaptativos (§13.5):
  - Las plantillas cambian según `LayoutService` (compacta, mediana, expandida); los organismos son los mismos.
  - Crear o editar es un flujo (`cc-flow-layout`, ruta con `data` flow y `unsavedChangesGuard`).
  - Las selecciones van por `OverlayService`, y un sheet nunca abre otro: devuelve la intención.
- Llaves: en el frontend solo la publishable key. La service role key solo en Edge Functions, nunca en el repo.
- Edge Functions:
  - verifican el JWT en el código (`verify_jwt` apagado en `config.jsonc`);
  - cambian datos por RPC con el JWT de quien llama;
  - usan la service role solo para lo que no se puede de otra forma (p. ej. `auth.admin`);
  - tienen CORS limitado a `ALLOWED_ORIGINS`.
- Commits pequeños en conventional commits. Los PRs se mergean con squash.

## Proceso por fase

- Verificación:
  - Durante la fase: implementar todo con commits intermedios cuando tenga sentido, sin correr lint, pruebas ni build en cada commit. Un commit intermedio que no compile no es problema.
  - Excepción: al escribir o cambiar una migración, correr en ese momento `npm run db:reset` y `npm run db:test`, porque los tipos generados dependen de ella.
  - Una vez antes del PR, la suite completa:
    - `npm run lint`, `npm test` y `npm run build`;
    - `npm run e2e` (los 5 proyectos) y `npm run db:test`;
    - `npm run e2e:local` si la fase toca invitaciones o Edge Functions.
  - Si algo falla, al corregir volver a correr solo lo afectado y terminar con una corrida completa.
- Pruebas, mientras la app está en etapa de exploración:
  - Unitarias sí, enfocadas en reglas de negocio: lógica de dominio (dinero, periodos, cuentas, categorías), servicios con lógica, guards, mapeo de errores y validaciones de formularios con reglas propias.
  - No escribir pruebas nuevas para componentes presentacionales ni detalles visuales (átomos, moléculas, layouts): lo visual se revisa con los screenshots del e2e. Las pruebas existentes se mantienen y se arreglan si se rompen.
  - pgTAP igual que siempre: es la seguridad de los datos.
  - e2e solo para los flujos principales de cada fase, más los screenshots para la revisión visual.
- Planes: concisos. Esquema SQL completo cuando la fase toca la base de datos; el resto en bullets cortos, sin repetir lo que ya dice la spec.
