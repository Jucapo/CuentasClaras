-- Profiles: created on sign-up; readable by their owner and by people who share a space.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

-- Ana and Beto share a space; Caro shares none with them.
insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000000', 'ana@example.com'),
  ('b0000000-0000-4000-8000-000000000000', 'beto@example.com'),
  ('c0000000-0000-4000-8000-000000000000', 'caro@example.com'),
  ('e0000000-0000-4000-8000-000000000000', repeat('x', 90) || '@example.com');

select is(
  (select display_name from public.profiles where user_id = 'a0000000-0000-4000-8000-000000000000'),
  'ana',
  'sign-up creates the profile named after the email local part'
);
select is(
  (select char_length(display_name) from public.profiles where user_id = 'e0000000-0000-4000-8000-000000000000'),
  80,
  'a long email local part is cut to the display name limit instead of failing the sign-up'
);
select ok(
  exists (select 1 from public.user_settings where user_id = 'a0000000-0000-4000-8000-000000000000'),
  'sign-up creates the user settings'
);

set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000000"}';
do $$ begin perform set_config('t.space', public.create_space('Hogar', 'COP', 1, 'monday')::text, true); end $$;

reset role;
insert into public.space_members (space_id, user_id, role)
values (current_setting('t.space')::uuid, 'b0000000-0000-4000-8000-000000000000', 'editor');

set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000000"}';

select results_eq(
  'select display_name from public.profiles order by display_name',
  $$values ('ana'), ('beto')$$,
  'a user sees their own profile and the profiles of their space mates, nobody else'
);
select is_empty(
  $$update public.profiles set display_name = 'Intruso'
    where user_id = 'b0000000-0000-4000-8000-000000000000' returning 1$$,
  'a user cannot edit a space mate''s profile'
);
select isnt_empty(
  $$update public.profiles set display_name = 'Ana María'
    where user_id = 'a0000000-0000-4000-8000-000000000000' returning 1$$,
  'a user edits their own display name'
);
select throws_ok(
  $$insert into public.profiles (user_id, display_name)
    values ('c0000000-0000-4000-8000-000000000000', 'Caro')$$,
  '42501',
  null,
  'profiles cannot be inserted from the client'
);
select throws_ok(
  $$update public.profiles set user_id = 'c0000000-0000-4000-8000-000000000000'
    where user_id = 'a0000000-0000-4000-8000-000000000000'$$,
  '42501',
  null,
  'a profile''s user cannot be changed'
);

set local request.jwt.claims to '{"sub": "c0000000-0000-4000-8000-000000000000"}';

select results_eq(
  'select display_name from public.profiles',
  $$values ('caro')$$,
  'a user without shared spaces only sees their own profile'
);
select is_empty(
  $$update public.profiles set display_name = 'Intruso'
    where user_id = 'a0000000-0000-4000-8000-000000000000' returning 1$$,
  'a stranger cannot edit someone else''s profile'
);

select * from finish();
rollback;
