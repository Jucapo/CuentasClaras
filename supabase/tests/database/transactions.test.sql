-- Transactions: visibility follows the accounts (a private one only for its owner, except what is
-- included in the space), writing needs write access to the source account and sight of the
-- destination, plus the integrity rules, card deferrals, idempotent saves and balances.
begin;
create extension if not exists pgtap with schema extensions;
select plan(50);

-- Ana owns "Hogar" with Beto (editor) and Dani (viewer). Caro owns her own space, where Ana is editor.
insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000000', 'ana@example.com'),
  ('b0000000-0000-4000-8000-000000000000', 'beto@example.com'),
  ('c0000000-0000-4000-8000-000000000000', 'caro@example.com'),
  ('d0000000-0000-4000-8000-00000000000d', 'dani@example.com');

set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000000"}';
do $$ begin perform set_config('t.space', public.create_space('Hogar', 'COP', 1, 'monday')::text, true); end $$;
set local request.jwt.claims to '{"sub": "c0000000-0000-4000-8000-000000000000"}';
do $$ begin perform set_config('t.caro_space', public.create_space('Caro', 'USD', 1, 'monday')::text, true); end $$;
do $$
declare
  new_id uuid;
begin
  insert into public.accounts (space_id, name, kind, currency, initial_balance_date, icon, color)
  values (current_setting('t.caro_space')::uuid, 'Banco', 'bank', 'USD', '2026-11-01', 'account_balance', 'blue')
  returning id into new_id;
  perform set_config('t.caro_account', new_id::text, true);
end $$;

reset role;
insert into public.space_members (space_id, user_id, role) values
  (current_setting('t.space')::uuid, 'b0000000-0000-4000-8000-000000000000', 'editor'),
  (current_setting('t.space')::uuid, 'd0000000-0000-4000-8000-00000000000d', 'viewer'),
  (current_setting('t.caro_space')::uuid, 'a0000000-0000-4000-8000-000000000000', 'editor');

-- ── Ana's catalog and movements ──────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000000"}';
do $$
declare
  space uuid := current_setting('t.space')::uuid;
  new_id uuid;
begin
  insert into public.accounts (space_id, name, kind, currency, initial_balance, initial_balance_date, icon, color)
  values (space, 'Efectivo', 'cash', 'COP', 100000, '2026-11-01', 'payments', 'green')
  returning id into new_id;
  perform set_config('t.cash', new_id::text, true);

  insert into public.accounts (space_id, name, kind, currency, initial_balance_date, icon, color)
  values (space, 'Dólares', 'bank', 'USD', '2026-11-01', 'account_balance', 'teal')
  returning id into new_id;
  perform set_config('t.usd', new_id::text, true);

  insert into public.accounts (space_id, name, kind, currency, initial_balance_date, icon, color)
  values (space, 'Tarjeta', 'credit_card', 'COP', '2026-11-01', 'credit_card', 'red')
  returning id into new_id;
  perform set_config('t.card', new_id::text, true);

  insert into public.accounts (
    space_id, visibility, name, kind, currency, initial_balance_date, icon, color,
    include_in_space_by_default
  )
  values (space, 'private', 'Ahorro Ana', 'savings', 'COP', '2026-11-01', 'savings', 'purple', true)
  returning id into new_id;
  perform set_config('t.ana_private', new_id::text, true);

  insert into public.categories (space_id, kind, name, icon, color)
  values (space, 'expense', 'Mercado', 'shopping_cart', 'green')
  returning id into new_id;
  perform set_config('t.food', new_id::text, true);

  insert into public.categories (space_id, parent_id, kind, name, icon)
  values (space, current_setting('t.food')::uuid, 'expense', 'Supermercado', 'store')
  returning id into new_id;
  perform set_config('t.grocery', new_id::text, true);

  insert into public.categories (space_id, kind, name, icon, color)
  values (space, 'income', 'Salario', 'payments', 'blue')
  returning id into new_id;
  perform set_config('t.salary', new_id::text, true);

  insert into public.tags (space_id, name, color)
  values (space, 'Fijos', 'blue')
  returning id into new_id;
  perform set_config('t.tag', new_id::text, true);
end $$;

