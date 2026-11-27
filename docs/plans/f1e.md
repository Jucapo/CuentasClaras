# F1e · Reportes — plan

> Plan de toda la F1e, en dos partes con un PR cada una. Se guarda en `docs/plans/f1e.md` (primer commit de la parte 1). La parte 2 la ejecuta otra sesión leyendo este archivo: antes de empezar, lee `CLAUDE.md` y `docs/finanzas-spec.md` completos.

## Contexto

La F1e (§10) cierra la F1 con Presupuestos, Transacciones (lista, filtros, edición), Resumen y el resto de Configuración. Hoy Transacciones, Presupuesto y Resumen son pantallas vacías (solo `cc-page-header`).

Ya existe y se reutiliza:

- `category_totals` (gastado, presupuesto y restante por categoría, alcance Espacio, en la moneda principal) y `private.convert_minor`.
- `cc-transaction-list`, `cc-budget-list` + `cc-money-row`, `MonthlyAmounts` y `PendingSaves`, `QuickEntryFlow`, `cc-list-detail-layout`, `OverlayService` + `cc-option-panel`, `ToastService` y `ConfirmService`.
- El patrón de lista paginada del detalle de cuenta (`account-detail-page.ts`): de a 50 con "Ver más".

Resultado esperado: un PR por parte contra `main`, sin merge y sin tocar producción.

## Decisiones

Cerradas con el usuario:

- **Lista de Transacciones:** muestra todo lo que el usuario ve por RLS, incluidas sus cuentas privadas (como el detalle de cuenta). Los totales suman exactamente lo listado.
- **Candado:** los movimientos de cuentas privadas llevan un candado pequeño en la fila, para que se entienda por qué los totales pueden diferir de Categorías (que usa el alcance Espacio).
- **Edición en expandida:** tocar un movimiento abre el registro rápido **en línea en el panel de detalle**: el mismo organismo, con teclado, campos, Guardar y Eliminar.
  - Si hay cambios sin guardar y se toca otro movimiento, se cierra el panel (✕ o Esc) o se sale de la ruta, se pregunta "¿Descartar los cambios?", igual que en los flujos.
  - En compacta y mediana se abre como hoy: sheet o diálogo.

Propias (se pasan a la spec en la parte 1):

- **Búsqueda:**
  - Busca en la nota, la categoría (y su padre) y la cuenta de origen o destino, sin distinguir mayúsculas ni tildes.
  - Cada palabra tiene que aparecer en algún campo.
  - Si el texto completo es un monto válido en el formato del usuario, también encuentra los movimientos con ese monto exacto (o monto destino).
  - Los nombres de cuentas que el usuario no ve no se buscan.
- **Filtros:**
  - Cuenta, categoría, etiqueta, tipo, persona y estado, cada uno de selección múltiple.
  - Dentro de un filtro suma cualquiera de los valores (OR); entre filtros se combinan (AND).
  - Elegir una categoría incluye sus subcategorías, y el filtro de cuenta mira el origen o el destino.
  - "Persona" solo aparece si el espacio tiene más de un miembro.
  - Los filtros se recuerdan mientras dure la sesión de la app (store raíz), no en el dispositivo.
- **Totales de Transacciones:**
  - Ingresos y gastos del conjunto filtrado, en la moneda principal, con la tasa de la fecha de cada movimiento. Neto = ingresos − gastos.
  - Las transferencias y los ajustes no suman.
  - Sin filtro de estado solo suma lo confirmado, como `category_totals`.
  - Los movimientos de cuentas fuera del espacio también suman, y si hay alguno, una línea con el candado debajo de los totales dice cuánto: "Incluye {monto} de cuentas fuera del espacio".
  - Si falta una tasa, el aviso de siempre.
- **Crear desde Transacciones (§7):**
  - "+" (atajo `N`) abre "¿Qué vas a registrar?": Transferencia y las categorías agrupadas en Gastos e Ingresos.
  - Después abre el registro rápido: en el panel en expandida, y como overlay en compacta y mediana.
- **Presupuesto** (cambios consolidados del usuario; reemplazan la nota de meses pasados; el detalle está en la spec, §4.7):
  - **Por subcategoría:**
    - Cada subcategoría puede tener su monto.
    - El de la categoría es el suyo propio (la fila "General", que cubre lo registrado directo en ella) más la suma de los de sus subcategorías.
    - Lo que ya existe queda como "General", sin migrar datos.
    - Gastado, restante y excedido van por fila y se suman en la categoría.
    - Si la categoría tiene algún presupuesto, una fila sin monto pero con gasto es excedida por lo gastado.
  - **Alcance de cada edición** (vista Mes): un selector arriba de la lista, "Solo {mes}" (por defecto) o "{mes} y los siguientes".
    - "Solo" guarda el mes y, si el siguiente no tiene monto propio, le guarda el que regía antes (o 0). El siguiente se guarda primero.
    - "Y los siguientes" guarda desde el mes; los posteriores con monto propio lo conservan, y la fila dice desde cuál.
    - La marca discreta "Solo {mes}" aparece cuando el monto del mes es propio y distinto del siguiente.
    - El asistente no cambia.
  - **Pantalla:**
    - Lista por categoría, con secciones "Gastos" e "Ingresos esperados", cada una con su fila de total.
    - Filas como en 1Money: el fondo es la barra de avance en un tono suave del color de la categoría (`role="progressbar"`, AA), y la pastilla con el restante o el excedido (resaltado).
    - Tocar una categoría abre su detalle: sheet en compacta, panel en expandida.
      - Encabezado con periodo, gastado, restante y presupuestado.
      - Filas General y subcategorías, editables en la fila, con lo gastado y lo restante.
      - "Ver transacciones" y "Quitar presupuesto" (con confirmación y el alcance).
  - **Calculadora:** cada fila editable tiene un botón que abre `cc-keypad` y `cc-amount-display` (una vista del detalle en compacta y mediana, un diálogo en expandida), con contexto ("Categoría › Subcategoría", periodo, gastado, restante, presupuesto). El resultado vuelve a la fila y se guarda con el alcance.
  - **Teclado:** `×` y `÷` con precedencia normal, el resultado redondeado a la unidad menor y la división por cero como error claro. También en el registro rápido.
  - **Un solo sheet:** en compacta, la calculadora y la confirmación de "Quitar presupuesto" son vistas dentro del sheet del detalle, con ←. Al confirmar vuelve al detalle con la fila actualizada y el scroll donde estaba, y Esc y el atrás del sistema vuelven al detalle sin cerrarlo. Solo "Ver transacciones" cierra el sheet. En expandida, la calculadora y la confirmación son diálogos sobre el panel.
  - **Periodos:** Año suma los 12 meses en solo lectura. Día, Semana, Siempre y Rango muestran un aviso y "Ver este mes".
  - **Apagado y lector:** con `budgets_enabled` apagado, el destino sigue y muestra el aviso, con un interruptor para el propietario. El lector ve sin editar.
- **Aviso de nueva versión:**
  - Toast persistente "Nueva versión disponible" con "Recargar", que llama a `activateUpdate()` y recarga.
  - Se revisa al volver a la app (`visibilitychange`) y cada `APP_UPDATE_CHECK_INTERVAL_MS`.
  - Si el SW queda irrecuperable, avisa y recarga.
  - Si otro toast lo reemplaza, no se repite: la versión nueva entra igual en la próxima carga.
- **Presupuesto sin RPC nueva:** `category_totals` se reemplaza con las mismas columnas (1.1) para que las subcategorías traigan presupuesto y restante, y la categoría la suma.

---

# Parte 1 · Transacciones, Presupuesto y cierres de la F1

Rama `feat/f1e1-transactions-budget` desde `main`.

## 1.1 Base de datos

`npx supabase migration new transaction_search` → `npm run db:reset` → `npm run db:test` → `npm run supabase:types`. No borra ni renombra nada y no transforma datos.

```sql
-- F1e · Transacciones: búsqueda y filtros de movimientos, y los totales de lo filtrado. Spec §7 y §8.

-- Búsqueda sin tildes. La forma de dos argumentos no depende del search_path.
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
```

**Presupuesto por subcategoría** (misma migración, renombrada a `search_and_subcategory_budgets`; no estaba en producción). Se reemplaza `category_totals` con las mismas columnas y los mismos grants (`create or replace` los conserva). Lo que cambia, sobre la función de la F1d:

```sql
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
  with settings as (...),          -- igual que en la F1d
  scoped as (...),                 -- igual
  movements as (...),              -- igual
  own as (...),                    -- igual: lo de cada categoría o subcategoría
  rolled as (...),                 -- igual: cada categoría con sus subcategorías
  budgets_in_force as (...),       -- igual: el monto en vigor de cada categoría en cada mes
  -- Cada monto en vigor, convertido, con la categoría principal a la que suma (§4.7).
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
```

- **pgTAP** (`supabase/tests/database/subcategory_budgets.test.sql`):
  - La categoría suma su General y sus subcategorías.
  - Una subcategoría con monto en USD se convierte con la tasa, y una en EUR sin tasa no suma y sale en `missing_rate_currencies` (de la subcategoría y de la categoría).
  - Una subcategoría sin monto pero con gasto trae presupuesto y restante en null, y su gasto entra en el restante de la categoría.
  - Varios meses suman el monto en vigor de cada subcategoría en cada mes, y un 0 la quita desde su mes.
  - `transaction_totals.test.sql` sigue igual: sus montos eran por categoría.

**pgTAP de la búsqueda**

Nuevo `supabase/tests/database/transaction_search.test.sql`, con la estructura de `transaction_totals.test.sql`.

- **Datos:**
  - Ana (propietaria de "Hogar", COP), Beto (editor) y Caro (de otro espacio).
  - Cuentas: Efectivo (COP, compartida), Dólares (USD, compartida), "Ahorro Ana" (privada) y "Ahorro Beto" (privada).
  - Categorías: "Educación › Colegio", Mercado y Salario. Etiqueta Fijos. Tasas USD→COP en dos fechas y una cuenta en EUR sin tasa.
