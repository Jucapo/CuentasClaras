-- Members (F1f): the owner changes other members' roles and removes them, anyone can leave, and
-- the space always keeps an owner, also on paths that skip RLS. space_member_list gives members
-- each other's names and emails.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

-- Ana owns "Hogar" with Beto and Eli (editors) and Dani (viewer). Caro owns her own space.
insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000000', 'ana@example.com'),
  ('b0000000-0000-4000-8000-000000000000', 'beto@example.com'),
  ('c0000000-0000-4000-8000-000000000000', 'caro@example.com'),
  ('d0000000-0000-4000-8000-00000000000d', 'dani@example.com'),
  ('e0000000-0000-4000-8000-00000000000e', 'eli@example.com');

set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000000"}';
do $$ begin perform set_config('t.space', public.create_space('Hogar', 'COP', 1, 'monday')::text, true); end $$;
set local request.jwt.claims to '{"sub": "c0000000-0000-4000-8000-000000000000"}';
do $$ begin perform set_config('t.caro_space', public.create_space('Caro', 'COP', 1, 'monday')::text, true); end $$;

reset role;
insert into public.space_members (space_id, user_id, role) values
  (current_setting('t.space')::uuid, 'b0000000-0000-4000-8000-000000000000', 'editor'),
  (current_setting('t.space')::uuid, 'd0000000-0000-4000-8000-00000000000d', 'viewer'),
  (current_setting('t.space')::uuid, 'e0000000-0000-4000-8000-00000000000e', 'editor');

-- ── space_member_list ────────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub": "d0000000-0000-4000-8000-00000000000d"}';
select results_eq(
  format('select display_name, email, role from public.space_member_list(%L)', current_setting('t.space')),
  $$values ('ana', 'ana@example.com', 'owner'::public.member_role),
           ('beto', 'beto@example.com', 'editor'::public.member_role),
           ('dani', 'dani@example.com', 'viewer'::public.member_role),
           ('eli', 'eli@example.com', 'editor'::public.member_role)$$,
  'any member sees the name, email and role of every member'
);
set local request.jwt.claims to '{"sub": "c0000000-0000-4000-8000-000000000000"}';
select is_empty(
  format('select 1 from public.space_member_list(%L)', current_setting('t.space')),
  'a non-member sees no members'
);
set local role anon;
select throws_ok(
  format('select public.space_member_list(%L)', current_setting('t.space')),
  '42501', null, 'anon cannot list members'
);

-- ── Roles ────────────────────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub": "b0000000-0000-4000-8000-000000000000"}';
select is_empty(
  $$update public.space_members set role = 'owner'
    where user_id = 'd0000000-0000-4000-8000-00000000000d' returning 1$$,
  'an editor cannot change roles'
);
set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000000"}';
select isnt_empty(
  $$update public.space_members set role = 'owner'
    where user_id = 'b0000000-0000-4000-8000-000000000000' returning 1$$,
  'the owner makes another member owner'
);
select is_empty(
  $$update public.space_members set role = 'editor'
    where user_id = 'a0000000-0000-4000-8000-000000000000' returning 1$$,
  'nobody changes their own role'
);

-- ── Removing and leaving ─────────────────────────────────────────────────────
set local request.jwt.claims to '{"sub": "e0000000-0000-4000-8000-00000000000e"}';
select is_empty(
  $$delete from public.space_members where user_id = 'd0000000-0000-4000-8000-00000000000d' returning 1$$,
  'an editor cannot remove another member'
);
set local request.jwt.claims to '{"sub": "c0000000-0000-4000-8000-000000000000"}';
select is_empty(
  $$delete from public.space_members where user_id = 'e0000000-0000-4000-8000-00000000000e' returning 1$$,
  'a non-member cannot remove members'
);
set local request.jwt.claims to '{"sub": "d0000000-0000-4000-8000-00000000000d"}';
select isnt_empty(
  $$delete from public.space_members where user_id = 'd0000000-0000-4000-8000-00000000000d' returning 1$$,
  'a viewer leaves the space'
);
select is_empty('select 1 from public.spaces', 'after leaving, the space is no longer visible');
set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000000"}';
select isnt_empty(
  $$delete from public.space_members where user_id = 'e0000000-0000-4000-8000-00000000000e' returning 1$$,
  'the owner removes an editor'
);
select isnt_empty(
  $$delete from public.space_members where user_id = 'b0000000-0000-4000-8000-000000000000' returning 1$$,
  'the owner removes another owner while one remains'
);
select throws_ok(
  $$delete from public.space_members where user_id = 'a0000000-0000-4000-8000-000000000000'$$,
  'P0001', 'last_owner', 'the last owner cannot leave'
);

-- ── At least one owner, without RLS ──────────────────────────────────────────
reset role;
select throws_ok(
  $$update public.space_members set role = 'editor' where user_id = 'a0000000-0000-4000-8000-000000000000'$$,
  'P0001', 'last_owner', 'the last owner cannot be demoted, even bypassing RLS'
);
select throws_ok(
  $$delete from public.space_members where user_id = 'a0000000-0000-4000-8000-000000000000'$$,
  'P0001', 'last_owner', 'the last owner cannot be deleted, even bypassing RLS'
);
insert into public.space_members (space_id, user_id, role)
  values (current_setting('t.space')::uuid, 'b0000000-0000-4000-8000-000000000000', 'owner');
select lives_ok(
  $$update public.space_members set role = 'viewer' where user_id = 'a0000000-0000-4000-8000-000000000000'$$,
  'an owner can be demoted while another owner remains'
);
select throws_ok(
  format('update public.space_members set role = %L where space_id = %L', 'editor', current_setting('t.space')),
  'P0001', 'last_owner', 'demoting every owner at once is blocked'
);
select lives_ok(
  format('update public.space_members set role = %L where space_id = %L', 'owner', current_setting('t.caro_space')),
  'another space is not affected'
);

-- Deleting a space still removes its members.
select lives_ok(
  format('delete from public.spaces where id = %L', current_setting('t.space')),
  'a space with members can still be deleted'
);
select is_empty(
  format('select 1 from public.space_members where space_id = %L', current_setting('t.space')),
  'deleting the space removes its members'
);

select * from finish();
rollback;
