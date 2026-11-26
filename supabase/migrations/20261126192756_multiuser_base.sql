-- F1a · Base multiusuario: perfiles, espacios, miembros, configuración de espacio y de usuario.
-- Spec §3 y §8. Todas las tablas con RLS y grants explícitos; helpers security definer en `private`.

-- ── Privilegios por defecto y esquema privado ───────────────────────────────
-- Las funciones nuevas no quedan ejecutables por PUBLIC: cada una se otorga explícitamente.
alter default privileges for role postgres revoke execute on functions from public;

create schema private;
grant usage on schema private to authenticated;

-- ── Enums ─────────────────────────────────────────────────────────────────────
-- member_role y no space_role, para no chocar con la función private.space_role().
create type public.member_role as enum ('owner', 'editor', 'viewer');
create type public.weekday as enum (
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
);
create type public.period_kind as enum ('day', 'week', 'month', 'year', 'all');
-- comma_dot = 1,234.56 · dot_comma = 1.234,56 · space_comma = 1 234,56
create type public.number_format as enum ('comma_dot', 'dot_comma', 'space_comma');
create type public.theme_preference as enum ('system', 'light', 'dark');
create type public.home_screen as enum ('accounts', 'categories', 'transactions', 'budget', 'summary');

-- ── Tablas ────────────────────────────────────────────────────────────────────
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null
    check (display_name = btrim(display_name) and char_length(display_name) between 1 and 80),
  avatar_url text check (avatar_url ~ '^https://'),
  created_at timestamptz not null default now()
);

create table public.spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (name = btrim(name) and char_length(name) between 1 and 60),
  created_by uuid references public.profiles (user_id) on delete set null,
  created_at timestamptz not null default now()
);
create index spaces_created_by_idx on public.spaces (created_by);

create table public.space_members (
  space_id uuid not null references public.spaces (id) on delete cascade,
  -- FK a profiles (no a auth.users) para poder embeber el perfil desde PostgREST.
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  role public.member_role not null,
  -- La FK a accounts llega en la F1b.
  default_account_id uuid,
  joined_at timestamptz not null default now(),
  primary key (space_id, user_id)
);
create index space_members_user_id_idx on public.space_members (user_id);

create table public.space_settings (
  space_id uuid primary key references public.spaces (id) on delete cascade,
  main_currency text not null default 'COP' check (main_currency ~ '^[A-Z]{3}$'),
  month_start_day smallint not null default 1 check (month_start_day between 1 and 28),
  week_start public.weekday not null default 'monday',
  budgets_enabled boolean not null default true,
  default_period public.period_kind not null default 'month',
  -- Último paso del asistente completado (0 = ninguno).
  onboarding_step smallint not null default 0 check (onboarding_step >= 0),
  onboarding_completed_at timestamptz
);

create table public.user_settings (
  user_id uuid primary key references public.profiles (user_id) on delete cascade,
  theme public.theme_preference not null default 'system',
  number_format public.number_format not null default 'comma_dot',
  show_decimals boolean not null default true,
  home_screen public.home_screen not null default 'categories',
  last_space_id uuid references public.spaces (id) on delete set null
);
create index user_settings_last_space_id_idx on public.user_settings (last_space_id);

-- ── Helpers ───────────────────────────────────────────────────────────────────
-- Security definer: leen space_members sin pasar por su RLS, lo que evita la recursión.
create function private.is_space_member(target_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.space_members
    where space_id = target_space_id and user_id = (select auth.uid())
  );
$$;

create function private.space_role(target_space_id uuid)
returns public.member_role
language sql
stable
security definer
set search_path = ''
as $$
  select role
  from public.space_members
  where space_id = target_space_id and user_id = (select auth.uid());
$$;

create function private.shares_space_with(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.space_members mine
    join public.space_members theirs on theirs.space_id = mine.space_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = target_user_id
  );
$$;

revoke all on function
  private.is_space_member(uuid),
  private.space_role(uuid),
  private.shares_space_with(uuid)
from public, anon;
grant execute on function
  private.is_space_member(uuid),
  private.space_role(uuid),
  private.shares_space_with(uuid)
to authenticated;

-- ── Privilegios de tablas ─────────────────────────────────────────────────────
-- revoke all también quita TRUNCATE, que se salta RLS. Incluye service_role para que local y
-- producción queden iguales sin importar los privilegios por defecto de cada uno.
revoke all on table
  public.profiles, public.spaces, public.space_members, public.space_settings, public.user_settings
from anon, authenticated, service_role;

