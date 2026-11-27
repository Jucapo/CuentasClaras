-- Search: search_transactions lists what the caller sees (RLS, private accounts included) with
-- search and filters, and transaction_totals adds up that set in the main currency: without a
-- status filter only what is confirmed, like category_totals, and with how much of it comes from
-- accounts outside the space.
begin;
create extension if not exists pgtap with schema extensions;
select plan(35);

-- Ana owns "Hogar" (COP) with Beto (editor) and Dani (viewer). Caro owns her own space.
insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000000', 'ana@example.com'),
  ('b0000000-0000-4000-8000-000000000000', 'beto@example.com'),
  ('c0000000-0000-4000-8000-000000000000', 'caro@example.com'),
  ('d0000000-0000-4000-8000-000000000000', 'dani@example.com');

set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000000"}';
do $$ begin perform set_config('t.space', public.create_space('Hogar', 'COP', 1, 'monday')::text, true); end $$;
set local request.jwt.claims to '{"sub": "c0000000-0000-4000-8000-000000000000"}';
do $$ begin perform public.create_space('Caro', 'USD', 1, 'monday'); end $$;

reset role;
insert into public.space_members (space_id, user_id, role) values
  (current_setting('t.space')::uuid, 'b0000000-0000-4000-8000-000000000000', 'editor'),
  (current_setting('t.space')::uuid, 'd0000000-0000-4000-8000-000000000000', 'viewer');

set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000000"}';
do $$
declare
  space uuid := current_setting('t.space')::uuid;
  new_id uuid;
begin
  insert into public.accounts (space_id, name, kind, currency, initial_balance_date, icon, color)
  values (space, 'Efectivo', 'cash', 'COP', '2026-11-01', 'payments', 'green')
  returning id into new_id;
  perform set_config('t.cash', new_id::text, true);

  insert into public.accounts (space_id, name, kind, currency, initial_balance_date, icon, color)
  values (space, 'Dólares', 'bank', 'USD', '2026-11-01', 'account_balance', 'teal')
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

  insert into public.categories (space_id, kind, name, icon, color)
  values (space, 'expense', 'Educación', 'school', 'blue')
  returning id into new_id;
  perform set_config('t.education', new_id::text, true);
  insert into public.categories (space_id, parent_id, kind, name, icon)
  values (space, new_id, 'expense', 'Colegio', 'school')
  returning id into new_id;
  perform set_config('t.school', new_id::text, true);
  insert into public.categories (space_id, kind, name, icon, color)
  values (space, 'expense', 'Mercado', 'shopping_cart', 'green')
  returning id into new_id;
  perform set_config('t.food', new_id::text, true);
  insert into public.categories (space_id, kind, name, icon, color)
  values (space, 'income', 'Salario', 'payments', 'blue')
  returning id into new_id;
  perform set_config('t.salary', new_id::text, true);

  insert into public.tags (space_id, name, color) values (space, 'Fijos', 'grey')
  returning id into new_id;
  perform set_config('t.fixed', new_id::text, true);

  perform public.save_exchange_rate(space, '2026-11-01', 'USD', 'COP', 4000);
  perform public.save_exchange_rate(space, '2026-11-20', 'USD', 'COP', 4200);
end $$;

set local request.jwt.claims to '{"sub": "b0000000-0000-4000-8000-000000000000"}';
do $$
declare
  new_id uuid;
begin
  insert into public.accounts (space_id, visibility, name, kind, currency, initial_balance_date, icon, color)
  values (current_setting('t.space')::uuid, 'private', 'Ahorro Beto', 'savings', 'COP', '2026-11-01', 'savings', 'orange')
  returning id into new_id;
  perform set_config('t.beto_private', new_id::text, true);
  -- Beto's own private expense, not included in the space.
  perform public.save_transaction(
    gen_random_uuid(), current_setting('t.space')::uuid, 'expense', '2026-11-21', 40000, new_id,
    current_setting('t.food')::uuid, entry_note => 'Almuerzo'
  );
