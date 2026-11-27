# F1f · Compartir — plan

> Se guarda en `docs/plans/f1f.md` (primer commit de `feat/f1f-sharing`, creada desde `main` actualizado). Antes de empezar: `CLAUDE.md` y `docs/finanzas-spec.md` completos.

## Contexto

Objetivo: que la esposa de Juan entre a su espacio desde su iPhone, con la PWA. Hoy cada espacio tiene un solo miembro.

Lo que ya existe y se reutiliza:

- BD:
  - `member_role` (`owner | editor | viewer`), `space_members` (PK `(space_id, user_id)`, `user_id → profiles`) y los helpers `private.space_role`, `is_space_member` y `shares_space_with`.
  - Los perfiles se leen entre co-miembros. Un propietario cambia roles ajenos, nunca el suyo.
- Lo que no existe:
  - Invitaciones, borrar membresías (no hay grant ni política) y la regla de al menos un propietario.
  - En el frontend: el correo de los miembros, el selector de espacio y la instalación de la PWA.
- Front:
  - `SpaceService`: `memberships`, `select()` (sin usar), `canConfigure` y `canEdit`. Falta un `reload()` público.
  - `SpaceMembersService`: alimenta Persona en Transacciones y Resumen.
  - `AuthService`: flujo implícito y `detectSessionInUrl`.
  - `/restablecer-contrasena` y `LoginPage` con `?redirect=`.
  - `cc-auth-layout`, `cc-list-item`, `OptionPanel` + `OverlayService`, `ConfirmService`, `ToastService` y `dataErrorMessage`.
- Dominio de producción: `https://cuentasclaras-inky.vercel.app` (homepage del repo). Se confirma en el runbook.

Resultado: PR contra `main`, sin merge y sin tocar producción. La migración, la función, los secretos, el SMTP y las URLs los aplica Juan con el runbook.

## Decisiones (van a la spec)

- **Links:**
  - Cada invitación tiene un token propio: 32 bytes al azar, en hex. Se guarda solo su `sha256`.
  - El token vence en 7 días, es de un solo uso y queda ligado al correo.
  - El link es `/invitacion?token=…`.
  - El token crudo solo existe al crear o al reenviar. Por eso **"Reenviar" rota el token**: el link anterior deja de servir y el vencimiento vuelve a 7 días desde hoy.
- **Cuenta nueva:**
  - La función llama `inviteUserByEmail` con `redirectTo` al link.
  - La plantilla arma `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=invite`.
  - La página llama `verifyOtp` **al enviar el formulario**, no al cargar, para que un escáner de links no gaste el token.
  - El link del correo depende del vencimiento de los OTP de Auth (máximo 24 h, se configura en el runbook). Si vence, el propietario reenvía.
- **Cuenta existente** (correo confirmado):
  - No hay correo. La función devuelve el link y el propietario lo copia o lo comparte.
  - Al entrar a la app, la persona ve un aviso persistente "Te invitaron a «X»" con "Ver", o la invitación en el asistente si no tiene espacio.
- **Revocar** no borra al usuario de Auth que creó la invitación: sin contraseña no puede entrar, y una nueva invitación lo reutiliza.
- **Privacidad:** el propietario se entera de si un correo ya tiene cuenta. Es inevitable si la cuenta existente no recibe correo, y se acepta mientras el registro esté cerrado. Se revisa en la F4.
- **Quien sale o es removido:**
  - Su membresía se borra y nada más:
    - sus cuentas compartidas y los movimientos en ellas quedan en el espacio;
    - sus cuentas privadas quedan ocultas para todos, también para él;
    - sus movimientos "incluidos en el espacio" siguen visibles y contando en el presupuesto conjunto, porque ya eran historia compartida.
  - Si vuelve, recupera todo. Su nombre se muestra como "Otra persona", el texto que ya existe.
  - La confirmación lo explica.
- **Roles:**
  - El propietario cambia el rol de los demás y los quita.
  - Nadie cambia su propio rol (se mantiene la política): para dejar de ser propietario, otro propietario lo cambia.
  - Cualquiera sale. El último propietario no puede salir.
  - La base garantiza al menos un propietario con un trigger que bloquea el espacio (`for update`), así dos cambios simultáneos no dejan cero.