- **Visibilidad:**
  - Beto ve lo compartido, lo suyo privado y lo incluido de Ana, pero no lo no incluido de Ana.
  - Ana sí ve su privado no incluido.
  - Caro no recibe filas ni totales.
- **Periodo:** los límites inclusivos y null = sin límite.
- **Filtros:**
  - Cuenta por origen y por destino (una transferencia).
  - Categoría padre con sus subcategorías; una subcategoría sola. Con filtro de categoría, sin transferencias.
  - Etiqueta, tipo, autor y estado.
  - Dos valores en un filtro suman (OR); dos filtros se combinan (AND).
- **Búsqueda:**
  - "educacion" encuentra "Educación", y el padre encuentra a la subcategoría.
  - La nota y la cuenta, sin distinguir mayúsculas.
  - Dos términos: los dos tienen que aparecer.
  - El monto exacto y el monto destino.
  - Beto no encuentra por el nombre "Ahorro Ana" el movimiento incluido de esa cuenta.
- **Totales:**
  - Ingresos, gastos y neto convertidos con la tasa de cada fecha.
  - Sin transferencias ni ajustes, y siguiendo los filtros y la búsqueda.
  - EUR sale en `missing_rate_currencies` y no suma.
  - Para Ana suma su privado no incluido; para Beto no.
  - Sin filtro de estado, lo pendiente no suma; con el filtro, sí.
  - Para Dani (lector, sin cuentas privadas), el mes coincide con la suma de las filas principales de `category_totals` y no hay nada fuera del espacio.
  - Para Beto, `outside_space_expense` es su privado no incluido, y restándolo los totales coinciden con `category_totals`.
  - Lo que una cuenta privada incluye en el espacio no cuenta como fuera.
- **`privileges.test.sql`:** `function_privs_are` de `search_transactions`, `transaction_totals` y `private.search_text` para `anon` (nada) y `authenticated` (execute).

## 1.2 Transacciones

**Datos (core y domain)**

- **`domain/transactions/transaction-filters.ts`** (+ spec):
  - `TransactionFilters` (accountIds, categoryIds, tagIds, types, authorIds, statuses) y `EMPTY_TRANSACTION_FILTERS`.
  - `activeFilterCount` y `filterChipText(labels)` ("Efectivo", "Efectivo +2").
  - `searchArguments(query, numberFormat)` devuelve `{ terms, amount }`. Los términos salen de `searchTerms`; el monto, de `parseMoney` con `DEFAULT_MINOR_UNITS` si todo el texto es un monto válido.
- **`domain/transactions/transactions.ts`** (+ spec):
  - `spaceAmount(movement)`: el monto con signo para la vista del espacio. Gasto −, ingreso +, ajuste según su dirección; la transferencia va sin signo.
  - `isPrivateMovement(movement, visibleAccounts)`: el origen o el destino es privado o no se ve.
- **`domain/transactions/group-by-day.ts`** (+ spec): `groupByDay(items, dateOf)` en el orden recibido. Lo usan Transacciones y el detalle de cuenta, que hoy agrupa en línea.
- **`TransactionsApi.search(spaceId, query, offset, limit)`:**
  - `rpc('search_transactions', args).select(TRANSACTION_SELECT).order('date', desc).order('created_at', desc).range(offset, offset + limit)`, con una fila de más para `hasMore`.
  - El mapeo de filas de `fetchForAccount` se extrae a `toTransaction(row)` y lo usan los dos.
  - Si los tipos generados no tipan el embed sobre la RPC (`SetofOptions`), se castea igual que `fetchForAccount`.
- **`TotalsApi.transactionTotals(spaceId, query)`:** con `.maybeSingle()`, y su modelo `TransactionTotals`.
- **`TransactionQuery`** (rango + filtros + `{ terms, amount }`) en `transaction.models.ts`.
- **`core/spaces/space-members.service.ts`** (+ api): los miembros del espacio activo con `profiles(display_name)`, para el filtro Persona. La RLS ya lo permite.

**Pantalla `features/transactions`**

- **`transaction-filters.store.ts`** (root): el texto de búsqueda y los filtros, con signals.
- **`transaction-items.ts`:** `toTransactionListItem(tx, lookups, perspective)`, movido desde `toItem` y `describe` del detalle de cuenta.
  - Con perspectiva de cuenta: el signo de `balanceDelta`, como hoy.
  - Con perspectiva de espacio: `spaceAmount`, el subtítulo con la cuenta ("Efectivo · Fijos · nota"), las transferencias como "Efectivo → Nequi" (o "Cuenta privada de X") y el candado.
- **`transactions-page`:**
  - Recursos: la lista se pide de 0 a `pages × TRANSACTION_PAGE_SIZE`, como el detalle de cuenta, y los totales aparte. Los dos dependen de espacio, `periods.range()`, búsqueda con debounce (`TRANSACTION_SEARCH_DEBOUNCE_MS`), filtros y `transactions.revision()`. `pages` vuelve a 1 cuando cambia el periodo, la búsqueda o los filtros.
  - Encabezado: `cc-page-header` con "+" (`N`).
  - Debajo: `cc-text-field type="search"`, `cc-filter-chips`, los totales (`cc-stat-group`) y el aviso de tasa faltante.
  - La lista: `cc-transaction-list`, con "Ver más".
  - Vacíos: "No hay movimientos en {periodo}"; con búsqueda o filtros, "Nada coincide" + "Limpiar filtros".
  - Un chip abre `cc-option-panel` (`mode: 'multiple'`) por `OverlayService`. Las categorías van agrupadas en Gastos e Ingresos (las subcategorías como "Padre › Hija"), y las cuentas y etiquetas archivadas en su grupo.
  - Expandida:
    - `cc-list-detail-layout` con `detailOpen = session() !== null`. El panel muestra `cc-quick-entry`, y sin sesión, `[ccDetailEmpty]` con "Elige un movimiento para editarlo" y "Nuevo movimiento".
    - Antes de cambiar de movimiento o cerrar, si `quickEntry.hasUnsavedChanges()`, se usa `ConfirmService` con el mismo texto que `unsavedChangesGuard`.
    - Al guardar o eliminar, el panel se cierra.
    - La página implementa `HasUnsavedChanges`.
  - Compacta y mediana: `QuickEntryFlow.edit(tx)`, como hoy.
  - Ruta: `data: LIST_DETAIL` y `canDeactivate: [unsavedChangesGuard]`.

**Registro rápido en línea**

- El contenido de `cc-quick-entry-sheet` pasa a un organismo nuevo `cc-quick-entry` (`organisms/quick-entry/`, que también recibe `quick-entry.model.ts`):
  - Inputs: `data: QuickEntryData` (el `QuickEntrySheetData` de hoy).
  - Outputs: `closed: 'saved' | 'delete' | 'cancel'`.
  - Método: `hasUnsavedChanges()`.
  - El `(keydown)` del host sigue igual, así que dígitos, `+`, `-`, Enter, Ctrl/⌘+S y Esc funcionan en todo el panel.
  - Con una container query elige dos columnas o una según el ancho: el panel puede ser más angosto que el diálogo.
- `cc-quick-entry-sheet` queda como envoltura: lee `OVERLAY_DATA` y cierra el `OverlayHandle` con el resultado. Hay una sola versión del flujo (§13.5).
- `QuickEntryFlow` expone sesiones: `createSession(...)` y `editSession(tx)` devuelven `{ data, finish(result) }`.
  - `finish` hace lo que hoy hace después del overlay: el toast con "Deshacer" al crear, y al eliminar, confirma y borra.
  - `editSession(tx)` devuelve null y muestra el toast de no permitido si no se puede escribir.
  - `forCategory`, `transferFrom` y `edit` las usan con el overlay.
  - `chooseNew()` abre "¿Qué vas a registrar?" y devuelve una sesión.

**UI (`shared/ui`), cada pieza nueva al catálogo `/ui`**

- `cc-filter-chips` (molécula, con botones propios y área táctil de 44 px; Material no trae un chip que abra opciones y se quite con ✕):
  - Inputs: `filters: FilterChip[]` (`{ key, label, summary: string | null }`), `label` y `expanded` (la clave del filtro con sus opciones abiertas).
  - Outputs: `opened(key)`, `cleared(key)` y `clearedAll`.
  - Una fila con scroll, en orden fijo. Los activos muestran el resumen y ✕, y con dos o más activos aparece "Limpiar".
  - Accesibilidad: cada chip lleva `aria-haspopup="dialog"` y `aria-expanded`; la ✕ se llama "Quitar filtro {filtro}". Solo tokens `--cc-*` y `--mat-sys-*`.
- `cc-stat-group` (molécula): `items: StatItem[]` (`{ label, amount, currency, tone?, signed?, note? }`) en fila, con una nota opcional debajo (`footnote` y `footnoteIcon`): en Transacciones, "Incluye {monto} de cuentas fuera del espacio" con el candado. La parte 2 lo reutiliza.
- `cc-transaction-list` (extender):
  - Input `selectedId` (va a `cc-list-item [selected]`).
  - En el ítem, `private?: boolean` (candado `lock` con nombre accesible "Cuenta privada") y `signed?: boolean`, que por defecto es true.
- `cc-missing-rates-notice` (organismo): el aviso de Categorías (`cc-section` highlight + "Agregar tasa"), extraído para usarlo en Categorías, Transacciones y Presupuesto.

## 1.3 Presupuesto

- **Dominio:**
  - **`domain/budgets/budget-scope.ts`** (+ spec, con los dos alcances y un mes pasado):
    - `BudgetEditScope = 'month' | 'onward'`.
    - `budgetWrites(entries, categoryId, month, amount, currency, scope)`: las filas a guardar.
      - `onward`: solo la del mes.
      - `month`: primero la del mes siguiente (si no tiene monto propio y lo que regía era distinto, con ese monto o 0), y luego la del mes.
    - `isMonthOnly(entries, categoryId, month)`: si el mes tiene monto propio y el siguiente también, con otro monto (para la marca).
    - `nextOwnMonth(entries, categoryId, month)`: el primer mes posterior con monto propio (para el aviso de "y los siguientes").
  - **`domain/budgets/budget-lines.ts`** (+ spec): con las filas de `category_totals` de una categoría y sus subcategorías, arma su vista.
    - La línea "General": lo gastado = total − subcategorías; el presupuesto = total − subcategorías, o null si no tiene monto propio en vigor.
    - Una línea por subcategoría.
    - El estado de cada línea (sin presupuesto, a medias, completo o excedido) y la regla de "excedida por lo gastado".
    - Los totales de la categoría.
  - **`domain/money/amount-expression.ts`** (+ spec):
    - Teclas `times` y `divide` (`*` y `/` en la expresión; `×` y `÷` al mostrarla), con precedencia normal.
    - `evaluateAmount(expression, exponent)` devuelve `{ ok: true, value } | { ok: false, error: 'division_by_zero' }`. Calcula exacto con `bigint` y redondea a la unidad menor, alejándose de cero.
    - `evaluateExpression` la usa y da 0 cuando hay error.
    - El registro rápido valida la división por cero con su propio mensaje.
