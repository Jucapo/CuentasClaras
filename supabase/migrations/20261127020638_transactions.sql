-- F1d · Movimientos: gastos, ingresos, transferencias y ajustes, con etiquetas, diferidos de tarjeta,
-- tasas de cambio manuales, saldos y totales por categoría. Spec §4.1, §4.2, §4.5, §4.6, §5.1 c y §8.

-- ── Tipos ─────────────────────────────────────────────────────────────────────
create type public.transaction_type as enum ('expense', 'income', 'transfer', 'adjustment');
-- El monto siempre es positivo: la dirección la da el tipo y, en los ajustes, esta columna.
create type public.adjustment_direction as enum ('increase', 'decrease');
create type public.transaction_source as enum ('manual', 'recurring', 'email', 'shortcut', 'import');
create type public.transaction_status as enum ('confirmed', 'pending');
create type public.installment_plan_kind as enum ('loan_schedule', 'debt_plan', 'card_deferral');
create type public.exchange_rate_source as enum ('manual', 'trm');

-- ── Movimientos ───────────────────────────────────────────────────────────────
create table public.transactions (
  -- Lo genera el cliente al abrir el registro: un reintento con el mismo id no duplica.
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  type public.transaction_type not null,
  -- Fecha local que manda el cliente (§11).
  date date not null,
  -- Unidades menores, siempre positivo (§4.2).
  amount bigint not null check (amount > 0),
  -- La de la cuenta; la pone private.prepare_transaction().
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  account_id uuid not null,
  -- Transferencias: la cuenta destino y, si su moneda es otra, lo que llegó en esa moneda.
  to_account_id uuid,
  to_amount bigint check (to_amount > 0),
  category_id uuid,
  adjustment_direction public.adjustment_direction,
  note text check (note = btrim(note) and char_length(note) between 1 and 500),
  -- Sin default estático: lo pone private.prepare_transaction() según la cuenta (§3.2).
  include_in_space boolean not null,
  operation_id uuid,
  financing_plan_id uuid,
  source public.transaction_source not null default 'manual',
  status public.transaction_status not null default 'confirmed',
  external_id text check (char_length(external_id) between 1 and 200),
  created_by uuid default auth.uid() references public.profiles (user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (space_id, id),
  -- restrict (F1b): una cuenta o categoría con movimientos se archiva, no se borra.
  foreign key (space_id, account_id) references public.accounts (space_id, id) on delete restrict,
  foreign key (space_id, to_account_id) references public.accounts (space_id, id) on delete restrict,
  foreign key (space_id, category_id) references public.categories (space_id, id) on delete restrict,
  constraint transactions_transfer_check check (
    case when type = 'transfer'
      then to_account_id is not null and to_account_id <> account_id and category_id is null
      else to_account_id is null and to_amount is null
    end
  ),
  constraint transactions_adjustment_check check (
    (type = 'adjustment') = (adjustment_direction is not null)
    and (type <> 'adjustment' or category_id is null)
  ),
  -- Gasto e ingreso llevan categoría, salvo los pendientes que lleguen sin ella (F3).
  constraint transactions_category_check check (
    type not in ('expense', 'income') or category_id is not null or status = 'pending'
  ),
  constraint transactions_include_in_space_check check (
    not include_in_space or type in ('expense', 'income')
  )
);
create index transactions_space_date_idx on public.transactions (space_id, date desc);
create index transactions_account_date_idx on public.transactions (account_id, date desc);
create index transactions_to_account_date_idx on public.transactions (to_account_id, date desc)
  where to_account_id is not null;
create index transactions_category_idx on public.transactions (space_id, category_id)
  where category_id is not null;
create index transactions_operation_idx on public.transactions (operation_id)
  where operation_id is not null;
create index transactions_financing_plan_idx on public.transactions (financing_plan_id)
  where financing_plan_id is not null;
create index transactions_created_by_idx on public.transactions (created_by);
create unique index transactions_external_id_key on public.transactions (space_id, source, external_id)
  where external_id is not null;

-- space_id es redundante a propósito, como en category_default_tags.
create table public.transaction_tags (
  space_id uuid not null,
  transaction_id uuid not null,
  tag_id uuid not null,
  primary key (transaction_id, tag_id),
  foreign key (space_id, transaction_id) references public.transactions (space_id, id)
    on delete cascade,
  foreign key (space_id, tag_id) references public.tags (space_id, id) on delete cascade
);
create index transaction_tags_tag_idx on public.transaction_tags (space_id, tag_id);

-- ── Planes de cuotas ──────────────────────────────────────────────────────────
-- F1d solo guarda los diferidos de tarjeta (cuotas y tasa); la tabla de cuotas llega en la F2.
create table public.installment_plans (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  account_id uuid not null,
  kind public.installment_plan_kind not null,
  -- Diferido de tarjeta: la compra, y se borra con ella.
  source_transaction_id uuid unique,
  installments integer not null check (installments between 1 and 360),
  -- Mensual, como fracción (0.0189 = 1,89 % MV); 0 = sin interés.
  rate numeric(9, 6) not null default 0 check (rate >= 0 and rate < 1),
  start_date date not null,
  created_at timestamptz not null default now(),
  unique (space_id, id),
  foreign key (space_id, account_id) references public.accounts (space_id, id) on delete cascade,
  foreign key (space_id, source_transaction_id) references public.transactions (space_id, id)
    on delete cascade,
  constraint installment_plans_card_deferral_check check (
    kind <> 'card_deferral' or (source_transaction_id is not null and installments > 1)
  )
);
create index installment_plans_account_idx on public.installment_plans (space_id, account_id);

-- Compras financiadas con un préstamo (F2).
alter table public.transactions
  add constraint transactions_financing_plan_fkey
  foreign key (space_id, financing_plan_id) references public.installment_plans (space_id, id)
  on delete set null (financing_plan_id);

-- ── Tasas de cambio ───────────────────────────────────────────────────────────
create table public.exchange_rates (
  id uuid primary key default gen_random_uuid(),
  -- Las manuales son del espacio; null queda para la TRM automática común a todos (F2).
  space_id uuid references public.spaces (id) on delete cascade,
  date date not null,
  base text not null check (base ~ '^[A-Z]{3}$'),
  quote text not null check (quote ~ '^[A-Z]{3}$'),
  -- 1 unidad de base = rate unidades de quote.
  rate numeric(20, 10) not null check (rate > 0),
  source public.exchange_rate_source not null default 'manual',
  created_at timestamptz not null default now(),
  check (base <> quote),
  check ((source = 'manual') = (space_id is not null))
);
-- Una por par y día en cualquier sentido: (USD, COP) y (COP, USD) del mismo día chocan.
create unique index exchange_rates_key
  on public.exchange_rates (space_id, least(base, quote), greatest(base, quote), date)
  nulls not distinct;

-- ── Helpers ───────────────────────────────────────────────────────────────────
-- Escribe en una cuenta quien puede editarla: editor del espacio y, si es privada, su dueño (§8).
create function private.can_write_account(target_account_id uuid)
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
      and private.is_space_editor(a.space_id)
      and (a.visibility = 'shared' or a.owner_id = (select auth.uid()))
  );
