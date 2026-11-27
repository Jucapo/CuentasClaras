-- Reports (F1e2): daily and breakdown totals in the space scope, net worth, daily totals of the
-- filtered movements and the balance on a date. Every movement is converted on its own, so any
-- split of the same period adds up to the same figures as category_totals and transaction_totals.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

-- Ana owns "Hogar" (COP) with Beto (editor). Caro owns her own space.
insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000000', 'ana@example.com'),
  ('b0000000-0000-4000-8000-000000000000', 'beto@example.com'),
  ('c0000000-0000-4000-8000-000000000000', 'caro@example.com');

set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000000"}';
do $$ begin perform set_config('t.space', public.create_space('Hogar', 'COP', 1, 'monday')::text, true); end $$;
set local request.jwt.claims to '{"sub": "c0000000-0000-4000-8000-000000000000"}';
do $$ begin perform public.create_space('Caro', 'USD', 1, 'monday'); end $$;

reset role;
insert into public.space_members (space_id, user_id, role) values
  (current_setting('t.space')::uuid, 'b0000000-0000-4000-8000-000000000000', 'editor');

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

  -- Its initial balance is from the 10th: a movement of the 3rd is already inside it.
  insert into public.accounts (space_id, name, kind, currency, initial_balance, initial_balance_date, icon, color)
  values (space, 'Banco', 'bank', 'COP', 2000000, '2026-11-10', 'account_balance', 'blue')
  returning id into new_id;
  perform set_config('t.bank', new_id::text, true);

  insert into public.accounts (space_id, name, kind, currency, initial_balance_date, icon, color)
  values (space, 'Dólares', 'bank', 'USD', '2026-11-01', 'account_balance', 'teal')
  returning id into new_id;
  perform set_config('t.usd', new_id::text, true);

  insert into public.accounts (space_id, name, kind, currency, initial_balance_date, include_in_total, icon, color)
  values (space, 'Euros', 'bank', 'EUR', '2026-11-01', false, 'account_balance', 'indigo')
  returning id into new_id;
  perform set_config('t.eur', new_id::text, true);

  insert into public.accounts (space_id, name, kind, currency, initial_balance, initial_balance_date, icon, color)
  values (space, 'Caja menor', 'savings', 'COP', 500000, '2026-11-01', 'savings', 'teal')
  returning id into new_id;
  perform set_config('t.petty', new_id::text, true);

  insert into public.accounts (space_id, visibility, name, kind, currency, initial_balance, initial_balance_date, icon, color)
  values (space, 'private', 'Ahorro Ana', 'wallet', 'COP', 300000, '2026-11-01', 'wallet', 'purple')
  returning id into new_id;
  perform set_config('t.ana_private', new_id::text, true);

  insert into public.accounts (space_id, name, kind, currency, initial_balance, initial_balance_date, icon, color)
  values (space, 'Tarjeta', 'credit_card', 'COP', -500000, '2026-11-01', 'credit_card', 'red');

  -- Neither of these enters the net worth: one is archived, the other is an asset (F2).
  insert into public.accounts (space_id, name, kind, currency, initial_balance, initial_balance_date, icon, color)
  values (space, 'Vieja', 'cash', 'COP', 999000, '2026-11-01', 'payments', 'gray')
  returning id into new_id;
  update public.accounts set archived_at = now() where id = new_id;
  insert into public.accounts (space_id, name, kind, currency, initial_balance, initial_balance_date, icon, color)
  values (space, 'Lote', 'asset', 'COP', 100000000, '2026-11-01', 'landscape', 'brown');

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

  insert into public.tags (space_id, name, color) values (space, 'Fijos', 'blue') returning id into new_id;
  perform set_config('t.fixed', new_id::text, true);
  insert into public.tags (space_id, name, color) values (space, 'Hogar', 'green') returning id into new_id;
  perform set_config('t.household', new_id::text, true);

  -- A rate with decimals: converting two movements together would round differently.
  perform public.save_exchange_rate(space, '2026-11-01', 'USD', 'COP', 4123.456789);
  perform public.save_exchange_rate(space, '2026-11-25', 'USD', 'COP', 4200);
