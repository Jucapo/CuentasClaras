-- Spaces, members and space settings: created only through create_space, visible only to
-- members, configured only by the owner.
begin;
create extension if not exists pgtap with schema extensions;
select plan(40);

-- Ana owns "Hogar" with Beto (editor) and Dani (viewer). Caro owns her own space.
insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000000', 'ana@example.com'),
  ('b0000000-0000-4000-8000-000000000000', 'beto@example.com'),
  ('c0000000-0000-4000-8000-000000000000', 'caro@example.com'),
  ('d0000000-0000-4000-8000-00000000000d', 'dani@example.com');

-- ── create_space ─────────────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000000"}';
do $$ begin perform set_config('t.space', public.create_space('  Hogar  ', 'COP', 28, 'sunday')::text, true); end $$;
set local request.jwt.claims to '{"sub": "c0000000-0000-4000-8000-000000000000"}';
do $$ begin perform set_config('t.caro_space', public.create_space('Caro', 'USD', 1, 'monday')::text, true); end $$;

reset role;
select results_eq(
  format('select name, created_by from public.spaces where id = %L', current_setting('t.space')),
  $$values ('Hogar', 'a0000000-0000-4000-8000-000000000000'::uuid)$$,
  'create_space creates the space with the trimmed name and its creator'
);
select results_eq(
  format('select user_id, role from public.space_members where space_id = %L', current_setting('t.space')),
  $$values ('a0000000-0000-4000-8000-000000000000'::uuid, 'owner'::public.member_role)$$,
  'create_space makes the creator the only member, as owner'
);
select results_eq(
  format(
    $$select main_currency, month_start_day, week_start, onboarding_step, onboarding_completed_at,
             budgets_enabled, default_period
      from public.space_settings where space_id = %L$$,
    current_setting('t.space')
  ),
  $$values ('COP', 28::smallint, 'sunday'::public.weekday, 1::smallint, null::timestamptz,
            true, 'month'::public.period_kind)$$,
  'create_space stores the settings and marks the first wizard step as done'
);

insert into public.space_members (space_id, user_id, role) values
  (current_setting('t.space')::uuid, 'b0000000-0000-4000-8000-000000000000', 'editor'),
  (current_setting('t.space')::uuid, 'd0000000-0000-4000-8000-00000000000d', 'viewer');

set local role anon;
select throws_ok(
  $$select public.create_space('Anónimo', 'COP', 1, 'monday')$$,
  '42501',
  null,
  'anonymous visitors cannot create spaces'
);

set local role authenticated;
set local request.jwt.claims to '{}';
select throws_ok(
  $$select public.create_space('Sin sesión', 'COP', 1, 'monday')$$,
  '42501',
  null,
  'create_space requires a signed-in user'
);

set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000000"}';
select throws_ok(
  $$select public.create_space('Raro', 'PESO', 1, 'monday')$$,
  '23514',
  null,
  'the main currency must be an ISO 4217 code'
);
select throws_ok(
  $$select public.create_space('Raro', 'COP', 29, 'monday')$$,
  '23514',
  null,
  'the month cannot start after day 28'
);
select throws_ok(
  $$select public.create_space('   ', 'COP', 1, 'monday')$$,
  '23514',
  null,
  'the space name cannot be blank'
);

-- ── No direct writes ─────────────────────────────────────────────────────────
select throws_ok(
  $$insert into public.spaces (name) values ('Directo')$$,
  '42501',
  null,
  'spaces cannot be inserted directly'
);
select throws_ok(
  format(
    $$insert into public.space_members (space_id, user_id, role)
      values (%L, 'c0000000-0000-4000-8000-000000000000', 'viewer')$$,
    current_setting('t.space')
  ),
  '42501',
  null,
  'members cannot be inserted directly'
);
select throws_ok(
  format('insert into public.space_settings (space_id) values (%L)', current_setting('t.caro_space')),
  '42501',
  null,
  'space settings cannot be inserted directly'
);
select throws_ok(
  format('delete from public.spaces where id = %L', current_setting('t.space')),
  '42501',
  null,
  'spaces cannot be deleted from the client yet'
);
select throws_ok(
  format('delete from public.space_members where space_id = %L', current_setting('t.space')),
  'P0001',
  'last_owner',
  'removing every member is blocked: the space keeps an owner (members.test.sql covers removal)'
);

-- ── Isolation: a non-member sees and changes nothing ─────────────────────────
set local request.jwt.claims to '{"sub": "c0000000-0000-4000-8000-000000000000"}';
select results_eq(
  'select name from public.spaces',
  $$values ('Caro')$$,
  'a user only sees the spaces they belong to'
);
select is_empty(
  format('select 1 from public.space_members where space_id = %L', current_setting('t.space')),
  'a non-member cannot see the members of a space'
);
select is_empty(
  format('select 1 from public.space_settings where space_id = %L', current_setting('t.space')),
  'a non-member cannot see the settings of a space'
);
select is_empty(
  format($$update public.spaces set name = 'Intruso' where id = %L returning 1$$, current_setting('t.space')),
  'a non-member cannot rename a space'
);
select is_empty(
  format(
    'update public.space_settings set month_start_day = 5 where space_id = %L returning 1',
    current_setting('t.space')
  ),
  'a non-member cannot change the settings of a space'
);
select is_empty(
  format(
    $$update public.space_members set role = 'viewer' where space_id = %L returning 1$$,
    current_setting('t.space')
  ),
  'a non-member cannot change roles'
);

