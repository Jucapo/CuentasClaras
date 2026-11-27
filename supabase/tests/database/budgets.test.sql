-- Budgets: a monthly amount per category from a period on (spending for expense categories,
-- expected income for income ones); members read, owners and editors write.
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

-- Ana owns "Hogar" with Beto (editor) and Dani (viewer). Caro owns her own space.
insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000000', 'ana@example.com'),
  ('b0000000-0000-4000-8000-000000000000', 'beto@example.com'),
  ('c0000000-0000-4000-8000-000000000000', 'caro@example.com'),
  ('d0000000-0000-4000-8000-00000000000d', 'dani@example.com');

set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000000"}';
do $$
declare
  new_id uuid;
begin
  perform set_config('t.space', public.create_space('Hogar', 'COP', 1, 'monday')::text, true);
  insert into public.categories (space_id, kind, name, icon, color)
  values (current_setting('t.space')::uuid, 'expense', 'Hogar', 'home', 'orange')
  returning id into new_id;
  perform set_config('t.home', new_id::text, true);
  insert into public.categories (space_id, kind, name, icon, color)
  values (current_setting('t.space')::uuid, 'income', 'Salario', 'work', 'teal')
  returning id into new_id;
  perform set_config('t.salary', new_id::text, true);
end $$;
set local request.jwt.claims to '{"sub": "c0000000-0000-4000-8000-000000000000"}';
do $$
declare
  new_id uuid;
begin
  perform set_config('t.caro_space', public.create_space('Caro', 'COP', 1, 'monday')::text, true);
  insert into public.categories (space_id, kind, name, icon, color)
  values (current_setting('t.caro_space')::uuid, 'expense', 'Viajes', 'flight', 'blue')
  returning id into new_id;
  perform set_config('t.caro_category', new_id::text, true);
end $$;

reset role;
insert into public.space_members (space_id, user_id, role) values
  (current_setting('t.space')::uuid, 'b0000000-0000-4000-8000-000000000000', 'editor'),
  (current_setting('t.space')::uuid, 'd0000000-0000-4000-8000-00000000000d', 'viewer');

-- ── Owner ────────────────────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000000"}';
select lives_ok(
  $q$do $$
    declare
      new_id uuid;
    begin
      insert into public.budgets (space_id, category_id, amount, currency, effective_from)
      values (current_setting('t.space')::uuid, current_setting('t.home')::uuid, 300000000, 'COP', '2026-11-01')
      returning id into new_id;
      perform set_config('t.budget', new_id::text, true);
    end $$$q$,
  'the owner sets the monthly budget of an expense category'
);
select lives_ok(
  format(
    $$insert into public.budgets (space_id, category_id, amount, currency, effective_from)
      values (%L, %L, 50000, 'USD', '2026-11-01')$$,
    current_setting('t.space'),
    current_setting('t.salary')
  ),
  'the expected income of an income category has its own currency'
);
select lives_ok(
  format(
    $$insert into public.budgets (space_id, category_id, amount, currency, effective_from)
      values (%L, %L, 0, 'COP', '2026-12-01')$$,
    current_setting('t.space'),
    current_setting('t.home')
  ),
  'a change from a later period is a new row, and 0 means no amount'
);
select throws_ok(
  format(
    $$insert into public.budgets (space_id, category_id, amount, currency, effective_from)
      values (%L, %L, 100, 'COP', '2026-11-01')$$,
    current_setting('t.space'),
    current_setting('t.home')
  ),
  '23505',
  null,
  'a category has one budget per period'
);
select throws_ok(
  format(
    $$insert into public.budgets (space_id, category_id, amount, currency, effective_from)
      values (%L, %L, -1, 'COP', '2027-01-01')$$,
    current_setting('t.space'),
    current_setting('t.home')
  ),
  '23514',
  null,
  'a budget is never negative'
);
select throws_ok(
  format(
    $$insert into public.budgets (space_id, category_id, amount, currency, effective_from)
      values (%L, %L, 100, 'COP', '2027-01-15')$$,
    current_setting('t.space'),
    current_setting('t.home')
  ),
  '23514',
  null,
  'a budget starts on the first day of the month that names its period'
);
select throws_ok(
  format(
    $$insert into public.budgets (space_id, category_id, amount, currency, effective_from)
      values (%L, %L, 100, 'cop', '2027-01-01')$$,
    current_setting('t.space'),
    current_setting('t.home')
  ),
  '23514',
  null,
  'the currency code must be uppercase ISO 4217'
);
select throws_ok(
  format(
    $$insert into public.budgets (space_id, category_id, amount, currency, effective_from)
      values (%L, %L, 100, 'COP', '2027-01-01')$$,
    current_setting('t.space'),
    current_setting('t.caro_category')
  ),
  '23503',
  null,
  'the category must belong to the same space'
);
select throws_ok(
  format('update public.budgets set category_id = %L where id = %L', current_setting('t.salary'), current_setting('t.budget')),
  '42501',
  null,
  'a budget never moves to another category'
);
select throws_ok(
  format($$update public.budgets set effective_from = '2027-02-01' where id = %L$$, current_setting('t.budget')),
  '42501',
  null,
  'a budget never moves to another period'
);