end $$;

-- Beto's private account in dollars, with a movement he includes in the space.
set local request.jwt.claims to '{"sub": "b0000000-0000-4000-8000-000000000000"}';
do $$
declare
  space uuid := current_setting('t.space')::uuid;
  new_id uuid;
begin
  insert into public.accounts (space_id, visibility, name, kind, currency, initial_balance_date, icon, color)
  values (space, 'private', 'Dólares Beto', 'bank', 'USD', '2026-11-01', 'account_balance', 'cyan')
  returning id into new_id;
  perform set_config('t.beto_usd', new_id::text, true);

  -- Same day and subcategory as Ana's dollars: 1001 and 5001 cents round down on their own
  -- (4127580.25 and 20621407.40) but up together (24748987.65).
  perform public.save_transaction(
    gen_random_uuid(), space, 'expense', '2026-11-12', 5001, new_id, current_setting('t.grocery')::uuid,
    entry_include_in_space => true
  );
end $$;

set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000000"}';
do $$
declare
  space uuid := current_setting('t.space')::uuid;
  cash uuid := current_setting('t.cash')::uuid;
  bank uuid := current_setting('t.bank')::uuid;
  food uuid := current_setting('t.food')::uuid;
  home uuid := current_setting('t.home')::uuid;
  salary uuid := current_setting('t.salary')::uuid;
  private_account uuid := current_setting('t.ana_private')::uuid;
begin
  perform public.save_transaction(gen_random_uuid(), space, 'income', '2026-11-02', 3000000, cash, salary);
  perform public.save_transaction(
    gen_random_uuid(), space, 'expense', '2026-11-05', 100000, cash, current_setting('t.grocery')::uuid,
    entry_tag_ids => array[current_setting('t.fixed')::uuid, current_setting('t.household')::uuid]
  );
  perform public.save_transaction(gen_random_uuid(), space, 'expense', '2026-11-05', 50000, cash, food);
  perform public.save_transaction(
    gen_random_uuid(), space, 'expense', '2026-11-12', 1001, current_setting('t.usd')::uuid,
    current_setting('t.grocery')::uuid
  );
  perform public.save_transaction(
    gen_random_uuid(), space, 'expense', '2026-11-15', 500, current_setting('t.eur')::uuid, home
  );
  -- Private: the first stays out of the space, the second is included.
  perform public.save_transaction(gen_random_uuid(), space, 'expense', '2026-11-07', 30000, private_account, food);
  perform public.save_transaction(
    gen_random_uuid(), space, 'expense', '2026-11-08', 20000, private_account, food,
    entry_include_in_space => true
  );
  -- Before the initial balance date of Banco.
  perform public.save_transaction(gen_random_uuid(), space, 'expense', '2026-11-03', 40000, bank, home);
  perform public.save_transaction(gen_random_uuid(), space, 'income', '2026-11-20', 100000, bank, salary);
  -- From an account in the total to one that is not.
  perform public.save_transaction(
    gen_random_uuid(), space, 'transfer', '2026-11-09', 200000, cash,
    entry_to_account_id => current_setting('t.petty')::uuid
  );
  perform public.save_transaction(
    gen_random_uuid(), space, 'adjustment', '2026-11-21', 10000, cash,
    entry_adjustment_direction => 'increase'
  );
  perform set_config(
    't.pending',
    public.save_transaction(gen_random_uuid(), space, 'expense', '2026-11-20', 99000, cash, home)::text,
    true
  );
end $$;

reset role;
update public.transactions set status = 'pending' where id = current_setting('t.pending')::uuid;
set local role authenticated;

