-- F1b · Catálogos: cuentas (incluidas deudas y "me deben"), categorías, etiquetas, etiquetas por
-- defecto, saldos y cuenta predeterminada por miembro. Spec §3.2, §4.1, §4.3, §4.4 y §8.

-- ── Tipos ─────────────────────────────────────────────────────────────────────
create type public.account_kind as enum (
  'cash', 'bank', 'wallet', 'savings', 'credit_card', 'loan', 'simple_debt', 'receivable', 'asset'
);
create type public.account_group as enum ('accounts', 'savings', 'debts', 'receivables', 'assets');
create type public.account_visibility as enum ('shared', 'private');
create type public.category_kind as enum ('expense', 'income');

-- Claves del catálogo de íconos y de la paleta (§13.3): nunca valores hex.
create domain public.icon_key as text check (value ~ '^[a-z0-9_]{1,64}$');
create domain public.color_key as text
  check (value ~ '^[a-z]+(-[a-z]+)*$' and char_length(value) <= 32);

-- Grupo de cada tipo de cuenta (§4.1). Fuente única para la columna generada y los triggers.
create function private.account_group_of(kind public.account_kind)
returns public.account_group
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case kind
    when 'cash' then 'accounts'
    when 'bank' then 'accounts'
    when 'wallet' then 'accounts'
    when 'savings' then 'savings'
    when 'credit_card' then 'debts'
    when 'loan' then 'debts'
    when 'simple_debt' then 'debts'
    when 'receivable' then 'receivables'
    when 'asset' then 'assets'
  end::public.account_group;
$$;
-- La columna generada se evalúa con los privilegios de quien inserta.
revoke all on function private.account_group_of(public.account_kind) from public, anon;
grant execute on function private.account_group_of(public.account_kind) to authenticated, service_role;

-- ── Espacios: ícono y color ───────────────────────────────────────────────────
alter table public.spaces
  add column icon public.icon_key not null default 'home',
  add column color public.color_key not null default 'green';

-- ── Cuentas ───────────────────────────────────────────────────────────────────
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  -- restrict: borrar un usuario con cuentas se resuelve explícitamente (F4).
  owner_id uuid not null default auth.uid() references public.profiles (user_id) on delete restrict,
  visibility public.account_visibility not null default 'shared',
  name text not null check (name = btrim(name) and char_length(name) between 1 and 60),
  kind public.account_kind not null,
  account_group public.account_group not null
    generated always as (private.account_group_of(kind)) stored,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  -- Unidades menores; las deudas en negativo (§4.1).
  initial_balance bigint not null default 0,
  -- Fecha local que manda el cliente: un default del servidor estaría en UTC.
  initial_balance_date date not null,
  icon public.icon_key not null,
  color public.color_key not null,
  -- Sin default estático: depende del grupo y lo pone private.set_account_defaults().
  include_in_total boolean not null,
  -- Solo aplica a las cuentas privadas (§3.2).
  include_in_space_by_default boolean not null default false,
  sort_order integer not null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  -- Destino de las FKs compuestas que exigen el mismo espacio.
  unique (space_id, id)
);
create index accounts_owner_id_idx on public.accounts (owner_id);

-- ── Cuenta predeterminada de cada miembro ─────────────────────────────────────
alter table public.space_members
  add constraint space_members_default_account_fkey
  foreign key (space_id, default_account_id) references public.accounts (space_id, id)
  on delete set null (default_account_id);
create index space_members_default_account_idx
  on public.space_members (space_id, default_account_id);

-- ── Categorías ────────────────────────────────────────────────────────────────
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  parent_id uuid,
  kind public.category_kind not null,
  name text not null check (name = btrim(name) and char_length(name) between 1 and 40),
  icon public.icon_key not null,
  -- Null solo en subcategorías: heredan el color de su categoría.
  color public.color_key,
  sort_order integer not null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (space_id, id),
  foreign key (space_id, parent_id) references public.categories (space_id, id) on delete cascade,
  check (parent_id is distinct from id),
  check (color is not null or parent_id is not null)
);
create index categories_parent_idx on public.categories (space_id, parent_id);
create unique index categories_name_key
  on public.categories (space_id, kind, parent_id, lower(name)) nulls not distinct
  where archived_at is null;

