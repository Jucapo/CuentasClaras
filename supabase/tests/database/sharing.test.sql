-- Sharing between two members (F1f): private accounts stay private, movements included in the
-- space are seen by everyone and count in the joint totals, a viewer only reads, and leaving
-- deletes nothing: what was shared stays shared and what was private stays hidden.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

-- Ana owns "Hogar" with Beto (editor) and Dani (viewer).
insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000000', 'ana@example.com'),
  ('b0000000-0000-4000-8000-000000000000', 'beto@example.com'),
  ('d0000000-0000-4000-8000-00000000000d', 'dani@example.com');

set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000000"}';
do $$
declare
  space uuid := public.create_space('Hogar', 'COP', 1, 'monday');
  new_id uuid;
begin
  perform set_config('t.space', space::text, true);
  insert into public.accounts (space_id, name, kind, currency, initial_balance_date, icon, color)
  values (space, 'Efectivo', 'cash', 'COP', '2026-11-01', 'payments', 'green')
  returning id into new_id;
  perform set_config('t.cash', new_id::text, true);
  insert into public.categories (space_id, kind, name, icon, color)
  values (space, 'expense', 'Mercado', 'shopping_cart', 'green')
  returning id into new_id;
  perform set_config('t.food', new_id::text, true);
  perform public.save_transaction(gen_random_uuid(), space, 'expense', '2026-11-05', 10000, current_setting('t.cash')::uuid, new_id);
end $$;

reset role;
insert into public.space_members (space_id, user_id, role) values
  (current_setting('t.space')::uuid, 'b0000000-0000-4000-8000-000000000000', 'editor'),
  (current_setting('t.space')::uuid, 'd0000000-0000-4000-8000-00000000000d', 'viewer');

-- Beto's private account: one movement included in the space, one kept private.
set local role authenticated;
set local request.jwt.claims to '{"sub": "b0000000-0000-4000-8000-000000000000"}';
do $$
declare
  space uuid := current_setting('t.space')::uuid;
  food uuid := current_setting('t.food')::uuid;
  new_id uuid;
begin
  insert into public.accounts (space_id, visibility, name, kind, currency, initial_balance_date, icon, color)
  values (space, 'private', 'Ahorro Beto', 'bank', 'COP', '2026-11-01', 'account_balance', 'cyan')
  returning id into new_id;
  perform set_config('t.beto_private', new_id::text, true);
  perform public.save_transaction(gen_random_uuid(), space, 'expense', '2026-11-06', 2000, new_id, food, entry_include_in_space => true);
  perform public.save_transaction(gen_random_uuid(), space, 'expense', '2026-11-07', 500, new_id, food, entry_include_in_space => false);
  perform public.save_transaction(gen_random_uuid(), space, 'expense', '2026-11-08', 300, current_setting('t.cash')::uuid, food);
end $$;

-- ── Two members ──────────────────────────────────────────────────────────────
set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000000"}';
select is_empty(
  format('select 1 from public.accounts where id = %L', current_setting('t.beto_private')),
  'another member''s private account is hidden'
);
select results_eq(
  'select amount from public.transactions order by date',
  $$values (10000::bigint), (2000::bigint), (300::bigint)$$,
  'a member sees the shared movements and the private ones included in the space, not the rest'
);
select results_eq(
  format(
    $$select amount from public.category_totals(%L, '2026-11-01', '2026-11-30') where category_id = %L$$,
    current_setting('t.space'), current_setting('t.food')
  ),
  $$values (12300::bigint)$$,
  'the included private movement counts in the joint totals; the private one does not'
);
set local request.jwt.claims to '{"sub": "b0000000-0000-4000-8000-000000000000"}';
select results_eq(
  'select count(*) from public.transactions',
  $$values (4::bigint)$$,
  'the owner of the private account sees all of its movements'
);

-- ── A viewer only reads ──────────────────────────────────────────────────────
set local request.jwt.claims to '{"sub": "d0000000-0000-4000-8000-00000000000d"}';
select results_eq(
  'select count(*) from public.transactions',
  $$values (3::bigint)$$,
  'a viewer sees what is shared'
);
select throws_ok(
  format(
    $$select public.save_transaction(gen_random_uuid(), %L, 'expense', '2026-11-09', 100, %L, %L)$$,
    current_setting('t.space'), current_setting('t.cash'), current_setting('t.food')
  ),
  '42501', null, 'a viewer cannot record movements'
);
select is_empty(
  format($$update public.accounts set name = 'Otro' where id = %L returning 1$$, current_setting('t.cash')),
  'a viewer cannot edit shared accounts'
);

-- ── Beto leaves: nothing is deleted ──────────────────────────────────────────
set local request.jwt.claims to '{"sub": "b0000000-0000-4000-8000-000000000000"}';
select isnt_empty(
  $$delete from public.space_members where user_id = 'b0000000-0000-4000-8000-000000000000' returning 1$$,
  'Beto leaves the space'
);
select is_empty('select 1 from public.transactions', 'after leaving, Beto sees nothing of the space');
select is_empty(
  format('select 1 from public.accounts where id = %L', current_setting('t.beto_private')),
  'his private account is hidden from him too'
);
set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000000"}';
select results_eq(
  format(
    $$select amount from public.category_totals(%L, '2026-11-01', '2026-11-30') where category_id = %L$$,
    current_setting('t.space'), current_setting('t.food')
  ),
  $$values (12300::bigint)$$,
  'what Beto shared stays in the space and keeps counting'
);
reset role;
select is(
  (select count(*) from public.accounts where id = current_setting('t.beto_private')::uuid),
  1::bigint,
  'the private account is kept, so he gets it back if he returns'
);

select * from finish();
rollback;