end $$;

-- Every movement has its own amount, so the tests name them by it.
set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000000"}';
do $$
declare
  space uuid := current_setting('t.space')::uuid;
  cash uuid := current_setting('t.cash')::uuid;
  usd uuid := current_setting('t.usd')::uuid;
  private_account uuid := current_setting('t.ana_private')::uuid;
  food uuid := current_setting('t.food')::uuid;
begin
  perform public.save_transaction(
    gen_random_uuid(), space, 'expense', '2026-11-05', 100000, cash, current_setting('t.school')::uuid,
    entry_note => 'Pensión de noviembre', entry_tag_ids => array[current_setting('t.fixed')::uuid]
  );
  perform public.save_transaction(
    gen_random_uuid(), space, 'expense', '2026-11-06', 50000, cash, food,
    entry_note => 'Tienda de la esquina'
  );
  perform public.save_transaction(gen_random_uuid(), space, 'expense', '2026-11-10', 1000, usd, food);
  perform public.save_transaction(
    gen_random_uuid(), space, 'expense', '2026-11-25', 1500, usd, current_setting('t.education')::uuid
  );
  perform public.save_transaction(gen_random_uuid(), space, 'income', '2026-11-02', 3000000, cash, current_setting('t.salary')::uuid);
  perform public.save_transaction(
    gen_random_uuid(), space, 'transfer', '2026-11-12', 200000, cash, entry_to_account_id => private_account
  );
  perform public.save_transaction(
    gen_random_uuid(), space, 'expense', '2026-11-15', 30000, private_account, food, entry_note => 'Regalo'
  );
  perform public.save_transaction(
    gen_random_uuid(), space, 'expense', '2026-11-16', 20000, private_account, food,
    entry_note => 'Mercado compartido', entry_include_in_space => true
  );
  perform public.save_transaction(
    gen_random_uuid(), space, 'adjustment', '2026-11-18', 5000, cash,
    entry_adjustment_direction => 'increase'
  );
  perform public.save_transaction(
    gen_random_uuid(), space, 'expense', '2026-11-20', 500, current_setting('t.eur')::uuid, food
  );
  perform public.save_transaction(
    gen_random_uuid(), space, 'transfer', '2026-11-22', 2500, usd, entry_to_account_id => cash,
    entry_to_amount => 105000
  );
  perform public.save_transaction(gen_random_uuid(), space, 'expense', '2026-12-03', 77700, cash, food);
end $$;

-- Pending movements arrive through automation (F3); the client cannot write the status.
reset role;
update public.transactions set status = 'pending' where amount = 50000;
set local role authenticated;

-- ── Visibility ───────────────────────────────────────────────────────────────
set local request.jwt.claims to '{"sub": "b0000000-0000-4000-8000-000000000000"}';
select results_eq(
  format($$select amount from public.search_transactions(%L, '2026-11-01', '2026-11-30') order by amount$$, current_setting('t.space')),
  $$values (500::bigint), (1000), (1500), (2500), (5000), (20000), (40000), (50000), (100000), (200000), (3000000)$$,
  'a member sees the shared movements, their own private ones and what others include in the space'
);

set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000000"}';
select results_eq(
  format($$select amount from public.search_transactions(%L, '2026-11-01', '2026-11-30') order by amount$$, current_setting('t.space')),
  $$values (500::bigint), (1000), (1500), (2500), (5000), (20000), (30000), (50000), (100000), (200000), (3000000)$$,
  'the owner of a private account also sees what is not included, but not the private movements of others'
);

set local request.jwt.claims to '{"sub": "c0000000-0000-4000-8000-000000000000"}';
select is_empty(
  format($$select 1 from public.search_transactions(%L)$$, current_setting('t.space')),
  'a non-member finds nothing in the space'
);
select is_empty(
  format($$select 1 from public.transaction_totals(%L)$$, current_setting('t.space')),
  'a non-member gets no totals of the space'
);

