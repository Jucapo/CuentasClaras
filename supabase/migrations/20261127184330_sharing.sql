-- F1f · Compartir: invitaciones, miembros (cambiar rol, quitar y salir) y la regla de al menos un
-- propietario. Spec §3, §7 y §8. El token de la invitación solo se guarda como hash; las escrituras
-- van por RPC. No borra ni renombra nada y no transforma datos.

-- ── Invitaciones ──────────────────────────────────────────────────────────────
create table public.space_invitations (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  email text not null constraint space_invitations_email_check check (
    email = lower(btrim(email)) and char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  ),
  role public.member_role not null,
  -- sha256 del token; el token solo viaja en el link.
  token_hash bytea not null unique,
  invited_by uuid references public.profiles (user_id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (user_id) on delete set null,
  declined_at timestamptz,
  revoked_at timestamptz,
  constraint space_invitations_one_outcome
    check (num_nonnulls(accepted_at, declined_at, revoked_at) <= 1)
);

-- Una abierta por correo y espacio (abierta = sin respuesta ni revocar, vencida o no).
create unique index space_invitations_open_key on public.space_invitations (space_id, email)
  where accepted_at is null and declined_at is null and revoked_at is null;
create index space_invitations_email_idx on public.space_invitations (email);

alter table public.space_invitations enable row level security;

revoke all on table public.space_invitations from anon, authenticated, service_role;
grant select, insert, update, delete on table public.space_invitations to service_role;
-- Sin token_hash, ni para el propietario. Las escrituras van por RPC.
grant select (
  id, space_id, email, role, invited_by, created_at, expires_at, accepted_at, declined_at, revoked_at
) on public.space_invitations to authenticated;

create policy space_invitations_select on public.space_invitations
  for select to authenticated
  using (private.space_role(space_id) = 'owner');

-- ── Helpers ───────────────────────────────────────────────────────────────────
-- Correo confirmado de quien llama; null sin sesión o sin confirmar.
create function private.confirmed_email()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select lower(u.email)
  from auth.users u
  where u.id = (select auth.uid()) and u.email_confirmed_at is not null;
$$;

create function private.invitation_token_hash(token text)
returns bytea
language sql
immutable
set search_path = ''
as $$
  select sha256(convert_to(token, 'UTF8'));
$$;

-- 32 bytes al azar en hex: 64 caracteres, seguros en una URL.
create function private.new_invitation_token()
returns text
language sql
volatile
set search_path = ''
as $$
  select encode(extensions.gen_random_bytes(32), 'hex');
$$;

-- Un correo con cuenta confirmada no recibe correo de invitación: la ve al entrar a la app.
create function private.has_confirmed_account(target_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.users u
    where lower(u.email) = target_email and u.email_confirmed_at is not null
  );
$$;

-- Valida y aplica la respuesta a una invitación ya bloqueada (for update). Orden de las
-- validaciones: sesión, existe, revocada, usada, vencida, correo y, al aceptar, ya es miembro.
-- Aceptar crea la membresía con el rol y una cuenta predeterminada, y deja el espacio como el
-- último usado. Devuelve el espacio.
create function private.respond_to_invitation(invitation public.space_invitations, accepting boolean)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  fallback_account uuid;
begin
  if caller is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if invitation.id is null then
    raise exception 'invitation_not_found' using errcode = 'P0001';
  end if;
  if invitation.revoked_at is not null then
    raise exception 'invitation_revoked' using errcode = 'P0001';
  end if;
  if invitation.accepted_at is not null or invitation.declined_at is not null then
    raise exception 'invitation_used' using errcode = 'P0001';
  end if;
  if invitation.expires_at <= now() then
    raise exception 'invitation_expired' using errcode = 'P0001';
  end if;
  if private.confirmed_email() is distinct from invitation.email then
    raise exception 'invitation_email_mismatch' using errcode = 'P0001';
  end if;

  if not accepting then
    update public.space_invitations set declined_at = now() where id = invitation.id;
    return invitation.space_id;
  end if;

  if exists (
    select 1 from public.space_members m
    where m.space_id = invitation.space_id and m.user_id = caller
  ) then
    raise exception 'already_member' using errcode = 'P0001';
  end if;

  -- La predeterminada de quien invitó si es compartida y activa; si no, la primera compartida
  -- activa del grupo Cuentas; si no hay, ninguna.
  select coalesce(
    (
      select a.id
      from public.space_members m
      join public.accounts a on a.space_id = m.space_id and a.id = m.default_account_id
      where m.space_id = invitation.space_id and m.user_id = invitation.invited_by
        and a.visibility = 'shared' and a.archived_at is null
    ),
    (
      select a.id
      from public.accounts a
      where a.space_id = invitation.space_id and a.visibility = 'shared'
        and a.archived_at is null and a.account_group = 'accounts'
      order by a.sort_order, a.created_at
      limit 1
    )
  )
  into fallback_account;

  insert into public.space_members (space_id, user_id, role, default_account_id)
  values (invitation.space_id, caller, invitation.role, fallback_account);
  update public.space_invitations
    set accepted_at = now(), accepted_by = caller
    where id = invitation.id;
  update public.user_settings set last_space_id = invitation.space_id where user_id = caller;
  return invitation.space_id;
end;
$$;

revoke all on function
  private.confirmed_email(),
  private.invitation_token_hash(text),
  private.new_invitation_token(),
  private.has_confirmed_account(text),
  private.respond_to_invitation(public.space_invitations, boolean)
from public, anon, authenticated;

-- ── RPC: invitar, reenviar y revocar (solo el propietario) ───────────────────
-- Crea la invitación y devuelve el token una sola vez. Una abierta pero vencida se revoca y se
-- reemplaza. invitee_has_account dice si el correo ya tiene cuenta confirmada: en ese caso la
-- Edge Function no envía correo y devuelve el link.
create function public.create_invitation(
  target_space_id uuid,
  invitee_email text,
  invitee_role public.member_role
)
returns table (
  invitation_id uuid,
  token text,
  email text,
  expires_at timestamptz,
  invitee_has_account boolean,
  space_name text,
  inviter_name text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  normalized text := lower(btrim(invitee_email));
  new_token text := private.new_invitation_token();
begin
  if private.space_role(target_space_id) is distinct from 'owner' then
    raise exception 'not_space_owner' using errcode = '42501';
  end if;
  if exists (
    select 1
    from public.space_members m
    join auth.users u on u.id = m.user_id
    where m.space_id = target_space_id and lower(u.email) = normalized
  ) then
    raise exception 'already_member' using errcode = 'P0001';
  end if;

  update public.space_invitations i
    set revoked_at = now()
    where i.space_id = target_space_id and i.email = normalized and i.expires_at <= now()
      and i.accepted_at is null and i.declined_at is null and i.revoked_at is null;
  if exists (
    select 1 from public.space_invitations i
    where i.space_id = target_space_id and i.email = normalized
      and i.accepted_at is null and i.declined_at is null and i.revoked_at is null
  ) then
    raise exception 'invitation_pending' using errcode = 'P0001';
  end if;

  return query
  with created as (
    insert into public.space_invitations (space_id, email, role, token_hash, invited_by, expires_at)
    values (
      target_space_id, normalized, invitee_role, private.invitation_token_hash(new_token),
      (select auth.uid()), now() + interval '7 days'
    )
    returning id, email, expires_at
  )
  select c.id, new_token, c.email, c.expires_at, private.has_confirmed_account(c.email),
         s.name, p.display_name
  from created c
  join public.spaces s on s.id = target_space_id
  left join public.profiles p on p.user_id = (select auth.uid());
end;
$$;

-- Reenviar: token nuevo y 7 días desde hoy; el link anterior deja de servir.
create function public.rotate_invitation(target_invitation_id uuid)
returns table (
  invitation_id uuid,
  token text,
  email text,
  expires_at timestamptz,
  invitee_has_account boolean,
  space_name text,
  inviter_name text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  invitation public.space_invitations;
  new_token text := private.new_invitation_token();
begin
  select * into invitation from public.space_invitations i
    where i.id = target_invitation_id
    for update;
  if invitation.id is null or private.space_role(invitation.space_id) is distinct from 'owner' then
    raise exception 'not_space_owner' using errcode = '42501';
  end if;
  if num_nonnulls(invitation.accepted_at, invitation.declined_at, invitation.revoked_at) > 0 then
    raise exception 'invitation_closed' using errcode = 'P0001';
  end if;

  return query
  with rotated as (
    update public.space_invitations i
      set token_hash = private.invitation_token_hash(new_token),
          expires_at = now() + interval '7 days'
      where i.id = invitation.id
    returning id, email, expires_at
  )
  select r.id, new_token, r.email, r.expires_at, private.has_confirmed_account(r.email),
         s.name, p.display_name
  from rotated r
  join public.spaces s on s.id = invitation.space_id
  left join public.profiles p on p.user_id = (select auth.uid());
end;
$$;

create function public.revoke_invitation(target_invitation_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  invitation public.space_invitations;
begin
  select * into invitation from public.space_invitations i
    where i.id = target_invitation_id
    for update;
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
-- Lo que /invitacion muestra antes de iniciar sesión, también para anon. Un token desconocido no
-- devuelve filas.
create function public.invitation_preview(invitation_token text)
returns table (
  invitation_id uuid,
  space_name text,
  space_icon public.icon_key,
  space_color public.color_key,
  inviter_name text,
  role public.member_role,
  email text,
  expires_at timestamptz,
  status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, s.name, s.icon, s.color, p.display_name, i.role, i.email, i.expires_at,
         case
           when i.revoked_at is not null then 'revoked'
           when i.accepted_at is not null then 'accepted'
           when i.declined_at is not null then 'declined'
           when i.expires_at <= now() then 'expired'
           else 'pending'
         end
  from public.space_invitations i
  join public.spaces s on s.id = i.space_id
  left join public.profiles p on p.user_id = i.invited_by
  where i.token_hash = private.invitation_token_hash(invitation_token);
$$;

-- Invitaciones abiertas y vigentes para el correo confirmado de quien llama, a espacios donde
-- todavía no está.
create function public.my_invitations()
returns table (
  invitation_id uuid,
  space_id uuid,
  space_name text,
  space_icon public.icon_key,
  space_color public.color_key,
  inviter_name text,
  role public.member_role,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, i.space_id, s.name, s.icon, s.color, p.display_name, i.role, i.expires_at
  from public.space_invitations i
  join public.spaces s on s.id = i.space_id
  left join public.profiles p on p.user_id = i.invited_by
  where i.email = private.confirmed_email()
    and i.accepted_at is null and i.declined_at is null and i.revoked_at is null
    and i.expires_at > now()
    and not exists (
      select 1 from public.space_members m
      where m.space_id = i.space_id and m.user_id = (select auth.uid())
    )
  order by i.created_at;
$$;

-- Por token (el link) o por id (el aviso dentro de la app, donde la prueba es el correo
-- confirmado). Exactamente uno de los dos.
create function public.accept_invitation(
  invitation_token text default null,
  target_invitation_id uuid default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  invitation public.space_invitations;
begin
  if num_nonnulls(invitation_token, target_invitation_id) <> 1 then
    raise exception 'invitation_not_found' using errcode = 'P0001';
  end if;
  select * into invitation from public.space_invitations i
    where (invitation_token is not null and i.token_hash = private.invitation_token_hash(invitation_token))
       or i.id = target_invitation_id
    for update;
  return private.respond_to_invitation(invitation, true);
end;
$$;

create function public.decline_invitation(
  invitation_token text default null,
  target_invitation_id uuid default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  invitation public.space_invitations;
begin
  if num_nonnulls(invitation_token, target_invitation_id) <> 1 then
    raise exception 'invitation_not_found' using errcode = 'P0001';
  end if;
  select * into invitation from public.space_invitations i
    where (invitation_token is not null and i.token_hash = private.invitation_token_hash(invitation_token))
       or i.id = target_invitation_id
    for update;
  return private.respond_to_invitation(invitation, false);
end;
$$;

-- ── Miembros ─────────────────────────────────────────────────────────────────
-- Nombre, correo y rol de los miembros, para quien es miembro. El correo solo sale por aquí.
create function public.space_member_list(target_space_id uuid)
returns table (
  user_id uuid,
  display_name text,
  email text,
  role public.member_role,
  joined_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id, p.display_name, u.email, m.role, m.joined_at
  from public.space_members m
  join public.profiles p on p.user_id = m.user_id
  join auth.users u on u.id = m.user_id
  where m.space_id = target_space_id and private.is_space_member(target_space_id)
  order by m.joined_at, m.user_id;
$$;

-- Salir y quitar: cada quien puede salir; el propietario puede quitar a cualquiera. Lo que pasa
-- con las cuentas y movimientos de quien sale está en la spec (§3.2): nada se borra.
grant delete on public.space_members to authenticated;

create policy space_members_delete on public.space_members
  for delete to authenticated
  using (user_id = (select auth.uid()) or private.space_role(space_id) = 'owner');

-- Siempre queda al menos un propietario, también por caminos que no pasan por RLS. Bloquear el
-- espacio serializa los cambios simultáneos. Si el espacio se está borrando (la fila ya no se ve),
-- la regla no aplica.
create function private.ensure_space_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.spaces s where s.id = old.space_id for update;
  if not found then
    return null;
  end if;
  if not exists (
    select 1 from public.space_members m
    where m.space_id = old.space_id and m.role = 'owner'
  ) then
    raise exception 'last_owner' using errcode = 'P0001';
  end if;
  return null;
end;
$$;

revoke all on function private.ensure_space_owner() from public, anon, authenticated;

create trigger space_members_keep_owner
  after delete or update of role on public.space_members
  for each row execute function private.ensure_space_owner();

-- ── Grants de las RPC ─────────────────────────────────────────────────────────
revoke all on function
  public.create_invitation(uuid, text, public.member_role),
  public.rotate_invitation(uuid),
  public.revoke_invitation(uuid),
  public.invitation_preview(text),
  public.my_invitations(),
  public.accept_invitation(text, uuid),
  public.decline_invitation(text, uuid),
  public.space_member_list(uuid)
from public, anon;

grant execute on function
  public.create_invitation(uuid, text, public.member_role),
  public.rotate_invitation(uuid),
  public.revoke_invitation(uuid),
  public.invitation_preview(text),
  public.my_invitations(),
  public.accept_invitation(text, uuid),
  public.decline_invitation(text, uuid),
  public.space_member_list(uuid)
to authenticated;

-- Única excepción a "anon no recibe nada": /invitacion se ve antes de iniciar sesión, y sin el
-- token no devuelve nada.
grant execute on function public.invitation_preview(text) to anon;
