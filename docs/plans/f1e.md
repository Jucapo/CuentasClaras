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
  - Si falta una tasa, el aviso de siempre.
- **Crear desde Transacciones (§7):**
  - "+" (atajo `N`) abre "¿Qué vas a registrar?": Transferencia y las categorías agrupadas en Gastos e Ingresos.
  - Después abre el registro rápido: en el panel en expandida, y como overlay en compacta y mediana.
- **Presupuesto:**
  - **Mes:** editable desde ese mes (vigencia = el mes que nombra el periodo).
    - En el mes actual (o uno futuro), la nota dice "Los cambios rigen desde {mes}".
    - En un mes pasado, la nota lo dice explícito: "Rige desde octubre: también cambia noviembre y diciembre". Nombra los meses siguientes hasta el actual.
    - Si una categoría tiene monto propio en alguno de esos meses, su fila lo aclara en el hint, porque ese mes y los que le siguen no cambian: "Solo cambia octubre: noviembre tiene monto propio", o "También cambia noviembre; diciembre tiene monto propio".
  - **Año:** suma los 12 meses, solo lectura, con la nota "Para cambiar montos, elige un mes".
  - **Día, Semana, Siempre y Rango:** un aviso y "Ver este mes".
  - **Todas las categorías:** se muestran las principales activas en su orden. Las que no tienen presupuesto muestran solo lo gastado y el campo vacío ("Sin presupuesto").
  - **Total de arriba:** presupuesto total contra todo lo gastado del periodo, con la línea "Sin presupuesto: $X" cuando hay gasto en categorías sin monto.
  - **Excedido:** barra y texto en color de error, con ícono de advertencia y "Te pasaste por $X".
  - **Ingresos esperados:** "Recibido $X · Faltan $Y". Si se superan, "Recibiste $Z de más", en tono positivo y no de error.
  - **`budgets_enabled` apagado:** el destino sigue en la navegación y muestra "Los presupuestos están apagados". El propietario ve un interruptor para encenderlos; los demás ven el texto.
  - **Lector:** ve los montos sin poder editarlos.
- **Aviso de nueva versión:**
  - Toast persistente "Nueva versión disponible" con "Recargar", que llama a `activateUpdate()` y recarga.
  - Se revisa al volver a la app (`visibilitychange`) y cada `APP_UPDATE_CHECK_INTERVAL_MS`.
  - Si el SW queda irrecuperable, avisa y recarga.
  - Si otro toast lo reemplaza, no se repite: la versión nueva entra igual en la próxima carga.