$$;

-- Exponente ISO 4217 de las unidades menores; refleja domain/money/currencies.ts.
create function private.currency_exponent(currency text)
returns integer
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case currency when 'COP' then 2 when 'USD' then 2 when 'EUR' then 2 else 2 end;
$$;

-- Tasa de una moneda a otra en una fecha: la más reciente con fecha menor o igual; sin ninguna
-- anterior, la más antigua. Vale en los dos sentidos del par; la manual del espacio gana a la
-- automática del mismo día. Null si no hay tasa.
create function private.exchange_rate(
  target_space_id uuid,
  from_currency text,
  to_currency text,
  on_date date
)
returns numeric
language sql
stable
set search_path = ''
as $$
  select case
    when from_currency = to_currency then 1::numeric
    else (
      select case when r.base = from_currency then r.rate else 1 / r.rate end
      from public.exchange_rates r
      where (r.space_id = target_space_id or r.space_id is null)
        and (
          (r.base = from_currency and r.quote = to_currency)
          or (r.base = to_currency and r.quote = from_currency)
        )
      order by
        r.date <= on_date desc,
        case when r.date <= on_date then r.date end desc,
        r.date,
        r.space_id is null
      limit 1
    )
  end;
$$;

-- Unidades menores de una moneda en otra; null si falta la tasa. round() se aleja de cero.
create function private.convert_minor(
  amount bigint,
  from_currency text,
  to_currency text,
  target_space_id uuid,
  on_date date
)
returns bigint
language sql
stable
set search_path = ''
as $$
  select round(
    amount
    * private.exchange_rate(target_space_id, from_currency, to_currency, on_date)
    * power(
      10::numeric,
      private.currency_exponent(to_currency) - private.currency_exponent(from_currency)
    )
  )::bigint;