- **Edge Function `invite-member`:**
  - `verify_jwt = false`: el JWT se verifica en el código con `auth.getUser(jwt)`. Esto funciona con cualquier tipo de llave y evita el problema de rotación de llaves.
  - Verifica que quien llama sea propietario. Los datos van por RPC con el JWT de quien llama, así la base vuelve a aplicar la regla.
  - La service role (`SUPABASE_SERVICE_ROLE_KEY`, inyectada por Supabase) se usa solo para `auth.admin.inviteUserByEmail`.
  - CORS: solo los orígenes de `ALLOWED_ORIGINS` (producción y `http://localhost:4200`).
- **Invitar:** un sheet con confirmación (correo + rol en la misma vista), como etiquetas y subcategorías. No es un flujo con ruta: son dos campos.
- **Selector de espacio:** solo con más de un espacio. Es un botón con el badge del espacio en las acciones del encabezado, antes de Configuración. Abre un `OptionPanel`. Al elegir, `select()` y la pantalla de inicio.
- **Errores de negocio:** `raise ... using errcode = 'P0001'` con una clave estable en el mensaje (`invitation_expired`…). El front las traduce. Los permisos siguen en `42501`.

## 1. Base de datos

`npx supabase migration new sharing` → `npm run db:reset` → `npm run db:test` → `npm run supabase:types`. No borra ni renombra nada y no transforma datos.