-- ── Etiquetas ─────────────────────────────────────────────────────────────────
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  name text not null check (name = btrim(name) and char_length(name) between 1 and 30),
  color public.color_key not null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (space_id, id)
);
create unique index tags_name_key on public.tags (space_id, lower(name)) where archived_at is null;

-- space_id es redundante a propósito: las FKs compuestas impiden mezclar espacios y la RLS no
-- necesita un join.
create table public.category_default_tags (
  space_id uuid not null,
  category_id uuid not null,
  tag_id uuid not null,
  primary key (category_id, tag_id),
  foreign key (space_id, category_id) references public.categories (space_id, id) on delete cascade,
  foreign key (space_id, tag_id) references public.tags (space_id, id) on delete cascade
);
create index category_default_tags_tag_idx on public.category_default_tags (space_id, tag_id);

-- ── Saldos (§4.1: se calculan, no se guardan) ─────────────────────────────────
-- La F1d reemplaza movements_total por la suma de los movimientos con `create or replace view`,
-- con las mismas columnas en el mismo orden, así que nadie que la use se rompe.
create view public.account_balances with (security_invoker = true) as
select
  a.id as account_id,
  a.space_id,
  a.currency,
  a.initial_balance,
  0::bigint as movements_total,
  a.initial_balance as balance
from public.accounts a;

-- ── Helpers ───────────────────────────────────────────────────────────────────
create function private.is_space_editor(target_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.space_role(target_space_id) in ('owner', 'editor'), false);
$$;

-- Lo usa la RLS de los movimientos en la F1d (§8).
create function private.can_see_account(target_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.accounts a
    where a.id = target_account_id
      and private.is_space_member(a.space_id)
      and (a.visibility = 'shared' or a.owner_id = (select auth.uid()))
  );
$$;

revoke all on function
  private.is_space_editor(uuid),
  private.can_see_account(uuid)
from public, anon;
grant execute on function
  private.is_space_editor(uuid),
  private.can_see_account(uuid)
to authenticated;

-- ── Triggers ──────────────────────────────────────────────────────────────────
-- Defaults que dependen de otras columnas: incluir en el total solo el dinero disponible
-- (grupo Cuentas) y el orden al final de las cuentas del espacio.
create function private.set_account_defaults()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.include_in_total is null then
    new.include_in_total := private.account_group_of(new.kind) = 'accounts';
  end if;
  if new.sort_order is null then
    select coalesce(max(a.sort_order) + 1, 0) into new.sort_order
    from public.accounts a
    where a.space_id = new.space_id;
  end if;
  return new;
end;
$$;
revoke all on function private.set_account_defaults() from public, anon, authenticated;

create trigger accounts_set_defaults
  before insert on public.accounts
  for each row execute function private.set_account_defaults();

-- Una cuenta archivada no puede ser la predeterminada de nadie, y una privada solo la de su dueño.
create function private.clear_unreachable_default_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.space_members
  set default_account_id = null
  where space_id = new.space_id
    and default_account_id = new.id
    and (new.archived_at is not null or user_id <> new.owner_id);
  return null;
end;
$$;
revoke all on function private.clear_unreachable_default_account() from public, anon, authenticated;

create trigger accounts_clear_unreachable_default
  after update of visibility, archived_at on public.accounts
  for each row
  when (new.archived_at is not null or new.visibility = 'private')
  execute function private.clear_unreachable_default_account();