-- ── Viewer ───────────────────────────────────────────────────────────────────
set local request.jwt.claims to '{"sub": "d0000000-0000-4000-8000-00000000000d"}';
select results_eq(
  format('select count(*)::int from public.budgets where space_id = %L', current_setting('t.space')),
  $$values (3)$$,
  'a viewer sees the budgets of the space'
);
select throws_ok(
  format(
    $$insert into public.budgets (space_id, category_id, amount, currency, effective_from)
      values (%L, %L, 100, 'COP', '2027-01-01')$$,
    current_setting('t.space'),
    current_setting('t.home')
  ),
  '42501',
  null,
  'a viewer cannot set budgets'
);
select is_empty(
  format('update public.budgets set amount = 1 where id = %L returning 1', current_setting('t.budget')),
  'a viewer cannot change budgets'
);
select is_empty(
  format('delete from public.budgets where id = %L returning 1', current_setting('t.budget')),
  'a viewer cannot delete budgets'
);

-- ── Editor ───────────────────────────────────────────────────────────────────
set local request.jwt.claims to '{"sub": "b0000000-0000-4000-8000-000000000000"}';
select isnt_empty(
  format($$update public.budgets set amount = 250000000, currency = 'COP' where id = %L returning 1$$, current_setting('t.budget')),
  'an editor changes a budget'
);
select lives_ok(
  format(
    $$insert into public.budgets (space_id, category_id, amount, currency, effective_from)
      values (%L, %L, 60000, 'USD', '2026-12-01')$$,
    current_setting('t.space'),
    current_setting('t.salary')
  ),
  'an editor sets the expected income'
);
select isnt_empty(
  format(
    $$delete from public.budgets where category_id = %L and effective_from = '2026-12-01' returning 1$$,
    current_setting('t.home')
  ),
  'an editor deletes a budget'
);

-- ── Non-member ───────────────────────────────────────────────────────────────
set local request.jwt.claims to '{"sub": "c0000000-0000-4000-8000-000000000000"}';
select is_empty(
  format('select 1 from public.budgets where space_id = %L', current_setting('t.space')),
  'a non-member sees no budgets of the space'
);
select throws_ok(
  format(
    $$insert into public.budgets (space_id, category_id, amount, currency, effective_from)
      values (%L, %L, 100, 'COP', '2027-01-01')$$,
    current_setting('t.space'),
    current_setting('t.home')
  ),
  '42501',
  null,
  'a non-member cannot set budgets in the space'
);
select is_empty(
  format('update public.budgets set amount = 1 where id = %L returning 1', current_setting('t.budget')),
  'a non-member cannot change the budgets of the space'
);

-- ── Deleting a category deletes its budgets ──────────────────────────────────
set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000000"}';
select isnt_empty(
  format('delete from public.categories where id = %L returning 1', current_setting('t.home')),
  'the owner deletes a category with a budget'
);
reset role;
select is_empty(
  format('select 1 from public.budgets where category_id = %L', current_setting('t.home')),
  'deleting a category deletes its budgets'
);

select * from finish();
rollback;
