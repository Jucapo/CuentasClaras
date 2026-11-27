-- Budgets per subcategory: category_totals gives each subcategory its own budget and what remains,
-- and a category adds its own amount (its "General") to those of its subcategories (spec §4.7).
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000000', 'ana@example.com');

set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000000"}';
do $$ begin perform set_config('t.space', public.create_space('Hogar', 'COP', 1, 'monday')::text, true); end $$;

do $$
declare
  space uuid := current_setting('t.space')::uuid;
  cash uuid;
  food uuid;
  salary uuid;
  new_id uuid;
begin
  insert into public.accounts (space_id, name, kind, currency, initial_balance_date, icon, color)
  values (space, 'Efectivo', 'cash', 'COP', '2026-11-01', 'payments', 'green')
  returning id into cash;

  insert into public.categories (space_id, kind, name, icon, color)
  values (space, 'expense', 'Mercado', 'shopping_cart', 'green')
  returning id into food;
  perform set_config('t.food', food::text, true);
  insert into public.categories (space_id, kind, name, icon, color)
  values (space, 'income', 'Salario', 'payments', 'blue')
  returning id into salary;

  insert into public.budgets (space_id, category_id, amount, currency, effective_from) values
    (space, food, 100000, 'COP', '2026-11-01'),
    (space, salary, 2000000, 'COP', '2026-11-01');
  perform public.save_exchange_rate(space, '2026-11-01', 'USD', 'COP', 4000);

  insert into public.categories (space_id, parent_id, kind, name, icon)
  values (space, food, 'expense', 'Supermercado', 'store') returning id into new_id;
  insert into public.budgets (space_id, category_id, amount, currency, effective_from)
  values (space, new_id, 300000, 'COP', '2026-11-01');
  perform public.save_transaction(gen_random_uuid(), space, 'expense', '2026-11-05', 350000, cash, new_id);
  perform public.save_transaction(gen_random_uuid(), space, 'expense', '2026-12-05', 10000, cash, new_id);

  -- In dollars, and removed from December.
  insert into public.categories (space_id, parent_id, kind, name, icon)
  values (space, food, 'expense', 'Plaza', 'storefront') returning id into new_id;
  insert into public.budgets (space_id, category_id, amount, currency, effective_from) values
    (space, new_id, 1000, 'USD', '2026-11-01'),
    (space, new_id, 0, 'USD', '2026-12-01');
  perform public.save_transaction(gen_random_uuid(), space, 'expense', '2026-11-06', 20000, cash, new_id);

  -- Spending without a budget.
  insert into public.categories (space_id, parent_id, kind, name, icon)
  values (space, food, 'expense', 'Tienda', 'store') returning id into new_id;
  perform public.save_transaction(gen_random_uuid(), space, 'expense', '2026-11-07', 15000, cash, new_id);

  -- A budget in euros, which have no rate.
  insert into public.categories (space_id, parent_id, kind, name, icon)
  values (space, food, 'expense', 'Kiosko', 'store') returning id into new_id;
  insert into public.budgets (space_id, category_id, amount, currency, effective_from)
  values (space, new_id, 500, 'EUR', '2026-11-01');

  perform public.save_transaction(gen_random_uuid(), space, 'expense', '2026-11-08', 50000, cash, food);

  insert into public.categories (space_id, parent_id, kind, name, icon)
  values (space, salary, 'income', 'Bonos', 'redeem') returning id into new_id;
  insert into public.budgets (space_id, category_id, amount, currency, effective_from)
  values (space, new_id, 500000, 'COP', '2026-11-01');
  perform public.save_transaction(gen_random_uuid(), space, 'income', '2026-11-02', 2000000, cash, salary);
  perform public.save_transaction(gen_random_uuid(), space, 'income', '2026-11-15', 700000, cash, new_id);
end $$;

select results_eq(
  format(
    $$select t.amount, t.budget, t.remaining
      from public.category_totals(%L, '2026-11-01', '2026-11-30', array['2026-11-01'::date]) t
      where t.category_id = %L$$,
    current_setting('t.space'), current_setting('t.food')
  ),
  $$values (435000::bigint, 4400000::bigint, 3965000::bigint)$$,
  'a category adds its own amount to the budgets of its subcategories, against everything spent in it'
);
select results_eq(
  format(
    $$select c.name::text, t.amount, t.budget, t.remaining
      from public.category_totals(%L, '2026-11-01', '2026-11-30', array['2026-11-01'::date]) t
      join public.categories c on c.id = t.category_id
      where c.name in ('Supermercado', 'Plaza')
      order by c.name$$,
    current_setting('t.space')
  ),
  $$values
    ('Plaza', 20000::bigint, 4000000::bigint, 3980000::bigint),
    ('Supermercado', 350000::bigint, 300000::bigint, -50000::bigint)$$,
  'a subcategory brings its own budget, converted to the main currency, and what remains of it'
);
select results_eq(
  format(
    $$select t.amount, t.budget, t.remaining
      from public.category_totals(%L, '2026-11-01', '2026-11-30', array['2026-11-01'::date]) t
      join public.categories c on c.id = t.category_id
      where c.name = 'Tienda'$$,
    current_setting('t.space')
  ),
  $$values (15000::bigint, null::bigint, null::bigint)$$,
  'a subcategory without a budget has no budget nor remaining, while its spending counts in its category'
);
select results_eq(
  format(
    $$select c.name::text, t.budget, t.missing_rate_currencies
      from public.category_totals(%L, '2026-11-01', '2026-11-30', array['2026-11-01'::date]) t
      join public.categories c on c.id = t.category_id
      where c.name in ('Kiosko', 'Mercado')
      order by c.name$$,
    current_setting('t.space')
  ),
  $$values ('Kiosko', null::bigint, array['EUR']::text[]), ('Mercado', 4400000::bigint, array['EUR']::text[])$$,
  'a budget in a currency without a rate stays out, and both the subcategory and its category report it'
);
select results_eq(
  format(
    $$select c.name::text, t.amount, t.budget, t.remaining
      from public.category_totals(%L, '2026-11-01', '2026-11-30', array['2026-11-01'::date]) t
      join public.categories c on c.id = t.category_id
      where c.kind = 'income'
      order by c.name$$,
    current_setting('t.space')
  ),
  $$values
    ('Bonos', 700000::bigint, 500000::bigint, -200000::bigint),
    ('Salario', 2700000::bigint, 2500000::bigint, -200000::bigint)$$,
  'expected incomes work the same per subcategory'
);
select results_eq(
  format(
    $$select c.name::text, t.amount, t.budget
      from public.category_totals(%L, '2026-11-01', '2026-12-31', array['2026-11-01', '2026-12-01']::date[]) t
      join public.categories c on c.id = t.category_id
      where c.name in ('Mercado', 'Plaza', 'Supermercado')
      order by c.name$$,
    current_setting('t.space')
  ),
  $$values
    ('Mercado', 445000::bigint, 4800000::bigint),
    ('Plaza', 20000::bigint, 4000000::bigint),
    ('Supermercado', 360000::bigint, 600000::bigint)$$,
  'several months add the budget in force of each subcategory in each one, and 0 removes it'
);

select * from finish();
rollback;
