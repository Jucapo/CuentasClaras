-- Totals: category_totals counts what the space shares (shared accounts plus included private
-- movements) in the main currency, rolls subcategories up, adds budgets and what remains, and
-- reports currencies without a rate. accounts_total and the manual exchange rates too.
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

-- Ana owns "Hogar" (COP) with Beto (editor) and Dani (viewer). Caro owns her own space.
insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000000', 'ana@example.com'),
  ('b0000000-0000-4000-8000-000000000000', 'beto@example.com'),
  ('c0000000-0000-4000-8000-000000000000', 'caro@example.com'),
  ('d0000000-0000-4000-8000-00000000000d', 'dani@example.com');

set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000000"}';
do $$ begin perform set_config('t.space', public.create_space('Hogar', 'COP', 1, 'monday')::text, true); end $$;
set local request.jwt.claims to '{"sub": "c0000000-0000-4000-8000-000000000000"}';
do $$ begin perform public.create_space('Caro', 'USD', 1, 'monday'); end $$;

reset role;
insert into public.space_members (space_id, user_id, role) values
  (current_setting('t.space')::uuid, 'b0000000-0000-4000-8000-000000000000', 'editor'),
  (current_setting('t.space')::uuid, 'd0000000-0000-4000-8000-00000000000d', 'viewer');

set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000000"}';
do $$
declare
  space uuid := current_setting('t.space')::uuid;
  new_id uuid;
begin
  insert into public.accounts (space_id, name, kind, currency, initial_balance, initial_balance_date, icon, color)
  values (space, 'Efectivo', 'cash', 'COP', 1000000, '2026-11-01', 'payments', 'green')
  returning id into new_id;
  perform set_config('t.cash', new_id::text, true);

  insert into public.accounts (space_id, name, kind, currency, initial_balance, initial_balance_date, icon, color)
  values (space, 'Dólares', 'bank', 'USD', 50000, '2026-11-01', 'account_balance', 'teal')
  returning id into new_id;
  perform set_config('t.usd', new_id::text, true);

  insert into public.accounts (space_id, name, kind, currency, initial_balance_date, icon, color)
  values (space, 'Euros', 'bank', 'EUR', '2026-11-01', 'account_balance', 'blue')
  returning id into new_id;
  perform set_config('t.eur', new_id::text, true);

  insert into public.accounts (space_id, visibility, name, kind, currency, initial_balance_date, icon, color)
  values (space, 'private', 'Ahorro Ana', 'savings', 'COP', '2026-11-01', 'savings', 'purple')
  returning id into new_id;
  perform set_config('t.ana_private', new_id::text, true);

  -- Neither of these counts in the total: one is archived, the other is not included.
  insert into public.accounts (space_id, name, kind, currency, initial_balance, initial_balance_date, icon, color)
  values (space, 'Vieja', 'cash', 'COP', 999000, '2026-11-01', 'payments', 'grey')
  returning id into new_id;
  update public.accounts set archived_at = now() where id = new_id;
  insert into public.accounts (space_id, name, kind, currency, initial_balance, initial_balance_date, icon, color)
  values (space, 'Caja menor', 'savings', 'COP', 500000, '2026-11-01', 'savings', 'teal');

  insert into public.categories (space_id, kind, name, icon, color)
  values (space, 'expense', 'Mercado', 'shopping_cart', 'green')
  returning id into new_id;
  perform set_config('t.food', new_id::text, true);
  insert into public.categories (space_id, parent_id, kind, name, icon)
  values (space, new_id, 'expense', 'Supermercado', 'store')
  returning id into new_id;
  perform set_config('t.grocery', new_id::text, true);
  insert into public.categories (space_id, kind, name, icon, color)
  values (space, 'expense', 'Casa', 'home', 'orange')
  returning id into new_id;
  perform set_config('t.home', new_id::text, true);
  insert into public.categories (space_id, kind, name, icon, color)
  values (space, 'income', 'Salario', 'payments', 'blue')
  returning id into new_id;
  perform set_config('t.salary', new_id::text, true);

  insert into public.budgets (space_id, category_id, amount, currency, effective_from) values
    (space, current_setting('t.food')::uuid, 500000, 'COP', '2026-11-01'),
    (space, current_setting('t.food')::uuid, 600000, 'COP', '2026-12-01'),
    (space, current_setting('t.home')::uuid, 10000, 'USD', '2026-11-01'),
    (space, current_setting('t.salary')::uuid, 2500000, 'COP', '2026-11-01');

  perform public.save_exchange_rate(space, '2026-11-01', 'USD', 'COP', 4000);
  perform public.save_exchange_rate(space, '2026-11-20', 'USD', 'COP', 4200);