```sql
-- F1f · Compartir: invitaciones, miembros y la regla de al menos un propietario. Spec §3, §7 y §8.
-- No borra ni renombra nada y no transforma datos.

-- ── Invitaciones ──────────────────────────────────────────────────────────────
create table public.space_invitations (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  email text not null constraint space_invitations_email_check
    check (email = lower(btrim(email)) and length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role public.member_role not null,
  token_hash bytea not null unique,                 -- sha256 del token; el token solo viaja en el link
  invited_by uuid references public.profiles (user_id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (user_id) on delete set null,
  declined_at timestamptz,
  revoked_at timestamptz,
  constraint space_invitations_one_outcome check (num_nonnulls(accepted_at, declined_at, revoked_at) <= 1)
);
-- Una abierta por correo y espacio (abierta = sin respuesta ni revocar, vencida o no).
create unique index space_invitations_open_key on public.space_invitations (space_id, email)
  where accepted_at is null and declined_at is null and revoked_at is null;
create index space_invitations_email_idx on public.space_invitations (email);

alter table public.space_invitations enable row level security;
revoke all on public.space_invitations from anon, authenticated, service_role;
grant select, insert, update, delete on public.space_invitations to service_role;
-- Sin token_hash, ni para el propietario. Las escrituras van por RPC.
grant select (id, space_id, email, role, invited_by, created_at, expires_at, accepted_at, declined_at, revoked_at)
  on public.space_invitations to authenticated;
create policy space_invitations_select on public.space_invitations for select to authenticated
  using (private.space_role(space_id) = 'owner');

-- ── Helpers ───────────────────────────────────────────────────────────────────
-- Correo confirmado de quien llama; null sin sesión o sin confirmar.
create function private.confirmed_email() returns text
language sql stable security definer set search_path = '' as $$
  select lower(u.email) from auth.users u
  where u.id = (select auth.uid()) and u.email_confirmed_at is not null;
$$;

create function private.invitation_token_hash(token text) returns bytea
language sql immutable set search_path = '' as $$ select sha256(convert_to(token, 'UTF8')); $$;

-- 32 bytes al azar en hex: 64 caracteres, seguros en una URL.
create function private.new_invitation_token() returns text
language sql volatile set search_path = '' as $$ select encode(extensions.gen_random_bytes(32), 'hex'); $$;

create function private.has_confirmed_account(target_email text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from auth.users u where lower(u.email) = target_email and u.email_confirmed_at is not null);
$$;

-- Valida y aplica la aceptación o el rechazo de una invitación ya bloqueada (for update).
-- Orden de las validaciones: sesión, existe, revocada, usada, vencida, correo, ya es miembro.
create function private.respond_to_invitation(invitation public.space_invitations, accept boolean) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  caller uuid := (select auth.uid());
  fallback_account uuid;
begin
  if caller is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if invitation.id is null then raise exception 'invitation_not_found' using errcode = 'P0001'; end if;
  if invitation.revoked_at is not null then raise exception 'invitation_revoked' using errcode = 'P0001'; end if;
  if invitation.accepted_at is not null or invitation.declined_at is not null then
    raise exception 'invitation_used' using errcode = 'P0001';
  end if;
  if invitation.expires_at <= now() then raise exception 'invitation_expired' using errcode = 'P0001'; end if;
  if private.confirmed_email() is distinct from invitation.email then
    raise exception 'invitation_email_mismatch' using errcode = 'P0001';
  end if;

  if not accept then
    update public.space_invitations set declined_at = now() where id = invitation.id;
    return invitation.space_id;
  end if;

  if exists (select 1 from public.space_members m where m.space_id = invitation.space_id and m.user_id = caller) then
    raise exception 'already_member' using errcode = 'P0001';
  end if;
  -- Cuenta predeterminada: la de quien invitó si es compartida y activa; si no, la primera compartida
  -- activa del grupo Cuentas; si no hay, ninguna.
  select coalesce(
    (select a.id from public.space_members m
       join public.accounts a on a.space_id = m.space_id and a.id = m.default_account_id
      where m.space_id = invitation.space_id and m.user_id = invitation.invited_by
        and a.visibility = 'shared' and a.archived_at is null),
    (select a.id from public.accounts a
      where a.space_id = invitation.space_id and a.visibility = 'shared' and a.archived_at is null
        and a.account_group = 'accounts'
      order by a.sort_order, a.created_at limit 1))
  into fallback_account;

  insert into public.space_members (space_id, user_id, role, default_account_id)
  values (invitation.space_id, caller, invitation.role, fallback_account);
  update public.space_invitations set accepted_at = now(), accepted_by = caller where id = invitation.id;
  update public.user_settings set last_space_id = invitation.space_id where user_id = caller;
  return invitation.space_id;
end;
$$;

revoke all on function private.confirmed_email(), private.invitation_token_hash(text),
  private.new_invitation_token(), private.has_confirmed_account(text),
  private.respond_to_invitation(public.space_invitations, boolean) from public, anon, authenticated;

-- ── RPC: invitar, reenviar y revocar (solo el propietario) ───────────────────
-- Crea la invitación y devuelve el token una sola vez. Una abierta pero vencida se revoca y se reemplaza.
-- invitee_has_account: si el correo ya tiene cuenta confirmada (la función no envía correo).
create function public.create_invitation(target_space_id uuid, invitee_email text, invitee_role public.member_role)
returns table (invitation_id uuid, token text, email text, expires_at timestamptz,
               invitee_has_account boolean, space_name text, inviter_name text)
language plpgsql volatile security definer set search_path = '' as $$
#variable_conflict use_column
declare
  normalized text := lower(btrim(invitee_email));
  new_token text := private.new_invitation_token();
begin
  if private.space_role(target_space_id) is distinct from 'owner' then
    raise exception 'not_space_owner' using errcode = '42501';
  end if;
  if exists (select 1 from public.space_members m join auth.users u on u.id = m.user_id
             where m.space_id = target_space_id and lower(u.email) = normalized) then
    raise exception 'already_member' using errcode = 'P0001';
  end if;
  update public.space_invitations i set revoked_at = now()
   where i.space_id = target_space_id and i.email = normalized and i.expires_at <= now()
     and i.accepted_at is null and i.declined_at is null and i.revoked_at is null;
  if exists (select 1 from public.space_invitations i
             where i.space_id = target_space_id and i.email = normalized
               and i.accepted_at is null and i.declined_at is null and i.revoked_at is null) then
    raise exception 'invitation_pending' using errcode = 'P0001';
  end if;

  return query
  with created as (
    insert into public.space_invitations (space_id, email, role, token_hash, invited_by, expires_at)
    values (target_space_id, normalized, invitee_role, private.invitation_token_hash(new_token),
            (select auth.uid()), now() + interval '7 days')
    returning id, email, expires_at
  )
  select c.id, new_token, c.email, c.expires_at, private.has_confirmed_account(c.email), s.name, p.display_name
  from created c
  join public.spaces s on s.id = target_space_id
  left join public.profiles p on p.user_id = (select auth.uid());
end;
$$;

-- Reenviar: token nuevo y 7 días desde hoy; el link anterior deja de servir.
create function public.rotate_invitation(target_invitation_id uuid)
returns table (invitation_id uuid, token text, email text, expires_at timestamptz,
               invitee_has_account boolean, space_name text, inviter_name text)
language plpgsql volatile security definer set search_path = '' as $$
#variable_conflict use_column
declare
  invitation public.space_invitations;
  new_token text := private.new_invitation_token();
begin
  select * into invitation from public.space_invitations where id = target_invitation_id for update;
  if invitation.id is null or private.space_role(invitation.space_id) is distinct from 'owner' then
    raise exception 'not_space_owner' using errcode = '42501';
  end if;
  if num_nonnulls(invitation.accepted_at, invitation.declined_at, invitation.revoked_at) > 0 then
    raise exception 'invitation_closed' using errcode = 'P0001';
  end if;
  return query
  with rotated as (
    update public.space_invitations
       set token_hash = private.invitation_token_hash(new_token), expires_at = now() + interval '7 days'
     where id = invitation.id
    returning id, email, expires_at
  )
  select r.id, new_token, r.email, r.expires_at, private.has_confirmed_account(r.email), s.name, p.display_name
  from rotated r
  join public.spaces s on s.id = invitation.space_id
  left join public.profiles p on p.user_id = (select auth.uid());
end;
$$;

create function public.revoke_invitation(target_invitation_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare invitation public.space_invitations;
begin
  select * into invitation from public.space_invitations where id = target_invitation_id for update;
  if invitation.id is null or private.space_role(invitation.space_id) is distinct from 'owner' then
    raise exception 'not_space_owner' using errcode = '42501';
  end if;
  if num_nonnulls(invitation.accepted_at, invitation.declined_at, invitation.revoked_at) > 0 then
    raise exception 'invitation_closed' using errcode = 'P0001';
  end if;
  update public.space_invitations set revoked_at = now() where id = invitation.id;
end;
$$;

-- ── RPC: ver, aceptar y rechazar (quien fue invitado) ─────────────────────────
-- Lo que /invitacion muestra antes de iniciar sesión (también anon). Un token desconocido no devuelve filas.
create function public.invitation_preview(invitation_token text)
returns table (invitation_id uuid, space_name text, space_icon public.icon_key, space_color public.color_key,
               inviter_name text, role public.member_role, email text, expires_at timestamptz, status text)
language sql stable security definer set search_path = '' as $$
  select i.id, s.name, s.icon, s.color, p.display_name, i.role, i.email, i.expires_at,
         case when i.revoked_at is not null then 'revoked'
              when i.accepted_at is not null then 'accepted'
              when i.declined_at is not null then 'declined'
              when i.expires_at <= now() then 'expired'
              else 'pending' end
  from public.space_invitations i
  join public.spaces s on s.id = i.space_id
  left join public.profiles p on p.user_id = i.invited_by
  where i.token_hash = private.invitation_token_hash(invitation_token);
$$;

-- Invitaciones abiertas y vigentes para el correo confirmado de quien llama, a espacios donde no está.
create function public.my_invitations()
returns table (invitation_id uuid, space_id uuid, space_name text, space_icon public.icon_key,
               space_color public.color_key, inviter_name text, role public.member_role, expires_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select i.id, i.space_id, s.name, s.icon, s.color, p.display_name, i.role, i.expires_at
  from public.space_invitations i
  join public.spaces s on s.id = i.space_id
  left join public.profiles p on p.user_id = i.invited_by
  where i.email = private.confirmed_email()
    and i.accepted_at is null and i.declined_at is null and i.revoked_at is null and i.expires_at > now()
    and not exists (select 1 from public.space_members m where m.space_id = i.space_id and m.user_id = (select auth.uid()))
  order by i.created_at;
$$;

-- Por token (link) o por id (aviso dentro de la app; ahí la prueba es el correo confirmado). Uno de los dos.
create function public.accept_invitation(invitation_token text default null, target_invitation_id uuid default null)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare invitation public.space_invitations;
begin
  if num_nonnulls(invitation_token, target_invitation_id) <> 1 then
    raise exception 'invitation_not_found' using errcode = 'P0001';
  end if;
  select * into invitation from public.space_invitations
   where (invitation_token is not null and token_hash = private.invitation_token_hash(invitation_token))
      or id = target_invitation_id
   for update;
  return private.respond_to_invitation(invitation, true);
end;
$$;

create function public.decline_invitation(invitation_token text default null, target_invitation_id uuid default null)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
-- mismo cuerpo que accept_invitation, con respond_to_invitation(invitation, false)
$$;

-- ── Miembros ─────────────────────────────────────────────────────────────────
-- Nombre, correo y rol de los miembros, para quien es miembro. El correo solo sale por aquí.
create function public.space_member_list(target_space_id uuid)
returns table (user_id uuid, display_name text, email text, role public.member_role, joined_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select m.user_id, p.display_name, u.email, m.role, m.joined_at
  from public.space_members m
  join public.profiles p on p.user_id = m.user_id
  join auth.users u on u.id = m.user_id
  where m.space_id = target_space_id and private.is_space_member(target_space_id)
  order by m.joined_at;
$$;

-- Salir y quitar: cada quien puede salir; el propietario puede quitar a cualquiera.
grant delete on public.space_members to authenticated;
create policy space_members_delete on public.space_members for delete to authenticated
  using (user_id = (select auth.uid()) or private.space_role(space_id) = 'owner');

-- Siempre queda al menos un propietario. El bloqueo del espacio serializa los cambios simultáneos.
-- Si el espacio se está borrando (la fila ya no se ve), no aplica.
create function private.ensure_space_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.spaces s where s.id = old.space_id for update;
  if not found then return null; end if;
  if not exists (select 1 from public.space_members m where m.space_id = old.space_id and m.role = 'owner') then
    raise exception 'last_owner' using errcode = 'P0001';
  end if;
  return null;
end;
$$;
revoke all on function private.ensure_space_owner() from public, anon, authenticated;
create trigger space_members_keep_owner after delete or update of role on public.space_members
  for each row execute function private.ensure_space_owner();

-- ── Grants de las RPC ─────────────────────────────────────────────────────────
revoke all on function public.create_invitation(uuid, text, public.member_role), public.rotate_invitation(uuid),
  public.revoke_invitation(uuid), public.invitation_preview(text), public.my_invitations(),
  public.accept_invitation(text, uuid), public.decline_invitation(text, uuid), public.space_member_list(uuid)
  from public, anon;
grant execute on function public.create_invitation(uuid, text, public.member_role), public.rotate_invitation(uuid),
  public.revoke_invitation(uuid), public.invitation_preview(text), public.my_invitations(),
  public.accept_invitation(text, uuid), public.decline_invitation(text, uuid), public.space_member_list(uuid)
  to authenticated;
-- Única excepción a "anon no recibe nada": /invitacion se ve antes de iniciar sesión; sin el token no devuelve nada.
grant execute on function public.invitation_preview(text) to anon;
```