-- ── daily_category_totals ────────────────────────────────────────────────────
set local request.jwt.claims to '{"sub": "b0000000-0000-4000-8000-000000000000"}';
select results_eq(
  format(
    $$select d.date, c.name::text, d.kind::text, d.amount, d.missing_rate_currencies
      from public.daily_category_totals(%L, '2026-11-01', '2026-11-30') d
      join public.categories c on c.id = d.category_id
      order by d.date, c.name$$,
    current_setting('t.space')
  ),
  $$values
    ('2026-11-02'::date, 'Salario', 'income', 3000000::bigint, array[]::text[]),
    ('2026-11-03'::date, 'Casa', 'expense', 40000::bigint, array[]::text[]),
    ('2026-11-05'::date, 'Mercado', 'expense', 150000::bigint, array[]::text[]),
    ('2026-11-08'::date, 'Mercado', 'expense', 20000::bigint, array[]::text[]),
    ('2026-11-12'::date, 'Mercado', 'expense', 24748987::bigint, array[]::text[]),
    ('2026-11-15'::date, 'Casa', 'expense', 0::bigint, array['EUR']::text[]),
    ('2026-11-20'::date, 'Salario', 'income', 100000::bigint, array[]::text[])$$,
  'by day and main category: subcategories roll up, each movement converted with the rate of its date, pending and transfers left out, and currencies without a rate'
);
select results_eq(
  format(
    $$select d.category_id, sum(d.amount)::bigint
      from public.daily_category_totals(%L, '2026-11-01', '2026-11-30') d
      group by d.category_id order by 1$$,
    current_setting('t.space')
  ),
  format(
    $$select t.category_id, t.amount
      from public.category_totals(%L, '2026-11-01', '2026-11-30') t
      where t.parent_id is null order by 1$$,
    current_setting('t.space')
  ),
  'the days of a category add up to its category_totals'
);

-- ── breakdown_totals ─────────────────────────────────────────────────────────
select results_eq(
  format(
    $$select a.name::text, b.kind::text, b.amount, b.movements, b.missing_rate_currencies
      from public.breakdown_totals(%L, '2026-11-01', '2026-11-30', 'account') b
      left join public.accounts a on a.id = b.key
      order by b.kind, a.name nulls first$$,
    current_setting('t.space')
  ),
  $$values
    (null::text, 'expense', 20000::bigint, 1, array[]::text[]),
    ('Banco', 'expense', 40000::bigint, 1, array[]::text[]),
    ('Dólares', 'expense', 4127580::bigint, 1, array[]::text[]),
    ('Dólares Beto', 'expense', 20621407::bigint, 1, array[]::text[]),
    ('Efectivo', 'expense', 150000::bigint, 2, array[]::text[]),
    ('Euros', 'expense', 0::bigint, 1, array['EUR']::text[]),
    ('Banco', 'income', 100000::bigint, 1, array[]::text[]),
    ('Efectivo', 'income', 3000000::bigint, 1, array[]::text[])$$,
  'by account: the included movement of another member''s private account goes with key null'
);
select results_eq(
  format(
    $$select b.kind, sum(b.amount)::bigint
      from public.breakdown_totals(%L, '2026-11-01', '2026-11-30', 'account') b
      group by b.kind order by 1$$,
    current_setting('t.space')
  ),
  format(
    $$select t.kind, sum(t.amount)::bigint
      from public.category_totals(%L, '2026-11-01', '2026-11-30') t
      where t.parent_id is null group by t.kind order by 1$$,
    current_setting('t.space')
  ),
  'the accounts add up to the total of each kind'
);
select results_eq(
  format(
    $$select b.kind, sum(b.amount)::bigint
      from public.breakdown_totals(%L, '2026-11-01', '2026-11-30', 'member') b
      group by b.kind order by 1$$,
    current_setting('t.space')
  ),
  format(
    $$select t.kind, sum(t.amount)::bigint
      from public.category_totals(%L, '2026-11-01', '2026-11-30') t
      where t.parent_id is null group by t.kind order by 1$$,
    current_setting('t.space')
  ),
  'the people add up to the total of each kind'
);
select results_eq(
  format(
    $$select b.key::text, b.kind::text, b.amount, b.movements
      from public.breakdown_totals(%L, '2026-11-01', '2026-11-30', 'member') b
      order by b.kind, b.key$$,
    current_setting('t.space')
  ),
  $$values
    ('a0000000-0000-4000-8000-000000000000', 'expense', 4337580::bigint, 6),
    ('b0000000-0000-4000-8000-000000000000', 'expense', 20621407::bigint, 1),
    ('a0000000-0000-4000-8000-000000000000', 'income', 3100000::bigint, 2)$$,
  'by person: the key is who recorded the movement'
);
select results_eq(
  format(
    $$select tg.name::text, b.kind::text, b.amount, b.movements
      from public.breakdown_totals(%L, '2026-11-01', '2026-11-30', 'tag') b
      left join public.tags tg on tg.id = b.key
      order by b.kind, tg.name nulls first$$,
    current_setting('t.space')
  ),
  $$values
    (null::text, 'expense', 24858987::bigint, 6),
    ('Fijos', 'expense', 100000::bigint, 1),
    ('Hogar', 'expense', 100000::bigint, 1),
    (null::text, 'income', 3100000::bigint, 2)$$,
  'by tag: a movement with two tags counts in each, and untagged movements go with key null'
);