$$;

revoke all on function
  private.can_write_account(uuid),
  private.currency_exponent(text),
  private.exchange_rate(uuid, text, text, date),
  private.convert_minor(bigint, text, text, uuid, date)
from public, anon;
grant execute on function
  private.can_write_account(uuid),
  private.currency_exponent(text),
  private.exchange_rate(uuid, text, text, date),
  private.convert_minor(bigint, text, text, uuid, date)
to authenticated;

-- ── Triggers ──────────────────────────────────────────────────────────────────
-- Completa y valida lo que depende de otras filas: la moneda sale de la cuenta, incluir en el
-- espacio solo aplica a gastos e ingresos de cuentas privadas (por defecto lo que diga la cuenta),
-- la categoría es de la clase del movimiento y la transferencia entre monedas lleva el monto
-- destino. Security invoker: una cuenta que quien escribe no ve da el mismo error que una que no
-- existe, para no revelar nada.
create function private.prepare_transaction()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  source_account record;
  target_currency text;
  category_kind public.category_kind;
begin
  select a.currency, a.visibility, a.include_in_space_by_default into source_account
  from public.accounts a
  where a.id = new.account_id;
  if not found then
    raise exception 'the account is not available' using errcode = '42501';
  end if;
  new.currency := source_account.currency;
  if source_account.visibility = 'shared' or new.type not in ('expense', 'income') then
    new.include_in_space := false;
  elsif new.include_in_space is null then
    new.include_in_space := source_account.include_in_space_by_default;
  end if;

  if new.type = 'transfer' and new.to_account_id is not null then
    select a.currency into target_currency
    from public.accounts a
    where a.id = new.to_account_id;
    if not found then
      raise exception 'the destination account is not available' using errcode = '42501';
    end if;
    if target_currency <> new.currency and new.to_amount is null then
      raise exception 'a transfer between currencies needs the amount that arrived'
        using errcode = '23514';
    end if;
    if target_currency = new.currency and new.to_amount is not null then
      raise exception 'a transfer within one currency has a single amount' using errcode = '23514';
    end if;
  end if;

  if new.category_id is not null then
    select c.kind into category_kind
    from public.categories c
    where c.id = new.category_id;
    if found and category_kind::text <> new.type::text then
      raise exception 'the category must be of the kind of the transaction' using errcode = '23514';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  return new;
end;
$$;
revoke all on function private.prepare_transaction() from public, anon, authenticated;

create trigger transactions_prepare
  before insert or update on public.transactions
  for each row execute function private.prepare_transaction();

-- Tipo y moneda de una cuenta con movimientos no cambian (§4.1).
create function private.lock_account_with_transactions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.kind <> old.kind or new.currency <> old.currency)
     and exists (
       select 1
       from public.transactions t
       where t.account_id = old.id or t.to_account_id = old.id
     ) then
    raise exception 'an account with transactions keeps its kind and currency'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.lock_account_with_transactions() from public, anon, authenticated;

create trigger accounts_lock_with_transactions
  before update of kind, currency on public.accounts
  for each row execute function private.lock_account_with_transactions();

-- Un diferido de tarjeta es de un gasto hecho con esa tarjeta (§5.1 c).
create function private.check_installment_plan()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.kind = 'card_deferral' and not exists (
    select 1
    from public.transactions t
    join public.accounts a on a.id = t.account_id
    where t.id = new.source_transaction_id
      and t.type = 'expense'
      and t.account_id = new.account_id
      and a.kind = 'credit_card'
  ) then
    raise exception 'a card deferral belongs to an expense paid with that credit card'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.check_installment_plan() from public, anon, authenticated;

create trigger installment_plans_check
  before insert or update on public.installment_plans
  for each row execute function private.check_installment_plan();