-- service_role ya no recibe grants por defecto; lo usan las Edge Functions (F1f).
grant select, insert, update, delete on table
  public.profiles, public.spaces, public.space_members, public.space_settings, public.user_settings
to service_role;

grant select on table
  public.profiles, public.spaces, public.space_members, public.space_settings, public.user_settings
to authenticated;

-- Updates por columna: nadie mueve filas entre espacios ni cambia llaves.
grant update (display_name, avatar_url) on public.profiles to authenticated;
grant update (name) on public.spaces to authenticated;
grant update (role) on public.space_members to authenticated;
grant update (
  main_currency, month_start_day, week_start, budgets_enabled, default_period,
  onboarding_step, onboarding_completed_at
) on public.space_settings to authenticated;
grant update (theme, number_format, show_decimals, home_screen, last_space_id)
  on public.user_settings to authenticated;
-- Sin insert/delete para el cliente: perfiles y user_settings los crea el trigger de alta;
-- espacios, miembros y settings solo create_space. Borrar espacios y quitar miembros: F1f.

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.spaces enable row level security;
alter table public.space_members enable row level security;
alter table public.space_settings enable row level security;
alter table public.user_settings enable row level security;

create policy profiles_select on public.profiles
  for select to authenticated
  using (user_id = (select auth.uid()) or private.shares_space_with(user_id));

create policy profiles_update on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy spaces_select on public.spaces
  for select to authenticated
  using (private.is_space_member(id));

create policy spaces_update on public.spaces
  for update to authenticated
  using (private.space_role(id) = 'owner')
  with check (private.space_role(id) = 'owner');

create policy space_members_select on public.space_members
  for select to authenticated
  using (private.is_space_member(space_id));

-- Solo el owner cambia roles, y nunca el suyo: así no se queda el espacio sin owner.
create policy space_members_update on public.space_members
  for update to authenticated
  using (private.space_role(space_id) = 'owner' and user_id <> (select auth.uid()))
  with check (private.space_role(space_id) = 'owner' and user_id <> (select auth.uid()));

create policy space_settings_select on public.space_settings
  for select to authenticated
  using (private.is_space_member(space_id));

create policy space_settings_update on public.space_settings
  for update to authenticated
  using (private.space_role(space_id) = 'owner')
  with check (private.space_role(space_id) = 'owner');

create policy user_settings_select on public.user_settings
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy user_settings_update on public.user_settings
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- last_space_id solo puede apuntar a un espacio propio y se valida solo cuando cambia: un valor
-- viejo (p. ej. tras salir de un espacio) no bloquea guardar otras preferencias.
create function private.check_last_space_id()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.last_space_id is distinct from old.last_space_id
     and new.last_space_id is not null
     and (select auth.uid()) is not null
     and not private.is_space_member(new.last_space_id) then
    raise exception 'last_space_id must be a space the user belongs to' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.check_last_space_id() from public, anon, authenticated;

create trigger user_settings_check_last_space
  before update of last_space_id on public.user_settings
  for each row execute function private.check_last_space_id();

-- ── Alta de usuarios: perfil + user_settings ─────────────────────────────────
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    left(coalesce(nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'Usuario'), 80)
  )
  on conflict (user_id) do nothing;

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;
revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Relleno para los usuarios que ya existen.
insert into public.profiles (user_id, display_name)
select id, left(coalesce(nullif(split_part(coalesce(email, ''), '@', 1), ''), 'Usuario'), 80)
from auth.users
on conflict (user_id) do nothing;

insert into public.user_settings (user_id)
select user_id from public.profiles
on conflict (user_id) do nothing;

-- ── RPC: crear espacio ───────────────────────────────────────────────────────
-- Una transacción: espacio + membresía owner + settings. El cliente no inserta en esas tablas.
create function public.create_space(
  space_name text,
  main_currency text,
  month_start_day integer,
  week_start public.weekday
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  new_space_id uuid;
begin
  if caller is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'create_space requires a signed-in user' using errcode = '42501';
  end if;

  insert into public.spaces (name, created_by)
  values (btrim(space_name), caller)
  returning id into new_space_id;

  insert into public.space_members (space_id, user_id, role)
  values (new_space_id, caller, 'owner');

  -- Crear el espacio es completar el paso 1 del asistente: se marca en la misma transacción.
  insert into public.space_settings (space_id, main_currency, month_start_day, week_start, onboarding_step)
  values (new_space_id, main_currency, month_start_day, week_start, 1);

  return new_space_id;
end;
$$;
revoke all on function public.create_space(text, text, integer, public.weekday) from public, anon;
grant execute on function public.create_space(text, text, integer, public.weekday) to authenticated;