set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000000"}';
select results_eq(
  format(
    $$select b.amount from public.breakdown_totals(%L, '2026-11-01', '2026-11-30', 'account') b
      where b.key is null and b.kind = 'expense'$$,
    current_setting('t.space')
  ),
  $$values (20621407::bigint)$$,
  'the owner of a private account sees it by name, and the other member''s included movement goes with key null'
);
select is_empty(
  format(
    $$select 1 from public.daily_category_totals(%L, '2026-11-07', '2026-11-07')$$,
    current_setting('t.space')
  ),
  'a private movement that is not included stays out of the reports, even for its owner'
);

-- ── transaction_day_totals ───────────────────────────────────────────────────
select results_eq(
  format(
    $$select d.income, d.expense, d.net
      from public.transaction_day_totals(%L, '2026-11-12', '2026-11-12') d$$,
    current_setting('t.space')
  ),
  $$values (0::bigint, 24748987::bigint, -24748987::bigint)$$,
  'a day converts each movement on its own'
);
select results_eq(
  format(
    $$select sum(d.income)::bigint, sum(d.expense)::bigint, sum(d.net)::bigint
      from public.transaction_day_totals(%L, '2026-11-01', '2026-11-30') d$$,
    current_setting('t.space')
  ),
  format(
    $$select t.income, t.expense, t.net
      from public.transaction_totals(%L, '2026-11-01', '2026-11-30') t$$,
    current_setting('t.space')
  ),
  'the days add up to transaction_totals'
);
select results_eq(
  format(
    $$select d.date, d.income, d.expense, d.net, d.missing_rate_currencies
      from public.transaction_day_totals(%L, '2026-11-20', '2026-11-20') d$$,
    current_setting('t.space')
  ),
  $$values ('2026-11-20'::date, 100000::bigint, 0::bigint, 100000::bigint, array[]::text[])$$,
  'without a status filter, a pending movement is listed but does not add up'
);
select results_eq(
  format(
    $$select d.date, d.income, d.expense, d.net
      from public.transaction_day_totals(
        %L, '2026-11-20', '2026-11-20', filter_statuses => array['pending']::public.transaction_status[]
      ) d$$,
    current_setting('t.space')
  ),
  $$values ('2026-11-20'::date, 0::bigint, 99000::bigint, -99000::bigint)$$,
  'with the status filter, exactly the chosen statuses add up'
);

