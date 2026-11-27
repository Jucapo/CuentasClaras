-- Categories: two levels at most, a subcategory keeps the kind of its parent and may inherit its
-- color; members read, owners and editors write; reorder_categories only moves siblings;
-- create_category_tree creates a whole template or nothing.
begin;
create extension if not exists pgtap with schema extensions;
select plan(39);

-- Ana owns "Hogar" with Beto (editor) and Dani (viewer). Caro owns her own space.
insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000000', 'ana@example.com'),
  ('b0000000-0000-4000-8000-000000000000', 'beto@example.com'),
  ('c0000000-0000-4000-8000-000000000000', 'caro@example.com'),
  ('d0000000-0000-4000-8000-00000000000d', 'dani@example.com');

set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000000"}';
do $$ begin perform set_config('t.space', public.create_space('Hogar', 'COP', 1, 'monday')::text, true); end $$;
set local request.jwt.claims to '{"sub": "c0000000-0000-4000-8000-000000000000"}';
do $$ begin perform set_config('t.caro_space', public.create_space('Caro', 'COP', 1, 'monday')::text, true); end $$;
do $$
declare
  new_id uuid;
begin
  insert into public.categories (space_id, kind, name, icon, color)
  values (current_setting('t.caro_space')::uuid, 'expense', 'Viajes', 'flight', 'blue')
  returning id into new_id;
  perform set_config('t.caro_category', new_id::text, true);
end $$;

reset role;
insert into public.space_members (space_id, user_id, role) values
  (current_setting('t.space')::uuid, 'b0000000-0000-4000-8000-000000000000', 'editor'),
  (current_setting('t.space')::uuid, 'd0000000-0000-4000-8000-00000000000d', 'viewer');

-- ── Owner builds a small tree ────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000000"}';
select lives_ok(
  $q$do $$
    declare
      new_id uuid;
    begin
      insert into public.categories (space_id, kind, name, icon, color)
      values (current_setting('t.space')::uuid, 'expense', 'Hogar', 'home', 'orange')
      returning id into new_id;
      perform set_config('t.home', new_id::text, true);

      insert into public.categories (space_id, parent_id, kind, name, icon)
      values (current_setting('t.space')::uuid, new_id, 'expense', 'Arriendo', 'key')
      returning id into new_id;
      perform set_config('t.rent', new_id::text, true);

      insert into public.categories (space_id, parent_id, kind, name, icon, color)
      values (current_setting('t.space')::uuid, current_setting('t.home')::uuid, 'expense', 'Servicios', 'bolt', 'amber')
      returning id into new_id;
      perform set_config('t.utilities', new_id::text, true);

      insert into public.categories (space_id, kind, name, icon, color)
      values (current_setting('t.space')::uuid, 'expense', 'Mercado', 'shopping_cart', 'green')
      returning id into new_id;
      perform set_config('t.market', new_id::text, true);

      insert into public.categories (space_id, kind, name, icon, color)
      values (current_setting('t.space')::uuid, 'income', 'Salario', 'work', 'teal')
      returning id into new_id;
      perform set_config('t.salary', new_id::text, true);
    end $$$q$,
  'the owner creates categories and subcategories'
);
select results_eq(
  format(
    $$select name, sort_order, color::text from public.categories where space_id = %L
      order by kind, parent_id nulls first, sort_order$$,
    current_setting('t.space')
  ),
  $$values ('Hogar', 0, 'orange'::text), ('Mercado', 1, 'green'), ('Arriendo', 0, null),
           ('Servicios', 1, 'amber'), ('Salario', 0, 'teal')$$,
  'new categories go last among their siblings, and a subcategory may inherit its color'
);
select throws_ok(
  format(
    $$insert into public.categories (space_id, parent_id, kind, name, icon)
      values (%L, %L, 'expense', 'Tercer nivel', 'key')$$,
    current_setting('t.space'),
    current_setting('t.rent')
  ),
  '23514',
  null,
  'there is no third level of categories'
);
select throws_ok(
  format(
    $$insert into public.categories (space_id, parent_id, kind, name, icon)
      values (%L, %L, 'income', 'Arriendos cobrados', 'key')$$,
    current_setting('t.space'),
    current_setting('t.home')
  ),
  '23514',
  null,
  'a subcategory has the kind of its parent'
);
select throws_ok(
  format('update public.categories set parent_id = %L where id = %L', current_setting('t.market'), current_setting('t.home')),
  '23514',
  null,
  'a category with subcategories cannot become a subcategory'
);
select throws_ok(
  format('update public.categories set parent_id = %L where id = %L', current_setting('t.rent'), current_setting('t.market')),
  '23514',
  null,
  'a category cannot move under a subcategory'
);
select isnt_empty(
  format(
    'update public.categories set parent_id = %L where id = %L returning 1',
    current_setting('t.market'),
    current_setting('t.utilities')
  ),
  'a subcategory moves to another parent of the same kind'
);
select throws_ok(
  format(
    $$insert into public.categories (space_id, kind, name, icon) values (%L, 'expense', 'Sin color', 'home')$$,
    current_setting('t.space')
  ),
  '23514',
  null,
  'a top-level category needs its own color'
);
select throws_ok(
  format('update public.categories set parent_id = null where id = %L', current_setting('t.rent')),
  '23514',
  null,
  'a subcategory without color cannot become top-level until it gets one'
);
select throws_ok(
  format(
    $$insert into public.categories (space_id, parent_id, kind, name, icon)
      values (%L, %L, 'expense', 'Prestada', 'flight')$$,
    current_setting('t.space'),
    current_setting('t.caro_category')
  ),
  '23503',
  null,
  'the parent must belong to the same space'
);
select throws_ok(
  format(
    $$insert into public.categories (space_id, kind, name, icon, color) values (%L, 'expense', 'mercado', 'store', 'green')$$,
    current_setting('t.space')
  ),
  '23505',
  null,
  'active sibling names are unique, ignoring case'
);
select lives_ok(
  format(
    $$insert into public.categories (space_id, kind, name, icon, color) values (%L, 'income', 'Mercado', 'store', 'green')$$,
    current_setting('t.space')
  ),
  'the same name can exist in the other kind'
);
select lives_ok(
  format(
    $$update public.categories set archived_at = now() where id = %L;
      insert into public.categories (space_id, kind, name, icon, color) values (%L, 'income', 'Salario', 'work', 'teal')$$,
    current_setting('t.salary'),
    current_setting('t.space')
  ),
  'an archived name can be used again'
);
select throws_ok(
  format($$update public.categories set kind = 'income' where id = %L$$, current_setting('t.market')),
  '42501',
  null,
  'the kind of a category never changes'
);
select throws_ok(
  format('update public.categories set space_id = %L where id = %L', current_setting('t.caro_space'), current_setting('t.market')),
  '42501',
  null,
  'a category cannot be moved to another space'
);
select throws_ok(
  format(
    $$insert into public.categories (space_id, kind, name, icon, color) values (%L, 'expense', 'Rara', 'Casa Grande', 'green')$$,
    current_setting('t.space')
  ),
  '23514',
  null,
  'icons are catalog keys'
);