- **Sin RPC nueva para Presupuesto:** `category_totals` ya da gastado, presupuesto (convertido) y restante por categoría de gasto y de ingreso.

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
```

**pgTAP**

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

- `cc-filter-chips` (molécula, `MatChipsModule`):
  - Inputs: `filters: FilterChip[]` (`{ key, label, summary: string | null }`) y `label`.
  - Outputs: `opened(key)` y `cleared(key)`.
  - Una fila con scroll, en orden fijo. Los activos muestran el resumen y ✕, y con dos o más activos aparece "Limpiar".
- `cc-stat-group` (molécula): `items: StatItem[]` (`{ label, amount, currency, tone?, signed?, note? }`) en fila. La parte 2 lo reutiliza.
- `cc-transaction-list` (extender):
  - Input `selectedId` (va a `cc-list-item [selected]`).
  - En el ítem, `private?: boolean` (candado `lock` con nombre accesible "Cuenta privada") y `signed?: boolean`, que por defecto es true.
- `cc-missing-rates-notice` (organismo): el aviso de Categorías (`cc-section` highlight + "Agregar tasa"), extraído para usarlo en Categorías, Transacciones y Presupuesto.

## 1.3 Presupuesto

- **`BudgetsService`:**
  - `amountFor(categoryId, month = currentMonth())` y `setMonthly(categoryId, amount, currency, month = currentMonth())`.
  - Expone `revision`. `TotalsService` lo agrega a los parámetros de su recurso, para que la barra se actualice al editar (hoy no se recarga).
- **`domain/budgets/budgets.ts`** (+ spec):
  - `followingMonths(month, untilMonth)`: los meses después de `month` hasta `untilMonth`, inclusive.
  - `inheritingMonths(entries, categoryId, month, untilMonth)`: los meses siguientes que heredan el monto de `month`. Se corta en el primero con monto propio de esa categoría.
  - Los textos de la nota y del hint salen de las dos funciones, en `features/budget/budget-texts.ts`, con los nombres de mes de `period-labels`.
- **`MonthlyAmounts`:** `entries(kind, month?)` y `save(change, month?)`. Agrega `progressEntries(kind, totals)`: cada categoría principal activa con su monto en vigor (en su moneda, para editar) y `{ spent, budget }` convertidos, de `category_totals`.
- **`budget-page`:**
  - Arriba, el total con `cc-budget-progress emphasis="summary"`.
  - La sección "Gastos": `cc-budget-list` con `progress`, la nota de vigencia (actual o pasada, ver Decisiones) y el hint por fila de los meses con monto propio (`hint` en `BudgetListEntry`, que pasa al `cc-money-row`).
  - La sección "Ingresos esperados": `cc-budget-list` de clase ingreso.
  - El aviso de tasa faltante, y los estados de periodo, `budgets_enabled` y lector descritos en Decisiones.
  - Ruta con `canDeactivate: [pendingSavesGuard]`. Enter pasa a la fila siguiente; ya lo hace `cc-budget-list`.
- **UI:**
  - `cc-progress-bar` (átomo nuevo):
    - `value` (0…1+, se recorta en 1) y `tone` (`primary` | `error` | `positive`).
    - `role="progressbar"` con `aria-valuenow`.
    - Token nuevo `--cc-progress-height`.
  - `cc-budget-progress` (molécula nueva):
    - Inputs: `spent`, `budget`, `currency`, `kind`, y `emphasis` (`row` | `summary`).
    - La barra y los textos de las Decisiones, con `UI_TEXT` (reutiliza `overBudget` y `remaining`).
  - `cc-budget-list` (extender):
    - En la entrada, `progress?: { spent; budget; currency; kind }`, que dibuja `cc-budget-progress` bajo la fila.
    - Input `readonly`, que deshabilita los `cc-money-row`.
    - El asistente queda igual, porque no pasa `progress`.

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
    - `e2e/budget.e2e.ts`: barras y excedido, editar un monto y pasar con Enter (revisa `budgets` en `writes()`), la nota de un mes pasado, Año en solo lectura y presupuestos apagados.
    - `settings`: pantalla de inicio (abrir `/` lleva a ella), periodo por defecto, interruptor de presupuesto y nombre visible.
  - **Screenshots:** `transacciones`, `transacciones-filtros`, `transacciones-editar`, `presupuesto`, `presupuesto-mes-pasado`, `presupuesto-anual`, `presupuesto-apagado`, `configuracion` y los del catálogo `/ui`.

## 1.7 Commits

1. `docs: plan de la F1e` (este archivo).
2. `docs(spec): decisiones de la F1e1`.
3. `feat(db): búsqueda de movimientos y totales filtrados` (migración, pgTAP y tipos).
4. `refactor(ui): registro rápido en línea y sesiones del flujo`.
5. `feat(ui): chips de filtro, grupo de cifras, barra de progreso y avance del presupuesto` (con el catálogo).
6. `feat(transactions): lista, búsqueda, filtros, totales y edición en el panel`.
7. `feat(budget): presupuesto por periodo con avance e ingresos esperados`.
8. `feat(settings): perfil, pantalla de inicio, periodo por defecto y presupuestos`.
9. `feat(pwa): aviso de nueva versión`.
10. `test(e2e): transacciones, presupuesto y configuración`.

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

**Presupuesto · móvil**

```
┌──────────────────────────────────┐
│           Presupuesto            │
│ ┌──────────────────────────────┐ │
│ │ Quedan $ 850.000             │ │
│ │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░          │ │
│ │ Gastado $ 3.150.000 de $ 4.000.000
│ │ Sin presupuesto: $ 120.000   │ │
│ └──────────────────────────────┘ │
│ Gastos · los cambios rigen desde Diciembre
│ (🛒) Mercado          $ 800.000  │  ← monto editable en la fila
│      ▓▓▓▓▓▓▓▓▓▓▓░░░░             │
│      Gastado $ 650.000 · Quedan $ 150.000
│ (🏠) Hogar ⚠        $ 1.500.000  │
│      ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ (error)     │
│      Te pasaste por $ 200.000    │
│ (🎁) Regalos      Sin presupuesto │
│      Gastado $ 120.000           │
│ Ingresos esperados               │
│ (💼) Salario        $ 6.000.000  │
│      ▓▓▓▓▓▓▓▓▓░░░░               │
│      Recibido $ 4.000.000 · Faltan $ 2.000.000
└──────────────────────────────────┘
```

**Presupuesto · escritorio**

```
┌──────┬─────────────────────────────────────────────────────────────────────────┐
│ rail │                              Presupuesto                                 │
│      │ ┌─────────────────────────────────────────────────────────────────────┐ │
│      │ │ Quedan $ 850.000   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░   Gastado $ 3.150.000 de $ 4M │ │
│      │ └─────────────────────────────────────────────────────────────────────┘ │
│      │ Gastos                              │ Ingresos esperados                 │
│      │ (🛒) Mercado          $ 800.000     │ (💼) Salario        $ 6.000.000    │
│      │      ▓▓▓▓▓▓▓▓▓▓░░░  Quedan $ 150k   │      ▓▓▓▓▓▓▓▓░░░  Faltan $ 2M      │
│      │ (🏠) Hogar ⚠        $ 1.500.000     │ (🧾) Independiente  $ 1.000.000    │
│      │      ▓▓▓▓▓▓▓▓▓▓▓▓▓  Te pasaste…     │      ▓▓▓▓▓▓▓▓▓▓▓▓  Recibiste de más│
└──────┴─────────────────────────────────────┴────────────────────────────────────┘
Mediana: una columna centrada, igual que en móvil.
Mes pasado: la nota cambia a "Rige desde octubre: también cambia noviembre y diciembre", y la fila
con monto propio en un mes siguiente lo aclara en su hint.
```

## Verificación y entrega · Parte 1

- **Al escribir la migración:** `npm run db:reset` y `npm run db:test`, y después `npm run supabase:types`.
- **Antes del PR, la suite completa:** `npm run lint`, `npm test`, `npm run build`, `npm run e2e` (los 4 proyectos) y `npm run db:test`.
- **Revisión visual:** los screenshots de `e2e/screenshots/{mobile,desktop}-{light,dark}`.
- **PR:** contra `main`, sin merge, con los screenshots descritos. Nada en producción: ni `db push` ni backups.

---

# Parte 2 · Resumen, reportes y Mis finanzas

Rama `feat/f1e2-summary` desde `main`, cuando el PR de la parte 1 esté mergeado; si no, desde `feat/f1e1-transactions-budget`. Reutiliza `cc-stat-group`, `cc-progress-bar`, `cc-missing-rates-notice`, `cc-donut`, `cc-tabs` y `cc-segmented-control`.

Incluye "Mis finanzas" (el patrimonio, §6), descrito en 2.3.

## 2.1 Base de datos

Migración `report_totals`. El alcance es Espacio, igual que `category_totals`, que no se toca.

```sql
-- F1e · Resumen: totales por día y por categoría, y desgloses por etiqueta, cuenta y persona,
-- alcance Espacio (§6).

