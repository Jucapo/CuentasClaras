-- Accounts: shared accounts are visible to every member, private ones only to their owner;
-- writing needs owner or editor role. Plus derived defaults, the balances view and the default
-- account of each member.
begin;
create extension if not exists pgtap with schema extensions;
select plan(48);

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
do $$ begin perform set_config('t.caro_space', public.create_space('Caro', 'USD', 1, 'monday')::text, true); end $$;

reset role;
insert into public.space_members (space_id, user_id, role) values
  (current_setting('t.space')::uuid, 'b0000000-0000-4000-8000-000000000000', 'editor'),
  (current_setting('t.space')::uuid, 'd0000000-0000-4000-8000-00000000000d', 'viewer');

-- ── Owner creates accounts ───────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000000"}';
do $$
declare
  new_id uuid;
begin
  insert into public.accounts (space_id, name, kind, currency, initial_balance, initial_balance_date, icon, color)
  values (current_setting('t.space')::uuid, 'Efectivo', 'cash', 'COP', 100000, '2026-11-01', 'payments', 'green')
  returning id into new_id;
  perform set_config('t.cash', new_id::text, true);

  insert into public.accounts (space_id, visibility, name, kind, currency, initial_balance_date, icon, color)
  values (current_setting('t.space')::uuid, 'private', 'Ahorro Ana', 'savings', 'COP', '2026-11-01', 'savings', 'teal')
  returning id into new_id;
  perform set_config('t.ana_private', new_id::text, true);

  insert into public.accounts (space_id, name, kind, currency, initial_balance, initial_balance_date, icon, color)
  values (current_setting('t.space')::uuid, 'Tarjeta', 'credit_card', 'COP', -50000, '2026-11-01', 'credit_card', 'red')
  returning id into new_id;
  perform set_config('t.card', new_id::text, true);
end $$;

set local request.jwt.claims to '{"sub": "c0000000-0000-4000-8000-000000000000"}';
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
select results_eq(
  format(
    $$select name, owner_id, account_group, include_in_total, sort_order
      from public.accounts where space_id = %L order by sort_order$$,
    current_setting('t.space')
  ),
  $$values
    ('Efectivo', 'a0000000-0000-4000-8000-000000000000'::uuid, 'accounts'::public.account_group, true, 0),
    ('Ahorro Ana', 'a0000000-0000-4000-8000-000000000000'::uuid, 'savings'::public.account_group, false, 1),
    ('Tarjeta', 'a0000000-0000-4000-8000-000000000000'::uuid, 'debts'::public.account_group, false, 2)$$,
  'the owner is the caller, the group follows the kind, only the Accounts group counts in the total by default, and new accounts go last'
);
select results_eq(
  $$select account_group_of from unnest(enum_range(null::public.account_kind)) as k,
      private.account_group_of(k) order by k$$,
  $$values ('accounts'::public.account_group), ('accounts'), ('accounts'), ('savings'), ('debts'),
           ('debts'), ('debts'), ('receivables'), ('assets')$$,
  'every account kind maps to its group'
);

-- ── Editor ───────────────────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub": "b0000000-0000-4000-8000-000000000000"}';
select results_eq(
  'select name from public.accounts order by sort_order',
  $$values ('Efectivo'), ('Tarjeta')$$,
  'a member does not see the private accounts of another member'
);
select is_empty(
  format('select 1 from public.account_balances where account_id = %L', current_setting('t.ana_private')),
  'the balances view hides the private accounts of another member'
);
select lives_ok(
  $q$do $$
    declare
      new_id uuid;
    begin
      insert into public.accounts (space_id, visibility, name, kind, currency, initial_balance_date, icon, color, include_in_total)
      values (current_setting('t.space')::uuid, 'private', 'Nequi Beto', 'wallet', 'COP', '2026-11-01', 'smartphone', 'purple', false)
      returning id into new_id;
      perform set_config('t.beto_private', new_id::text, true);
    end $$$q$,
  'an editor creates a private account of their own'
);
select results_eq(
  format('select include_in_total, sort_order from public.accounts where id = %L', current_setting('t.beto_private')),
  $$values (false, 3)$$,
  'an explicit include_in_total wins over the group default'
);
select isnt_empty(
  format($$update public.accounts set name = 'Billetera' where id = %L returning 1$$, current_setting('t.cash')),
  'an editor edits a shared account'
);
select is_empty(
  format($$update public.accounts set name = 'Mía' where id = %L returning 1$$, current_setting('t.ana_private')),
  'an editor cannot edit the private account of another member'
);
select throws_ok(
  format($$update public.accounts set visibility = 'private' where id = %L$$, current_setting('t.card')),
  '42501',
  null,
  'an editor cannot make the shared account of another member private'
);
select throws_ok(
  format(
    $$insert into public.accounts (space_id, owner_id, name, kind, currency, initial_balance_date, icon, color)
      values (%L, 'a0000000-0000-4000-8000-000000000000', 'Ajena', 'cash', 'COP', '2026-11-01', 'payments', 'green')$$,
    current_setting('t.space')
  ),
  '42501',
  null,
  'nobody picks the owner of an account'
);
select throws_ok(
  format(
    'update public.accounts set space_id = %L where id = %L',
    current_setting('t.caro_space'),
    current_setting('t.cash')
  ),
  '42501',
  null,
  'an account cannot be moved to another space'
);
select throws_ok(
  format(
    $$insert into public.accounts (space_id, name, kind, currency, initial_balance_date, icon, color)
      values (%L, 'Hex', 'cash', 'COP', '2026-11-01', 'payments', '#ff0000')$$,
    current_setting('t.space')
  ),
  '23514',
  null,
  'colors are palette keys, never hex values'
);
select throws_ok(
  format(
    $$insert into public.accounts (space_id, name, kind, currency, initial_balance_date, icon, color)
      values (%L, 'Sin fecha', 'cash', 'COP', null, 'payments', 'green')$$,
    current_setting('t.space')
  ),
  '23502',
  null,
  'the initial balance date is required'
);
select lives_ok(
  $q$do $$
    declare
      new_id uuid;
    begin
      insert into public.accounts (space_id, name, kind, currency, initial_balance_date, icon, color)
      values (current_setting('t.space')::uuid, 'Temporal', 'cash', 'COP', '2026-11-01', 'payments', 'green')
      returning id into new_id;
      perform set_config('t.temporary', new_id::text, true);
    end $$$q$,
  'an editor creates a shared account'
);
select isnt_empty(
  format('delete from public.accounts where id = %L returning 1', current_setting('t.temporary')),
  'an editor deletes a shared account'
);
select is_empty(
  format('delete from public.accounts where id = %L returning 1', current_setting('t.ana_private')),
  'an editor cannot delete the private account of another member'
);