do $$
declare
  space uuid := current_setting('t.space')::uuid;
  cash uuid := current_setting('t.cash')::uuid;
  private_account uuid := current_setting('t.ana_private')::uuid;
  food uuid := current_setting('t.food')::uuid;
begin
  perform set_config('t.lunch', public.save_transaction(
    gen_random_uuid(), space, 'expense', '2026-11-10', 25000, cash, current_setting('t.grocery')::uuid,
    entry_tag_ids => array[current_setting('t.tag')::uuid]
  )::text, true);
  perform public.save_transaction(
    gen_random_uuid(), space, 'income', '2026-11-05', 3000000, cash, current_setting('t.salary')::uuid
  );
  perform set_config('t.private_hidden', public.save_transaction(
    gen_random_uuid(), space, 'expense', '2026-11-11', 10000, private_account, food,
    entry_include_in_space => false
  )::text, true);
  perform set_config('t.private_included', public.save_transaction(
    gen_random_uuid(), space, 'expense', '2026-11-12', 7000, private_account, food
  )::text, true);
  perform set_config('t.private_transfer', public.save_transaction(
    gen_random_uuid(), space, 'transfer', '2026-11-12', 50000, private_account,
    entry_to_account_id => cash
  )::text, true);
  perform public.save_transaction(
    gen_random_uuid(), space, 'transfer', '2026-11-15', 400000, cash,
    entry_to_account_id => current_setting('t.usd')::uuid, entry_to_amount => 10000
  );
  perform public.save_transaction(
    gen_random_uuid(), space, 'adjustment', '2026-11-20', 1000, cash,
    entry_adjustment_direction => 'increase'
  );
  perform public.save_transaction(
    gen_random_uuid(), space, 'adjustment', '2026-11-21', 500, cash,
    entry_adjustment_direction => 'decrease'
  );
  -- Before the initial balance date: already part of that balance.
  perform public.save_transaction(gen_random_uuid(), space, 'expense', '2026-10-15', 9999, cash, food);
  perform set_config('t.into_private', public.save_transaction(
    gen_random_uuid(), space, 'transfer', '2026-11-22', 5000, cash,
    entry_to_account_id => private_account
  )::text, true);
end $$;

reset role;
-- Pending movements (Por confirmar, F3) come from automation, never from the client.
insert into public.transactions (space_id, type, date, amount, account_id, category_id, status)
values (
  current_setting('t.space')::uuid, 'expense', '2026-11-23', 1111, current_setting('t.cash')::uuid,
  current_setting('t.food')::uuid, 'pending'
);

-- ── What the triggers fill in ────────────────────────────────────────────────
select results_eq(
  format(
    'select currency, created_by, include_in_space from public.transactions where id = %L',
    current_setting('t.lunch')
  ),
  $$values ('COP'::text, 'a0000000-0000-4000-8000-000000000000'::uuid, false)$$,
  'the currency comes from the account, the author is the caller, and shared accounts never include'
);
select results_eq(
  format(
    'select id::text, include_in_space from public.transactions where id in (%L, %L) order by amount',
    current_setting('t.private_included'), current_setting('t.private_hidden')
  ),
  format(
    'values (%L, true), (%L, false)',
    current_setting('t.private_included'), current_setting('t.private_hidden')
  ),
  'a private movement takes the default of its account unless it says otherwise'
);
select results_eq(
  format('select tag_id::text from public.transaction_tags where transaction_id = %L', current_setting('t.lunch')),
  format('values (%L)', current_setting('t.tag')),
  'save_transaction stores the tags'
);

-- ── Balances ─────────────────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000000"}';
select results_eq(
  format(
    $$select account_id::text, movements_total, balance from public.account_balances
      where account_id in (%L, %L, %L) order by balance$$,
    current_setting('t.cash'), current_setting('t.usd'), current_setting('t.ana_private')
  ),
  format(
    $$values (%L, -62000::bigint, -62000::bigint), (%L, 10000::bigint, 10000::bigint),
             (%L, 2620500::bigint, 2720500::bigint)$$,
    current_setting('t.ana_private'), current_setting('t.usd'), current_setting('t.cash')
  ),
  'balances add income, transfers in (what arrived) and increases, subtract the rest, skip pending movements and those before the initial balance date'
);

