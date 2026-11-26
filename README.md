# Cuentas Claras

App de finanzas personales (PWA) para reemplazar 1Money. Angular + Supabase, desplegada en Vercel.

- Especificación funcional y técnica: [docs/finanzas-spec.md](docs/finanzas-spec.md)
- Guía de trabajo y comandos: [CLAUDE.md](CLAUDE.md)

Requisitos: [fnm](https://github.com/Schniz/fnm) y Docker Desktop (backend WSL2 en Windows).

```bash
fnm use            # Node según .node-version
npm install
npm run db:start   # Supabase local en Docker (la primera vez descarga las imágenes)
npm run db:reset   # aplica las migraciones y el seed
npm start          # http://localhost:4200
```

Inicia sesión con el usuario del seed, `dev@cuentasclaras.test` / `cuentas-claras-dev`, o crea uno en Studio local (http://127.0.0.1:54323 → Authentication). Los correos de auth del stack local llegan a Mailpit (http://127.0.0.1:54324).