-- El diferido sigue a su compra si cambia de cuenta o de fecha, y se borra si deja de ser un gasto
-- con tarjeta.
create function private.sync_card_deferral()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.type = 'expense' and exists (
    select 1 from public.accounts a where a.id = new.account_id and a.kind = 'credit_card'
  ) then
    update public.installment_plans p
    set account_id = new.account_id, start_date = new.date
    where p.source_transaction_id = new.id
      and p.kind = 'card_deferral'
      and (p.account_id <> new.account_id or p.start_date <> new.date);
  else
    delete from public.installment_plans p
    where p.source_transaction_id = new.id and p.kind = 'card_deferral';
  end if;
  return null;
end;
$$;
revoke all on function private.sync_card_deferral() from public, anon, authenticated;

create trigger transactions_sync_card_deferral
  after update of type, account_id, date on public.transactions
  for each row execute function private.sync_card_deferral();

-- Borrar un espacio (F1f) borra primero sus movimientos: así las FKs restrict hacia cuentas y
-- categorías no frenan la cascada.
create function private.delete_space_transactions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.transactions where space_id = old.id;
  return old;
end;
$$;
revoke all on function private.delete_space_transactions() from public, anon, authenticated;

create trigger spaces_delete_transactions_first
  before delete on public.spaces
  for each row execute function private.delete_space_transactions();

-- ── Privilegios de tablas ─────────────────────────────────────────────────────
revoke all on table
  public.transactions, public.transaction_tags, public.installment_plans, public.exchange_rates
from anon, authenticated, service_role;

grant select, insert, update, delete on table
  public.transactions, public.transaction_tags, public.installment_plans, public.exchange_rates
to service_role;

grant select, delete on table
  public.transactions, public.transaction_tags, public.installment_plans, public.exchange_rates
to authenticated;

-- El id lo genera el cliente (guardado idempotente). La moneda sale de la cuenta y el autor es quien
-- llama. Origen, estado, id externo, operación y financiación los escriben la automatización (F3) y
-- las deudas (F2).
grant insert (
  id, space_id, type, date, amount, account_id, to_account_id, to_amount, category_id,
  adjustment_direction, note, include_in_space
) on public.transactions to authenticated;
grant update (
  type, date, amount, account_id, to_account_id, to_amount, category_id,
  adjustment_direction, note, include_in_space
) on public.transactions to authenticated;

grant insert (space_id, transaction_id, tag_id) on public.transaction_tags to authenticated;

grant insert (space_id, account_id, kind, source_transaction_id, installments, rate, start_date)
  on public.installment_plans to authenticated;
grant update (account_id, installments, rate, start_date)
  on public.installment_plans to authenticated;

-- Las manuales: el origen lo pone el default. No se editan; save_exchange_rate las reemplaza.
grant insert (space_id, date, base, quote, rate) on public.exchange_rates to authenticated;

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table public.transactions enable row level security;
alter table public.transaction_tags enable row level security;
alter table public.installment_plans enable row level security;
alter table public.exchange_rates enable row level security;

-- Visible si se ve la cuenta o la cuenta destino, o si está incluido en el espacio (§3.2, §8).
create policy transactions_select on public.transactions
  for select to authenticated
  using (
    (include_in_space and private.is_space_member(space_id))
    or private.can_see_account(account_id)
    or private.can_see_account(to_account_id)
  );

-- Escribe quien puede escribir en la cuenta de origen; la cuenta destino tiene que verla.
create policy transactions_insert on public.transactions
  for insert to authenticated
  with check (
    private.can_write_account(account_id)
    and (to_account_id is null or private.can_see_account(to_account_id))
  );

create policy transactions_update on public.transactions
  for update to authenticated
  using (private.can_write_account(account_id))
  with check (
    private.can_write_account(account_id)
    and (to_account_id is null or private.can_see_account(to_account_id))
  );

-- Igual que editar: borrar una transferencia no puede cambiar el saldo de una cuenta que no se ve.
create policy transactions_delete on public.transactions
  for delete to authenticated
  using (
    private.can_write_account(account_id)
    and (to_account_id is null or private.can_see_account(to_account_id))
  );

-- Las etiquetas siguen al movimiento: se ven si se ve, y se cambian si se puede escribir en su cuenta.
create policy transaction_tags_select on public.transaction_tags
  for select to authenticated
  using (exists (select 1 from public.transactions t where t.id = transaction_id));

create policy transaction_tags_insert on public.transaction_tags
  for insert to authenticated
  with check (exists (
    select 1
    from public.transactions t
    where t.id = transaction_id and private.can_write_account(t.account_id)
  ));