-- ── Visibility ───────────────────────────────────────────────────────────────
set local request.jwt.claims to '{"sub": "b0000000-0000-4000-8000-000000000000"}';
select is_empty(
  format('select 1 from public.transactions where id = %L', current_setting('t.private_hidden')),
  'a member does not see the movements of a private account of another member'
);
select isnt_empty(
  format('select 1 from public.transactions where id = %L', current_setting('t.private_included')),
  'a member sees a private movement included in the space'
);
select isnt_empty(
  format('select 1 from public.transactions where id = %L', current_setting('t.private_transfer')),
  'a member sees a transfer from a private account into an account they see'
);
select results_eq(
  format('select balance from public.account_balances where account_id = %L', current_setting('t.cash')),
  $$values (2720500::bigint)$$,
  'the balance of a shared account is the same for every member'
);
select isnt_empty(
  format('select 1 from public.transaction_tags where transaction_id = %L', current_setting('t.lunch')),
  'tags are visible with their movement'
);

set local request.jwt.claims to '{"sub": "d0000000-0000-4000-8000-00000000000d"}';
select isnt_empty(
  format('select 1 from public.transactions where id = %L', current_setting('t.lunch')),
  'a viewer sees the shared movements'
);

set local request.jwt.claims to '{"sub": "c0000000-0000-4000-8000-000000000000"}';
select is_empty(
  format('select 1 from public.transactions where space_id = %L', current_setting('t.space')),
  'a non-member sees no movements of the space'
);
select is_empty(
  format('select 1 from public.transaction_tags where transaction_id = %L', current_setting('t.lunch')),
  'a non-member sees no tags of the space'
);

-- ── Writing ──────────────────────────────────────────────────────────────────
set local request.jwt.claims to '{"sub": "b0000000-0000-4000-8000-000000000000"}';
select throws_ok(
  format(
    $$select public.save_transaction(gen_random_uuid(), %L, 'expense', '2026-11-10', 100, %L, %L)$$,
    current_setting('t.space'), current_setting('t.ana_private'), current_setting('t.food')
  ),
  '42501',
  null,
  'nobody writes into the private account of another member'
);
select is_empty(
  format($$update public.transactions set note = 'Mío' where id = %L returning 1$$, current_setting('t.private_included')),
  'seeing an included private movement does not allow editing it'
);
select is_empty(
  format('delete from public.transactions where id = %L returning 1', current_setting('t.private_included')),
  'seeing an included private movement does not allow deleting it'
);
select throws_ok(
  format(
    $$select public.save_transaction(%L, %L, 'expense', '2026-11-10', 100, %L, %L)$$,
    current_setting('t.private_included'), current_setting('t.space'), current_setting('t.cash'),
    current_setting('t.food')
  ),
  '23505',
  null,
  'save_transaction with the id of a movement the caller cannot write never takes it over'
);
select throws_ok(
  format(
    $$select public.save_transaction(gen_random_uuid(), %L, 'transfer', '2026-11-10', 100, %L,
        entry_to_account_id => %L)$$,
    current_setting('t.space'), current_setting('t.cash'), current_setting('t.ana_private')
  ),
  '42501',
  null,
  'nobody transfers into an account they cannot see'
);
select is_empty(
  format('delete from public.transactions where id = %L returning 1', current_setting('t.into_private')),
  'nobody deletes a transfer into an account they cannot see'
);

set local request.jwt.claims to '{"sub": "d0000000-0000-4000-8000-00000000000d"}';
select throws_ok(
  format(
    $$select public.save_transaction(gen_random_uuid(), %L, 'expense', '2026-11-10', 100, %L, %L)$$,
    current_setting('t.space'), current_setting('t.cash'), current_setting('t.food')
  ),
  '42501',
  null,
  'a viewer cannot record movements'
);

set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000000"}';
select throws_ok(
  format(
    $$select public.save_transaction(gen_random_uuid(), %L, 'expense', '2026-11-10', 100, %L, %L)$$,
    current_setting('t.space'), current_setting('t.caro_account'), current_setting('t.food')
  ),
  '23503',
  null,
  'a movement never uses an account of another space, even one the caller can write'
);

