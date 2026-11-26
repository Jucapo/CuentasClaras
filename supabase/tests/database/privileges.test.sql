-- Grants: Supabase no longer grants anything by default, so every privilege is explicit.
-- These assertions catch a grant that goes missing or one that is too broad.
begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

-- ── anon gets nothing ────────────────────────────────────────────────────────
select table_privs_are('public', 'profiles', 'anon', array[]::text[], 'anon has no access to profiles');
select table_privs_are('public', 'spaces', 'anon', array[]::text[], 'anon has no access to spaces');
select table_privs_are('public', 'space_members', 'anon', array[]::text[], 'anon has no access to space_members');
select table_privs_are('public', 'space_settings', 'anon', array[]::text[], 'anon has no access to space_settings');
select table_privs_are('public', 'user_settings', 'anon', array[]::text[], 'anon has no access to user_settings');

-- ── authenticated: read, plus column-level updates ───────────────────────────
select table_privs_are('public', 'profiles', 'authenticated', array['SELECT'], 'authenticated reads profiles');
select table_privs_are('public', 'spaces', 'authenticated', array['SELECT'], 'authenticated reads spaces');
select table_privs_are('public', 'space_members', 'authenticated', array['SELECT'], 'authenticated reads space_members');
select table_privs_are('public', 'space_settings', 'authenticated', array['SELECT'], 'authenticated reads space_settings');
select table_privs_are('public', 'user_settings', 'authenticated', array['SELECT'], 'authenticated reads user_settings');

select column_privs_are('public', 'profiles', 'display_name', 'authenticated', array['SELECT', 'UPDATE'],
  'the display name is editable');
select column_privs_are('public', 'profiles', 'user_id', 'authenticated', array['SELECT'],
  'the profile key is read-only');
select column_privs_are('public', 'spaces', 'name', 'authenticated', array['SELECT', 'UPDATE'],
  'the space name is editable');
select column_privs_are('public', 'spaces', 'created_by', 'authenticated', array['SELECT'],
  'the space creator is read-only');
select column_privs_are('public', 'space_members', 'role', 'authenticated', array['SELECT', 'UPDATE'],
  'the member role is editable');
select column_privs_are('public', 'space_members', 'space_id', 'authenticated', array['SELECT'],
  'the membership space is read-only');
select column_privs_are('public', 'space_members', 'default_account_id', 'authenticated', array['SELECT'],
  'the default account is read-only until F1b');
select column_privs_are('public', 'space_settings', 'month_start_day', 'authenticated', array['SELECT', 'UPDATE'],
  'the month start day is editable');
select column_privs_are('public', 'space_settings', 'space_id', 'authenticated', array['SELECT'],
  'the settings space is read-only');
select column_privs_are('public', 'user_settings', 'last_space_id', 'authenticated', array['SELECT', 'UPDATE'],
  'the last space is editable');
select column_privs_are('public', 'user_settings', 'user_id', 'authenticated', array['SELECT'],
  'the settings owner is read-only');

-- ── service_role: plain CRUD for Edge Functions, never TRUNCATE ──────────────
select table_privs_are('public', 'profiles', 'service_role', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
  'service_role has CRUD on profiles');
select table_privs_are('public', 'spaces', 'service_role', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
  'service_role has CRUD on spaces');
select table_privs_are('public', 'space_members', 'service_role', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
  'service_role has CRUD on space_members');
select table_privs_are('public', 'space_settings', 'service_role', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
  'service_role has CRUD on space_settings');
select table_privs_are('public', 'user_settings', 'service_role', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
  'service_role has CRUD on user_settings');

-- ── Functions ────────────────────────────────────────────────────────────────
select function_privs_are('public', 'create_space', array['text', 'text', 'integer', 'weekday'], 'anon',
  array[]::text[], 'anon cannot call create_space');
select function_privs_are('public', 'create_space', array['text', 'text', 'integer', 'weekday'], 'authenticated',
  array['EXECUTE'], 'authenticated calls create_space');
select function_privs_are('private', 'is_space_member', array['uuid'], 'anon',
  array[]::text[], 'anon cannot call the membership helper');
select function_privs_are('private', 'handle_new_user', array[]::text[], 'authenticated',
  array[]::text[], 'nobody calls the sign-up trigger function directly');
select ok(
  not has_schema_privilege('anon', 'private', 'USAGE'),
  'the private schema is not reachable for anon'
);

select * from finish();
rollback;