create policy transaction_tags_delete on public.transaction_tags
  for delete to authenticated
  using (exists (
    select 1
    from public.transactions t
    where t.id = transaction_id and private.can_write_account(t.account_id)
  ));

-- Un diferido se ve con su cuenta o con su compra (incluida en el espacio); se escribe con la cuenta.
create policy installment_plans_select on public.installment_plans
  for select to authenticated
  using (
    private.can_see_account(account_id)
    or exists (select 1 from public.transactions t where t.id = source_transaction_id)
  );

create policy installment_plans_insert on public.installment_plans
  for insert to authenticated
  with check (private.can_write_account(account_id));

create policy installment_plans_update on public.installment_plans
  for update to authenticated
  using (private.can_write_account(account_id))
  with check (private.can_write_account(account_id));

create policy installment_plans_delete on public.installment_plans
  for delete to authenticated
  using (private.can_write_account(account_id));

create policy exchange_rates_select on public.exchange_rates
  for select to authenticated
  using (space_id is null or private.is_space_member(space_id));

create policy exchange_rates_insert on public.exchange_rates
  for insert to authenticated
  with check (private.is_space_editor(space_id));

create policy exchange_rates_delete on public.exchange_rates
  for delete to authenticated
  using (private.is_space_editor(space_id));

-- ── Saldos ────────────────────────────────────────────────────────────────────
-- Mismas columnas que en la F1b. Cuentan los movimientos confirmados desde la fecha del saldo
-- inicial (los anteriores ya están en él): gasto y transferencia saliente restan; ingreso y
-- transferencia entrante suman (lo que llegó, en la moneda de destino); el ajuste suma o resta
-- según su dirección (§4.1). space_id viaja en el join para que el filtro por espacio llegue a
-- transactions.
create or replace view public.account_balances with (security_invoker = true) as
with movements as (
  select
    t.space_id,
    t.account_id,
    t.date,
    case
      when t.type = 'income' or t.adjustment_direction = 'increase' then t.amount
      else -t.amount
    end as delta
  from public.transactions t
  where t.status = 'confirmed'
  union all
  select t.space_id, t.to_account_id, t.date, coalesce(t.to_amount, t.amount)
  from public.transactions t
  where t.type = 'transfer' and t.status = 'confirmed'
)
select
  a.id as account_id,
  a.space_id,
  a.currency,
  a.initial_balance,
  coalesce(sum(m.delta), 0)::bigint as movements_total,
  (a.initial_balance + coalesce(sum(m.delta), 0))::bigint as balance
from public.accounts a
left join movements m
  on m.space_id = a.space_id
  and m.account_id = a.id
  and m.date >= a.initial_balance_date
group by a.id;