**Seed:** se agrega `ana@cuentasclaras.test` (misma contraseña, sin espacio) para probar a mano el camino de la cuenta existente.

**pgTAP:**

- **`invitations.test.sql`:**
  - **Crear:** el propietario sí; el editor, el lector y quien no es miembro no (`42501`). Se cubren `already_member`, `invitation_pending` y el reemplazo de una vencida.
  - **El token:** el hash es el `sha256` del token y el token no queda guardado. Vence a los 7 días. `invitee_has_account` sí y no.
  - **Leer:** el propietario ve; el editor no ve filas. `token_hash` da `42501` incluso al propietario.
  - **Reenviar:** solo el propietario. El token anterior deja de servir y el vencimiento se extiende. Las cerradas dan `invitation_closed`.
  - **Revocar:** solo el propietario.
  - **`invitation_preview`:** anon con token válido ve la invitación, con el estado de cada caso; con uno inválido, nada.
  - **`my_invitations`:** solo las del correo propio, vigentes y de espacios ajenos.
  - **Aceptar:** queda la membresía con el rol, la cuenta predeterminada (la de quien invitó, la primera compartida o ninguna), `last_space_id` y `accepted_at`.
  - **Rechazos de aceptar:** sin sesión, token inválido, revocada, usada (segundo intento y después de rechazar), vencida, otro correo, correo sin confirmar y ya es miembro.
  - **Aceptar por id:** las mismas reglas.
  - **Rechazar:** marca `declined_at`, y después aceptar falla.