-- ── Integrity ────────────────────────────────────────────────────────────────
select throws_ok(
  format(
    $$select public.save_transaction(gen_random_uuid(), %L, 'expense', '2026-11-10', 100, %L, %L)$$,
    current_setting('t.space'), current_setting('t.cash'), current_setting('t.salary')
  ),
  '23514',
  'the category must be of the kind of the transaction',
  'an expense cannot use an income category'
);
select throws_ok(
  format(
    $$select public.save_transaction(gen_random_uuid(), %L, 'income', '2026-11-10', 100, %L, %L)$$,
    current_setting('t.space'), current_setting('t.cash'), current_setting('t.food')
  ),
  '23514',
  'the category must be of the kind of the transaction',
  'an income cannot use an expense category'
);
select throws_ok(
  format(
    $$select public.save_transaction(gen_random_uuid(), %L, 'expense', '2026-11-10', 100, %L)$$,
    current_setting('t.space'), current_setting('t.cash')
  ),
  '23514',
  null,
  'a confirmed expense needs a category'
);
select throws_ok(
  format(
    $$select public.save_transaction(gen_random_uuid(), %L, 'transfer', '2026-11-10', 100, %L)$$,
    current_setting('t.space'), current_setting('t.cash')
  ),
  '23514',
  null,
  'a transfer needs a destination'
);
select throws_ok(
  format(
    $$select public.save_transaction(gen_random_uuid(), %L, 'transfer', '2026-11-10', 100, %L,
        entry_to_account_id => %L)$$,
    current_setting('t.space'), current_setting('t.cash'), current_setting('t.cash')
  ),
  '23514',
  null,
  'a transfer goes to another account'
);
select throws_ok(
  format(
    $$insert into public.transactions (space_id, type, date, amount, account_id, to_account_id, category_id)
      values (%L, 'transfer', '2026-11-10', 100, %L, %L, %L)$$,
    current_setting('t.space'), current_setting('t.cash'), current_setting('t.card'), current_setting('t.food')
  ),
  '23514',
  null,
  'a transfer has no category'
);
select throws_ok(
  format(
    $$select public.save_transaction(gen_random_uuid(), %L, 'transfer', '2026-11-10', 100, %L,
        entry_to_account_id => %L)$$,
    current_setting('t.space'), current_setting('t.cash'), current_setting('t.usd')
  ),
  '23514',
  'a transfer between currencies needs the amount that arrived',
  'a transfer between currencies needs the amount that arrived'
);
select throws_ok(
  format(
    $$select public.save_transaction(gen_random_uuid(), %L, 'transfer', '2026-11-10', 100, %L,
        entry_to_account_id => %L, entry_to_amount => 100)$$,
    current_setting('t.space'), current_setting('t.cash'), current_setting('t.card')
  ),
  '23514',
  'a transfer within one currency has a single amount',
  'a transfer within one currency has a single amount'
);
select throws_ok(
  format(
    $$select public.save_transaction(gen_random_uuid(), %L, 'adjustment', '2026-11-10', 100, %L)$$,
    current_setting('t.space'), current_setting('t.cash')
  ),
  '23514',
  null,
  'an adjustment needs a direction'
);
select throws_ok(
  format(
    $$select public.save_transaction(gen_random_uuid(), %L, 'expense', '2026-11-10', 100, %L, %L,
        entry_adjustment_direction => 'increase')$$,
    current_setting('t.space'), current_setting('t.cash'), current_setting('t.food')
  ),
  '23514',
  null,
  'only adjustments have a direction'
);
select throws_ok(
  format(
    $$select public.save_transaction(gen_random_uuid(), %L, 'expense', '2026-11-10', 0, %L, %L)$$,
    current_setting('t.space'), current_setting('t.cash'), current_setting('t.food')
  ),
  '23514',
  null,
  'amounts are positive'
);
do $$
declare
  space uuid := current_setting('t.space')::uuid;