-- ── Viewer ───────────────────────────────────────────────────────────────────
set local request.jwt.claims to '{"sub": "d0000000-0000-4000-8000-00000000000d"}';
select results_eq(
  'select name from public.accounts order by sort_order',
  $$values ('Billetera'), ('Tarjeta')$$,
  'a viewer sees the shared accounts only'
);
select throws_ok(
  format(
    $$insert into public.accounts (space_id, name, kind, currency, initial_balance_date, icon, color)
      values (%L, 'Lector', 'cash', 'COP', '2026-11-01', 'payments', 'green')$$,
    current_setting('t.space')
  ),
  '42501',
  null,
  'a viewer cannot create accounts'
);
select is_empty(
  format($$update public.accounts set name = 'Lector' where id = %L returning 1$$, current_setting('t.cash')),
  'a viewer cannot edit accounts'
);
select is_empty(
  format('update public.accounts set archived_at = now() where id = %L returning 1', current_setting('t.cash')),
  'a viewer cannot archive accounts'
);
select is_empty(
  format('delete from public.accounts where id = %L returning 1', current_setting('t.cash')),
  'a viewer cannot delete accounts'
);
select throws_ok(
  format(
    $$insert into public.accounts (space_id, visibility, name, kind, currency, initial_balance_date, icon, color)
      values (%L, 'private', 'Privada del lector', 'cash', 'COP', '2026-11-01', 'payments', 'green')$$,
    current_setting('t.space')
  ),
  '42501',
  null,
  'a viewer cannot create private accounts either'
);

-- ── Non-member ───────────────────────────────────────────────────────────────
set local request.jwt.claims to '{"sub": "c0000000-0000-4000-8000-000000000000"}';
select results_eq(
  'select name from public.accounts',
  $$values ('Banco')$$,
  'a non-member sees no accounts of the space'
);
select throws_ok(
  format(
    $$insert into public.accounts (space_id, name, kind, currency, initial_balance_date, icon, color)
      values (%L, 'Intrusa', 'cash', 'COP', '2026-11-01', 'payments', 'green')$$,
    current_setting('t.space')
  ),
  '42501',
  null,
  'a non-member cannot create accounts in the space'
);

-- ── Balances view ────────────────────────────────────────────────────────────
set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000000"}';
select results_eq(
  format(
    'select currency, initial_balance, movements_total, balance from public.account_balances where account_id = %L',
    current_setting('t.card')
  ),
  $$values ('COP', -50000::bigint, 0::bigint, -50000::bigint)$$,
  'the balance is the initial balance until movements exist (debts are negative)'
);
select results_eq(
  format('select count(*)::int from public.account_balances where space_id = %L', current_setting('t.space')),
  $$values (3)$$,
  'the owner sees the balances of the shared accounts and of their own private ones'
);