-- ── Viewer ───────────────────────────────────────────────────────────────────
set local request.jwt.claims to '{"sub": "d0000000-0000-4000-8000-00000000000d"}';
select results_eq(
  'select name from public.spaces',
  $$values ('Hogar')$$,
  'a viewer sees the space'
);
select results_eq(
  format('select count(*)::int from public.space_members where space_id = %L', current_setting('t.space')),
  $$values (3)$$,
  'a viewer sees every member of the space'
);
select is_empty(
  format(
    'update public.space_settings set month_start_day = 5 where space_id = %L returning 1',
    current_setting('t.space')
  ),
  'a viewer cannot change the space settings'
);
select is_empty(
  format($$update public.spaces set name = 'Lector' where id = %L returning 1$$, current_setting('t.space')),
  'a viewer cannot rename the space'
);
select is_empty(
  $$update public.space_members set role = 'owner'
    where user_id = 'd0000000-0000-4000-8000-00000000000d' returning 1$$,
  'a viewer cannot promote themselves'
);

-- ── Editor ───────────────────────────────────────────────────────────────────
set local request.jwt.claims to '{"sub": "b0000000-0000-4000-8000-000000000000"}';
select is_empty(
  format(
    'update public.space_settings set month_start_day = 5 where space_id = %L returning 1',
    current_setting('t.space')
  ),
  'an editor cannot change the space settings (configuration is owner-only)'
);
select is_empty(
  format(
    'update public.space_settings set onboarding_postponed_at = now() where space_id = %L returning 1',
    current_setting('t.space')
  ),
  'an editor cannot postpone the setup wizard'
);
select is_empty(
  format($$update public.spaces set name = 'Editor' where id = %L returning 1$$, current_setting('t.space')),
  'an editor cannot rename the space'
);
select is_empty(
  $$update public.space_members set role = 'editor'
    where user_id = 'd0000000-0000-4000-8000-00000000000d' returning 1$$,
  'an editor cannot change other members'' roles'
);
select is_empty(
  $$update public.space_members set role = 'owner'
    where user_id = 'b0000000-0000-4000-8000-000000000000' returning 1$$,
  'an editor cannot promote themselves'
);

-- ── Owner ────────────────────────────────────────────────────────────────────
set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000000"}';
select isnt_empty(
  format(
    $$update public.space_settings set month_start_day = 15, week_start = 'monday', main_currency = 'USD'
      where space_id = %L returning 1$$,
    current_setting('t.space')
  ),
  'the owner changes the space settings'
);
select isnt_empty(
  format(
    $$update public.space_settings set onboarding_step = 3, onboarding_postponed_at = now()
      where space_id = %L returning 1$$,
    current_setting('t.space')
  ),
  'the owner saves the wizard progress and postpones it'
);
select isnt_empty(
  format($$update public.spaces set name = 'Casa' where id = %L returning 1$$, current_setting('t.space')),
  'the owner renames the space'
);
select isnt_empty(
  $$update public.space_members set role = 'editor'
    where user_id = 'd0000000-0000-4000-8000-00000000000d' returning 1$$,
  'the owner changes another member''s role'
);
select is_empty(
  $$update public.space_members set role = 'viewer'
    where user_id = 'a0000000-0000-4000-8000-000000000000' returning 1$$,
  'the owner cannot change their own role, so the space keeps an owner'
);
select throws_ok(
  $$update public.space_members set user_id = 'c0000000-0000-4000-8000-000000000000'
    where user_id = 'b0000000-0000-4000-8000-000000000000'$$,
  '42501',
  null,
  'a membership cannot be moved to another user'
);
select throws_ok(
  format(
    'update public.space_settings set space_id = %L where space_id = %L',
    current_setting('t.caro_space'),
    current_setting('t.space')
  ),
  '42501',
  null,
  'settings cannot be moved to another space'
);
select throws_ok(
  format('update public.space_settings set month_start_day = 29 where space_id = %L', current_setting('t.space')),
  '23514',
  null,
  'the month start day stays between 1 and 28'
);
select throws_ok(
  format('update public.space_settings set month_start_day = 0 where space_id = %L', current_setting('t.space')),
  '23514',
  null,
  'the month start day cannot be 0'
);
select throws_ok(
  format($$update public.space_settings set main_currency = 'cop' where space_id = %L$$, current_setting('t.space')),
  '23514',
  null,
  'the currency code must be uppercase ISO 4217'
);

reset role;
select results_eq(
  format('select month_start_day, main_currency from public.space_settings where space_id = %L', current_setting('t.space')),
  $$values (15::smallint, 'USD')$$,
  'only the owner''s change reached the settings'
);

select * from finish();
rollback;
