# Cuentas Claras

App de finanzas personales (PWA) que reemplaza 1Money. **Al iniciar cada fase, lee `docs/finanzas-spec.md` completa**: es la fuente de verdad. Si algo cambia, se actualiza ahí primero. Trabaja solo en la fase pedida (§10).

## Stack

- Angular 22: standalone, zoneless, signals, OnPush por defecto, Signal Forms y Vitest. Angular Material M3 + CDK.
- PWA con `@angular/pwa` (`ngsw-config.json`, `public/manifest.webmanifest`).
- Supabase: Postgres, Auth, RLS y Edge Functions. Proyecto `ryuknhuvydlwtbgruqdt`, CLI 3 con `supabase/config.jsonc`.
- Vercel: SPA estático (`vercel.json`); salida en `dist/cuentas-claras/browser`. Deploy automático desde `main`.

## Comandos

- `fnm use`: Node según `.node-version` (26).
- `npm start` (http://localhost:4200) · `npm run lint` · `npm test` · `npm run test:watch` · `npm run build`
- `npm run format` / `npm run format:check`: Prettier.
- `npx supabase login` / `npx supabase link --project-ref ryuknhuvydlwtbgruqdt`
- `npx supabase migration new <nombre>` → editar el SQL → `npx supabase db push`
- `npm run supabase:types`: regenera `src/app/core/supabase/database.types.ts`. Correrlo tras cada migración.

## Estructura

- `src/app/core`: servicios globales (supabase, auth, routing, layout, config).
- `src/app/shared`: pipes y UI reutilizable.
- `src/app/domain`: lógica pura sin Angular, con pruebas.
- `src/app/features/<feature>`: pantallas.
- `src/styles`: tema, tokens (`--cc-*`) y breakpoints. Los componentes hacen `@use 'breakpoints'`.

## Convenciones (§11)

- TypeScript strict. Código e identificadores en inglés; UI y rutas en español (`APP_PATHS`).
- Componente, plantilla y estilos en archivos separados. Estado con signals.
- Nada de valores quemados: constantes en `core/config`, rutas en `core/routing/app-paths.ts`, estilos con tokens `--cc-*` y `--mat-sys-*`.
- Comentarios: solo TSDoc de una línea en exports, notas cortas cuando algo deliberado parece raro, y TODOs.
- Dinero: enteros en unidades menores (nunca float); se formatea solo con el pipe o servicio de moneda.
- Fechas de movimiento: `YYYY-MM-DD` local, sin conversiones de zona horaria.
- BD: cambios solo con migraciones; RLS en todas las tablas; pruebas de políticas con pgTAP (`npx supabase test db`).
- Llaves: en el frontend solo la publishable key. La service role key solo en Edge Functions, nunca en el repo.
- Antes de commit: `npm run lint && npm test && npm run build`. Commits pequeños en conventional commits.