-- ── set_default_account ──────────────────────────────────────────────────────
set local request.jwt.claims to '{"sub": "b0000000-0000-4000-8000-000000000000"}';
select lives_ok(
  format('select public.set_default_account(%L, %L)', current_setting('t.space'), current_setting('t.cash')),
  'a member picks a shared account as their default'
);
select results_eq(
  format(
    $$select default_account_id from public.space_members
      where space_id = %L and user_id = 'b0000000-0000-4000-8000-000000000000'$$,
    current_setting('t.space')
  ),
  format('values (%L::uuid)', current_setting('t.cash')),
  'set_default_account saves the default of the caller'
);
select lives_ok(
  format('select public.set_default_account(%L, %L)', current_setting('t.space'), current_setting('t.beto_private')),
  'a member picks one of their private accounts as their default'
);
select throws_ok(
  format('select public.set_default_account(%L, %L)', current_setting('t.space'), current_setting('t.ana_private')),
  '42501',
  null,
  'set_default_account rejects the private account of another member'
);
select throws_ok(
  format('select public.set_default_account(%L, %L)', current_setting('t.space'), current_setting('t.caro_account')),
  '42501',
  null,
  'set_default_account rejects an account of another space'
);
select throws_ok(
  format('select public.set_default_account(%L, %L)', current_setting('t.caro_space'), current_setting('t.caro_account')),
  '42501',
  null,
  'set_default_account rejects a space the caller does not belong to'
);
select throws_ok(
  format('select public.set_default_account(%L, gen_random_uuid())', current_setting('t.space')),
  '42501',
  null,
  'set_default_account rejects an account that does not exist'
);
select lives_ok(
  format('select public.set_default_account(%L, null)', current_setting('t.space')),
  'a member clears their default account'
);
select throws_ok(
  format(
    $$update public.space_members set default_account_id = %L
      where space_id = %L and user_id = 'b0000000-0000-4000-8000-000000000000'$$,
    current_setting('t.cash'),
    current_setting('t.space')
  ),
  '42501',
  null,
  'the default account only changes through set_default_account'
);

set local request.jwt.claims to '{"sub": "d0000000-0000-4000-8000-00000000000d"}';
select lives_ok(
  format('select public.set_default_account(%L, %L)', current_setting('t.space'), current_setting('t.card')),
  'a viewer also has a default account'
);

set local role anon;
select throws_ok(
  format('select public.set_default_account(%L, %L)', current_setting('t.space'), current_setting('t.cash')),
  '42501',
  null,
  'anonymous visitors cannot call set_default_account'
);

-- ── Defaults that become unreachable ─────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000000"}';
select lives_ok(
  format('select public.set_default_account(%L, %L)', current_setting('t.space'), current_setting('t.cash')),
  'the owner picks the cash account'
);
set local request.jwt.claims to '{"sub": "b0000000-0000-4000-8000-000000000000"}';
select lives_ok(
  format('select public.set_default_account(%L, %L)', current_setting('t.space'), current_setting('t.cash')),
  'the editor picks the same account'
);

set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000000"}';
select isnt_empty(
  format($$update public.accounts set visibility = 'private' where id = %L returning 1$$, current_setting('t.cash')),
  'the owner of an account makes it private'
);
reset role;
select results_eq(
  format(
    'select user_id, default_account_id from public.space_members where space_id = %L order by user_id',
    current_setting('t.space')
  ),
  format(
    $$values
      ('a0000000-0000-4000-8000-000000000000'::uuid, %L::uuid),
      ('b0000000-0000-4000-8000-000000000000'::uuid, null::uuid),
      ('d0000000-0000-4000-8000-00000000000d'::uuid, %L::uuid)$$,
    current_setting('t.cash'),
    current_setting('t.card')
  ),
  'making an account private clears it as the default of everyone but its owner'
);

set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000000"}';
select isnt_empty(
  format('update public.accounts set archived_at = now() where id = %L returning 1', current_setting('t.card')),
  'the owner archives the card'
);
select throws_ok(
  format('select public.set_default_account(%L, %L)', current_setting('t.space'), current_setting('t.card')),
  '42501',
  null,
  'set_default_account rejects an archived account'
);
reset role;
select results_eq(
  format(
    $$select default_account_id from public.space_members
      where space_id = %L and user_id = 'd0000000-0000-4000-8000-00000000000d'$$,
    current_setting('t.space')
  ),
  $$values (null::uuid)$$,
  'archiving an account clears it as the default of every member'
);

set local role authenticated;
set local request.jwt.claims to '{"sub": "b0000000-0000-4000-8000-000000000000"}';
select lives_ok(
  format('select public.set_default_account(%L, %L)', current_setting('t.space'), current_setting('t.beto_private')),
  'the editor picks their private account again'
);
select isnt_empty(
  format('delete from public.accounts where id = %L returning 1', current_setting('t.beto_private')),
  'the editor deletes their private account'
);
reset role;
select results_eq(
  format(
    $$select default_account_id from public.space_members
      where space_id = %L and user_id = 'b0000000-0000-4000-8000-000000000000'$$,
    current_setting('t.space')
  ),
  $$values (null::uuid)$$,
  'deleting an account leaves no dangling default'
);

select throws_ok(
  format(
    $$update public.space_members set default_account_id = %L
      where space_id = %L and user_id = 'c0000000-0000-4000-8000-000000000000'$$,
    current_setting('t.cash'),
    current_setting('t.caro_space')
  ),
  '23503',
  null,
  'the default account must belong to the same space, even for privileged writers'
);

select * from finish();
rollback;