- **`members.test.sql`:**
  - El propietario cambia roles ajenos. El editor no cambia roles. Nadie cambia el suyo.
  - El propietario quita a un editor y a otro propietario. El editor no quita a otros. Cualquiera sale.
  - El último propietario no puede salir, ni ser degradado o borrado como `postgres` (el trigger actúa sin RLS).
  - Borrar el espacio sigue funcionando.
  - `space_member_list` trae los correos a los miembros; a los demás, nada.
- **`sharing.test.sql`** (visibilidad entre dos miembros):
  - La cuenta privada de Beto es invisible para Ana.
  - Lo "incluido" se ve y suma en `category_totals`; lo no incluido, no.
  - El lector ve lo compartido y no puede escribir.
  - Después de que Beto sale: Ana sigue viendo lo incluido, la cuenta privada queda oculta para todos y Beto no ve nada del espacio.
- **Actualizaciones:**
  - `spaces.test.sql`: el caso "members cannot be removed yet" pasa a "solo así".
  - `privileges.test.sql`: la tabla, las columnas sin `token_hash`, el `delete` de `space_members` y cada función, incluida la excepción de anon.

## 2. Correo, función y configuración local

- **`supabase/templates/invite.html` y `recovery.html`:**
  - En español, con la marca: barra `#1E4E8C`, logo `{{ .SiteURL }}/icons/…` y botón.
  - Invitación: "{{ .Data.inviter_name }} te invitó a «{{ .Data.space_name }}»", con texto genérico si faltan los datos. El link es `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=invite`.
  - Recuperar: el `{{ .ConfirmationURL }}` de siempre, que `/restablecer-contrasena` ya maneja.
