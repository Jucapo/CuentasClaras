-- F1e · Transacciones: búsqueda y filtros de movimientos, y los totales de lo filtrado. Spec §7 y §8.

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
-- suman. Lo que no tiene tasa no suma y su moneda sale aparte. Sin fila para quien no es miembro.
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
  -- Una conversión por tipo, moneda y día, como en category_totals.
  grouped as (
    select t.type, t.currency, t.date, sum(t.amount)::bigint as amount
    from public.search_transactions(
      target_space_id, from_date, to_date, search_terms, search_amount, filter_account_ids,
      filter_category_ids, filter_tag_ids, filter_types, filter_author_ids, filter_statuses
    ) t
    where t.type in ('expense', 'income')
    group by t.type, t.currency, t.date
  ),
  converted as (
    select
      g.type,
      g.currency,
      private.convert_minor(g.amount, g.currency, st.main_currency, target_space_id, g.date)
        as amount
    from grouped g
    cross join settings st
  ),
  sums as (
    select
      coalesce(sum(cv.amount) filter (where cv.type = 'income'), 0) as income,
      coalesce(sum(cv.amount) filter (where cv.type = 'expense'), 0) as expense,
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