-- ── accounts_balance ─────────────────────────────────────────────────────────
select results_eq(
  format($$select balance, currency, missing_rate_currencies from public.accounts_balance(%L, '2026-11-30')$$, current_setting('t.space')),
  format($$select total, currency, missing_rate_currencies from public.accounts_total(%L, '2026-11-30')$$, current_setting('t.space')),
  'without future movements, the balance of the last day is the header total'
);
select results_eq(
  format($$select balance, currency, missing_rate_currencies from public.accounts_balance(%L, '2026-11-30')$$, current_setting('t.space')),
  $$values (1805800::bigint, 'COP'::text, array[]::text[])$$,
  'the accounts in the total, the owner''s private one included, converted with the rate of the date'
);
select results_eq(
  format(
    $$select
        (select balance from public.accounts_balance(%1$L, '2026-11-02', array[%2$L::uuid])),
        (select balance from public.accounts_balance(%1$L, '2026-11-03', array[%2$L::uuid])),
        (select balance from public.accounts_balance(%1$L, '2026-11-30', array[%2$L::uuid]))$$,
    current_setting('t.space'), current_setting('t.bank')
  ),
  $$values (2040000::bigint, 2000000::bigint, 2100000::bigint)$$,
  'before the initial balance date, what that balance already had is taken back out'
);
select results_eq(
  format(
    $$select
        (select balance from public.accounts_balance(%1$L, '2026-11-08', array[%2$L::uuid, %3$L::uuid])),
        (select balance from public.accounts_balance(%1$L, '2026-11-09', array[%2$L::uuid, %3$L::uuid])),
        (select balance from public.accounts_balance(%1$L, '2026-11-09', array[%3$L::uuid]))$$,
    current_setting('t.space'), current_setting('t.cash'), current_setting('t.petty')
  ),
  $$values (4350000::bigint, 4350000::bigint, 700000::bigint)$$,
  'a transfer moves money between the chosen accounts without changing their sum'
);
select results_eq(
  format(
    $$select balance, currency from public.accounts_balance(%L, '2026-11-30', array[%L::uuid])$$,
    current_setting('t.space'), current_setting('t.beto_usd')
  ),
  $$values (0::bigint, 'COP'::text)$$,
  'another member''s private account does not enter, even when asked for'
);
select results_eq(
  format(
    $$select balance, missing_rate_currencies from public.accounts_balance(%L, '2026-11-30', array[%L::uuid])$$,
    current_setting('t.space'), current_setting('t.eur')
  ),
  $$values (0::bigint, array['EUR']::text[])$$,
  'a currency without a rate does not add up and is reported'
);

set local request.jwt.claims to '{"sub": "b0000000-0000-4000-8000-000000000000"}';
select results_eq(
  format($$select balance from public.accounts_balance(%L, '2026-11-30')$$, current_setting('t.space')),
  $$values (-19448400::bigint)$$,
  'each member gets the total of the accounts they see, with their own private ones'
);

-- ── net_worth ────────────────────────────────────────────────────────────────
set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000000"}';
select results_eq(
  format(
    $$select account_group::text, currency, balance, converted, main_currency
      from public.net_worth(%L, '2026-11-30')$$,
    current_setting('t.space')
  ),
  $$values
    ('accounts', 'COP', 6010000::bigint, 6010000::bigint, 'COP'),
    ('accounts', 'EUR', -500::bigint, null::bigint, 'COP'),
    ('accounts', 'USD', -1001::bigint, -4204200::bigint, 'COP'),
    ('savings', 'COP', 700000::bigint, 700000::bigint, 'COP'),
    ('debts', 'COP', -500000::bigint, -500000::bigint, 'COP')$$,
  'net worth: visible active accounts by group and currency, outside the total too, debts negative, no archived accounts nor assets, and null without a rate'
);
set local request.jwt.claims to '{"sub": "b0000000-0000-4000-8000-000000000000"}';
select results_eq(
  format(
    $$select balance from public.net_worth(%L, '2026-11-30')
      where account_group = 'accounts' and currency = 'COP'$$,
    current_setting('t.space')
  ),
  $$values (5760000::bigint)$$,
  'another member''s private account stays out of the net worth'
);

-- ── Non-members ──────────────────────────────────────────────────────────────
set local request.jwt.claims to '{"sub": "c0000000-0000-4000-8000-000000000000"}';
select is_empty(
  format(
    $$select 1 from public.daily_category_totals(%1$L, null, null)
      union all select 1 from public.breakdown_totals(%1$L, null, null, 'account')
      union all select 1 from public.net_worth(%1$L, '2026-11-30')
      union all select 1 from public.transaction_day_totals(%1$L)$$,
    current_setting('t.space')
  ),
  'a non-member gets no reports of the space'
);
select results_eq(
  format($$select balance, currency from public.accounts_balance(%L, '2026-11-30')$$, current_setting('t.space')),
  $$values (0::bigint, null::text)$$,
  'a non-member gets an empty balance, without the currency of the space'
);

select * from finish();
rollback;