create type public.report_dimension as enum ('tag', 'account', 'member');

-- Movimientos que cuentan en el alcance Espacio: confirmados, de gasto o ingreso, de cuentas
-- compartidas o incluidos en el espacio, entre dos fechas (null = sin límite). Security invoker: las
-- cuentas privadas de otros no se ven, así que solo entran sus movimientos incluidos.
create function private.space_movements(target_space_id uuid, from_date date, to_date date)
returns table (
  id uuid,
  kind public.category_kind,
  date date,
  amount bigint,
  currency text,
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
    t.id, c.kind, t.date, t.amount, t.currency, t.category_id,
    coalesce(c.parent_id, c.id), t.account_id, a.id is not null, t.created_by
  from public.transactions t
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
  with settings as (
    select s.main_currency from public.space_settings s where s.space_id = target_space_id
  ),
  grouped as (
    select m.date, m.top_category_id, m.kind, m.currency, sum(m.amount)::bigint as amount
    from private.space_movements(target_space_id, from_date, to_date) m
    group by m.date, m.top_category_id, m.kind, m.currency
  ),
  converted as (
    select
      g.date, g.top_category_id, g.kind, g.currency,
      private.convert_minor(g.amount, g.currency, st.main_currency, target_space_id, g.date)
        as amount
    from grouped g
    cross join settings st
  )
  select
    cv.date,
    cv.top_category_id,
    cv.kind,
    coalesce(sum(cv.amount), 0)::bigint,
    coalesce(
      array_agg(distinct cv.currency order by cv.currency) filter (where cv.amount is null),
      '{}'
    )
  from converted cv
  group by cv.date, cv.top_category_id, cv.kind
  order by cv.date, cv.top_category_id;
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
  with settings as (
    select s.main_currency from public.space_settings s where s.space_id = target_space_id
  ),
  keyed as (
    select
      case dimension
        when 'account' then case when m.account_visible then m.account_id end
        when 'member' then m.created_by
        else tt.tag_id
      end as key,
      m.kind, m.date, m.currency, m.amount
    from private.space_movements(target_space_id, from_date, to_date) m
    left join public.transaction_tags tt on dimension = 'tag' and tt.transaction_id = m.id
  ),
  grouped as (
    select k.key, k.kind, k.currency, k.date, sum(k.amount)::bigint as amount, count(*) as movements
    from keyed k
    group by k.key, k.kind, k.currency, k.date
  ),
  converted as (
    select
      g.key, g.kind, g.currency, g.movements,
      private.convert_minor(g.amount, g.currency, st.main_currency, target_space_id, g.date)
        as amount
    from grouped g
    cross join settings st
  )
  select
    cv.key,
    cv.kind,
    coalesce(sum(cv.amount), 0)::bigint,
    sum(cv.movements)::integer,
    coalesce(
      array_agg(distinct cv.currency order by cv.currency) filter (where cv.amount is null),
      '{}'
    )
  from converted cv
  group by cv.key, cv.kind;
$$;
revoke all on function public.breakdown_totals(uuid, date, date, public.report_dimension)
  from public, anon;
grant execute on function public.breakdown_totals(uuid, date, date, public.report_dimension)
  to authenticated;
```

- **Sin RPC nueva:**
  - Ingresos, gastos y balance (actual y anterior), el ranking por categoría y el desglose por subcategoría salen de `category_totals`. Se llama dos veces: con el rango del periodo y con el del anterior.
  - Los promedios se calculan en el cliente.
- **pgTAP** (`supabase/tests/database/report_totals.test.sql`, con datos como los de `transaction_totals.test.sql`):
  - **Visibilidad:** lo privado no incluido de otro no cuenta, lo incluido sí, y quien no es miembro no recibe filas.
  - **Conversión:** con la tasa de cada día, y la moneda sin tasa sale en `missing_rate_currencies`.
  - **Por día:** las subcategorías se suman a su principal.
  - **Por etiqueta:** un movimiento con dos etiquetas cuenta en cada una, y los que no tienen etiqueta van con key null.
  - **Por cuenta:** la privada incluida de otro va con key null.
  - **Por persona:** key es quien lo registró.
  - **Pendientes:** no cuentan.
  - **`privileges.test.sql`:** las tres funciones.

## 2.2 Frontend

- **Dominio:** `domain/reports/` con pruebas.
  - `previousPeriod(period, settings)`: usa `shiftPeriod(period, -1)`; Siempre no tiene periodo anterior.
  - `compareTotals(current, previous)`: la diferencia y el % (null si el anterior es 0). El tono sale de la clase: que suban los gastos es malo y que suban los ingresos es bueno.
  - `periodAverages(total, range, today, firstDate)`:
    - Cuenta los días desde el inicio (o el primer movimiento, en Siempre) hasta el fin, o hasta hoy si el periodo está en curso.
    - Por día = total / días. Por semana = × 7. Por mes = × `AVERAGE_MONTH_DAYS` (365,2425 / 12).
    - Se redondea a unidades menores, alejándose de cero.
  - `shareOf(items)`: el % de cada elemento.
  - `chartBuckets(rows, range, settings)`:
    - Rellena con 0 los días sin movimientos.
    - En Año y Siempre agrupa por mes del periodo (`periodMonth`).
    - Más de `CHART_DAILY_MAX_BUCKETS` días también va por mes.
- **Datos:**
  - `ReportsApi` (`core/reports`) con `dailyCategoryTotals` y `breakdownTotals`.
  - `ReportsService`: recursos por periodo y `revision`, más el `category_totals` del periodo anterior.
  - El rango del periodo anterior se agrega en `PeriodService`.
- **`summary-page`:**
  - `cc-stat-group`: ingresos, gastos y balance, con la nota "▲ 12 % vs. Noviembre". En Siempre no hay comparación.
  - `cc-segmented-control` para elegir Gastos o Ingresos.
  - Las barras apiladas.
  - Los promedios en `cc-stat-group`.
  - "Por categoría": `cc-donut` + `cc-breakdown-list` con %. Tocar una categoría la despliega en sus subcategorías.
  - `cc-tabs`: Etiqueta, Cuenta y Persona, cada una con `cc-breakdown-list`. Persona solo aparece con más de un miembro. Un aviso dice que con varias etiquetas el % no suma 100.
  - `cc-missing-rates-notice`.
- **UI nueva** (al catálogo `/ui`):
  - `cc-breakdown-list` (organismo): filas con `cc-icon-badge`, nombre, %, `cc-amount` y `cc-progress-bar`.
  - `cc-bar-chart` (átomo): las barras apiladas.
- **ECharts** en un chunk diferido:
  - `npm i echarts`. `cc-bar-chart` importa solo dentro de un `import()` dinámico: `echarts/core`, `BarChart`, `GridComponent`, `TooltipComponent` y `CanvasRenderer`.
  - La página lo envuelve en `@defer (on viewport)` con un placeholder del mismo alto.
  - `ngx-echarts` solo si tiene versión para Angular 22; si no, se queda el wrapper propio. Se actualiza §2 de la spec con lo elegido.
  - **Tema:** los colores salen de la paleta (`paletteColor`, que es `light-dark()`) y de `--mat-sys-*`. Se resuelven con un elemento sonda: `getComputedStyle(probe).color`.
  - Se redibuja al cambiar el tema o el esquema del sistema, y respeta `prefers-reduced-motion` (sin animación).
  - **Verificar:** en la salida de `npm run build`, `echarts` no aparece en los chunks iniciales.
- **e2e:**
  - El mock agrega `rpc/daily_category_totals` y `rpc/breakdown_totals`.
  - `e2e/summary.e2e.ts`: resumen con comparación, cambio Gastos/Ingresos, el gráfico visible, pestañas de desglose y la llamada con el rango anterior.
  - Screenshots `resumen`, `resumen-ingresos` y `resumen-desglose`.
- **Spec:** §6 y §7 Resumen con las decisiones (alcance Espacio, promedios, barras por mes en Año y Siempre); §8 con las RPCs nuevas; §12.

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
- **Spec:** §7 Cuentas ("Mis finanzas" en la F1e2, las reglas de arriba y Deudas en la F2), §6 Patrimonio (los bienes en la F2), §8 con `net_worth` y §12.

## Layouts · Parte 2

**Resumen · móvil**

```
┌──────────────────────────────────┐
│             Resumen              │
│ Ingresos      +$ 6.200.000       │
│               ▲ 4 % vs. Noviembre│
│ Gastos        −$ 4.100.000       │
│               ▼ 9 % vs. Noviembre│
│ Balance       +$ 2.100.000       │
│ [  Gastos  |  Ingresos  ]        │
│ Por día                          │
│  █ ▅   ▇     ▃ █  ▂   ▆          │  barras apiladas por categoría
│ ─┴─┴───┴─────┴─┴──┴───┴─         │
│ Promedio  día $ 136.000          │
│           semana $ 957.000       │
│           mes $ 4.150.000        │
│ Por categoría                    │
│        ( donut )                 │
│ (🛒) Mercado    38 %  $ 1.558.000│
│      ▓▓▓▓▓▓▓░░░░░                │
│ (🏠) Hogar      25 %  $ 1.025.000│
│ [Etiqueta | Cuenta | Persona]    │
│ Fijos           41 %  $ 1.681.000│
└──────────────────────────────────┘
```

**Resumen · escritorio**

```
┌──────┬──────────────────────────────────────────────────────────────────────────┐
│ rail │                                Resumen                                    │
│      │ Ingresos +$ 6.200.000 ▲4 %  │ Gastos −$ 4.100.000 ▼9 %  │ Balance +$ 2.1M  │
│      │ [ Gastos | Ingresos ]                                                     │
│      │ ┌───────────────────────────────────────────┐ ┌─────────────────────────┐ │
│      │ │ Por día                                   │ │ Por categoría           │ │
│      │ │  █ ▅   ▇     ▃ █  ▂   ▆  ▅ ▇ ▃            │ │       ( donut )         │ │
│      │ │ ─┴─┴───┴─────┴─┴──┴───┴──┴─┴─┴─           │ │ Mercado   38 %  1.558k  │ │
│      │ ├───────────────────────────────────────────┤ │ Hogar     25 %  1.025k  │ │
│      │ │ Promedio: día $136k · semana $957k · mes  │ │ …                       │ │
│      │ └───────────────────────────────────────────┘ ├─────────────────────────┤ │
│      │                                               │ [Etiqueta|Cuenta|Persona]│ │
│      │                                               │ Fijos     41 %  1.681k  │ │
│      │                                               └─────────────────────────┘ │
└──────┴──────────────────────────────────────────────────────────────────────────┘
Mediana: una columna, como en móvil, con las cifras en fila.
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

## Verificación y entrega · Parte 2

Igual que la parte 1, y además se revisa que ECharts no aparezca en los chunks iniciales del build. PR contra `main`, sin merge. Nada en producción.

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
