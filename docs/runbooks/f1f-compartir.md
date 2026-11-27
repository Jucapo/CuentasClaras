# Runbook F1f · Compartir el espacio en producción

> Lo aplica Juan a mano, en este orden. No contiene secretos: la contraseña de aplicación de Gmail
> y la service role key nunca se escriben en el repo ni en este archivo.

## Valores

| Qué                             | Valor                                                                                         |
| ------------------------------- | --------------------------------------------------------------------------------------------- |
| Proyecto Supabase               | `ryuknhuvydlwtbgruqdt` (`https://ryuknhuvydlwtbgruqdt.supabase.co`)                           |
| App en producción               | `https://cuentasclaras-inky.vercel.app` (si cambia el dominio, se actualizan los pasos 4 y 7) |
| SMTP                            | `smtp.gmail.com`, puerto `587` (STARTTLS); `465` (SSL) también sirve                          |
| Remitente                       | El mismo Gmail que autentica; nombre `Cuentas Claras`                                         |
| Vencimiento del link del correo | 24 h (`86400` s, el máximo de Auth)                                                           |
| Vencimiento de la invitación    | 7 días (lo pone la base de datos)                                                             |
| Secretos de la función          | `APP_URL`, `ALLOWED_ORIGINS`                                                                  |

## 1. Contraseña de aplicación de Gmail

1. En la cuenta de Google: **Seguridad** → activar la **Verificación en 2 pasos** (es requisito).
2. **Seguridad** → **Contraseñas de aplicaciones** → crear una llamada `Cuentas Claras Supabase`.
3. Copiar las 16 letras directamente al paso 2. No se guardan en otro lado.

Gmail permite unos 500 correos al día: de sobra para invitaciones y recuperar contraseña.

## 2. SMTP en Supabase Auth

Dashboard → **Authentication** → **Emails** → **SMTP Settings** → **Enable custom SMTP**:

- Sender email: el Gmail del paso 1.
- Sender name: `Cuentas Claras`.
- Host: `smtp.gmail.com`.
- Port: `587`.
- Username: el Gmail completo.
- Password: la contraseña de aplicación.

## 3. Ajustes de Auth

- **Sign In / Providers**:
  - **Allow new users to sign up**: apagado. El registro sigue cerrado; la invitación crea al usuario con la API de administración.
  - **Email** → **Confirm email**: encendido.
  - **Email OTP Expiration**: `86400`. Es lo que dura el link del correo de invitación; después se usa "Reenviar".
  - **Minimum password length**: `8`, igual que la app.
- **Rate Limits** → correos por hora: `30`.

## 4. URLs

**Authentication** → **URL Configuration**:

- **Site URL**: `https://cuentasclaras-inky.vercel.app`.
- **Redirect URLs**: `https://cuentasclaras-inky.vercel.app/**`.

Sin esta última, el link de invitación (`/invitacion?token=…`) y el de recuperar contraseña (`/restablecer-contrasena`) vuelven a la Site URL y no sirven.

## 5. Plantillas de correo

**Authentication** → **Emails** → **Templates**. Se copia el HTML completo de cada archivo:

| Plantilla      | Asunto                                       | Cuerpo                             |
| -------------- | -------------------------------------------- | ---------------------------------- |
| Invite user    | `Te invitaron a Cuentas Claras`              | `supabase/templates/invite.html`   |
| Reset password | `Restablece tu contraseña de Cuentas Claras` | `supabase/templates/recovery.html` |

El link de la invitación tiene que quedar como está en el archivo: `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=invite`.

## 6. Migración

```sh
npm run db:backup
npx supabase migration list --remote=ryuknhuvydlwtbgruqdt   # pendiente: 20261127184330_sharing
npx supabase db push --remote=ryuknhuvydlwtbgruqdt
```

La migración solo agrega cosas:

- la tabla `space_invitations` y sus RPC;
- la política para quitar miembros;
- el trigger de al menos un propietario.

No borra, no renombra y no transforma datos.

## 7. Secretos de la función

```sh
npx supabase secrets set --remote=ryuknhuvydlwtbgruqdt \
  APP_URL=https://cuentasclaras-inky.vercel.app \
  ALLOWED_ORIGINS=https://cuentasclaras-inky.vercel.app,http://localhost:4200
npx supabase secrets list --remote=ryuknhuvydlwtbgruqdt
```