-- ── RPC: guardar un movimiento ────────────────────────────────────────────────
-- Crea o edita un movimiento con sus etiquetas y, si es una compra con tarjeta a más de una cuota,
-- su diferido (§5.1 c), todo o nada. Idempotente: target_id lo genera el cliente al abrir el
-- registro; si ya existe y quien llama puede escribirlo, se actualiza, así que un reintento no
-- duplica. Security invoker: aplican la RLS y los triggers igual que en un insert.
create function public.save_transaction(
  target_id uuid,
  target_space_id uuid,
  entry_type public.transaction_type,
  entry_date date,
  entry_amount bigint,
  entry_account_id uuid,
  entry_category_id uuid default null,
  entry_to_account_id uuid default null,
  entry_to_amount bigint default null,
  entry_adjustment_direction public.adjustment_direction default null,
  entry_note text default null,
  entry_include_in_space boolean default null,
  entry_tag_ids uuid[] default '{}',
  entry_installments integer default 1,
  entry_monthly_rate numeric default 0
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved_id uuid;
begin
  update public.transactions t
  set type = entry_type,
      date = entry_date,
      amount = entry_amount,
      account_id = entry_account_id,
      category_id = entry_category_id,
      to_account_id = entry_to_account_id,
      to_amount = entry_to_amount,
      adjustment_direction = entry_adjustment_direction,
      note = nullif(btrim(entry_note), ''),
      -- Sin valor se conserva el guardado; el trigger lo fuerza a false si ya no aplica.
      include_in_space = coalesce(entry_include_in_space, t.include_in_space)
  where t.id = target_id and t.space_id = target_space_id
  returning t.id into saved_id;

  -- Sin fila, es nuevo. Un id que existe pero que quien llama no puede escribir choca con la llave.
  if saved_id is null then
    insert into public.transactions (
      id, space_id, type, date, amount, account_id, category_id, to_account_id, to_amount,
      adjustment_direction, note, include_in_space
    ) values (
      target_id, target_space_id, entry_type, entry_date, entry_amount, entry_account_id,
      entry_category_id, entry_to_account_id, entry_to_amount, entry_adjustment_direction,
      nullif(btrim(entry_note), ''), entry_include_in_space
    )
    returning id into saved_id;
  end if;

  delete from public.transaction_tags tt
  where tt.transaction_id = saved_id and tt.tag_id <> all (coalesce(entry_tag_ids, '{}'));
  insert into public.transaction_tags (space_id, transaction_id, tag_id)
  select target_space_id, saved_id, tag.id
  from unnest(coalesce(entry_tag_ids, '{}')) as tag (id)
  on conflict do nothing;

  if coalesce(entry_installments, 1) > 1 then
    insert into public.installment_plans (
      space_id, account_id, kind, source_transaction_id, installments, rate, start_date
    ) values (
      target_space_id, entry_account_id, 'card_deferral', saved_id, entry_installments,
      coalesce(entry_monthly_rate, 0), entry_date
    )
    on conflict (source_transaction_id) do update
    set account_id = excluded.account_id,
        installments = excluded.installments,
        rate = excluded.rate,
        start_date = excluded.start_date;
  else
    delete from public.installment_plans p
    where p.source_transaction_id = saved_id and p.kind = 'card_deferral';
  end if;

  return saved_id;
end;
$$;
revoke all on function public.save_transaction(
  uuid, uuid, public.transaction_type, date, bigint, uuid, uuid, uuid, bigint,
  public.adjustment_direction, text, boolean, uuid[], integer, numeric
) from public, anon;
grant execute on function public.save_transaction(
  uuid, uuid, public.transaction_type, date, bigint, uuid, uuid, uuid, bigint,
  public.adjustment_direction, text, boolean, uuid[], integer, numeric
) to authenticated;

-- ── RPC: totales por categoría ────────────────────────────────────────────────
-- Gastado o recibido por categoría entre dos fechas (null = sin límite), en la moneda principal,
-- con lo presupuestado y lo restante (§4.7, §7). Alcance Espacio: cuentas compartidas más lo
-- incluido de las privadas; solo confirmados. Cada categoría suma sus subcategorías; las
-- subcategorías traen solo lo suyo y sin presupuesto. budget_months son los meses (día 1) cuyos
-- presupuestos aplican: uno en Mes, doce en Año, ninguno en los demás periodos. Lo que no tiene
-- tasa no suma y su moneda sale en missing_rate_currencies. Security invoker: decide la RLS.
create function public.category_totals(
  target_space_id uuid,
  from_date date,
  to_date date,
  budget_months date[] default '{}'
)
returns table (
  category_id uuid,
  parent_id uuid,
  kind public.category_kind,
  amount bigint,
  budget bigint,
  remaining bigint,
  missing_rate_currencies text[]
)
language sql
stable
security invoker
set search_path = ''
as $$
  with settings as (
    select s.main_currency from public.space_settings s where s.space_id = target_space_id
  ),
  -- Se agrupa por categoría, moneda y día antes de convertir: una conversión por grupo.
  scoped as (
    select t.category_id, t.currency, t.date, sum(t.amount)::bigint as amount
    from public.transactions t
    -- Las cuentas privadas de otros no se ven: sin fila, el movimiento cuenta solo si está incluido.
    left join public.accounts a on a.id = t.account_id
    where t.space_id = target_space_id
      and t.status = 'confirmed'
      and t.type in ('expense', 'income')
      and (from_date is null or t.date >= from_date)
      and (to_date is null or t.date <= to_date)
      and (t.include_in_space or a.visibility = 'shared')
    group by t.category_id, t.currency, t.date
  ),
  movements as (
    select
      c.id as category_id,
      coalesce(c.parent_id, c.id) as top_id,
      s.currency,
      private.convert_minor(s.amount, s.currency, st.main_currency, target_space_id, s.date)
        as converted
    from scoped s
    join public.categories c on c.id = s.category_id
    cross join settings st
  ),
  own as (
    select
      m.category_id,
      sum(m.converted) as amount,
      array_agg(distinct m.currency) filter (where m.converted is null) as missing
    from movements m
    group by m.category_id
  ),
  rolled as (
    select
      m.top_id,
      sum(m.converted) as amount,
      array_agg(distinct m.currency) filter (where m.converted is null) as missing
    from movements m
    group by m.top_id
  ),
  budgets_in_force as (
    select distinct on (period.month, b.category_id)
      b.category_id, b.amount, b.currency, period.month
    from unnest(budget_months) as period (month)
    join public.budgets b on b.space_id = target_space_id and b.effective_from <= period.month
    order by period.month, b.category_id, b.effective_from desc
  ),
  budget_totals as (
    select
      bf.category_id,
      sum(bf.converted) as amount,
      array_agg(distinct bf.currency) filter (where bf.converted is null) as missing
    from (
      select
        bif.category_id,
        bif.currency,
        private.convert_minor(
          bif.amount, bif.currency, st.main_currency, target_space_id,
          coalesce(to_date, bif.month)
        ) as converted
      from budgets_in_force bif
      cross join settings st
      where bif.amount > 0
    ) bf
    group by bf.category_id
  )
  select
    c.id,
    c.parent_id,
    c.kind,
    coalesce(case when c.parent_id is null then r.amount else o.amount end, 0)::bigint,
    bt.amount::bigint,
    (bt.amount - coalesce(r.amount, 0))::bigint,
    array(
      select distinct missing.currency
      from unnest(
        coalesce(case when c.parent_id is null then r.missing else o.missing end, '{}')
        || coalesce(bt.missing, '{}')
      ) as missing (currency)
      order by missing.currency
    )
  from public.categories c
  left join own o on o.category_id = c.id
  left join rolled r on r.top_id = c.id and c.parent_id is null
  left join budget_totals bt on bt.category_id = c.id and c.parent_id is null
  where c.space_id = target_space_id;
$$;
revoke all on function public.category_totals(uuid, date, date, date[]) from public, anon;
grant execute on function public.category_totals(uuid, date, date, date[]) to authenticated;

-- ── RPC: total de las cuentas ─────────────────────────────────────────────────
-- Saldo de las cuentas activas con "incluir en el total" que quien llama ve, en la moneda principal
-- con la tasa de on_date (§4.6, §7). Las monedas sin tasa no suman y salen aparte.
create function public.accounts_total(target_space_id uuid, on_date date)
returns table (total bigint, currency text, missing_rate_currencies text[])
language sql
stable
security invoker
set search_path = ''
as $$
  with settings as (
    select s.main_currency from public.space_settings s where s.space_id = target_space_id
  ),
  balances as (
    select
      b.currency,
      private.convert_minor(b.balance, b.currency, st.main_currency, target_space_id, on_date)
        as converted
    from public.account_balances b
    join public.accounts a on a.id = b.account_id
    cross join settings st
    where b.space_id = target_space_id and a.include_in_total and a.archived_at is null
  )
  select
    coalesce(sum(bl.converted), 0)::bigint,
    (select st.main_currency from settings st),
    coalesce(
      array_agg(distinct bl.currency order by bl.currency) filter (where bl.converted is null),
      '{}'
    )
  from balances bl;
$$;
revoke all on function public.accounts_total(uuid, date) from public, anon;
grant execute on function public.accounts_total(uuid, date) to authenticated;

-- ── RPC: guardar una tasa ─────────────────────────────────────────────────────
-- Una tasa por par y día en cada espacio, en cualquiera de los dos sentidos: guardar reemplaza la
-- del mismo día (§4.6). Security invoker: la RLS decide quién puede.
create function public.save_exchange_rate(
  target_space_id uuid,
  rate_date date,
  base_currency text,
  quote_currency text,
  rate_value numeric
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from public.exchange_rates r
  where r.space_id = target_space_id
    and r.date = rate_date
    and least(r.base, r.quote) = least(base_currency, quote_currency)
    and greatest(r.base, r.quote) = greatest(base_currency, quote_currency);
  insert into public.exchange_rates (space_id, date, base, quote, rate)
  values (target_space_id, rate_date, base_currency, quote_currency, rate_value);
end;
$$;
revoke all on function public.save_exchange_rate(uuid, date, text, text, numeric)
  from public, anon;
grant execute on function public.save_exchange_rate(uuid, date, text, text, numeric)
  to authenticated;
