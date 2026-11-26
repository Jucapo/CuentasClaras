-- User settings: private to their owner; last_space_id may only point to one of the user's spaces.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000000', 'ana@example.com'),
  ('b0000000-0000-4000-8000-000000000000', 'beto@example.com'),
  ('c0000000-0000-4000-8000-000000000000', 'caro@example.com');

-- Ana owns "Hogar" (Beto is a member); Caro owns "Caro".
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000000"}';
do $$ begin perform set_config('t.ana_space', public.create_space('Hogar', 'COP', 1, 'monday')::text, true); end $$;
set local request.jwt.claims to '{"sub": "c0000000-0000-4000-8000-000000000000"}';
do $$ begin perform set_config('t.caro_space', public.create_space('Caro', 'COP', 1, 'monday')::text, true); end $$;

reset role;
insert into public.space_members (space_id, user_id, role)
values (current_setting('t.ana_space')::uuid, 'b0000000-0000-4000-8000-000000000000', 'viewer');

set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000000"}';

select results_eq(
  'select user_id from public.user_settings',
  $$values ('a0000000-0000-4000-8000-000000000000'::uuid)$$,
  'a user only sees their own settings'
);
select is_empty(
  $$update public.user_settings set theme = 'dark'
    where user_id = 'c0000000-0000-4000-8000-000000000000' returning 1$$,
  'a user cannot edit someone else''s settings'
);
select lives_ok(
  format(
    $$update public.user_settings set last_space_id = %L, number_format = 'dot_comma', show_decimals = false
      where user_id = 'a0000000-0000-4000-8000-000000000000'$$,
    current_setting('t.ana_space')
  ),
  'a user remembers one of their spaces and their number format'
);
select throws_ok(
  format(
    $$update public.user_settings set last_space_id = %L
      where user_id = 'a0000000-0000-4000-8000-000000000000'$$,
    current_setting('t.caro_space')
  ),
  '42501',
  null,
  'last_space_id cannot point to a space the user does not belong to'
);
select throws_ok(
  $$insert into public.user_settings (user_id) values ('a0000000-0000-4000-8000-000000000000')$$,
  '42501',
  null,
  'user settings cannot be inserted from the client'
);
select throws_ok(
  $$delete from public.user_settings where user_id = 'a0000000-0000-4000-8000-000000000000'$$,
  '42501',
  null,
  'user settings cannot be deleted from the client'
);

-- Beto remembers Ana's space, then leaves it: the stale value must not block other changes.
set local request.jwt.claims to '{"sub": "b0000000-0000-4000-8000-000000000000"}';
select lives_ok(
  format(
    $$update public.user_settings set last_space_id = %L
      where user_id = 'b0000000-0000-4000-8000-000000000000'$$,
    current_setting('t.ana_space')
  ),
  'a member remembers a shared space'
);

reset role;
delete from public.space_members
where space_id = current_setting('t.ana_space')::uuid
  and user_id = 'b0000000-0000-4000-8000-000000000000';

set local role authenticated;
set local request.jwt.claims to '{"sub": "b0000000-0000-4000-8000-000000000000"}';
select isnt_empty(
  $$update public.user_settings set theme = 'dark'
    where user_id = 'b0000000-0000-4000-8000-000000000000' returning 1$$,
  'a stale last_space_id does not block saving other preferences'
);
select lives_ok(
  $$update public.user_settings set last_space_id = null
    where user_id = 'b0000000-0000-4000-8000-000000000000'$$,
  'last_space_id can be cleared'
);

select * from finish();
rollback;