begin
  perform set_config('t.private_out', public.save_transaction(
    gen_random_uuid(), space, 'transfer', '2026-11-10', 100, current_setting('t.ana_private')::uuid,
    entry_to_account_id => current_setting('t.cash')::uuid, entry_include_in_space => true,
    entry_note => '   '
  )::text, true);
  perform set_config('t.shared_included', public.save_transaction(
    gen_random_uuid(), space, 'expense', '2026-11-10', 100, current_setting('t.cash')::uuid,
    current_setting('t.food')::uuid, entry_include_in_space => true
  )::text, true);
end $$;
select results_eq(
  format('select include_in_space, note from public.transactions where id = %L', current_setting('t.private_out')),
  $$values (false, null::text)$$,
  'only expenses and incomes are included in the space, and a blank note is no note'
);
select results_eq(
  format('select include_in_space from public.transactions where id = %L', current_setting('t.shared_included')),
  $$values (false)$$,
  'a movement of a shared account is never marked as included'
);

-- ── Idempotent saves ─────────────────────────────────────────────────────────
do $$
declare
  retry uuid := gen_random_uuid();
begin
  perform set_config('t.retry', retry::text, true);
  -- A retry after losing the response sends the same id again.
  perform public.save_transaction(
    retry, current_setting('t.space')::uuid, 'expense', '2026-11-10', 1200,
    current_setting('t.cash')::uuid, current_setting('t.food')::uuid
  );
  perform public.save_transaction(
    retry, current_setting('t.space')::uuid, 'expense', '2026-11-10', 1300,
    current_setting('t.cash')::uuid, current_setting('t.food')::uuid
  );
end $$;
select results_eq(
  format('select count(*)::int, max(amount) from public.transactions where id = %L', current_setting('t.retry')),
  $$values (1, 1300::bigint)$$,
  'saving twice with the same id leaves a single movement with the last values'
);

do $$
declare
  space uuid := current_setting('t.space')::uuid;
  private_included uuid := current_setting('t.private_included')::uuid;
begin
  perform public.save_transaction(
    private_included, space, 'expense', '2026-11-12', 7000, current_setting('t.ana_private')::uuid,
    current_setting('t.food')::uuid, entry_include_in_space => false
  );
  perform public.save_transaction(
    private_included, space, 'expense', '2026-11-12', 7500, current_setting('t.ana_private')::uuid,
    current_setting('t.food')::uuid
  );
end $$;
select results_eq(
  format('select include_in_space, amount from public.transactions where id = %L', current_setting('t.private_included')),
  $$values (false, 7500::bigint)$$,
  'editing without saying whether it is included keeps the stored choice'
);

-- ── Card deferrals ───────────────────────────────────────────────────────────
do $$
begin
  perform set_config('t.purchase', public.save_transaction(
    gen_random_uuid(), current_setting('t.space')::uuid, 'expense', '2026-11-14', 300000,
    current_setting('t.card')::uuid, current_setting('t.food')::uuid,
    entry_installments => 3, entry_monthly_rate => 0.015
  )::text, true);
end $$;
select results_eq(
  format(
    $$select kind, account_id::text, installments, rate, start_date from public.installment_plans
      where source_transaction_id = %L$$,
    current_setting('t.purchase')
  ),
  format(
    $$values ('card_deferral'::public.installment_plan_kind, %L, 3, 0.015::numeric(9, 6), '2026-11-14'::date)$$,
    current_setting('t.card')
  ),
  'a card purchase in installments stores its deferral'
);
select throws_ok(
  format(
    $$select public.save_transaction(gen_random_uuid(), %L, 'expense', '2026-11-14', 300000, %L, %L,
        entry_installments => 3)$$,
    current_setting('t.space'), current_setting('t.cash'), current_setting('t.food')
  ),
  '23514',
  'a card deferral belongs to an expense paid with that credit card',
  'only credit card purchases have installments'
);

update public.transactions set date = '2026-11-16' where id = current_setting('t.purchase')::uuid;
select results_eq(
  format('select start_date from public.installment_plans where source_transaction_id = %L', current_setting('t.purchase')),
  $$values ('2026-11-16'::date)$$,
  'the deferral follows the date of its purchase'
);

do $$
begin
  perform public.save_transaction(
    current_setting('t.purchase')::uuid, current_setting('t.space')::uuid, 'expense', '2026-11-16',
    300000, current_setting('t.card')::uuid, current_setting('t.food')::uuid
  );