end $$;

do $$
declare
  space uuid := current_setting('t.space')::uuid;
  cash uuid := current_setting('t.cash')::uuid;
  usd uuid := current_setting('t.usd')::uuid;
  private_account uuid := current_setting('t.ana_private')::uuid;
  food uuid := current_setting('t.food')::uuid;
begin
  perform public.save_transaction(gen_random_uuid(), space, 'expense', '2026-11-05', 100000, cash, current_setting('t.grocery')::uuid);
  perform public.save_transaction(gen_random_uuid(), space, 'expense', '2026-11-06', 50000, cash, food);
  perform public.save_transaction(gen_random_uuid(), space, 'expense', '2026-11-10', 1000, usd, food);
  perform public.save_transaction(gen_random_uuid(), space, 'expense', '2026-11-25', 1000, usd, food);
  perform public.save_transaction(gen_random_uuid(), space, 'expense', '2026-11-07', 30000, private_account, food);
  perform public.save_transaction(
    gen_random_uuid(), space, 'expense', '2026-11-08', 20000, private_account, food,
    entry_include_in_space => true
  );
  perform public.save_transaction(gen_random_uuid(), space, 'income', '2026-11-02', 3000000, cash, current_setting('t.salary')::uuid);
  perform public.save_transaction(gen_random_uuid(), space, 'expense', '2026-12-03', 77700, cash, food);
  -- Before the first rate and before the initial balance date of the account.
  perform public.save_transaction(gen_random_uuid(), space, 'expense', '2026-10-15', 1000, usd, food);
  perform public.save_transaction(
    gen_random_uuid(), space, 'expense', '2026-11-15', 500, current_setting('t.eur')::uuid,
    current_setting('t.home')::uuid
  );
end $$;

-- ── category_totals ──────────────────────────────────────────────────────────
set local request.jwt.claims to '{"sub": "b0000000-0000-4000-8000-000000000000"}';
select results_eq(
  format(
    $$select c.name::text, t.amount, t.budget, t.remaining, t.missing_rate_currencies
      from public.category_totals(%L, '2026-11-01', '2026-11-30', array['2026-11-01'::date]) t
      join public.categories c on c.id = t.category_id
      order by c.name$$,
    current_setting('t.space')
  ),
  $$values
    ('Casa', 0::bigint, 42000000::bigint, 42000000::bigint, array['EUR']::text[]),
    ('Mercado', 8370000::bigint, 500000::bigint, -7870000::bigint, array[]::text[]),
    ('Salario', 3000000::bigint, 2500000::bigint, -500000::bigint, array[]::text[]),
    ('Supermercado', 100000::bigint, null::bigint, null::bigint, array[]::text[])$$,
  'a month: shared and included movements in the main currency with the rate of their date, subcategories rolled up, budgets and expected incomes with what remains, and currencies without a rate'
);
select results_eq(
  format(
    $$select t.parent_id::text from public.category_totals(%L, '2026-11-01', '2026-11-30') t
      where t.category_id = %L$$,
    current_setting('t.space'), current_setting('t.grocery')
  ),
  format('values (%L)', current_setting('t.food')),
  'subcategories come with their parent'
);

set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000000"}';
select results_eq(
  format(
    $$select t.amount from public.category_totals(%L, '2026-11-01', '2026-11-30') t
      where t.category_id = %L$$,
    current_setting('t.space'), current_setting('t.food')
  ),
  $$values (8370000::bigint)$$,
  'the owner of a private account gets the same space totals: what is not included stays out'
);
select results_eq(
  format(
    $$select t.amount, t.budget from public.category_totals(%L, '2026-10-01', '2026-10-31') t
      where t.category_id = %L$$,
    current_setting('t.space'), current_setting('t.food')
  ),
  $$values (4000000::bigint, null::bigint)$$,
  'a movement older than every rate uses the oldest one, and no budget months means no budget'
);
select results_eq(
  format(
    $$select c.name::text, t.amount, t.budget
      from public.category_totals(%L, '2026-11-01', '2026-12-31', array['2026-11-01', '2026-12-01']::date[]) t
      join public.categories c on c.id = t.category_id
      where t.parent_id is null and c.kind = 'expense'
      order by c.name$$,
    current_setting('t.space')
  ),
  $$values ('Casa', 0::bigint, 84000000::bigint), ('Mercado', 8447700::bigint, 1100000::bigint)$$,
  'several months add the budget in force in each one'
);
select results_eq(
  format(
    $$select t.amount from public.category_totals(%L, null, null) t where t.category_id = %L$$,
    current_setting('t.space'), current_setting('t.food')
  ),
  $$values (12447700::bigint)$$,
  'without dates the totals cover every movement'
);