-- ── Period ───────────────────────────────────────────────────────────────────
set local request.jwt.claims to '{"sub": "b0000000-0000-4000-8000-000000000000"}';
select results_eq(
  format($$select count(*)::integer from public.search_transactions(%L, null, null)$$, current_setting('t.space')),
  $$values (12)$$,
  'without dates the search covers every movement'
);
select results_eq(
  format($$select amount from public.search_transactions(%L, '2026-11-25', '2026-11-25')$$, current_setting('t.space')),
  $$values (1500::bigint)$$,
  'both limits of the period are inclusive'
);

-- ── Filters ──────────────────────────────────────────────────────────────────
set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000000"}';
select results_eq(
  format(
    $$select amount from public.search_transactions(%L, '2026-11-01', '2026-11-30', filter_account_ids => array[%L]::uuid[]) order by amount$$,
    current_setting('t.space'), current_setting('t.ana_private')
  ),
  $$values (20000::bigint), (30000), (200000)$$,
  'the account filter matches the source and the destination of a transfer'
);

set local request.jwt.claims to '{"sub": "b0000000-0000-4000-8000-000000000000"}';
select results_eq(
  format(
    $$select amount from public.search_transactions(%L, '2026-11-01', '2026-11-30', filter_category_ids => array[%L]::uuid[]) order by amount$$,
    current_setting('t.space'), current_setting('t.education')
  ),
  $$values (1500::bigint), (100000)$$,
  'a category brings its subcategories, and transfers never match a category'
);
select results_eq(
  format(
    $$select amount from public.search_transactions(%L, '2026-11-01', '2026-11-30', filter_category_ids => array[%L]::uuid[])$$,
    current_setting('t.space'), current_setting('t.school')
  ),
  $$values (100000::bigint)$$,
  'a subcategory brings only its own movements'
);
select results_eq(
  format(
    $$select amount from public.search_transactions(%L, '2026-11-01', '2026-11-30', filter_tag_ids => array[%L]::uuid[])$$,
    current_setting('t.space'), current_setting('t.fixed')
  ),
  $$values (100000::bigint)$$,
  'the tag filter matches the tagged movements'
);
select results_eq(
  format(
    $$select amount from public.search_transactions(%L, '2026-11-01', '2026-11-30', filter_types => array['income', 'adjustment']::public.transaction_type[]) order by amount$$,
    current_setting('t.space')
  ),
  $$values (5000::bigint), (3000000)$$,
  'any of the values of a filter is enough'
);
select results_eq(
  format(
    $$select amount from public.search_transactions(%L, '2026-11-01', '2026-11-30', filter_author_ids => array['b0000000-0000-4000-8000-000000000000']::uuid[])$$,
    current_setting('t.space')
  ),
  $$values (40000::bigint)$$,
  'the person filter matches who recorded the movement'
);
select results_eq(
  format(
    $$select amount from public.search_transactions(%L, '2026-11-01', '2026-11-30', filter_statuses => array['pending']::public.transaction_status[])$$,
    current_setting('t.space')
  ),
  $$values (50000::bigint)$$,
  'the status filter matches pending movements'
);
select results_eq(
  format(
    $$select amount from public.search_transactions(%L, '2026-11-01', '2026-11-30', filter_category_ids => array[%L]::uuid[], filter_account_ids => array[%L]::uuid[])$$,
    current_setting('t.space'), current_setting('t.food'), current_setting('t.usd')
  ),
  $$values (1000::bigint)$$,
  'different filters combine'
);
select results_eq(
  format(
    $$select count(*)::integer from public.search_transactions(%L, '2026-11-01', '2026-11-30', filter_types => '{}', filter_tag_ids => null)$$,
    current_setting('t.space')
  ),
  $$values (11)$$,
  'an empty or null filter does not filter'
);