-- Máximo dos niveles (§4.3): el padre no tiene padre y es de la misma clase, y una categoría con
-- subcategorías no puede volverse subcategoría ni cambiar de clase.
create function private.check_category_hierarchy()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent record;
begin
  if new.parent_id is not null then
    select c.parent_id, c.kind into parent
    from public.categories c
    where c.id = new.parent_id;

    if found and parent.parent_id is not null then
      raise exception 'categories have at most two levels' using errcode = '23514';
    end if;
    if found and parent.kind <> new.kind then
      raise exception 'a subcategory has the kind of its parent' using errcode = '23514';
    end if;
  end if;

  if tg_op = 'UPDATE'
     and (new.parent_id is not null or new.kind <> old.kind)
     and exists (select 1 from public.categories c where c.parent_id = new.id) then
    raise exception 'a category with subcategories stays a top-level category of its kind'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.check_category_hierarchy() from public, anon, authenticated;

create trigger categories_check_hierarchy
  before insert or update of parent_id, kind on public.categories
  for each row execute function private.check_category_hierarchy();

-- Orden al final de sus hermanas (mismo espacio, clase y padre).
create function private.set_category_sort_order()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.sort_order is null then
    select coalesce(max(c.sort_order) + 1, 0) into new.sort_order
    from public.categories c
    where c.space_id = new.space_id
      and c.kind = new.kind
      and c.parent_id is not distinct from new.parent_id;
  end if;
  return new;
end;
$$;
revoke all on function private.set_category_sort_order() from public, anon, authenticated;

create trigger categories_set_sort_order
  before insert on public.categories
  for each row execute function private.set_category_sort_order();

-- ── Privilegios de tablas ─────────────────────────────────────────────────────
revoke all on table
  public.accounts, public.categories, public.tags, public.category_default_tags,
  public.account_balances
from anon, authenticated, service_role;

grant select, insert, update, delete on table
  public.accounts, public.categories, public.tags, public.category_default_tags
to service_role;
grant select on table public.account_balances to authenticated, service_role;

grant select, delete on table
  public.accounts, public.categories, public.tags, public.category_default_tags
to authenticated;

-- Nadie elige el dueño, el id ni la fecha de creación, ni mueve filas entre espacios.
grant insert (
  space_id, visibility, name, kind, currency, initial_balance, initial_balance_date, icon, color,
  include_in_total, include_in_space_by_default, sort_order
) on public.accounts to authenticated;
grant update (
  visibility, name, kind, currency, initial_balance, initial_balance_date, icon, color,
  include_in_total, include_in_space_by_default, sort_order, archived_at
) on public.accounts to authenticated;

-- La clase de una categoría no cambia: así sus subcategorías siempre coinciden.
grant insert (space_id, parent_id, kind, name, icon, color, sort_order)
  on public.categories to authenticated;
grant update (parent_id, name, icon, color, sort_order, archived_at)
  on public.categories to authenticated;

grant insert (space_id, name, color) on public.tags to authenticated;
grant update (name, color, archived_at) on public.tags to authenticated;

grant insert (space_id, category_id, tag_id) on public.category_default_tags to authenticated;

grant update (icon, color) on public.spaces to authenticated;

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.tags enable row level security;
alter table public.category_default_tags enable row level security;

-- Las privadas solo las ve su dueño (§3.2).
create policy accounts_select on public.accounts
  for select to authenticated
  using (
    private.is_space_member(space_id)
    and (visibility = 'shared' or owner_id = (select auth.uid()))
  );

create policy accounts_insert on public.accounts
  for insert to authenticated
  with check (private.is_space_editor(space_id) and owner_id = (select auth.uid()));

-- with check sobre la fila nueva: un editor no puede volver privada la cuenta de otro.
create policy accounts_update on public.accounts
  for update to authenticated
  using (
    private.is_space_editor(space_id)
    and (visibility = 'shared' or owner_id = (select auth.uid()))
  )
  with check (
    private.is_space_editor(space_id)
    and (visibility = 'shared' or owner_id = (select auth.uid()))
  );

