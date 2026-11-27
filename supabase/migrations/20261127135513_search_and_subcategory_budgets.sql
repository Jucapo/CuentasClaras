-- F1e · Transacciones: búsqueda y filtros de movimientos, y los totales de lo filtrado. Presupuesto
-- por subcategoría en los totales por categoría. Spec §4.7, §7 y §8.

-- ── Búsqueda sin tildes ───────────────────────────────────────────────────────
-- La forma de dos argumentos de unaccent no depende del search_path.
create extension if not exists unaccent with schema extensions;
grant execute on function extensions.unaccent(regdictionary, text) to authenticated;

-- Minúsculas y sin tildes, como normalizeSearchText (domain/text/search-text.ts).
create function private.search_text(value text)
returns text
language sql
stable
parallel safe
set search_path = ''
as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(value, '')));
$$;
revoke all on function private.search_text(text) from public, anon;
grant execute on function private.search_text(text) to authenticated;

-- ── RPC: buscar movimientos ───────────────────────────────────────────────────
-- Lo que quien llama ve (RLS) entre dos fechas (null = sin límite), con búsqueda y filtros (§7).
-- Un filtro null o vacío no filtra; dentro de un filtro basta un valor, y los filtros se combinan.
-- La categoría incluye sus subcategorías y la cuenta mira origen y destino. Cada término tiene que
-- aparecer en la nota, la categoría, su padre o una cuenta visible; search_amount (unidades menores,
-- exponente 2 como todas las monedas de currency_exponent) encuentra además ese monto exacto.
-- Devuelve filas de transactions para que PostgREST embeba etiquetas, autor y diferido, ordene y
-- pagine. Security invoker: decide la RLS.
create function public.search_transactions(
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
returns setof public.transactions
language sql
stable
security invoker
set search_path = ''
as $$
  select t.*
  from public.transactions t
  -- Sin fila (cuenta privada de otro), su nombre no entra en la búsqueda.
  left join public.accounts a on a.id = t.account_id
  left join public.accounts ta on ta.id = t.to_account_id
  left join public.categories c on c.id = t.category_id
  left join public.categories p on p.id = c.parent_id
  cross join lateral (
    select private.search_text(concat_ws(' ', t.note, c.name, p.name, a.name, ta.name)) as haystack
  ) h
  where t.space_id = target_space_id
    and (from_date is null or t.date >= from_date)
    and (to_date is null or t.date <= to_date)
    and (
      coalesce(cardinality(filter_account_ids), 0) = 0
      or t.account_id = any (filter_account_ids)
      or t.to_account_id = any (filter_account_ids)
    )
    and (
      coalesce(cardinality(filter_category_ids), 0) = 0
      or c.id = any (filter_category_ids)
      or c.parent_id = any (filter_category_ids)
    )
    and (
      coalesce(cardinality(filter_tag_ids), 0) = 0
      or exists (
        select 1
        from public.transaction_tags tt
        where tt.transaction_id = t.id and tt.tag_id = any (filter_tag_ids)
      )
    )
    and (coalesce(cardinality(filter_types), 0) = 0 or t.type = any (filter_types))
    and (coalesce(cardinality(filter_author_ids), 0) = 0 or t.created_by = any (filter_author_ids))
    and (coalesce(cardinality(filter_statuses), 0) = 0 or t.status = any (filter_statuses))
    and (
      coalesce(cardinality(search_terms), 0) = 0
      or (search_amount is not null and (t.amount = search_amount or t.to_amount = search_amount))
      or not exists (
        select 1
        from unnest(search_terms) as term (value)
        where strpos(h.haystack, private.search_text(term.value)) = 0
      )
    );
$$;
revoke all on function public.search_transactions(
  uuid, date, date, text[], bigint, uuid[], uuid[], uuid[], public.transaction_type[], uuid[],
  public.transaction_status[]
) from public, anon;
grant execute on function public.search_transactions(
  uuid, date, date, text[], bigint, uuid[], uuid[], uuid[], public.transaction_type[], uuid[],
  public.transaction_status[]
) to authenticated;

-- ── RPC: totales de lo filtrado ───────────────────────────────────────────────
-- Ingresos, gastos y neto de lo que devuelve search_transactions con los mismos argumentos, en la
-- moneda principal con la tasa de la fecha de cada movimiento (§4.6). Transferencias y ajustes no
-- suman. Sin filtro de estado solo suma lo confirmado, como category_totals: lo pendiente se lista
-- pero no suma. Lo que no tiene tasa no suma y su moneda sale aparte. Sin fila para quien no es
-- miembro.
-- Los movimientos de cuentas fuera del espacio (privadas propias, sin incluir) suman, como en la
-- lista; outside_space_income y outside_space_expense dicen cuánto de cada total son, en la misma
-- moneda. Sin ellos, los totales son los de category_totals (Inicio y Presupuesto).
create function public.transaction_totals(
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
  -- Una conversión por tipo, moneda, día y alcance, como en category_totals.
  grouped as (
    select
      t.type,
      t.currency,
      t.date,
      -- Lo que category_totals deja fuera. La cuenta privada de otro no se ve (sin fila), pero
      -- de ella solo se ve lo incluido.
      not coalesce(t.include_in_space or a.visibility = 'shared', false) as outside,
      sum(t.amount)::bigint as amount
    from public.search_transactions(
      target_space_id, from_date, to_date, search_terms, search_amount, filter_account_ids,
      filter_category_ids, filter_tag_ids, filter_types, filter_author_ids, filter_statuses
    ) t
    left join public.accounts a on a.id = t.account_id
    where t.type in ('expense', 'income')
      and (coalesce(cardinality(filter_statuses), 0) > 0 or t.status = 'confirmed')
    group by t.type, t.currency, t.date, outside
  ),
  converted as (
    select
      g.type,
      g.currency,
      g.outside,
      private.convert_minor(g.amount, g.currency, st.main_currency, target_space_id, g.date)
        as amount
    from grouped g
    cross join settings st
  ),
  sums as (
    select
      coalesce(sum(cv.amount) filter (where cv.type = 'income'), 0) as income,
      coalesce(sum(cv.amount) filter (where cv.type = 'expense'), 0) as expense,
      coalesce(sum(cv.amount) filter (where cv.type = 'income' and cv.outside), 0)
        as outside_income,
      coalesce(sum(cv.amount) filter (where cv.type = 'expense' and cv.outside), 0)
        as outside_expense,
      coalesce(
        array_agg(distinct cv.currency order by cv.currency) filter (where cv.amount is null),
        '{}'
      ) as missing
    from converted cv
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
revoke all on function public.transaction_totals(
  uuid, date, date, text[], bigint, uuid[], uuid[], uuid[], public.transaction_type[], uuid[],
  public.transaction_status[]
) from public, anon;
grant execute on function public.transaction_totals(
  uuid, date, date, text[], bigint, uuid[], uuid[], uuid[], public.transaction_type[], uuid[],
  public.transaction_status[]
) to authenticated;

-- ── RPC: totales por categoría, con presupuesto por subcategoría ──────────────
-- Igual que en la F1d (mismas columnas; create or replace conserva los grants), salvo el
-- presupuesto: cada subcategoría trae el suyo y su restante, y el de una categoría es su monto
-- propio (el "General", que cubre lo registrado directo en ella) más los de sus subcategorías
-- (§4.7). Lo que no tiene tasa no suma y su moneda sale en missing_rate_currencies de la fila y de
-- su categoría.
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