-- ── Search ───────────────────────────────────────────────────────────────────
select results_eq(
  format(
    $$select amount from public.search_transactions(%L, '2026-11-01', '2026-11-30', search_terms => array['educacion']) order by amount$$,
    current_setting('t.space')
  ),
  $$values (1500::bigint), (100000)$$,
  'the search ignores accents and finds a subcategory by its parent'
);
select results_eq(
  format(
    $$select amount from public.search_transactions(%L, '2026-11-01', '2026-11-30', search_terms => array['PENSION'])$$,
    current_setting('t.space')
  ),
  $$values (100000::bigint)$$,
  'the search finds the note, ignoring case'
);
select results_eq(
  format(
    $$select amount from public.search_transactions(%L, '2026-11-01', '2026-11-30', search_terms => array['dolares']) order by amount$$,
    current_setting('t.space')
  ),
  $$values (1000::bigint), (1500), (2500)$$,
  'the search finds the account'
);
select results_eq(
  format(
    $$select amount from public.search_transactions(%L, '2026-11-01', '2026-11-30', search_terms => array['mercado', 'efectivo'])$$,
    current_setting('t.space')
  ),
  $$values (50000::bigint)$$,
  'every term has to appear in some field'
);
select results_eq(
  format(
    $$select amount from public.search_transactions(%L, '2026-11-01', '2026-11-30', search_terms => array['2.000'], search_amount => 200000)$$,
    current_setting('t.space')
  ),
  $$values (200000::bigint)$$,
  'a typed amount finds the movements with that exact amount'
);
select results_eq(
  format(
    $$select amount from public.search_transactions(%L, '2026-11-01', '2026-11-30', search_terms => array['1.050'], search_amount => 105000)$$,
    current_setting('t.space')
  ),
  $$values (2500::bigint)$$,
  'a typed amount also finds what arrived in a transfer between currencies'
);
select is_empty(
  format(
    $$select 1 from public.search_transactions(%L, '2026-11-01', '2026-11-30', search_terms => array['ahorro', 'ana'])$$,
    current_setting('t.space')
  ),
  'the names of accounts the caller cannot see are not searched'
);

set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000000"}';
select results_eq(
  format(
    $$select amount from public.search_transactions(%L, '2026-11-01', '2026-11-30', search_terms => array['ahorro', 'ana']) order by amount$$,
    current_setting('t.space')
  ),
  $$values (20000::bigint), (30000), (200000)$$,
  'the owner finds movements by the name of their private account'
);

-- ── Totals ───────────────────────────────────────────────────────────────────
set local request.jwt.claims to '{"sub": "b0000000-0000-4000-8000-000000000000"}';
select results_eq(
  format(
    $$select income, expense, net, currency, missing_rate_currencies from public.transaction_totals(%L, '2026-11-01', '2026-11-30')$$,
    current_setting('t.space')
  ),
  $$values (3000000::bigint, 10460000::bigint, -7460000::bigint, 'COP'::text, array['EUR']::text[])$$,
  'the totals add up what the list shows in the main currency, without transfers, adjustments or pending movements, and report currencies without a rate'
);

set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000000"}';
select results_eq(
  format(
    $$select income, expense, net from public.transaction_totals(%L, '2026-11-01', '2026-11-30')$$,
    current_setting('t.space')
  ),
  $$values (3000000::bigint, 10450000::bigint, -7450000::bigint)$$,
  'the owner of a private account gets its movements in the totals, like in the list'
);

