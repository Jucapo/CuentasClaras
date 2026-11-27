-- F1e2 · Resumen, Mis finanzas y Transacciones: totales por día y por categoría, desgloses por
-- etiqueta, cuenta y persona (alcance Espacio), patrimonio, totales por día de lo filtrado y saldo
-- a una fecha. Spec §6, §7 y §8.
-- Cada movimiento se convierte a la moneda principal por separado, para que cualquier reparto (por
-- día, categoría, cuenta o persona) sume exactamente lo mismo: category_totals y
-- transaction_totals se reemplazan con esa regla, con las mismas columnas (create or replace
-- conserva los grants). No borra ni renombra nada y no transforma datos.

create type public.report_dimension as enum ('tag', 'account', 'member');

-- ── Movimientos del alcance Espacio ───────────────────────────────────────────
-- Confirmados, de gasto o ingreso, de cuentas compartidas o incluidos en el espacio, entre dos
-- fechas (null = sin límite), con su monto en la moneda principal y la tasa de su fecha (null sin
-- tasa). Security invoker: las cuentas privadas de otros no se ven, así que solo entran sus
-- movimientos incluidos; quien no es miembro no ve space_settings y no recibe filas.
create function private.space_movements(target_space_id uuid, from_date date, to_date date)
returns table (
  id uuid,
  kind public.category_kind,
  date date,
  amount bigint,
  currency text,
  converted bigint,
  category_id uuid,
  top_category_id uuid,
  account_id uuid,
  account_visible boolean,
  created_by uuid
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    t.id,
    c.kind,
    t.date,
    t.amount,
    t.currency,
    private.convert_minor(t.amount, t.currency, s.main_currency, target_space_id, t.date),
    t.category_id,
    coalesce(c.parent_id, c.id),
    t.account_id,
    a.id is not null,
    t.created_by
  from public.transactions t
  join public.space_settings s on s.space_id = t.space_id
  join public.categories c on c.id = t.category_id
  -- Sin fila (cuenta privada de otro), el movimiento cuenta solo si está incluido.
  left join public.accounts a on a.id = t.account_id
  where t.space_id = target_space_id
    and t.status = 'confirmed'
    and t.type in ('expense', 'income')
    and (from_date is null or t.date >= from_date)
    and (to_date is null or t.date <= to_date)
    and (t.include_in_space or a.visibility = 'shared');
$$;
revoke all on function private.space_movements(uuid, date, date) from public, anon;
grant execute on function private.space_movements(uuid, date, date) to authenticated;

-- ── RPC: totales por categoría ────────────────────────────────────────────────
-- Igual que en la F1e (mismas columnas y presupuesto por subcategoría), salvo la conversión: cada
-- movimiento se convierte por separado (space_movements), así el total de una categoría es la
-- suma de daily_category_totals y de breakdown_totals.
create or replace function public.category_totals(
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
  movements as (
    select m.category_id, m.top_category_id as top_id, m.currency, m.converted
    from private.space_movements(target_space_id, from_date, to_date) m
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
  -- Cada monto en vigor, convertido, con la categoría principal a la que suma.
  budget_rows as (
    select
      bif.category_id,
      coalesce(c.parent_id, c.id) as top_id,
      bif.currency,
      private.convert_minor(
        bif.amount, bif.currency, st.main_currency, target_space_id, coalesce(to_date, bif.month)
      ) as converted
    from budgets_in_force bif
    join public.categories c on c.id = bif.category_id
    cross join settings st
    where bif.amount > 0
  ),
  -- El propio: el "General" de una categoría o el de una subcategoría.
  budget_own as (
    select
      br.category_id,
      sum(br.converted) as amount,
      array_agg(distinct br.currency) filter (where br.converted is null) as missing
    from budget_rows br
    group by br.category_id
  ),
  -- El de una categoría: su General más los de sus subcategorías.
  budget_rolled as (
    select
      br.top_id,
      sum(br.converted) as amount,
      array_agg(distinct br.currency) filter (where br.converted is null) as missing
    from budget_rows br
    group by br.top_id
  )
  select
    c.id,
    c.parent_id,
    c.kind,
    coalesce(case when c.parent_id is null then r.amount else o.amount end, 0)::bigint,
    (case when c.parent_id is null then bro.amount else bow.amount end)::bigint,
    (
      case
        when c.parent_id is null then bro.amount - coalesce(r.amount, 0)
        else bow.amount - coalesce(o.amount, 0)
      end
    )::bigint,
    array(
      select distinct missing.currency
      from unnest(
        coalesce(case when c.parent_id is null then r.missing else o.missing end, '{}')
        || coalesce(case when c.parent_id is null then bro.missing else bow.missing end, '{}')
      ) as missing (currency)
      order by missing.currency
    )
  from public.categories c
  left join own o on o.category_id = c.id
  left join rolled r on r.top_id = c.id and c.parent_id is null
  left join budget_own bow on bow.category_id = c.id
  left join budget_rolled bro on bro.top_id = c.id and c.parent_id is null
  where c.space_id = target_space_id;
$$;

-- ── RPC: totales por día y categoría ──────────────────────────────────────────
-- Para las barras apiladas del Resumen: por día y categoría principal (suma sus subcategorías), en
-- la moneda principal. Lo que no tiene tasa no suma y su moneda sale aparte.
create function public.daily_category_totals(target_space_id uuid, from_date date, to_date date)
returns table (
  date date,
  category_id uuid,
  kind public.category_kind,
  amount bigint,
  missing_rate_currencies text[]
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    m.date,
    m.top_category_id,
    m.kind,
    coalesce(sum(m.converted), 0)::bigint,
    coalesce(
      array_agg(distinct m.currency order by m.currency) filter (where m.converted is null),
      '{}'
    )
  from private.space_movements(target_space_id, from_date, to_date) m
  group by m.date, m.top_category_id, m.kind
  order by m.date, m.top_category_id;
$$;
revoke all on function public.daily_category_totals(uuid, date, date) from public, anon;
grant execute on function public.daily_category_totals(uuid, date, date) to authenticated;

-- ── RPC: desglose por etiqueta, cuenta o persona ──────────────────────────────
-- Por etiqueta, un movimiento con varias cuenta en cada una y sin etiquetas va con key null. Por
-- cuenta, las privadas de otros (sus movimientos incluidos) van juntas con key null. Por persona,
-- key es quien lo registró. En la moneda principal, como el resto del Resumen.
create function public.breakdown_totals(
  target_space_id uuid,
  from_date date,
  to_date date,
  dimension public.report_dimension
)
returns table (
  key uuid,
  kind public.category_kind,
  amount bigint,
  movements integer,
  missing_rate_currencies text[]
)
language sql
stable
security invoker
set search_path = ''
as $$
  with keyed as (
    select
      case dimension
        when 'account' then case when m.account_visible then m.account_id end
        when 'member' then m.created_by
        else tt.tag_id
      end as key,
      m.kind,
      m.currency,
      m.converted
    from private.space_movements(target_space_id, from_date, to_date) m
    left join public.transaction_tags tt on dimension = 'tag' and tt.transaction_id = m.id
  )
  select
    k.key,
    k.kind,
    coalesce(sum(k.converted), 0)::bigint,
    count(*)::integer,
    coalesce(
      array_agg(distinct k.currency order by k.currency) filter (where k.converted is null),
      '{}'
    )
  from keyed k
  group by k.key, k.kind;
$$;
revoke all on function public.breakdown_totals(uuid, date, date, public.report_dimension)
  from public, anon;
grant execute on function public.breakdown_totals(uuid, date, date, public.report_dimension)
  to authenticated;

-- ── RPC: patrimonio ───────────────────────────────────────────────────────────
-- "Mis finanzas" (§6): saldo por grupo y moneda de las cuentas activas que quien llama ve, sin los
-- bienes (F2), convertido a la moneda principal con la tasa de on_date (null si falta). Las deudas
-- vienen con su signo guardado (negativo). Security invoker: account_balances y accounts siguen la
-- RLS, así que las privadas de otros no entran.
create function public.net_worth(target_space_id uuid, on_date date)
returns table (
  account_group public.account_group,
  currency text,
  balance bigint,
  converted bigint,
  main_currency text
)
language sql
stable
security invoker
set search_path = ''
as $$
  with settings as (
    select s.main_currency from public.space_settings s where s.space_id = target_space_id
  ),
  balances as (
    select a.account_group, b.currency, sum(b.balance)::bigint as balance
    from public.account_balances b
    join public.accounts a on a.id = b.account_id
    where b.space_id = target_space_id
      and a.archived_at is null
      and a.account_group <> 'assets'
    group by a.account_group, b.currency
  )
  select
    bl.account_group,
    bl.currency,
    bl.balance,
    private.convert_minor(bl.balance, bl.currency, st.main_currency, target_space_id, on_date),
    st.main_currency
  from balances bl
  cross join settings st
  order by bl.account_group, bl.currency;
$$;
revoke all on function public.net_worth(uuid, date) from public, anon;
grant execute on function public.net_worth(uuid, date) to authenticated;

-- ── Lo que suma en Transacciones ──────────────────────────────────────────────
-- Lo que devuelve search_transactions con los mismos argumentos, de gasto o ingreso (sin filtro de
-- estado, solo lo confirmado), con su monto convertido por movimiento y si viene de una cuenta
-- fuera del espacio (lo que category_totals deja fuera). La cuenta privada de otro no se ve (sin
-- fila), pero de ella solo se ve lo incluido.
create function private.filtered_amounts(
  target_space_id uuid,
  from_date date default null,
  to_date date default null,
  search_terms text[] default null,
  search_amount bigint default null,
  filter_account_ids uuid[] default null,
  filter_category_ids uuid[] default null,
  filter_tag_ids uuid[] default null,
  filter_types public.transaction_type[] default null,
  filter_author_ids uuid[] default null,
  filter_statuses public.transaction_status[] default null
)
returns table (
  date date,
  type public.transaction_type,
  outside boolean,
  currency text,
  converted bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    t.date,
    t.type,
    not coalesce(t.include_in_space or a.visibility = 'shared', false),
    t.currency,
    private.convert_minor(t.amount, t.currency, s.main_currency, target_space_id, t.date)
  from public.search_transactions(
    target_space_id, from_date, to_date, search_terms, search_amount, filter_account_ids,
    filter_category_ids, filter_tag_ids, filter_types, filter_author_ids, filter_statuses
  ) t
  join public.space_settings s on s.space_id = target_space_id
  left join public.accounts a on a.id = t.account_id
  where t.type in ('expense', 'income')
    and (coalesce(cardinality(filter_statuses), 0) > 0 or t.status = 'confirmed');
$$;
revoke all on function private.filtered_amounts(
  uuid, date, date, text[], bigint, uuid[], uuid[], uuid[], public.transaction_type[], uuid[],
  public.transaction_status[]
) from public, anon;
grant execute on function private.filtered_amounts(
  uuid, date, date, text[], bigint, uuid[], uuid[], uuid[], public.transaction_type[], uuid[],
  public.transaction_status[]
) to authenticated;

-- ── RPC: totales de lo filtrado ───────────────────────────────────────────────
-- Igual que en la F1e (mismas columnas y reglas), salvo la conversión: cada movimiento se
-- convierte por separado (filtered_amounts), así su total es la suma de transaction_day_totals.
-- Sin fila para quien no es miembro.
create or replace function public.transaction_totals(
  target_space_id uuid,
  from_date date default null,
  to_date date default null,
  search_terms text[] default null,
  search_amount bigint default null,
  filter_account_ids uuid[] default null,
  filter_category_ids uuid[] default null,
  filter_tag_ids uuid[] default null,
  filter_types public.transaction_type[] default null,
  filter_author_ids uuid[] default null,
  filter_statuses public.transaction_status[] default null
)
returns table (
  income bigint,
  expense bigint,
  net bigint,
  outside_space_income bigint,
  outside_space_expense bigint,
  currency text,
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
  sums as (
    select
      coalesce(sum(f.converted) filter (where f.type = 'income'), 0) as income,
      coalesce(sum(f.converted) filter (where f.type = 'expense'), 0) as expense,
      coalesce(sum(f.converted) filter (where f.type = 'income' and f.outside), 0)
        as outside_income,
      coalesce(sum(f.converted) filter (where f.type = 'expense' and f.outside), 0)
        as outside_expense,
      coalesce(
        array_agg(distinct f.currency order by f.currency) filter (where f.converted is null),
        '{}'
      ) as missing
    from private.filtered_amounts(
      target_space_id, from_date, to_date, search_terms, search_amount, filter_account_ids,
      filter_category_ids, filter_tag_ids, filter_types, filter_author_ids, filter_statuses
    ) f
  )
  select
    s.income::bigint,
    s.expense::bigint,
    (s.income - s.expense)::bigint,
    s.outside_income::bigint,
    s.outside_expense::bigint,
    st.main_currency,
    s.missing
  from sums s
  cross join settings st;
$$;

-- ── RPC: totales por día de lo filtrado ───────────────────────────────────────
-- Para el encabezado de cada día en Transacciones (§7): ingresos, gastos y neto por día, con las
-- reglas de transaction_totals. No depende de cuánto de la lista se haya cargado.
create function public.transaction_day_totals(
  target_space_id uuid,
  from_date date default null,
  to_date date default null,
  search_terms text[] default null,
  search_amount bigint default null,
  filter_account_ids uuid[] default null,
  filter_category_ids uuid[] default null,
  filter_tag_ids uuid[] default null,
  filter_types public.transaction_type[] default null,
  filter_author_ids uuid[] default null,
  filter_statuses public.transaction_status[] default null
)
returns table (
  date date,
  income bigint,
  expense bigint,
  net bigint,
  missing_rate_currencies text[]
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    f.date,
    coalesce(sum(f.converted) filter (where f.type = 'income'), 0)::bigint,
    coalesce(sum(f.converted) filter (where f.type = 'expense'), 0)::bigint,
    (
      coalesce(sum(f.converted) filter (where f.type = 'income'), 0)
      - coalesce(sum(f.converted) filter (where f.type = 'expense'), 0)
    )::bigint,
    coalesce(
      array_agg(distinct f.currency order by f.currency) filter (where f.converted is null),
      '{}'
    )
  from private.filtered_amounts(
    target_space_id, from_date, to_date, search_terms, search_amount, filter_account_ids,
    filter_category_ids, filter_tag_ids, filter_types, filter_author_ids, filter_statuses
  ) f
  group by f.date
  order by f.date desc;
$$;
revoke all on function public.transaction_day_totals(
  uuid, date, date, text[], bigint, uuid[], uuid[], uuid[], public.transaction_type[], uuid[],
  public.transaction_status[]
) from public, anon;
grant execute on function public.transaction_day_totals(
  uuid, date, date, text[], bigint, uuid[], uuid[], uuid[], public.transaction_type[], uuid[],
  public.transaction_status[]
) to authenticated;

-- ── RPC: saldo a una fecha ────────────────────────────────────────────────────
-- Saldo al cierre de on_date de las cuentas del total del encabezado (account_ids vacío: incluidas
-- en el total y activas) o de las elegidas, en la moneda principal con la tasa de on_date (§4.6).
-- Desde la fecha del saldo inicial suma lo confirmado hasta on_date; antes de esa fecha descuenta
-- lo que el saldo inicial ya traía (§4.1). Una fila, como accounts_total (currency null para quien
-- no es miembro). Security invoker: solo entran las cuentas que quien llama ve.
create function public.accounts_balance(
  target_space_id uuid,
  on_date date,
  account_ids uuid[] default null
)
returns table (balance bigint, currency text, missing_rate_currencies text[])
language sql
stable
security invoker
set search_path = ''
as $$
  with settings as (
    select s.main_currency from public.space_settings s where s.space_id = target_space_id
  ),
  chosen as (
    select a.id, a.currency, a.initial_balance, a.initial_balance_date
    from public.accounts a
    where a.space_id = target_space_id
      and case
        when coalesce(cardinality(account_ids), 0) = 0
          then a.include_in_total and a.archived_at is null
        else a.id = any (account_ids)
      end
  ),
  -- Igual que la vista account_balances.
  movements as (
    select
      t.account_id,
      t.date,
      case
        when t.type = 'income' or t.adjustment_direction = 'increase' then t.amount
        else -t.amount
      end as delta
    from public.transactions t
    where t.space_id = target_space_id and t.status = 'confirmed'
    union all
    select t.to_account_id, t.date, coalesce(t.to_amount, t.amount)
    from public.transactions t
    where t.space_id = target_space_id and t.type = 'transfer' and t.status = 'confirmed'
  ),
  balances as (
    select
      ch.currency,
      (
        ch.initial_balance
        + coalesce(
          sum(m.delta) filter (where m.date >= ch.initial_balance_date and m.date <= on_date), 0
        )
        - coalesce(
          sum(m.delta) filter (where m.date > on_date and m.date < ch.initial_balance_date), 0
        )
      )::bigint as balance
    from chosen ch
    left join movements m on m.account_id = ch.id
    group by ch.id, ch.currency, ch.initial_balance, ch.initial_balance_date
  ),
  converted as (
    select
      b.currency,
      private.convert_minor(b.balance, b.currency, st.main_currency, target_space_id, on_date)
        as converted
    from balances b
    cross join settings st
  )
  select
    coalesce(sum(cv.converted), 0)::bigint,
    (select st.main_currency from settings st),
    coalesce(
      array_agg(distinct cv.currency order by cv.currency) filter (where cv.converted is null),
      '{}'
    )
  from converted cv;
$$;
revoke all on function public.accounts_balance(uuid, date, uuid[]) from public, anon;
grant execute on function public.accounts_balance(uuid, date, uuid[]) to authenticated;