- **`config.jsonc`:**
  - `auth.email.template.invite` y `recovery`, con asunto y `content_path`.
  - `otp_expiry: 86400`.
  - `rate_limit.email_sent` local en 30.
  - `edge_runtime.enabled: true`.
  - `functions.invite-member.verify_jwt: false`.
- **`supabase/functions/`:**
  - `deno.json` (`npm:@supabase/supabase-js@<misma versión del front>`), `_shared/cors.ts` y `invite-member/index.ts`.
  - El flujo de la función:
    1. CORS: preflight y origen permitido.
    2. Solo `POST`.
    3. `Bearer` → `getUser(jwt)`. Si falla, 401.
    4. Valida el cuerpo (`{ action: 'invite', spaceId, email, role }` o `{ action: 'resend', invitationId }`).
    5. `invite`: comprueba que quien llama es propietario (`space_members` con su JWT; si no, 403) y llama `create_invitation`. `resend`: `rotate_invitation`.
    6. Sin cuenta, `admin.inviteUserByEmail(email, { redirectTo: link, data: { space_name, inviter_name } })`. Si falla al invitar, `revoke_invitation` y 502 `email_failed`. Si es por límite de envíos, 429.
    7. Responde `{ invitationId, email, expiresAt, delivery: 'email' | 'link', link? }`. El link solo va con `delivery: 'link'`.
  - Errores: `{ error: { code } }`, con CORS en todas las respuestas.
  - Env: `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` (inyectadas; TODO pasar a `SUPABASE_SECRET_KEYS` cuando se retiren las legacy), más `APP_URL` y `ALLOWED_ORIGINS` (secretos).
- **Local:**
  - `supabase/functions/local.env`, con valores que no son secretos (`APP_URL` y `ALLOWED_ORIGINS` de localhost).
  - Scripts: `functions:serve` (`supabase functions serve --env-file …`) y `e2e:local`.
- **Runbook `docs/runbooks/f1f-compartir.md`**, sin secretos:
  1. Gmail: verificación en 2 pasos y contraseña de aplicación.
  2. SMTP: `smtp.gmail.com:587`, el usuario y remitente son el Gmail, el nombre "Cuentas Claras" y la contraseña de aplicación.
  3. Límite de correos por hora.
  4. Auth:
     - registro cerrado;
     - confirmación de correo encendida;
     - contraseña mínima de 8;
     - "Email OTP Expiration" en 86400.
  5. Site URL: `https://cuentasclaras-inky.vercel.app`. Redirect URL: `https://cuentasclaras-inky.vercel.app/**`.
  6. Plantillas: asunto y cuerpo copiados de `supabase/templates`.
  7. `npm run db:backup` y luego `db push --remote=ryuknhuvydlwtbgruqdt`.
  8. `secrets set --remote=… APP_URL=… ALLOWED_ORIGINS=…` y comprobar que `SUPABASE_SERVICE_ROLE_KEY` aparece entre las inyectadas.
  9. `functions deploy invite-member --remote=…` (el deploy usa el proyecto vinculado si no se pasa `--remote`). Verificar que "Verify JWT" quede apagado y por qué.
  10. Prueba en producción: invitar a un correo propio y abrirlo en Safari del iPhone.
  11. Cómo revertir.