- **Datos:**
  - **`BudgetsService`:**
    - `amountFor(categoryId, month = currentMonth())`.
    - `setAmount(categoryId, amount, currency, month, scope)`: aplica `budgetWrites` en orden. `setMonthly` (el del asistente) queda como `onward` desde el mes actual.
    - `revision`: `TotalsService` la agrega a su recurso, para que las barras se actualicen al guardar.
  - **`MonthlyAmounts`:**
    - `save(change, month?, scope?)`, que pasa por `PendingSaves`.
    - `categoryViews(kind, month | null)`: las filas de la lista y el detalle de cada categoría, desde `category_totals` y `budgetsService`.
- **`budget-page`** (list-detail, como Cuentas):
  - **Lista:**
    - El selector de alcance (`cc-segmented-control`, solo en Mes y para quien edita).
    - El aviso de tasa faltante.
    - La sección "Gastos": su fila de total (`cc-budget-row`, con "Sin presupuesto: $X" debajo) y una `cc-budget-row` por categoría.
    - La sección "Ingresos esperados", igual.
  - **Detalle:**
    - En expandida va en el panel: `cc-budget-detail`.
    - En compacta y mediana, `cc-budget-detail-sheet`: la calculadora y la confirmación son vistas dentro de él (`OverlayHandle.enterView` agrega la entrada de historial, así el atrás del sistema vuelve al detalle). Solo se cierra con `transactions`, y la página navega.
    - Los guardados de las filas van por `MonthlyAmounts.save` con el mes y el alcance.
  - **"Ver transacciones":** pone el filtro de categoría en `TransactionFiltersStore` y navega a Transacciones; el periodo es el global.
  - **"Quitar presupuesto":** confirma ("¿Quitar el presupuesto de {categoría}?", diciendo el alcance) y guarda 0 en el General y en cada subcategoría con monto en vigor.
  - **Calculadora:** en el panel, `cc-amount-calculator-sheet` por `OverlayService` (diálogo). Devuelve el monto y la página lo guarda.
  - Rutas: `data: LIST_DETAIL` y `canDeactivate: [pendingSavesGuard]`. Estados de periodo, `budgets_enabled` y lector, como en Decisiones.
- **UI** (al catálogo `/ui`; `cc-budget-progress` se elimina, porque lo reemplazan las piezas de abajo):
  - `cc-progress-bar` (átomo):
    - Variante `backdrop`: llena el fondo de su contenedor en un tono suave de una clave de paleta (`color`, con su intensidad `pale`), y sigue con `role="progressbar"`.
    - Variante `bar`: la de siempre.
  - `cc-budget-pill` (molécula): el restante, el faltante o el excedido en una pastilla. El excedido va en color de error y lo recibido de más en tono positivo, con contraste AA.
  - `cc-budget-row` (molécula), la fila de 1Money:
    - El fondo es la barra (`backdrop`), con el badge, el nombre y lo gastado.
    - A la derecha, la pastilla y "presupuestado $X".
    - Puede ser accionable (abre el detalle), estar seleccionada (panel) y llevar una nota (la línea "Sin presupuesto").
  - `cc-budget-list` (organismo, se extiende):
    - En modo avance (las entradas con `progress`), cada fila editable lleva el fondo de barra, el `cc-money-row`, lo gastado, la pastilla y un botón de calculadora (`calculate(entryId)`).
    - Suma la marca "Solo {mes}" y el hint de "y los siguientes".
    - El asistente sigue igual.
  - `cc-budget-detail` (organismo): el encabezado (`cc-budget-row` no accionable con el periodo), el `cc-budget-list` de la categoría y las acciones "Ver transacciones" y "Quitar presupuesto".
  - `cc-budget-detail-sheet` (organismo): el overlay del anterior, con sus vistas (calculadora y confirmación). Lee sus datos como signals, para seguir los guardados, y conserva el detalle oculto mientras una vista lo tapa.
  - `cc-amount-calculator` (organismo, en línea; `cc-amount-calculator-sheet` es su overlay):
    - El encabezado de contexto, `cc-amount-display` ("Presupuesto para el mes") y `cc-keypad`.
    - Teclado físico como en el registro rápido.
    - Emite las unidades menores; con `backButton` lleva ← para volver.
  - `cc-confirm-panel` (molécula): la confirmación sin overlay, para usarla como vista; `cc-confirm-dialog` la envuelve para `ConfirmService`.
  - `cc-overlay-panel` (se extiende): `backButton` pone ← ("Volver") en lugar de ✕.
  - `cc-keypad` (molécula): 5 columnas como en 1Money (÷ × − + a la izquierda, ⌫ y 000 a la derecha, ✓ alto). Sirve al registro rápido y a la calculadora.

## 1.4 Configuración

Comparada con §7. Ya existen: tema, formato de moneda, atajos de teclado, nombre, ícono y color del espacio, moneda principal, primer día del mes y de la semana, Catálogos (cuentas, categorías, etiquetas), Monedas y Configuración inicial.

Se agrega:

1. **Perfil:** "Nombre visible" en la sección del usuario, con Guardar. `core/profiles/profile.service.ts` + `profiles.api.ts` leen y actualizan `profiles.display_name`, que ya tiene grant y RLS. Al guardar, se recargan los miembros del espacio.
2. **Pantalla de inicio:**
   - Un `cc-select` en Preferencias: Cuentas, Categorías, Transacciones, Presupuesto o Resumen (`user_settings.home_screen`).
   - Se aplica con `homeScreenGuard` (+ spec): la ruta `''` deja de ser un `redirectTo` fijo y pasa a ser `{ path: '', pathMatch: 'full', canActivate: [authGuard, spaceGuard, homeScreenGuard], children: [] }`, que devuelve el `UrlTree` de `HOME_SCREEN_PATHS[home_screen]` (en `app-paths.ts`).
   - `'**'` redirige a `''`.
3. **Periodo por defecto:** un `cc-select` en Espacio: Día, Semana, Mes, Año o Siempre (`space_settings.default_period`), con el hint "Se usa en los dispositivos que no recuerdan otro".
4. **Presupuestos on/off:** el `cc-switch` "Mostrar presupuestos" en Espacio (`budgets_enabled`).
   - 3 y 4 se guardan con el Guardar del espacio, en el parche de `saveActivePreferences`. Solo el propietario, como el resto del formulario.
5. **Orden de §7:**
   - La sección "Tú" (perfil y preferencias).
   - "Espacio": formulario, catálogos, monedas y configuración inicial.
   - "Sesión".

No se agrega:

- Miembros e invitaciones (F1f).
- Avatar (sin almacenamiento de archivos todavía).

## 1.5 Aviso de nueva versión

- **`core/pwa/app-update.service.ts`** (+ spec con un `SwUpdate` falso), que arranca desde `provideAppInitializer` solo si `swUpdate.isEnabled`:
  - `VERSION_READY` muestra `toast.showWithAction(APP_UPDATE_TEXT.ready, APP_UPDATE_TEXT.reload, { persistent: true })`. Con la acción: `activateUpdate()` y `document.location.reload()`.
  - `unrecoverable` muestra el aviso y recarga.
  - `checkForUpdate()` corre al volver a visible y cada `APP_UPDATE_CHECK_INTERVAL_MS`.
- **`ToastService`:** la opción `persistent`, sin duración.
- **Textos y constantes** en `core/config`.
- En e2e el SW está apagado (`ng serve`), así que lo cubre la prueba unitaria.

## 1.6 Spec, docs y e2e

- **Spec** (segundo commit, antes del código). Versión 0.10:
  - §7: Transacciones, Presupuesto y Configuración con las decisiones de arriba.
  - §4.7: el total y los estados del presupuesto.
  - §8: las RPCs `search_transactions` y `transaction_totals`.
  - §12: las decisiones de la F1e.
  - §13.1: los componentes nuevos.
- **`CLAUDE.md`:** "Estructura" suma `profiles` y `pwa` a `core`.
- **e2e:**
  - **Mock** (`e2e/support/supabase.ts`):
    - Rutas `rpc/search_transactions`, con periodo, tipo, cuenta, categoría, etiqueta y términos en memoria, y los mismos embeds que `transactions`.
    - `rpc/transaction_totals`.
    - `profiles`: GET y PATCH.
    - `space_members` filtrado por `space_id`, con perfiles.
  - **Flujos:**
    - `e2e/transactions-page.e2e.ts`: lista por día, búsqueda (revisa `search_terms` en `rpcCalls`), poner y quitar un filtro, totales, editar y guardar (en el panel en escritorio, en el sheet en móvil), eliminar, y descartar con cambios sin guardar.
    - `e2e/budget.e2e.ts`:
      - La lista con las filas de fondo y la pastilla, y un excedido.
      - Abrir una categoría (sheet en móvil, panel en escritorio).
      - Editar el General y una subcategoría en la fila con cada alcance (revisa las filas en `writes()`).
      - La calculadora con × o ÷.
      - "Ver transacciones" (llega con el filtro) y "Quitar presupuesto".
      - Año en solo lectura y presupuestos apagados.
    - `settings`: pantalla de inicio (abrir `/` lleva a ella), periodo por defecto, interruptor de presupuesto y nombre visible.
  - **Screenshots:** `transacciones`, `transacciones-filtros`, `transacciones-editar`, `presupuesto`, `presupuesto-detalle`, `presupuesto-calculadora`, `presupuesto-anual`, `presupuesto-apagado`, `configuracion` y los del catálogo `/ui`.