-- ── Viewer ───────────────────────────────────────────────────────────────────
set local request.jwt.claims to '{"sub": "d0000000-0000-4000-8000-00000000000d"}';
select results_eq(
  format('select count(*)::int from public.categories where space_id = %L', current_setting('t.space')),
  $$values (7)$$,
  'a viewer sees the categories of the space'
);
select throws_ok(
  format(
    $$insert into public.categories (space_id, kind, name, icon, color) values (%L, 'expense', 'Lector', 'home', 'green')$$,
    current_setting('t.space')
  ),
  '42501',
  null,
  'a viewer cannot create categories'
);
select is_empty(
  format($$update public.categories set name = 'Lector' where id = %L returning 1$$, current_setting('t.market')),
  'a viewer cannot edit categories'
);
select is_empty(
  format('delete from public.categories where id = %L returning 1', current_setting('t.market')),
  'a viewer cannot delete categories'
);
select throws_ok(
  format('select public.reorder_categories(array[%L, %L]::uuid[])', current_setting('t.market'), current_setting('t.home')),
  '42501',
  null,
  'a viewer cannot reorder categories'
);
select throws_ok(
  format(
    $$select public.create_category_tree(%L, 'expense', '[{"name": "Lector", "icon": "home", "color": "green"}]')$$,
    current_setting('t.space')
  ),
  '42501',
  null,
  'a viewer cannot create categories from the template'
);