create policy accounts_delete on public.accounts
  for delete to authenticated
  using (
    private.is_space_editor(space_id)
    and (visibility = 'shared' or owner_id = (select auth.uid()))
  );

create policy categories_select on public.categories
  for select to authenticated
  using (private.is_space_member(space_id));

create policy categories_insert on public.categories
  for insert to authenticated
  with check (private.is_space_editor(space_id));

create policy categories_update on public.categories
  for update to authenticated
  using (private.is_space_editor(space_id))
  with check (private.is_space_editor(space_id));

create policy categories_delete on public.categories
  for delete to authenticated
  using (private.is_space_editor(space_id));

create policy tags_select on public.tags
  for select to authenticated
  using (private.is_space_member(space_id));

create policy tags_insert on public.tags
  for insert to authenticated
  with check (private.is_space_editor(space_id));

create policy tags_update on public.tags
  for update to authenticated
  using (private.is_space_editor(space_id))
  with check (private.is_space_editor(space_id));

create policy tags_delete on public.tags
  for delete to authenticated
  using (private.is_space_editor(space_id));

create policy category_default_tags_select on public.category_default_tags
  for select to authenticated
  using (private.is_space_member(space_id));

create policy category_default_tags_insert on public.category_default_tags
  for insert to authenticated
  with check (private.is_space_editor(space_id));

create policy category_default_tags_delete on public.category_default_tags
  for delete to authenticated
  using (private.is_space_editor(space_id));

-- ── RPC: cuenta predeterminada ────────────────────────────────────────────────
-- Cada miembro elige la suya (§3.1). La cuenta debe ser del espacio, visible para quien llama y no
-- estar archivada; cualquier otra da el mismo error, para no revelar si existe.
create function public.set_default_account(target_space_id uuid, target_account_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
begin
  if caller is null or not private.is_space_member(target_space_id) then
    raise exception 'set_default_account requires a member of the space' using errcode = '42501';
  end if;

  if target_account_id is not null and not exists (
    select 1
    from public.accounts a
    where a.id = target_account_id
      and a.space_id = target_space_id
      and (a.visibility = 'shared' or a.owner_id = caller)
      and a.archived_at is null
  ) then
    raise exception 'the default account must be an active account the member can see'
      using errcode = '42501';
  end if;

  update public.space_members
  set default_account_id = target_account_id
  where space_id = target_space_id and user_id = caller;
end;
$$;
revoke all on function public.set_default_account(uuid, uuid) from public, anon;
grant execute on function public.set_default_account(uuid, uuid) to authenticated;

-- ── RPC: reordenar categorías ─────────────────────────────────────────────────
-- Security invoker: respeta la RLS. Recibe todas las hermanas en el orden nuevo.
create function public.reorder_categories(category_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  updated integer;
begin
  if cardinality(category_ids) is distinct from (
    select count(distinct id) from unnest(category_ids) as ids (id)
  ) then
    raise exception 'reorder_categories needs distinct ids' using errcode = '23514';
  end if;

  if (
    select count(*)
    from (
      select distinct c.space_id, c.kind, c.parent_id
      from public.categories c
      where c.id = any (category_ids)
    ) siblings
  ) > 1 then
    raise exception 'only sibling categories can be reordered together' using errcode = '23514';
  end if;

  update public.categories c
  set sort_order = ordered.position - 1
  from unnest(category_ids) with ordinality as ordered (id, position)
  where c.id = ordered.id;

  -- La RLS filtra en silencio: si faltan filas, quien llama no podía cambiarlas todas.
  get diagnostics updated = row_count;
  if updated <> coalesce(cardinality(category_ids), 0) then
    raise exception 'reorder_categories can only reorder editable categories'
      using errcode = '42501';
  end if;
end;
$$;
revoke all on function public.reorder_categories(uuid[]) from public, anon;
grant execute on function public.reorder_categories(uuid[]) to authenticated;