## 1.7 Commits

1. `docs: plan de la F1e` (este archivo).
2. `docs(spec): decisiones de la F1e1`.
3. `feat(db): búsqueda de movimientos y totales filtrados` (migración, pgTAP y tipos).
4. `refactor(ui): registro rápido en línea y sesiones del flujo`.
5. `feat(ui): chips de filtro, grupo de cifras, barra de progreso y avance del presupuesto` (con el catálogo).
6. `feat(transactions): lista, búsqueda, filtros, totales y edición en el panel`.
7. `docs: ajustes de la F1e` (presupuesto por subcategoría, alcance, detalle y calculadora; Mis finanzas en la spec).
8. `feat(db): presupuesto por subcategoría en category_totals`.
9. `feat(money): multiplicar y dividir en el teclado`.
10. `feat(budget): presupuesto por categoría y subcategoría, con alcance, detalle y calculadora`.
11. `feat(settings): perfil, pantalla de inicio, periodo por defecto y presupuestos`.
12. `feat(pwa): aviso de nueva versión`.
13. `test(e2e): transacciones, presupuesto y configuración`.

## Layouts · Parte 1

**Transacciones · móvil (compacta)**

```
┌──────────────────────────────────┐
│ $ 4.250.000  ‹ Diciembre ›     ⚙ │  encabezado global
├──────────────────────────────────┤
│          Transacciones         ＋ │
│ ┌──────────────────────────────┐ │
│ │ 🔍 Buscar                     │ │
│ └──────────────────────────────┘ │
│ (Efectivo ✕)(Gasto ✕)(Etiqueta ▾)(Persona ▾)(Limpiar) →
│  Ingresos       Gastos      Neto │
│ +$ 3.000.000 −$ 1.250.000 +$ 1.750.000
│ Hoy                              │
│ (🛒) Mercado › Supermercado       │
│      Efectivo · Fijos  −$ 125.000 │
│ (💊) Salud 🔒                     │
│      Ahorro Ana         −$ 80.000 │
│ Ayer                             │
│ (⇄) Efectivo → Nequi    $ 50.000 │
│            [ Ver más ]           │
├──────────────────────────────────┤
│ Cuentas Categ. Trans. Pres. Resum│
└──────────────────────────────────┘
Tocar una fila → registro rápido (sheet) para editar o eliminar.
```

**Transacciones · escritorio (expandida)**

```
┌──────┬────────────────────────────────────┬─────────────────────────────────────┐
│ rail │ Transacciones                    ＋ │ Mercado › Supermercado            ✕ │
│      │ 🔍 Buscar                           │ ┌─────────────┐ Cuenta   Efectivo ▾ │
│      │ (Cuenta ▾)(Categoría ▾)(Etiqueta ▾)…│ │  $ 125.000  │ Fecha  (Hoy)(Ayer)  │
│      │ Ingresos     Gastos        Neto     │ │ 7   8   9 ⌫ │ (Super)(Plaza)      │
│      │ +3.000.000   −1.250.000  +1.750.000 │ │ 4   5   6 + │ ▸ Etiquetas y nota  │
│      │ Hoy                                 │ │ 1   2   3 − │                     │
│      │▌Mercado › Super        −$ 125.000   │ │ ,   0     ✓ │ [Eliminar]          │
│      │  Salario             +$ 3.000.000   │ └─────────────┘                     │
│      │ Ayer …               [ Ver más ]    │                                     │
└──────┴────────────────────────────────────┴─────────────────────────────────────┘
Sin selección, el panel dice "Elige un movimiento para editarlo" y ofrece "Nuevo movimiento (N)".
Mediana: un panel a la vez y el registro rápido como diálogo.
```

**Presupuesto · móvil** (filas como en 1Money: `▒` es el fondo de barra en el tono suave de la categoría)

```
┌──────────────────────────────────┐
│           Presupuesto            │
│ [ Solo diciembre | Dic. y siguientes ]   ← alcance, en Mes
│ ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░░░░░░░░░░░░░ │
│ Gastos               ( $ 850.000 )│  pastilla: restante
│ gastado $ 3.150.000  presup. $ 4M │
│ Sin presupuesto: $ 120.000        │
│ ▒▒▒▒▒▒▒▒▒▒▒▒▒░░░░░░░░░░░░░░░░░░░ │
│ (🛒) Mercado         ( $ 150.000 )│
│      $ 650.000    presup. $ 800.000
│ ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒ │
│ (🏠) Hogar          (■ $ 200.000 ■)  excedido resaltado
│      $ 1.700.000  presup. $ 1,5M  │
│ Ingresos esperados               │
│ ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░░░░░░░░░░░░░░ │
│ (💼) Salario        ( $ 2.000.000 )  faltan
└──────────────────────────────────┘
Tocar una categoría → sheet del detalle:
┌──────────────────────────────────┐
│ (🛒) Mercado                    ✕ │
│ ▒▒▒▒▒▒▒▒▒▒▒▒░░░░░░░░░░░░░░░░░░░░ │
│ 1 dic – 31 dic       ( $ 150.000 )│
│ gastado $ 650.000  presup. $ 800.000
│ ▒▒▒▒▒▒▒▒░░░░░░░░░░░░░░░░░░░░░░░░ │
│ General            $ 200.000  [🧮]│  ← monto en la fila
│ $ 50.000                ($150.000)│
│ ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒ │
│ Supermercado       $ 600.000  [🧮]│  Solo diciembre
│ $ 600.000                 ( $ 0 ) │
│ Plaza          Sin presupuesto[🧮]│
│ $ 0                               │
│ [🗑 Quitar presupuesto] [🧾 Ver transacciones]
└──────────────────────────────────┘
Calculadora (sheet): encabezado "Mercado › Supermercado", periodo, gastado, pastilla, presupuesto;
"Presupuesto para el mes  $ 600.000"; teclado de 5 columnas:
  ÷ 7 8 9 ⌫ / × 4 5 6 000 / − 1 2 3 ✓ / + 0 0 , ✓
```

**Presupuesto · escritorio** (lista y detalle lado a lado, §13.5)

```
┌──────┬────────────────────────────────────┬─────────────────────────────────────┐
│ rail │ Presupuesto                        │ (🛒) Mercado                         │
│      │ [ Solo diciembre | Dic. y sig. ]    │ ▒▒▒▒▒▒▒▒▒▒▒░░░░  1 dic – 31 dic      │
│      │ ▒▒▒▒▒▒▒▒▒▒▒▒▒▒░░░  Gastos ($850k)   │ gastado $650k  presup. $800k ($150k) │
│      │ ▒▒▒▒▒▒▒▒░░░░░░░░  🛒 Mercado ($150k)│ General        $ 200.000 [🧮] ($150k)│
│      │ ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒ 🏠 Hogar (■$200k■)│ Supermercado   $ 600.000 [🧮] ($0)   │
│      │ Ingresos esperados                  │ Plaza          Sin presupuesto [🧮]  │
│      │ ▒▒▒▒▒▒▒▒▒▒▒░░░░░  💼 Salario ($2M)  │ [Quitar presupuesto] [Ver transacc.] │
└──────┴────────────────────────────────────┴─────────────────────────────────────┘
La calculadora es un diálogo. Mediana: un panel a la vez (el detalle como sheet).
```

## Verificación y entrega · Parte 1

- **Al escribir la migración:** `npm run db:reset` y `npm run db:test`, y después `npm run supabase:types`.
- **Antes del PR, la suite completa:** `npm run lint`, `npm test`, `npm run build`, `npm run e2e` (los 4 proyectos) y `npm run db:test`.
- **Revisión visual:** los screenshots de `e2e/screenshots/{mobile,desktop}-{light,dark}`.
- **PR:** contra `main`, sin merge, con los screenshots descritos. Nada en producción: ni `db push` ni backups.

---

# Parte 2 · Resumen, reportes y Mis finanzas