-- ── Editor ───────────────────────────────────────────────────────────────────
set local request.jwt.claims to '{"sub": "b0000000-0000-4000-8000-000000000000"}';
select lives_ok(
  format(
    $$insert into public.categories (space_id, kind, name, icon, color) values (%L, 'expense', 'Salud', 'medical_services', 'red')$$,
    current_setting('t.space')
  ),
  'an editor creates categories'
);
select isnt_empty(
  format($$update public.categories set name = 'Supermercado', color = 'lime' where id = %L returning 1$$, current_setting('t.market')),
  'an editor edits categories'
);
select lives_ok(
  format(
    $$select public.reorder_categories(array[%L, %L, (select id from public.categories where name = 'Salud')]::uuid[])$$,
    current_setting('t.market'),
    current_setting('t.home')
  ),
  'an editor reorders sibling categories'
);
select results_eq(
  format(
    $$select name from public.categories where space_id = %L and kind = 'expense' and parent_id is null
      order by sort_order$$,
    current_setting('t.space')
  ),
  $$values ('Supermercado'), ('Hogar'), ('Salud')$$,
  'reorder_categories saves the new order'
);
select throws_ok(
  format('select public.reorder_categories(array[%L, %L]::uuid[])', current_setting('t.home'), current_setting('t.rent')),
  '23514',
  null,
  'categories of different levels cannot be reordered together'
);
select throws_ok(
  format('select public.reorder_categories(array[%L, %L]::uuid[])', current_setting('t.home'), current_setting('t.home')),
  '23514',
  null,
  'reorder_categories rejects repeated ids'
);

-- ── Template ─────────────────────────────────────────────────────────────────
select lives_ok(
  format(
    $$select public.create_category_tree(%L, 'expense', '[
      {"name": "Transporte", "icon": "directions_car", "color": "blue",
       "children": [{"name": "Peajes", "icon": "toll"}, {"name": "Parqueadero", "icon": "local_parking"}]},
      {"name": "Regalos", "icon": "redeem", "color": "pink"}
    ]')$$,
    current_setting('t.space')
  ),
  'an editor creates categories with subcategories from the template'
);
select results_eq(
  format(
    $$select c.name, c.sort_order, c.color::text, p.name from public.categories c
      left join public.categories p on p.id = c.parent_id
      where c.space_id = %L and c.name in ('Transporte', 'Peajes', 'Parqueadero', 'Regalos')
      order by c.parent_id nulls first, c.sort_order$$,
    current_setting('t.space')
  ),
  $$values ('Transporte', 3, 'blue'::text, null::text), ('Regalos', 4, 'pink', null),
           ('Peajes', 0, null, 'Transporte'), ('Parqueadero', 1, null, 'Transporte')$$,
  'template categories go last, keep their order and their subcategories inherit the color'
);
select throws_ok(
  format(
    $$select public.create_category_tree(%L, 'expense', '[
      {"name": "Nueva", "icon": "home", "color": "green", "children": [{"name": "Hija", "icon": "home"}]},
      {"name": "salud", "icon": "home", "color": "green"}
    ]')$$,
    current_setting('t.space')
  ),
  '23505',
  null,
  'a repeated name stops the template'
);
select is_empty(
  format($$select 1 from public.categories where space_id = %L and name in ('Nueva', 'Hija')$$, current_setting('t.space')),
  'a template that fails creates nothing'
);
select throws_ok(
  format(
    $$select public.create_category_tree(%L, 'income', '[{"name": "Rara", "icon": "Casa Grande", "color": "green"}]')$$,
    current_setting('t.space')
  ),
  '23514',
  null,
  'template icons are catalog keys'
);

-- ── Non-member ───────────────────────────────────────────────────────────────
set local request.jwt.claims to '{"sub": "c0000000-0000-4000-8000-000000000000"}';
select is_empty(
  format('select 1 from public.categories where space_id = %L', current_setting('t.space')),
  'a non-member sees no categories of the space'
);
select throws_ok(
  format('select public.reorder_categories(array[%L, %L]::uuid[])', current_setting('t.market'), current_setting('t.home')),
  '42501',
  null,
  'a non-member cannot reorder the categories of the space'
);
select is_empty(
  format($$update public.categories set name = 'Intrusa' where id = %L returning 1$$, current_setting('t.home')),
  'a non-member cannot edit the categories of the space'
);
select throws_ok(
  format(
    $$select public.create_category_tree(%L, 'expense', '[{"name": "Intrusa", "icon": "home", "color": "green"}]')$$,
    current_setting('t.space')
  ),
  '42501',
  null,
  'a non-member cannot create categories in the space from the template'
);

-- ── Deleting a category deletes its subcategories ────────────────────────────
set local request.jwt.claims to '{"sub": "b0000000-0000-4000-8000-000000000000"}';
select isnt_empty(
  format('delete from public.categories where id = %L returning 1', current_setting('t.home')),
  'an editor deletes a category'
);
reset role;
select is_empty(
  format('select 1 from public.categories where id = %L', current_setting('t.rent')),
  'deleting a category deletes its subcategories'
);

select * from finish();
rollback;
