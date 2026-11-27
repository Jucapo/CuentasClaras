-- F1c · Asistente: presupuestos y montos esperados por categoría, posponer el asistente y crear
-- categorías desde la plantilla sugerida. Spec §4.7, §7, §8 y Anexo A.

-- ── Asistente ─────────────────────────────────────────────────────────────────
-- "Terminar más tarde": con fecha, la app deja de abrir el asistente sola, en todos los dispositivos.
alter table public.space_settings add column onboarding_postponed_at timestamptz;
grant update (onboarding_postponed_at) on public.space_settings to authenticated;

-- ── Presupuestos ──────────────────────────────────────────────────────────────
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  -- De gasto: presupuesto. De ingreso: ingreso mensual esperado.
  category_id uuid not null,
  -- Unidades menores; 0 = sin monto desde ese periodo.
  amount bigint not null check (amount >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  -- Primer día del mes con que se nombra el periodo desde el que rige (§4.5): no depende del día de
  -- inicio del mes, así que cambiarlo no mueve los presupuestos.
  effective_from date not null check (extract(day from effective_from) = 1),
  created_at timestamptz not null default now(),
  foreign key (space_id, category_id) references public.categories (space_id, id) on delete cascade,
  unique (category_id, effective_from)
);
create index budgets_space_idx on public.budgets (space_id);

revoke all on table public.budgets from anon, authenticated, service_role;
grant select, insert, update, delete on table public.budgets to service_role;
grant select, delete on table public.budgets to authenticated;
grant insert (space_id, category_id, amount, currency, effective_from) on public.budgets
  to authenticated;
grant update (amount, currency) on public.budgets to authenticated;

alter table public.budgets enable row level security;
create policy budgets_select on public.budgets for select to authenticated
  using (private.is_space_member(space_id));
create policy budgets_insert on public.budgets for insert to authenticated
  with check (private.is_space_editor(space_id));
create policy budgets_update on public.budgets for update to authenticated
  using (private.is_space_editor(space_id)) with check (private.is_space_editor(space_id));
create policy budgets_delete on public.budgets for delete to authenticated
  using (private.is_space_editor(space_id));

-- ── Plantilla de categorías ───────────────────────────────────────────────────
-- Crea categorías con sus subcategorías en una sola transacción: se crea todo o nada.
-- tree: [{"name", "icon", "color", "children": [{"name", "icon"}]}]; las subcategorías heredan el
-- color. Security invoker: la RLS y los triggers de categorías aplican igual que en un insert.
create function public.create_category_tree(
  target_space_id uuid,
  category_kind public.category_kind,
  tree jsonb
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  parent jsonb;
  child jsonb;
  new_parent_id uuid;
begin
  for parent in select value from jsonb_array_elements(tree) loop
    insert into public.categories (space_id, kind, name, icon, color)
    values (
      target_space_id, category_kind, parent ->> 'name', parent ->> 'icon', parent ->> 'color'
    )
    returning id into new_parent_id;
    for child in
      select value from jsonb_array_elements(coalesce(parent -> 'children', '[]'::jsonb))
    loop
      insert into public.categories (space_id, parent_id, kind, name, icon)
      values (target_space_id, new_parent_id, category_kind, child ->> 'name', child ->> 'icon');
    end loop;
  end loop;
end;
$$;
revoke all on function public.create_category_tree(uuid, public.category_kind, jsonb)
  from public, anon;
grant execute on function public.create_category_tree(uuid, public.category_kind, jsonb)
  to authenticated;