- `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` los inyecta Supabase, y la lista debe mostrarlos.
- La service role key se queda ahí: no se copia a ningún lado.
- Si algún día se apagan las llaves legacy, la función usa la `default` de `SUPABASE_PUBLISHABLE_KEYS` y `SUPABASE_SECRET_KEYS`.

## 8. Desplegar la función

```sh
npx supabase functions deploy invite-member --remote=ryuknhuvydlwtbgruqdt
```

- Sin `--remote`, el comando usa el proyecto vinculado: siempre se pasa el ref.
- En Dashboard → **Edge Functions** → `invite-member`, **Verify JWT** tiene que quedar **apagado**, como dice `config.jsonc`. La función verifica el JWT ella misma con `auth.getUser`, así funciona con cualquier llave de firma y no se rompe al rotarlas.

## 9. Comprobar CORS

En local, el gateway (Kong) responde CORS por su cuenta. En producción manda la función:

```sh
# Desde otro origen: 403 y sin Access-Control-Allow-Origin
curl -si -X POST https://ryuknhuvydlwtbgruqdt.supabase.co/functions/v1/invite-member \
  -H "Origin: https://otro-sitio.example" -H "Content-Type: application/json" -d '{}' | head -20
# Preflight desde la app: 204 con Access-Control-Allow-Origin de la app
curl -si -X OPTIONS https://ryuknhuvydlwtbgruqdt.supabase.co/functions/v1/invite-member \
  -H "Origin: https://cuentasclaras-inky.vercel.app" -H "Access-Control-Request-Method: POST" | head -20
```

## 10. Prueba con un alias de Gmail

El alias `micorreo+prueba@gmail.com` llega a la misma bandeja, pero para Supabase es otra cuenta.

1. Desplegar en Vercel la rama mergeada (deploy automático desde `main`).
2. En la app: **Configuración** → **Miembros e invitaciones** → **Invitar**: el alias, rol **Lector**.
3. Revisar el correo: en español, con la marca y el botón "Aceptar invitación".
4. Abrirlo en el iPhone, en **Safari**. Elegir un nombre de prueba y una contraseña, y aceptar. Debe mostrar "¡Listo!" con los pasos para instalar.
5. Probar "Reenviar" antes de aceptar si se quiere: llega otro correo y el anterior deja de servir.
6. Entrar con el alias desde otro navegador: ve el espacio, sin poder editar (Lector).

**Limpieza, antes de invitar a la esposa:**

1. **Configuración** → **Miembros**:
   - si el alias aceptó, **Quitar** al alias;
   - si alguna invitación del alias sigue pendiente, **Revocar**.
2. Opcional: Dashboard → **Authentication** → **Users** → el alias → **Delete user**. Solo si no creó cuentas: la FK `accounts.owner_id` lo impide si las creó. Con rol Lector no puede crearlas.
3. Comprobar que **Miembros** muestre solo a Juan y que no queden invitaciones pendientes.

## 11. Invitar a la esposa

1. **Miembros** → **Invitar**: su correo, rol **Editor**, o **Propietario** si se quiere compartir la configuración.
2. En su iPhone, ella abre el correo y lo abre en **Safari**: si Gmail lo abre dentro de la app, toca "Abrir en Safari".
3. Elige nombre y contraseña, y acepta.
4. En Safari: **Compartir** (o el menú **⋯**) → **Agregar a inicio** → **Agregar**.
5. Abre la app desde el ícono y entra con su correo y su contraseña. La app instalada no comparte la sesión de Safari, por eso pide entrar.

Si el link venció (24 h) o ya se usó, en **Miembros** → **Reenviar**.

## Revertir

- **Invitaciones:** se revocan desde **Miembros**.
- **Función:** `npx supabase functions delete invite-member --remote=ryuknhuvydlwtbgruqdt`. Sin ella, la app muestra un error al invitar, y lo demás sigue igual.
- **SMTP:** apagar **Enable custom SMTP** devuelve los correos al servidor de Supabase (con su límite bajo).
- **Migración:** solo agrega objetos, así que dejarla no afecta nada. Si hace falta, se restaura el respaldo del paso 6 con el procedimiento de siempre, o se escribe una migración nueva.