## 3. Frontend

- **Core:**
  - `app-paths`: `invitation: 'invitacion'`, `SETTINGS_PATHS.members: 'miembros'` y los query params de la invitación. `/invitacion` entra en `OUTSIDE_SHELL_PATHS`.
  - `core/config/member.constants.ts`: los nombres y descripciones de los roles (tabla §3.1) y el nombre de la función.
  - `SpaceService.reload()` público.
  - `SpaceMembersService` pasa a `space_member_list` (agrega `email`) y suma `changeRole`, `remove` y `leave`. Al salir, recarga y va a otro espacio o a `/bienvenida`.
  - `core/invitations/`:
    - `invitations.api.ts` (la tabla con columnas explícitas, las RPC y `functions.invoke`);
    - `InvitationsService` (las pendientes del espacio para el propietario y `mine()` para el invitado);
    - `invitation-errors.ts` (claves → español);
    - `AcceptInvitationFlow`: verifica el OTP solo si no hay sesión con ese correo, luego `updateUser({ password })`, el nombre visible, `accept_invitation` y `reload()`.
  - `dataErrorMessage` traduce `P0001` por clave.
  - `core/pwa/install.service.ts`: captura `beforeinstallprompt` desde el arranque, y expone `isStandalone`, `platform` y `prompt()`.
- **Dominio puro con pruebas:**
  - `domain/pwa/install-platform.ts`: iOS (también iPadOS con `maxTouchPoints`), Android u otro.
  - `domain/members/member-rules.ts`: quién puede cambiar o quitar a quién y si puede salir.
  - `domain/invitations/invitation-link.ts`: el modo según los params (`token` + `token_hash`, solo `token`, `id` o inválido).
- **UI** (`cc-`, al catálogo `/ui`):
  - `cc-invitation-card` (molécula): el badge del espacio y "X te invitó a «Y» como Z".
  - `cc-install-steps` (molécula): los pasos por plataforma (iOS: Compartir → Agregar a inicio; Android: "Instalar" o el menú; escritorio) y "Entra con tu correo y contraseña".
  - `cc-member-list` (organismo): miembros e invitaciones sobre `cc-list-item`, con acciones en `ccListItemEnd`.
  - `cc-invite-sheet` (organismo con confirmación):
    - correo y rol con su descripción;
    - una vista "link" con Copiar (`navigator.clipboard` en el toque) y Compartir (`navigator.share` si existe);
    - "Reenviar" de una cuenta existente abre la misma vista.
  - Íconos nuevos (`person_add`, `person_remove`, `ios_share`, `add_box`, `content_copy`, `share`, `logout`…) con `npm run icons:build`.
- **Configuración → Miembros** (`/configuracion/miembros`, enlazado desde "Espacio" con un resumen):
  - Todos ven la lista: nombre, correo, rol y "(tú)".
  - El propietario:
    - toca un miembro para elegir el rol en un `OptionPanel`; hacer a alguien propietario pide confirmación;
    - tiene "Quitar" con confirmación (explica lo de las cuentas privadas);
    - ve "Invitaciones pendientes" (correo, rol y "vence el …"), con Reenviar y Revocar;
    - invita con el "+".
  - Cualquiera tiene "Salir del espacio", con confirmación. Si es el último propietario, explica por qué no.
  - La orquestación va en `member-flow.ts`, como `tag-flow.ts`.
- **`/invitacion`** (en `AuthFrame`, sin guard):
  - Siempre muestra la vista previa y los estados de inválida, vencida, usada y revocada.
  - **Cuenta nueva** (`token_hash`):
    - Pide nombre visible y contraseña, como el registro, y "Aceptar invitación".
    - Si el OTP falló, dice que el link venció o ya se usó, y ofrece iniciar sesión o pedir que la reenvíen.
  - **Cuenta existente:**
    - Sin sesión: "Iniciar sesión" (`/iniciar-sesion?redirect=…`, que reutiliza el login y "¿Olvidaste tu contraseña?").
    - Con la sesión correcta: Aceptar o Rechazar.
    - Con otra cuenta: avisa y ofrece cerrar sesión.
  - **Terminado:** "Ya eres parte de «Y»". Si no está en la PWA instalada, muestra `cc-install-steps` con el correo. Si ya está en la PWA (o entró por `id`), va al espacio.