-- ── accounts_total ───────────────────────────────────────────────────────────
set local request.jwt.claims to '{"sub": "b0000000-0000-4000-8000-000000000000"}';
select results_eq(
  format($$select total, currency, missing_rate_currencies from public.accounts_total(%L, '2026-11-30')$$, current_setting('t.space')),
  $$values (205372300::bigint, 'COP'::text, array['EUR']::text[])$$,
  'the total adds the active accounts included in it with the rate of the day, and reports currencies without a rate'
);

-- ── Exchange rates ───────────────────────────────────────────────────────────
set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000000"}';
do $$
begin
  -- Written the other way around: 1 COP = 0.0002 EUR.
  perform public.save_exchange_rate(current_setting('t.space')::uuid, '2026-11-01', 'COP', 'EUR', 0.0002);
end $$;
select ok(
  private.exchange_rate(current_setting('t.space')::uuid, 'EUR', 'COP', '2026-11-15') = 5000,
  'a rate works in both directions'
);
select ok(
  private.exchange_rate(current_setting('t.space')::uuid, 'USD', 'COP', '2026-11-19') = 4000
  and private.exchange_rate(current_setting('t.space')::uuid, 'USD', 'COP', '2026-11-20') = 4200,
  'a movement uses the latest rate on or before its date'
);
select results_eq(
  format(
    $$select t.amount, t.missing_rate_currencies from public.category_totals(%L, '2026-11-01', '2026-11-30') t
      where t.category_id = %L$$,
    current_setting('t.space'), current_setting('t.home')
  ),
  $$values (2500000::bigint, array[]::text[])$$,
  'once the rate exists, the amount counts'
);
select results_eq(
  format($$select total, missing_rate_currencies from public.accounts_total(%L, '2026-11-30')$$, current_setting('t.space')),
  $$values (202872300::bigint, array[]::text[])$$,
  'the total converts every currency once all rates exist'
);

do $$
begin
  perform public.save_exchange_rate(current_setting('t.space')::uuid, '2026-12-15', 'USD', 'COP', 4300);
  perform public.save_exchange_rate(current_setting('t.space')::uuid, '2026-12-15', 'COP', 'USD', 0.0002325581);
end $$;
select results_eq(
  format($$select base, quote from public.exchange_rates where space_id = %L and date = '2026-12-15'$$, current_setting('t.space')),
  $$values ('COP'::text, 'USD'::text)$$,
  'saving a rate replaces the one of the same pair and day, even written the other way around'
);
select throws_ok(
  format(
    $$insert into public.exchange_rates (space_id, date, base, quote, rate) values (%L, '2026-12-15', 'USD', 'COP', 4300)$$,
    current_setting('t.space')
  ),
  '23505',
  null,
  'there is one rate per pair and day, in either direction'
);
select throws_ok(
  format(
    $$insert into public.exchange_rates (space_id, date, base, quote, rate) values (%L, '2026-12-16', 'USD', 'USD', 1)$$,
    current_setting('t.space')
  ),
  '23514',
  null,
  'a rate is between two currencies'
);

set local request.jwt.claims to '{"sub": "b0000000-0000-4000-8000-000000000000"}';
select isnt_empty(
  format('select 1 from public.exchange_rates where space_id = %L', current_setting('t.space')),
  'members see the rates of their space'
);
select lives_ok(
  format($$select public.save_exchange_rate(%L, '2026-12-20', 'USD', 'COP', 4250)$$, current_setting('t.space')),
  'an editor saves rates'
);

set local request.jwt.claims to '{"sub": "d0000000-0000-4000-8000-00000000000d"}';
select throws_ok(
  format($$select public.save_exchange_rate(%L, '2026-12-21', 'USD', 'COP', 4260)$$, current_setting('t.space')),
  '42501',
  null,
  'a viewer cannot save rates'
);

set local request.jwt.claims to '{"sub": "c0000000-0000-4000-8000-000000000000"}';
select is_empty(
  format('select 1 from public.exchange_rates where space_id = %L', current_setting('t.space')),
  'a non-member sees no rates of the space'
);
select is_empty(
  format(
    $$select 1 from public.category_totals(%L, null, null)$$,
    current_setting('t.space')
  ),
  'a non-member gets no totals of the space'
);

select * from finish();
rollback;