end $$;
select is_empty(
  format('select 1 from public.installment_plans where source_transaction_id = %L', current_setting('t.purchase')),
  'saving a purchase in one installment removes its deferral'
);

do $$
begin
  perform public.save_transaction(
    current_setting('t.purchase')::uuid, current_setting('t.space')::uuid, 'expense', '2026-11-16',
    300000, current_setting('t.card')::uuid, current_setting('t.food')::uuid, entry_installments => 2
  );
  update public.transactions set account_id = current_setting('t.cash')::uuid
  where id = current_setting('t.purchase')::uuid;
end $$;
select is_empty(
  format('select 1 from public.installment_plans where source_transaction_id = %L', current_setting('t.purchase')),
  'a deferral goes away when its purchase is no longer paid with a card'
);

do $$
begin
  perform public.save_transaction(
    current_setting('t.purchase')::uuid, current_setting('t.space')::uuid, 'expense', '2026-11-16',
    300000, current_setting('t.card')::uuid, current_setting('t.food')::uuid, entry_installments => 2
  );
  delete from public.transactions where id = current_setting('t.purchase')::uuid;
end $$;
select is_empty(
  format('select 1 from public.installment_plans where source_transaction_id = %L', current_setting('t.purchase')),
  'deleting a purchase deletes its deferral'
);

-- ── Accounts and categories with movements ───────────────────────────────────
select throws_ok(
  format('delete from public.accounts where id = %L', current_setting('t.cash')),
  '23503',
  null,
  'an account with movements cannot be deleted'
);
select throws_ok(
  format($$update public.accounts set currency = 'USD' where id = %L$$, current_setting('t.cash')),
  '23514',
  'an account with transactions keeps its kind and currency',
  'the currency of an account with movements does not change'
);
select throws_ok(
  format($$update public.accounts set kind = 'bank' where id = %L$$, current_setting('t.cash')),
  '23514',
  'an account with transactions keeps its kind and currency',
  'the kind of an account with movements does not change'
);
select throws_ok(
  format($$update public.accounts set kind = 'wallet' where id = %L$$, current_setting('t.usd')),
  '23514',
  'an account with transactions keeps its kind and currency',
  'receiving a transfer also counts as having movements'
);
select lives_ok(
  $q$do $$
    declare
      new_id uuid;
    begin
      insert into public.accounts (space_id, name, kind, currency, initial_balance_date, icon, color)
      values (current_setting('t.space')::uuid, 'Nueva', 'cash', 'COP', '2026-11-01', 'payments', 'green')
      returning id into new_id;
      update public.accounts set currency = 'EUR', kind = 'bank' where id = new_id;
    end $$$q$,
  'an account without movements can still change its kind and currency'
);
select throws_ok(
  format('delete from public.categories where id = %L', current_setting('t.grocery')),
  '23503',
  null,
  'a category with movements cannot be deleted'
);
select throws_ok(
  $q$do $$
    declare
      parent uuid;
      child uuid;
    begin
      insert into public.categories (space_id, kind, name, icon, color)
      values (current_setting('t.space')::uuid, 'expense', 'Casa', 'home', 'orange')
      returning id into parent;
      insert into public.categories (space_id, parent_id, kind, name, icon)
      values (current_setting('t.space')::uuid, parent, 'expense', 'Arriendo', 'house')
      returning id into child;
      perform public.save_transaction(
        gen_random_uuid(), current_setting('t.space')::uuid, 'expense', '2026-11-01', 1500000,
        current_setting('t.cash')::uuid, child
      );
      delete from public.categories where id = parent;
    end $$$q$,
  '23503',
  null,
  'deleting a category is blocked by the movements of its subcategories'
);

-- ── Deleting a whole space ───────────────────────────────────────────────────
reset role;
select lives_ok(
  format('delete from public.spaces where id = %L', current_setting('t.space')),
  'deleting a space removes its movements first, so the restrict foreign keys do not block it'
);
select is_empty(
  format('select 1 from public.transactions where space_id = %L', current_setting('t.space')),
  'no movement of a deleted space is left'
);

select * from finish();
rollback;