- **Asistente:** en `space-step`, sin espacio y con `mine()`, una sección destacada por invitación con "Aceptar invitación" y "Rechazar", arriba de "Crear espacio".
- **App:** al entrar con espacio, si hay `mine()`, el Shell muestra una vez por sesión un toast persistente "Te invitaron a «X»" con "Ver" (`/invitacion?id=`).
- **Encabezado:** el selector de espacio (ver Decisiones).
- **Revisión con dos miembros** (local, invitando a Ana como lector y luego como editor):
  - Persona en Transacciones (filtro) y en el Resumen (pestaña).
  - "Cuenta privada de X".
  - Las acciones con `canEdit` y `canConfigure` en cada pantalla.
  - Se arregla lo que falle.

## 4. Pruebas

- **Unitarias:**
  - el dominio de arriba;
  - `invitation-errors` y `dataErrorMessage` con `P0001`;
  - `AcceptInvitationFlow`: el orden, cuándo se salta el OTP y el fallo del OTP;
  - `InvitationsService`: `delivery` correo o link;
  - `SpaceMembersService.leave`;
  - `SpaceService.reload`.
- **e2e con mocks:**
  - `mockDataApi` suma las opciones `role`, `members`, `invitations`, `myInvitations` y `spaces`, más los mocks de las RPC nuevas, `functions/v1/invite-member`, `auth/v1/verify` y `auth/v1/user`.
  - `members.e2e.ts`: invitar (correo y link), cambiar el rol, quitar y salir.
  - `invitation.e2e.ts`: cuenta nueva, cuenta existente, vencida y terminado con los pasos de iOS.
  - El asistente con una invitación pendiente.
  - El selector con dos espacios.
  - Persona con dos miembros (sigue el caso de un solo miembro).
  - El lector: sin "+" ni edición.
  - Screenshots de todo.
- **Proyecto `iphone-webkit`** (`devices['iPhone 15']`, sin `channel`):
  - Solo `invitation.e2e.ts` y `auth-screens.e2e.ts`.
  - Requiere `npx playwright install webkit` una vez (lo instalo yo y lo anoto en `CLAUDE.md`).
- **e2e local** (`playwright.local.config.ts`, `e2e/local/*.local.ts`, en WebKit iPhone):
  - Requiere `db:start` y `functions:serve`.
  - Crea un propietario único (signUp + `create_space` por API) e inicia sesión en la UI.
  - Invita a un correo único y toma el link de Mailpit (`/api/v1/search`).
  - En un contexto nuevo: nombre, contraseña y aceptar; ve los pasos de iOS.
  - En otro contexto nuevo: inicia sesión con la cuenta nueva y entra al espacio.

## 5. Spec, CLAUDE.md y commits

- **Spec (v0.12):**
  - §3.1 y el encabezado de §7: el selector.
  - §3.2: qué pasa con los datos de quien sale.
  - §3.3: las reglas de invitación, los links, el OTP de 24 h y reenviar.
  - §7: Configuración → Miembros, `/invitacion` en Autenticación y el asistente.
  - §8: la tabla, las RPC, el trigger, la política de borrado y la Edge Function.
  - §10 y §12: la decisión de la F1f.
- **`CLAUDE.md`:**
  - comandos: `functions:serve`, `e2e:local` e instalar WebKit;
  - el e2e con 5 proyectos;
  - en la estructura: `supabase/functions`, `supabase/templates` y `docs/runbooks`.
- **Commits:**
  1. el plan;
  2. la migración, pgTAP y los tipos;
  3. la función, las plantillas y la config;
  4. el core y el dominio;
  5. Miembros y los componentes;
  6. `/invitacion`, el asistente, el selector y el aviso;
  7. el e2e con mocks y WebKit;
  8. el e2e local;
  9. la spec, el runbook y `CLAUDE.md`.

## Verificación

- Al escribir la migración: `npm run db:reset` y `npm run db:test`.
- Antes del PR, la suite completa:
  - `npm run lint`, `npm test` y `npm run build`;
  - `npm run e2e` (5 proyectos) y `npm run db:test`;
  - `npm run e2e:local`, con `db:start` y `functions:serve`.
- Revisar los screenshots: móvil y escritorio, claro y oscuro, e iPhone.
- Revisar a mano en local el correo en Mailpit (`127.0.0.1:54324`) y los dos miembros.
- PR contra `main` sin merge. Nada en producción.