set local request.jwt.claims to '{"sub": "b0000000-0000-4000-8000-000000000000"}';
select results_eq(
  format(
    $$select income, expense, missing_rate_currencies from public.transaction_totals(%L, '2026-11-01', '2026-11-30', filter_account_ids => array[%L]::uuid[])$$,
    current_setting('t.space'), current_setting('t.usd')
  ),
  $$values (0::bigint, 10300000::bigint, array[]::text[])$$,
  'each movement converts with the rate of its date'
);
select results_eq(
  format(
    $$select expense, net from public.transaction_totals(%L, '2026-11-01', '2026-11-30', search_terms => array['educacion'])$$,
    current_setting('t.space')
  ),
  $$values (6400000::bigint, -6400000::bigint)$$,
  'the totals follow the search'
);
select results_eq(
  format(
    $$select income, expense, net from public.transaction_totals(%L, '2026-11-01', '2026-11-30', filter_types => array['transfer', 'adjustment']::public.transaction_type[])$$,
    current_setting('t.space')
  ),
  $$values (0::bigint, 0::bigint, 0::bigint)$$,
  'transfers and adjustments do not add up'
);
select results_eq(
  format(
    $$select expense from public.transaction_totals(%L, '2026-11-01', '2026-11-30', filter_statuses => array['pending']::public.transaction_status[])$$,
    current_setting('t.space')
  ),
  $$values (50000::bigint)$$,
  'the totals count the filtered set, pending movements included'
);
select results_eq(
  format(
    $$select income, expense from public.transaction_totals(%L, null, null)$$,
    current_setting('t.space')
  ),
  $$values (3000000::bigint, 10537700::bigint)$$,
  'without dates the totals cover every movement'
);

-- ── Outside the space, and the rule of category_totals ───────────────────────
-- What was spent and received in the month by category (Inicio, Presupuesto): its top-level rows.
set local request.jwt.claims to '{"sub": "d0000000-0000-4000-8000-000000000000"}';
select results_eq(
  format(
    $$select income, expense from public.transaction_totals(%L, '2026-11-01', '2026-11-30')$$,
    current_setting('t.space')
  ),
  format(
    $$select
        coalesce(sum(amount) filter (where kind = 'income'), 0)::bigint,
        coalesce(sum(amount) filter (where kind = 'expense'), 0)::bigint
      from public.category_totals(%L, '2026-11-01', '2026-11-30')
      where parent_id is null$$,
    current_setting('t.space')
  ),
  'without a status filter, the month of someone who sees only the space matches category_totals'
);
select results_eq(
  format(
    $$select income, expense, outside_space_income, outside_space_expense from public.transaction_totals(%L, '2026-11-01', '2026-11-30')$$,
    current_setting('t.space')
  ),
  $$values (3000000::bigint, 10420000::bigint, 0::bigint, 0::bigint)$$,
  'and that month leaves out the pending movement, with nothing from accounts outside the space'
);

set local request.jwt.claims to '{"sub": "b0000000-0000-4000-8000-000000000000"}';
select results_eq(
  format(
    $$select outside_space_income, outside_space_expense from public.transaction_totals(%L, '2026-11-01', '2026-11-30')$$,
    current_setting('t.space')
  ),
  $$values (0::bigint, 40000::bigint)$$,
  'the totals say how much of them comes from accounts outside the space'
);
select results_eq(
  format(
    $$select income - outside_space_income, expense - outside_space_expense from public.transaction_totals(%L, '2026-11-01', '2026-11-30')$$,
    current_setting('t.space')
  ),
  format(
    $$select
        coalesce(sum(amount) filter (where kind = 'income'), 0)::bigint,
        coalesce(sum(amount) filter (where kind = 'expense'), 0)::bigint
      from public.category_totals(%L, '2026-11-01', '2026-11-30')
      where parent_id is null$$,
    current_setting('t.space')
  ),
  'without what comes from outside the space, the totals of the owner of a private account match category_totals'
);

set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000000"}';
select results_eq(
  format(
    $$select expense, outside_space_expense from public.transaction_totals(%L, '2026-11-01', '2026-11-30', filter_account_ids => array[%L]::uuid[])$$,
    current_setting('t.space'), current_setting('t.ana_private')
  ),
  $$values (50000::bigint, 30000::bigint)$$,
  'what a private account includes in the space is not outside it'
);

select * from finish();
rollback;