Rama `feat/f1e2-summary` desde `main` (la parte 1 ya está mergeada, #8). Revisado contra main y las capturas de 1Money (resumen, transacciones, categorías y presupuesto), que son referencia de comportamiento, no de estilo.

Reutiliza:

- `cc-stat-group`, `cc-progress-bar`, `cc-missing-rates-notice` y `cc-tabs`.
- De la parte 1: `cc-budget-row` (con `emphasis="total"`), `cc-budget-pill`, `TransactionFiltersStore` y el patrón de `BudgetPage.viewTransactions` (`reset`, `set('categoryIds', …)` y navegar).
- `TotalsApi.categoryTotals(space, range, months)`, que ya acepta cualquier rango, y `TotalsService`, que ya trae las cifras del periodo con su presupuesto (`budgetMonths`).
- `rangeText` y `periodTitle` (`domain/periods/period-labels.ts`), y `shiftPeriod` y `periodRange` (`domain/periods/periods.ts`).
- El patrón de vistas de `cc-budget-detail-sheet` (`OverlayHandle.enterView`).

El Resumen ya no usa `cc-donut` ni `cc-segmented-control`.

Además de "Mis finanzas" (2.3), la parte 2 trae el nuevo "¿Qué vas a registrar?" y el registro rápido rediseñado (2.4), ajustes a Transacciones (2.5) y la regla de altura de los sheets (2.6).

## 2.1 Base de datos

Migración `report_totals`. El alcance es Espacio, igual que `category_totals`. No borra ni renombra nada y no transforma datos.

**Decisión: se convierte cada movimiento por separado.** `convert_minor` redondea; si cada reporte convierte agrupando distinto (por subcategoría y día, por cuenta, por persona), los totales en otra moneda pueden diferir en unidades menores. Convirtiendo por movimiento, cualquier reparto suma exactamente lo mismo. Por eso `category_totals` y `transaction_totals` se reemplazan con las mismas columnas y los mismos grants (`create or replace` los conserva). En lo que está en la moneda principal no cambia nada: `exchange_rate` devuelve 1 cuando las monedas coinciden.

```sql
-- F1e · Resumen y Transacciones: totales por día y por categoría, desgloses por etiqueta, cuenta y
-- persona (alcance Espacio, §6), totales por día de lo filtrado y saldo a una fecha (§7). Cada
-- movimiento se convierte por separado, para que cualquier reparto sume lo mismo.

create type public.report_dimension as enum ('tag', 'account', 'member');

-- Movimientos que cuentan en el alcance Espacio: confirmados, de gasto o ingreso, de cuentas
-- compartidas o incluidos en el espacio, entre dos fechas (null = sin límite), con su monto en la
-- moneda principal y la tasa de su fecha (null sin tasa). Security invoker: las cuentas privadas de
-- otros no se ven, así que solo entran sus movimientos incluidos; quien no es miembro no ve
-- space_settings y no recibe filas.
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
    t.id, c.kind, t.date, t.amount, t.currency,
    private.convert_minor(t.amount, t.currency, s.main_currency, target_space_id, t.date),
    t.category_id, coalesce(c.parent_id, c.id), t.account_id, a.id is not null, t.created_by
  from public.transactions t
  join public.space_settings s on s.space_id = t.space_id
  join public.categories c on c.id = t.category_id
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

-- ── RPC: totales por día y categoría ──────────────────────────────────────────
-- Para las barras apiladas: por día y categoría principal (suma sus subcategorías), en la moneda
-- principal con la tasa de ese día. Lo que no tiene tasa no suma y su moneda sale aparte.
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
-- key es quien lo registró. En la moneda principal con la tasa de la fecha de cada movimiento.
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
      m.kind, m.currency, m.converted
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
```

**Conversión por movimiento en `category_totals` y `transaction_totals`** (misma migración; mismas columnas y grants):

```sql
-- Igual que en la parte 1, salvo que cada movimiento se convierte por separado (space_movements):
-- así su total por categoría es la suma de daily_category_totals y de breakdown_totals.
create or replace function public.category_totals(
  target_space_id uuid,
  from_date date,
  to_date date,
  budget_months date[] default '{}'
)
returns table (...)                -- igual
...
as $$
  with settings as (...),          -- igual
  -- scoped y movements de antes se reemplazan por:
  movements as (
    select m.category_id, m.top_category_id as top_id, m.currency, m.converted
    from private.space_movements(target_space_id, from_date, to_date) m
  ),
  own as (...),                    -- igual
  rolled as (...),                 -- igual
  budgets_in_force as (...),       -- igual
  budget_rows as (...),            -- igual
  budget_own as (...),             -- igual
  budget_rolled as (...)           -- igual
  select ...                       -- igual
$$;

-- Lo que suma en Transacciones: lo que devuelve search_transactions con los mismos argumentos, de
-- gasto o ingreso (sin filtro de estado, solo lo confirmado), con su monto convertido por
-- movimiento y si viene de una cuenta fuera del espacio.
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

-- Mismas columnas que en la parte 1; ahora suma private.filtered_amounts.
create or replace function public.transaction_totals(<los mismos 11 argumentos>)
returns table (...)                -- igual
...
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
    s.income::bigint, s.expense::bigint, (s.income - s.expense)::bigint,
    s.outside_income::bigint, s.outside_expense::bigint, st.main_currency, s.missing
  from sums s
  cross join settings st;
$$;

-- ── RPC: totales por día de lo filtrado ───────────────────────────────────────
-- Para el encabezado de cada día en Transacciones (§7), con las reglas de transaction_totals. No
-- depende de cuánto de la lista se haya cargado.
create function public.transaction_day_totals(<los mismos 11 argumentos, con sus defaults>)
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

-- Grants de las nuevas: revoke all ... from public, anon; grant execute ... to authenticated.
```

- **Sin RPC nueva:**
  - Ingresos, gastos y balance, el ranking por categoría y el desglose por subcategoría salen de `category_totals`, que ya trae `TotalsService` para el periodo global.
  - La comparación es otra llamada a `category_totals` con el rango de `comparisonRange` (2.2 B).
  - Los promedios se calculan en el cliente.
- **pgTAP** (`supabase/tests/database/report_totals.test.sql`, con datos como los de `transaction_totals.test.sql`):
  - **Visibilidad:** lo privado no incluido de otro no cuenta, lo incluido sí, y quien no es miembro no recibe filas.
  - **Conversión:** con la tasa de cada día, y la moneda sin tasa sale en `missing_rate_currencies`.
  - **Por día:** las subcategorías se suman a su principal.
  - **Por etiqueta:** un movimiento con dos etiquetas cuenta en cada una, y los que no tienen etiqueta van con key null.
  - **Por cuenta:** la privada incluida de otro va con key null.
  - **Por persona:** key es quien lo registró.
  - **Pendientes:** no cuentan.
  - **Cifras coherentes:**
    - Los datos incluyen dos movimientos en USD del mismo día y la misma subcategoría, desde cuentas y autores distintos, con una tasa con decimales (p. ej. 4123,456789). Es el caso que se descuadraría al convertir por grupos.
    - Para el mismo periodo, la suma de `daily_category_totals` por categoría es igual a `category_totals`.
    - `breakdown_totals` por cuenta y por persona suma el total de cada clase.
    - La suma de `transaction_day_totals` es igual a `transaction_totals`.
  - **`accounts_balance`:**
    - Sin filtro, el saldo de hoy es igual a `accounts_total(hoy)` (sin movimientos con fecha futura).
    - Un movimiento anterior a la fecha del saldo inicial: el saldo antes y después de él.
    - Una transferencia entre una cuenta incluida en el total y una que no.
    - Con `account_ids`, solo esas cuentas; la privada de otro no entra.
    - Quien no es miembro recibe `currency` null.
  - **Pruebas existentes:** `subcategory_budgets`, `transaction_totals` y `transaction_search` se vuelven a correr; solo se ajustan si dependían del redondeo por grupos.
  - **`privileges.test.sql`:** las funciones públicas nuevas (`daily_category_totals`, `breakdown_totals`, `net_worth`, `transaction_day_totals` y `accounts_balance`) y las privadas (`space_movements` y `filtered_amounts`). El `plan(…)` sube.

## 2.2 Resumen

**De arriba abajo** (como la referencia de 1Money):

1. **Balance y tasa de ahorro:** el balance del periodo (ingresos − gastos) y, al lado, un anillo con la tasa de ahorro (balance / ingresos, en %).
   - Sin ingresos, el anillo no aparece. Con el balance negativo, va en tono de error.
   - `role="img"` con aria-label ("Tasa de ahorro: 62 %").
2. **Gastos e Ingresos:** dos tarjetas que son a la vez el selector (`cc-total-toggle`, en lugar de `cc-segmented-control`).
   - La elegida va rellena con el tono de su clase, y cada una lleva su nota de comparación (B).
3. **Barras apiladas por día** (C).
4. **Promedios:** tres casillas, "Día (prom.)", "Semana (prom.)" y "Mes".
5. **"Por categoría":** filas con ícono, nombre, monto y barra con el %, sin donut (las barras y la lista ya muestran lo mismo).
   - Primero las 3 categorías mayores, en el orden del gráfico. Si hay 4 o más, una fila gris "Más…" despliega el resto. Las categorías en 0 no aparecen.
   - Tocar una categoría despliega sus subcategorías, más "General" si hay algo registrado directo en ella.
   - Tocar una subcategoría (o "General", o una categoría sin subcategorías) abre Transacciones filtrado por ella, con el patrón de `viewTransactions`. El periodo sigue siendo el global.
6. **"Presupuesto":** solo con presupuestos activos (`budgets_enabled`, en Mes o Año, y la clase con presupuesto).
   - Una fila de Gastos (gastado frente a presupuestado) y una de Ingresos (recibido frente a presupuestado): `cc-budget-row emphasis="total"` con su pastilla.
   - Tocarla abre Presupuesto. La fila de Ahorros llega con las metas de la F2.
7. **Pestañas Etiqueta, Cuenta y Persona** (`cc-tabs` + `cc-breakdown-list`), con la clase elegida en las tarjetas.
   - Persona solo aparece con más de un miembro.
   - Un aviso dice que con varias etiquetas el % no suma 100.

Arriba de todo, `cc-missing-rates-notice` cuando falta una tasa.

**Layout:**

- **Expandida:** dos columnas con grid en la página (no es list-detail). A la izquierda, el balance con el anillo, las tarjetas, el gráfico y los promedios. A la derecha, la lista, el presupuesto y las pestañas.
- **Compacta y mediana:** una columna.

**A. Dominio** (`domain/reports/`, con pruebas):

- `savingsRate(income, expense)`: balance / ingresos, o null sin ingresos.
- `periodAverages(total, range, today, firstDate, kind)`:
  - Cuenta los días desde el inicio (o el primer movimiento, en Siempre) hasta el fin, o hasta hoy si el periodo está en curso.
  - Por día = total / días. Por semana = × 7.
  - Por mes: en el periodo Mes, el total del periodo (como la referencia); en los demás, por día × `AVERAGE_MONTH_DAYS` (365,2425 / 12), y la casilla dice "Mes (prom.)".
  - Se redondea a unidades menores, alejándose de cero.
- `shareOf(items)`: el % de cada elemento.
- `kindBudgetFigures(totals, kind)` (`domain/budgets`): lo gastado y la suma de los presupuestos de las categorías principales de la clase (null si es 0). Reemplaza `sumBudgets` de `budget-page.ts`, así Presupuesto y Resumen calculan igual.

**B. Comparación con el periodo anterior** (`domain/reports/comparison.ts`, con pruebas):

- `comparisonRange(period, settings, today)` devuelve `{ range, truncated } | null`:
  - **Siempre:** null (sin comparación).
  - **Los demás:** el rango de `shiftPeriod(period, -1)`. El rango personalizado se mueve en un bloque de su mismo largo.
  - **Periodo en curso:** el anterior se recorta a los mismos días transcurridos: termina en `min(inicio anterior + transcurridos − 1, fin anterior)`, con `truncated: true`.
  - **Periodo terminado:** el anterior completo.
  - **Periodo futuro:** null.
- `compareTotals(current, previous, kind)`: el cambio en % y el tono. Que suban los gastos es malo y que suban los ingresos es bueno. Si el anterior es 0, no hay nota.
- **Nota:** "▼ 9 % vs. 28 sep – 26 oct", siempre con `rangeText`, así dice contra qué compara.
- **Datos:** `ReportsService` llama a `TotalsApi.categoryTotals(space, comparison.range, [])`. No hay RPC nueva.
- **Pruebas:** periodo en curso y terminado, inicio de mes en día 27 y 28, meses de distinta longitud (el día 31 contra un mes de 30 días), Semana y Año.

**C. Gráfico** (`domain/reports/chart.ts`, con pruebas):

- `rankCategories(totals, kind)`: las categorías principales con monto, de mayor a menor, como `{ top, rest }` con las 3 mayores. Lo usan el gráfico y la lista, así el orden es el mismo.
- `chartBuckets(rows, range, top, settings)`:
  - Una serie por cada categoría del top, con su color, y una gris (`gray`) para el resto.
  - Rellena con 0 los días sin movimientos.
  - En Año y Siempre agrupa por mes del periodo (`periodMonth`), y también con más de `CHART_DAILY_MAX_BUCKETS` días.
- `chartTicks(range, buckets)`: por día, una marca cada 7 días desde el inicio del periodo, más la fecha final; por mes, una por mes.
- **`cc-bar-chart`:**
  - Eje de montos a la derecha, con líneas guía punteadas.
  - Tocar o pasar el mouse por una barra muestra el día, su total y el desglose (tooltip `axis`). El formato de los montos llega por input, desde el servicio de moneda.
  - `role="img"` con un aria-label que resume el periodo, el total y la categoría mayor ("Gastos de Diciembre: $ X; la mayor es Mercado, $ Y"). El tooltip no es la única forma de leer los datos: la lista los tiene todos.
- **ECharts** en un chunk diferido:
  - `npm i echarts ngx-echarts` (`ngx-echarts@22`, peer `@angular/core >=22`; `echarts@6`, import modular).
  - `provideEchartsCore({ echarts: () => import('./echarts-setup') })` va en los `providers` de `cc-bar-chart`, así el átomo carga ECharts por su cuenta (también en `/ui`). El setup registra solo `BarChart`, `GridComponent`, `TooltipComponent` y `CanvasRenderer`.
  - `getComputedStyle` devuelve `light-dark(a, b)` sin resolver, y el canvas no lo entiende: el átomo elige el lado según el `color-scheme` de la sonda (o el del sistema).
  - La página envuelve el gráfico en `@defer (on viewport)` con un placeholder del mismo alto.
  - **Tema:** los colores salen de la paleta (`paletteColor`, que es `light-dark()`) y de `--mat-sys-*`. Se resuelven con un elemento sonda: `getComputedStyle(probe).color`.
  - Se redibuja al cambiar el tema o el esquema del sistema, y respeta `prefers-reduced-motion` (sin animación).
  - **Verificar:** en la salida de `npm run build`, `echarts` no aparece en los chunks iniciales.

**Datos:**

- `ReportsApi` (`core/reports`) con `dailyCategoryTotals` y `breakdownTotals`.
- `ReportsService`: recursos por periodo y `revision` (transacciones, tasas y presupuestos), más el `category_totals` de `comparisonRange`.

**UI nueva** (al catálogo `/ui`):

- `cc-progress-ring` (átomo): anillo SVG con `value` (0–1), `tone` (`positive` o `error`), `label` y el texto del centro.
- `cc-total-toggle` (molécula): dos tarjetas como `radiogroup` (flechas del teclado), cada una con su etiqueta, monto y nota. La elegida va rellena con su tono: tokens nuevos `--cc-tone-expense` e `--cc-tone-income` (con sus `on-*`), que salen del tema y cumplen AA.
- `cc-stat-group`: variante `tiles` (casillas con fondo, en fila). La usan los promedios y los saldos de Transacciones.
- `cc-breakdown-list` (organismo): filas con `cc-icon-badge`, nombre, `cc-amount` y `cc-progress-bar` con el %. Filas desplegables (subcategorías) y la fila "Más…". Emite la categoría tocada.
- `cc-bar-chart` (átomo): las barras apiladas.

**e2e:**

- El mock agrega `rpc/daily_category_totals` y `rpc/breakdown_totals`.
- `e2e/summary.e2e.ts`:
  - el cambio con las tarjetas;
  - la nota con el rango recortado (revisa `rpcCalls('category_totals')`);
  - el gráfico con su aria-label;
  - "Más…" y una subcategoría que lleva a Transacciones con el filtro;
  - la fila de presupuesto, que lleva a Presupuesto;
  - las pestañas de desglose.
- Screenshots `resumen`, `resumen-ingresos`, `resumen-categorias` (desplegado) y `resumen-desglose`.

## 2.3 Mis finanzas (patrimonio)

Como la pestaña de 1Money: los activos (Cuentas, Ahorros y Me deben) contra las Deudas, y el neto. Va por moneda y consolidado en la moneda principal con la tasa de hoy.

- **Dónde va:** una pestaña "Mis finanzas" en Cuentas, no una sección del Resumen. Es lo más coherente con la spec y con §13.5:
  - §6 y §7 ya la ubican ahí ("pestaña Mis finanzas" de Cuentas), como en 1Money.
  - En expandida, las pestañas viven en el panel de lista de `cc-list-detail-layout`, así que el detalle de cuenta sigue al lado.
  - En compacta y mediana es un panel a la vez, como el resto de Cuentas.
- **Pestañas de Cuentas:** `cc-tabs` "Cuentas | Mis finanzas".
  - La pestaña Deudas, con sus círculos de progreso, llega en la F2. Mientras tanto, las deudas siguen en la lista de Cuentas, como hoy.
  - La pestaña elegida va en un query param (`?vista=mis-finanzas`, constante en `app-paths.ts`), para que atrás y recargar la conserven.
- **Qué cuenta:**
  - Las cuentas que el usuario ve: compartidas y sus privadas, sin importar "incluir en el total".
  - Las archivadas, fuera.
  - Las deudas restan: su saldo guardado ya es negativo, y se muestran en positivo como "lo que debes".
  - Los bienes (grupo `assets`), fuera: con su valor manual llegan en la F2.
- **Tasa faltante:** esa moneda no suma en el consolidado, y la pantalla lo avisa con `cc-missing-rates-notice`. Los totales por moneda sí se muestran.

**SQL** (en la misma migración `report_totals`)

```sql
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
```

- **pgTAP** (en `report_totals.test.sql`):
  - El dueño ve su cuenta privada en su patrimonio; otro miembro no.
  - Las archivadas y los bienes no entran, y sí entran las cuentas con "incluir en el total" apagado.
  - Las deudas restan.
  - La conversión usa la tasa de `on_date`, y sin tasa `converted` es null.
  - Quien no es miembro no recibe filas.
  - `privileges.test.sql`: la función nueva.
- **Frontend:**
  - `domain/accounts/net-worth.ts` (+ spec): `netWorth(rows)` devuelve, por moneda y consolidado, los activos (Cuentas + Ahorros + Me deben), las deudas (en positivo) y el neto, más las monedas sin tasa.
  - `NetWorthApi` y `NetWorthService` (`core/accounts`): la tasa de `periods.today()` y la `revision` de transacciones, cuentas y tasas.
  - El organismo `cc-net-worth` va al catálogo:
    - Arriba, el neto consolidado con `cc-stat-group` (Activos, Deudas y Neto).
    - Debajo, una fila por grupo, con su total por moneda y el consolidado.
    - Y un bloque "Por moneda" cuando hay más de una.
  - `accounts-page` agrega las pestañas y el aviso de tasa faltante.
- **e2e:**
  - Mock de `rpc/net_worth`.
  - En `e2e/accounts.e2e.ts` (o uno nuevo): la pestaña con activos, deudas y neto, una cuenta en USD con y sin tasa, y que el query param se conserve al recargar.
  - Screenshot `cuentas-mis-finanzas`.
- **Spec:** la decisión (pestaña de Cuentas) y sus reglas ya quedaron en §7 Cuentas desde la parte 1. La parte 2 agrega `net_worth` a §8, la nota de los bienes en §6 y la decisión en §12.

## 2.4 Nuevo movimiento y registro rápido

Como en 1Money (capturas de transacciones y categorías). Aplica al crear y al editar, desde cualquier pantalla.

**"¿Qué vas a registrar?"** ("+" y atajo `N`):

- `cc-entry-chooser` (organismo) y su overlay `cc-entry-chooser-sheet` reemplazan el `cc-option-panel` de `QuickEntryFlow.chooseNew()`.
- Tres pestañas (`cc-tabs` con ícono): Ingreso, Gasto y Transferencia. Abre siempre en Gasto.
- **Gasto e Ingreso:** la cuadrícula de categorías de ese tipo, con lo registrado en el periodo debajo de cada ícono, en su color.
  - `cc-category-grid` gana `donut` (por defecto true) y `cc-category-bubble` gana `amountColor: 'neutral' | 'category'`.
  - Las cifras salen de `TotalsService.find` (alcance Espacio, como Categorías).
- **Transferencia:** las cuentas en que se puede escribir, por grupo (Cuentas, Ahorros, Deudas, Me deben), con el total del grupo y el saldo de cada una.
  - `cc-account-list` y `cc-account-row` ganan `actionable` y `(opened)`.
  - Tocar una cuenta abre el registro rápido de transferencia desde esa cuenta (`transferSession(id)`).
- En expandida, Transacciones lo abre como diálogo y el registro rápido sigue en el panel.

**Registro rápido** (`cc-quick-entry`, en sus tres layouts: sheet, diálogo y panel):

- **Arriba, dos bloques** (`cc-entry-endpoints`, molécula), cada uno con su color y su ícono (contrastado con `paletteForeground`):
  - gastos: "De cuenta → A categoría";
  - ingresos: "De categoría → A cuenta";
  - transferencias: "De cuenta → A cuenta";
  - ajustes: un solo bloque, Cuenta, más "Sube/Baja" como hoy.
  - "Sale" y "Llega" de las transferencias entre monedas no cambian.
- **Selector dentro del mismo overlay:** tocar un bloque abre el selector como vista, con ←:
  - las cuentas por grupo con su saldo (la misma lista del "¿Qué vas a registrar?");
  - o las categorías del mismo tipo (la grilla sin donut). Elegir otra categoría reinicia la subcategoría y, al crear, las etiquetas siguen a la nueva.
- **Subcategorías:** chips con ícono en una fila desplazable (`.cc-chip-row`). La elegida va rellena con el color de la categoría.
  - `ChipOption` gana `icon`, y `cc-chip-choice` rellena la elegida con su `color`.
- **Monto:** grande, en el color de la categoría y con contraste AA.
  - `cc-amount-display` gana `color` y tamaño grande.
  - El texto usa `paletteTextColor(key)` (`color-palette.ts`, nuevo): la misma clave o, si no llega a 4,5:1 sobre la superficie, su `-deep` o `-dark`, en claro y en oscuro. Una prueba unitaria lo verifica para cada color, como la de `readableForeground`. Las cifras de las burbujas del selector usan el mismo helper.
- **Nota:** visible, como `cc-text-field` ("Notas…"), sin abrir nada.
- **Etiquetas, cuotas e "incluir en el espacio":** siguen donde están. La disclosure queda solo para las etiquetas.
- **Fecha:** una línea, "Hoy, 27 nov" (`entryDateText(date, today)`, con prueba).
  - Tocarla abre una vista (`cc-date-choice`, molécula) con Hoy, Ayer y Elegir día (`cc-date-field`, el calendario nativo).
  - Periodicidad y recordatorio llegan con los recurrentes (F3): no se muestran.
- **Al crear:** el teclado sigue visible como hoy.
- **Al editar:**
  - en el sheet, el teclado aparece al tocar el monto; en el diálogo y el panel hay espacio y se ve siempre (y el teclado físico escribe ahí);
  - abajo van las acciones Borrar, Fecha y Duplicar;
  - **Borrar** confirma en una vista del mismo overlay y, al confirmar, borra y cierra. Hoy el sheet se cierra y abre otra confirmación; `QuickEntryFlow.finish('delete')` deja de preguntar.
  - **Duplicar** (`closed('duplicate')` → `duplicateSession(tx)`) abre un movimiento nuevo con los datos guardados del original, un id nuevo y la fecha de hoy. Si hay cambios sin guardar, primero pregunta "¿Descartar los cambios?".
- **✕ y ✓ flotantes (§13.5):**
  - La ✕ flota arriba a la derecha; el título queda solo como nombre accesible.
  - El ✓ es la tecla del teclado mientras el teclado se ve; sin teclado (al editar), es el ✓ flotante. Así nunca hay dos ✓.
  - El pie con Cancelar y Guardar del diálogo desaparece.
- **Vistas** (selector de cuenta o categoría, fecha, borrar y descartar), con el patrón de `cc-budget-detail-sheet`:
  - Cada vista lleva ← ("Volver"). Esc y el atrás del sistema (Android o navegador) vuelven a la vista anterior sin cerrar.
  - Al volver, el formulario conserva su scroll y el foco vuelve al control que abrió la vista.
  - Los helpers de scroll y foco (`scrollPositions`, `activeElementIn`, `focusHeading`) salen de `budget-detail-sheet` a un archivo compartido.
  - `cc-quick-entry` inyecta `OverlayHandle` opcional: en el panel de Transacciones las vistas funcionan igual, sin entrada de historial, y Esc vuelve.
- **Descartar cambios:** `OverlayService` gana una guarda de cierre (`OverlayHandle.guardClose`) para la ✕, el fondo, Esc y el atrás.
  - Con cambios sin guardar, en vez de cerrar, el registro rápido muestra la vista "¿Descartar los cambios?".
  - Hoy esos cierres descartan sin preguntar; solo el panel preguntaba.
- **Diálogo y panel:** los bloques van arriba, a todo el ancho. Debajo, dos columnas: el monto y el teclado a la izquierda; las subcategorías, la nota, la fecha y los detalles a la derecha. Una vista ocupa todo el contenido.
- **Teclado físico:** igual que hoy (dígitos, operadores, Enter, Ctrl/⌘+S). Esc vuelve de una vista o cierra con la guarda.
- **Modelo:**
  - `QuickEntryAccount` gana `icon`, `color`, `balance` y el grupo como clave (`AccountGroup`).
  - `QuickEntryCategory` gana `icon` y `color`.
  - `QuickEntryData` gana `categories` (las del mismo tipo, para la vista).
  - `QuickEntryResult` gana `'duplicate'`.
- **e2e:**
  - Se ajustan `transactions.e2e.ts` (la cuenta y "Hacia" se eligen con el bloque y su vista; "Eliminar" pasa a "Borrar"), `transactions-page.e2e.ts` y los demos del registro rápido en `/ui`.
  - Se suman:
    - "¿Qué vas a registrar?" con sus tres pestañas, y una transferencia desde la lista;
    - la vista de fecha;
    - al editar, el teclado oculto hasta tocar el monto;
    - Duplicar;
    - descartar con la ✕ y cambios sin guardar;
    - el atrás del sistema desde una vista (`page.goBack()`).
  - Screenshots `nuevo-movimiento` (cada pestaña), `registro-rapido-gasto`, `registro-rapido-cuenta`, `registro-rapido-fecha` y `registro-rapido-editar`.

## 2.5 Transacciones

Comparada con la captura de 1Money: se cierran las diferencias que encajan con el sistema de diseño.

- **Encabezado de cada día:** el título de siempre ("Hoy", "Jueves 26 nov") y, a la derecha, el neto del día (ingresos − gastos), con signo y el color de su signo.
  - Sigue las reglas de `transaction_totals` (lo filtrado; sin filtro de estado, solo lo confirmado).
  - Sale de `transaction_day_totals`, así que no depende de cuánto de la lista se haya cargado.
  - `TransactionListGroup` gana `total` opcional; el detalle de cuenta no lo usa.
- **Filas:**
  - El título pasa a "Categoría (Subcategoría)", en lugar de "Padre › Hija".
  - La segunda línea, la cuenta con su ícono, más las etiquetas y las cuotas. La tercera, la nota.
  - El monto va con el color del tipo: `tone` por ítem, `auto` en gastos e ingresos (que ya van con signo) y `neutral` en transferencias y ajustes.
  - Las transferencias siguen como "Efectivo → Nequi", y el candado sigue.
- **Saldo inicial y saldo final** (`cc-stat-group variant="tiles"`, arriba de los totales):
  - **Fechas** (`balanceDates(range, today)`, `domain/transactions`, con prueba):
    - el inicial es el saldo al cierre del día anterior al periodo;
    - el final, al cierre del periodo, o de hoy si está en curso;
    - en Siempre solo hay saldo final.
  - **Cuentas:** las del total del encabezado (incluidas en el total) o, con filtro de cuenta, esas cuentas.
  - **Cuándo no se muestran** (`showsBalances(filters, search)`, con prueba): con búsqueda o con filtros de otro tipo (categoría, etiqueta, tipo, persona o estado), porque un saldo no aplica.
  - Salen de `TotalsApi.accountsBalance(space, date, accountIds)`, con dos llamadas. Las monedas sin tasa se suman al aviso.
- **e2e:**
  - El mock agrega `rpc/transaction_day_totals` y `rpc/accounts_balance`.
  - En `transactions-page.e2e.ts`: el total de cada día, el formato de las filas, los saldos sin filtro y con filtro de cuenta (revisa las fechas en `rpcCalls('accounts_balance')`) y que no aparezcan con un filtro de categoría.
  - Screenshot `transacciones` actualizado.

## 2.6 Sheets

- **Regla nueva en §13.5:** en compacta, los overlays salen desde abajo con el alto de su contenido y la pantalla de fondo visible. Solo pasan a pantalla completa (el máximo, con scroll interno) cuando el contenido es largo.
- **Hoy ya se cumple:** no hay opción de alto completo, y el máximo es `--cc-picker-panel-max-height` (88 dvh; 92 dvh en el registro rápido, el detalle de presupuesto y la calculadora).
- Se aplica a lo nuevo ("¿Qué vas a registrar?" y las vistas del registro rápido) y se revisa con los screenshots que ningún overlay existente fuerce más alto.

## Layouts · Parte 2

**Resumen · móvil**

```
┌──────────────────────────────────┐
│             Resumen              │
│        Balance                   │
│      +$ 2.100.000          ( 34 %)│  anillo: tasa de ahorro
│ ┌───────────────┐┌───────────────┐│
│ │▓▓▓ Gastos ▓▓▓▓││   Ingresos    ││  la elegida va rellena
│ │▓ −$ 4.100.000▓││ +$ 6.200.000  ││
│ │▓▼ 9 % vs. 28 sep – 26 oct ▓▓▓▓││ ▲ 4 % vs. 28 sep – 26 oct
│ └───────────────┘└───────────────┘│
│  █ ▅   ▇     ▃ █  ▂   ▆   ┊ $ 2M │  top 3 con su color, el resto gris;
│  █ █   █     █ █  █   █   ┊ $ 1M │  eje de montos a la derecha
│ ─┴─┴───┴─────┴─┴──┴───┴───┴──────│
│ 28 oct  4 nov  11 nov  18 nov 27 nov
│ [Día (prom.)][Semana (prom.)][Mes]│
│ [ $ 136.000 ][  $ 957.000   ][$4,1M]
│ (🛒) Mercado          $ 1.558.000│
│      ▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░  38 % │
│ (🏠) Hogar            $ 1.025.000│
│      ▓▓▓▓▓▓░░░░░░░░░░░░░░░  25 % │
│ (🚗) Transporte         $ 600.000│
│ (⌄)  Más…               $ 917.000│  gris; despliega el resto
│ Presupuesto                      │
│ ▒▒▒▒▒▒▒▒▒▒▒▒▒░░░ Gastos ($ 850k) │  cc-budget-row, abre Presupuesto
│ ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒ Ingresos ($ 2M) │
│ [Etiqueta | Cuenta | Persona]    │
│ Fijos           41 %  $ 1.681.000│
└──────────────────────────────────┘
Tocar Mercado → despliega Supermercado, Plaza y General; tocar una → Transacciones filtrado.
```

**Resumen · escritorio** (dos columnas)

```
┌──────┬──────────────────────────────────────┬───────────────────────────────────┐
│ rail │ Resumen                              │                                   │
│      │ Balance +$ 2.100.000         ( 34 %) │ (🛒) Mercado  ▓▓▓▓▓▓▓░░  $ 1.558k │
│      │ [▓ Gastos −$ 4,1M ▓][ Ingresos +$6,2M]│ (🏠) Hogar    ▓▓▓▓░░░░░  $ 1.025k │
│      │  ▼ 9 % vs. …         ▲ 4 % vs. …     │ (🚗) Transp.  ▓▓░░░░░░░    $ 600k │
│      │  █ ▅   ▇   ▃ █  ▂   ▆  ▅ ▇  ┊ $ 2M   │ (⌄)  Más…    ▓▓▓░░░░░░    $ 917k │
│      │ ─┴─┴───┴───┴─┴──┴───┴──┴─┴──┴──────  │ Presupuesto                       │
│      │ [Día (prom.)][Semana (prom.)][Mes]   │ ▒▒▒▒▒▒▒▒░░ Gastos     ($ 850k)    │
│      │                                      │ ▒▒▒▒▒▒▒▒▒▒ Ingresos   ($ 2M)      │
│      │                                      │ [Etiqueta | Cuenta | Persona]     │
│      │                                      │ Fijos       41 %      $ 1.681k    │
└──────┴──────────────────────────────────────┴───────────────────────────────────┘
Mediana: una columna, como en móvil.
```

**"¿Qué vas a registrar?" · móvil** (sheet con el alto de su contenido)

```
┌──────────────────────────────────┐
│  (↑) Ingreso  (↓) Gasto  (⇄) Transf.
│               ‾‾‾‾‾‾‾            │  abre en Gasto
│ Mercado  Hogar   Transp.  Salud  │
│  (🛒)     (🏠)    (🚗)     (💊)  │
│ $ 1,5M   $ 1M    $ 600k   $ 80k  │  en el color de cada categoría (AA)
│ Ocio     Compras  …              │
└──────────────────────────────────┘
Transferencia: Cuentas $ 4.250.000 / (💵) Efectivo $ 350.000 / (🏦) Bancolombia … / Ahorros …
```

**Registro rápido · móvil** (crear un gasto)

```
┌──────────────────────────────────┐
│▓▓ De cuenta ▓▓▓▓▓│▒▒ A categoría ✕│  bloques con el color de cada uno
│▓▓ (💵) Efectivo ▓│▒▒ (🛒) Mercado ▒│
│ ((Supermercado)) (Plaza) (Tienda) →  la elegida, rellena
│              Gasto               │
│           $ 25.000               │  grande, en el color de la categoría
│ ┌──────────────────────────────┐ │
│ │ Notas…                       │ │
│ └──────────────────────────────┘ │
│ Hoy, 27 nov                    › │  abre Hoy / Ayer / Elegir día
│ ▸ Etiquetas · Fijos              │
│  ÷   7   8   9   ⌫               │
│  ×   4   5   6  000              │
│  −   1   2   3   ✓               │
│  +   0   0   ,   ✓               │
└──────────────────────────────────┘
Editar: sin teclado hasta tocar el monto; abajo [🗑 Borrar] [📅 Fecha] [⧉ Duplicar] y el ✓ flotante.
Tocar un bloque → vista con ← (cuentas por grupo con saldo, o categorías del mismo tipo).
```

**Cuentas · Mis finanzas · móvil**

```
┌──────────────────────────────────┐
│             Cuentas            ＋ │
│ [  Cuentas  |  Mis finanzas  ]   │
│ Activos       $ 52.300.000       │
│ Deudas        $ 31.800.000       │
│ Neto          $ 20.500.000       │
│ Activos                          │
│ (💳) Cuentas      $ 4.250.000    │
│ (🐷) Ahorros     $ 46.050.000    │
│                  US$ 1.200 ≈ $ 5.040.000
│ (🤝) Me deben     $ 2.000.000    │
│ Deudas                           │
│ (🏦) Deudas      $ 31.800.000    │
│ Por moneda                       │
│ COP   neto $ 15.460.000          │
│ USD   neto US$ 1.200             │
└──────────────────────────────────┘
```

**Cuentas · Mis finanzas · escritorio**

```
┌──────┬──────────────────────────────────────┬──────────────────────────────────┐
│ rail │ Cuentas                            ＋ │                                  │
│      │ [ Cuentas | Mis finanzas ]           │  (detalle de la cuenta elegida,  │
│      │ Activos $ 52,3M │ Deudas $ 31,8M │    │   o "Elige una cuenta")          │
│      │ Neto $ 20,5M                         │                                  │
│      │ Activos · Cuentas · Ahorros · Me deben│                                  │
│      │ Deudas                               │                                  │
│      │ Por moneda                           │                                  │
└──────┴──────────────────────────────────────┴──────────────────────────────────┘
```

## Spec, catálogo y commits · Parte 2

- **Spec** (v0.11, antes del código):
  - §2: gráficas (sin donut en el Resumen; `ngx-echarts` 22 y `echarts` 6).
  - §6: "Por categoría" con barras y lista, promedios, comparación y la nota de los bienes.
  - §7: Resumen, "¿Qué vas a registrar?", registro rápido y Transacciones.
  - §8: las RPCs nuevas y la conversión por movimiento.
  - §12: las decisiones de la F1e2.
  - §13.1: los componentes nuevos.
  - §13.5: la regla de los sheets, y las vistas y la guarda de descarte del registro rápido.
- **Catálogo `/ui`:** `cc-progress-ring`, `cc-total-toggle`, `cc-stat-group` (`tiles`), `cc-bar-chart`, `cc-breakdown-list`, `cc-entry-endpoints`, `cc-date-choice`, `cc-entry-chooser`, `cc-net-worth`, y las variantes nuevas de burbuja, grilla, chips, `cc-amount-display`, lista de cuentas y lista de movimientos.
- **Commits:**
  1. `docs: plan de la F1e2`.
  2. `docs(spec): decisiones de la F1e2`.
  3. `feat(db): report_totals` (migración, pgTAP y tipos).
  4. `feat(summary): resumen, comparación y gráfico`.
  5. `feat(accounts): mis finanzas`.
  6. `feat(quick-entry): nuevo movimiento y registro rápido`.
  7. `feat(transactions): totales por día, filas y saldos`.

## Verificación y entrega · Parte 2

- **Al escribir la migración:** `npm run db:reset` y `npm run db:test`, y después `npm run supabase:types`.
- **Al final, una vez:** `npm run lint`, `npm test`, `npm run build`, `npm run e2e` (los 4 proyectos) y `npm run db:test`.
- **Revisión visual:** los screenshots de móvil y escritorio, en claro y oscuro, junto a las capturas de referencia. Las capturas nunca se copian al repo, ni a e2e ni a docs.
- **Build:** en su salida, `echarts` no aparece en los chunks iniciales.
- **PR:** contra `main`, sin merge. Nada en producción: la migración `report_totals` la aplica el usuario después.

---

## Archivos clave

- **BD:**
  - `supabase/migrations/20261127020638_transactions.sql`: `category_totals`, `convert_minor` y la RLS.
  - `supabase/tests/database/transaction_totals.test.sql`: el patrón de pgTAP.
  - `supabase/tests/database/privileges.test.sql`.
- **Transacciones:**
  - `src/app/features/transactions/quick-entry-flow.ts`.
  - `src/app/shared/ui/organisms/quick-entry-sheet/`.
  - `src/app/features/accounts/account-detail/account-detail-page.ts`: el patrón de lista, `toItem` y `describe`.
  - `src/app/core/transactions/transactions.api.ts`.
  - `src/app/shared/ui/organisms/transaction-list/`.
  - `src/app/shared/ui/templates/list-detail-layout/`.
- **Presupuesto:**
  - `src/app/core/budgets/budgets.service.ts`.
  - `src/app/features/budget/monthly-amounts.ts`.
  - `src/app/shared/ui/organisms/budget-list/`.
  - `src/app/core/totals/totals.service.ts`.
  - `src/app/features/categories/categories-page.*`: el aviso de tasa y `budgets_enabled`.
- **Configuración:**
  - `src/app/features/settings/settings-page.*`.
  - `src/app/core/spaces/space.service.ts`: `saveActivePreferences` y `updateActiveSettings`.
  - `src/app/core/user-settings/`.
  - `src/app/app.routes.ts`.
  - `src/app/core/routing/app-paths.ts`.
- **PWA:**
  - `src/app/app.config.ts`.
  - `src/app/shared/ui/services/toast.service.ts`.
- **e2e:**
  - `e2e/support/supabase.ts`.
  - `e2e/support/catalog-fixture.ts`: `HOUSEHOLD_WITH_MOVEMENTS`.
  - `e2e/transactions.e2e.ts`: el patrón.
- **Parte 2:**
  - `supabase/migrations/20261127135513_search_and_subcategory_budgets.sql`: `category_totals`, `search_transactions` y `transaction_totals`, que se reemplazan.
  - `src/app/features/summary/` (hoy solo el encabezado) y su ruta en `src/app/app.routes.ts`.
  - `src/app/domain/periods/periods.ts` y `period-labels.ts`: `shiftPeriod`, `periodRange` y `rangeText`.
  - `src/app/core/totals/`: `TotalsApi` y `TotalsService`.
  - `src/app/features/budget/budget-page.ts`: `sumBudgets` y `viewTransactions`.
  - `src/app/shared/ui/organisms/quick-entry/` y `quick-entry-sheet/`, y `src/app/features/transactions/quick-entry-flow.ts`.
  - `src/app/shared/ui/organisms/budget-detail-sheet/`: el patrón de vistas.
  - `src/app/shared/ui/services/overlay.service.ts` y `molecules/overlay-panel/`.
  - `src/app/shared/ui/colors/color-palette.ts` y `src/app/domain/color/contrast.ts`.
  - `src/app/features/transactions/transaction-items.ts` y `shared/ui/organisms/transaction-list/`.
