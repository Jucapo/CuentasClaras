-- Grants: Supabase no longer grants anything by default, so every privilege is explicit.
-- These assertions catch a grant that goes missing or one that is too broad.
begin;
create extension if not exists pgtap with schema extensions;
select plan(119);

-- ── anon gets nothing ────────────────────────────────────────────────────────
select table_privs_are('public', 'profiles', 'anon', array[]::text[], 'anon has no access to profiles');
select table_privs_are('public', 'spaces', 'anon', array[]::text[], 'anon has no access to spaces');
select table_privs_are('public', 'space_members', 'anon', array[]::text[], 'anon has no access to space_members');
select table_privs_are('public', 'space_settings', 'anon', array[]::text[], 'anon has no access to space_settings');
select table_privs_are('public', 'user_settings', 'anon', array[]::text[], 'anon has no access to user_settings');
select table_privs_are('public', 'accounts', 'anon', array[]::text[], 'anon has no access to accounts');
select table_privs_are('public', 'categories', 'anon', array[]::text[], 'anon has no access to categories');
select table_privs_are('public', 'tags', 'anon', array[]::text[], 'anon has no access to tags');
select table_privs_are('public', 'category_default_tags', 'anon', array[]::text[],
  'anon has no access to category_default_tags');
select table_privs_are('public', 'account_balances', 'anon', array[]::text[], 'anon has no access to account_balances');
select table_privs_are('public', 'budgets', 'anon', array[]::text[], 'anon has no access to budgets');

-- ── authenticated: read, plus column-level updates ───────────────────────────
select table_privs_are('public', 'profiles', 'authenticated', array['SELECT'], 'authenticated reads profiles');
select table_privs_are('public', 'spaces', 'authenticated', array['SELECT'], 'authenticated reads spaces');
select table_privs_are('public', 'space_members', 'authenticated', array['SELECT'], 'authenticated reads space_members');
select table_privs_are('public', 'space_settings', 'authenticated', array['SELECT'], 'authenticated reads space_settings');
select table_privs_are('public', 'user_settings', 'authenticated', array['SELECT'], 'authenticated reads user_settings');
select table_privs_are('public', 'accounts', 'authenticated', array['SELECT', 'DELETE'],
  'authenticated reads and deletes accounts (RLS decides which)');
select table_privs_are('public', 'categories', 'authenticated', array['SELECT', 'DELETE'],
  'authenticated reads and deletes categories (RLS decides which)');
select table_privs_are('public', 'tags', 'authenticated', array['SELECT', 'DELETE'],
  'authenticated reads and deletes tags (RLS decides which)');
select table_privs_are('public', 'category_default_tags', 'authenticated', array['SELECT', 'DELETE'],
  'authenticated reads and removes default tags (RLS decides which)');
select table_privs_are('public', 'account_balances', 'authenticated', array['SELECT'],
  'authenticated reads the balances view');
select table_privs_are('public', 'budgets', 'authenticated', array['SELECT', 'DELETE'],
  'authenticated reads and deletes budgets (RLS decides which)');

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
  'the default account only changes through set_default_account');
select column_privs_are('public', 'spaces', 'icon', 'authenticated', array['SELECT', 'UPDATE'],
  'the space icon is editable');
select column_privs_are('public', 'accounts', 'name', 'authenticated', array['SELECT', 'INSERT', 'UPDATE'],
  'the account name is set on insert and editable');
select column_privs_are('public', 'accounts', 'space_id', 'authenticated', array['SELECT', 'INSERT'],
  'an account never moves to another space');
select column_privs_are('public', 'accounts', 'owner_id', 'authenticated', array['SELECT'],
  'nobody picks or changes the owner of an account');
select column_privs_are('public', 'accounts', 'archived_at', 'authenticated', array['SELECT', 'UPDATE'],
  'accounts are archived by update, never created archived');
select column_privs_are('public', 'categories', 'kind', 'authenticated', array['SELECT', 'INSERT'],
  'the kind of a category is set once');
select column_privs_are('public', 'categories', 'parent_id', 'authenticated', array['SELECT', 'INSERT', 'UPDATE'],
  'a subcategory can move to another parent');
select column_privs_are('public', 'tags', 'color', 'authenticated', array['SELECT', 'INSERT', 'UPDATE'],
  'the tag color is editable');
select column_privs_are('public', 'category_default_tags', 'tag_id', 'authenticated', array['SELECT', 'INSERT'],
  'default tag links are never edited in place');
select column_privs_are('public', 'space_settings', 'month_start_day', 'authenticated', array['SELECT', 'UPDATE'],
  'the month start day is editable');
select column_privs_are('public', 'space_settings', 'space_id', 'authenticated', array['SELECT'],
  'the settings space is read-only');
select column_privs_are('public', 'space_settings', 'onboarding_postponed_at', 'authenticated',
  array['SELECT', 'UPDATE'], 'postponing the wizard is a settings update');
select column_privs_are('public', 'budgets', 'amount', 'authenticated', array['SELECT', 'INSERT', 'UPDATE'],
  'the budget amount is set on insert and editable');
select column_privs_are('public', 'budgets', 'currency', 'authenticated', array['SELECT', 'INSERT', 'UPDATE'],
  'the budget currency is set on insert and editable');
select column_privs_are('public', 'budgets', 'space_id', 'authenticated', array['SELECT', 'INSERT'],
  'a budget never moves to another space');
select column_privs_are('public', 'budgets', 'category_id', 'authenticated', array['SELECT', 'INSERT'],
  'a budget never moves to another category');
select column_privs_are('public', 'budgets', 'effective_from', 'authenticated', array['SELECT', 'INSERT'],
  'a change from another period is a new row');
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
select table_privs_are('public', 'accounts', 'service_role', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
  'service_role has CRUD on accounts');
select table_privs_are('public', 'categories', 'service_role', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
  'service_role has CRUD on categories');
select table_privs_are('public', 'tags', 'service_role', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
  'service_role has CRUD on tags');
select table_privs_are('public', 'category_default_tags', 'service_role', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
  'service_role has CRUD on category_default_tags');
select table_privs_are('public', 'account_balances', 'service_role', array['SELECT'],
  'service_role reads the balances view');
select table_privs_are('public', 'budgets', 'service_role', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
  'service_role has CRUD on budgets');

-- ── Functions ────────────────────────────────────────────────────────────────
select function_privs_are('public', 'create_space', array['text', 'text', 'integer', 'weekday'], 'anon',
  array[]::text[], 'anon cannot call create_space');
select function_privs_are('public', 'create_space', array['text', 'text', 'integer', 'weekday'], 'authenticated',
  array['EXECUTE'], 'authenticated calls create_space');
select function_privs_are('private', 'is_space_member', array['uuid'], 'anon',
  array[]::text[], 'anon cannot call the membership helper');
select function_privs_are('private', 'handle_new_user', array[]::text[], 'authenticated',
  array[]::text[], 'nobody calls the sign-up trigger function directly');
select function_privs_are('public', 'set_default_account', array['uuid', 'uuid'], 'anon',
  array[]::text[], 'anon cannot call set_default_account');
select function_privs_are('public', 'set_default_account', array['uuid', 'uuid'], 'authenticated',
  array['EXECUTE'], 'authenticated calls set_default_account');
select function_privs_are('public', 'reorder_categories', array['uuid[]'], 'anon',
  array[]::text[], 'anon cannot call reorder_categories');
select function_privs_are('public', 'reorder_categories', array['uuid[]'], 'authenticated',
  array['EXECUTE'], 'authenticated calls reorder_categories');
select function_privs_are('public', 'create_category_tree', array['uuid', 'category_kind', 'jsonb'], 'anon',
  array[]::text[], 'anon cannot call create_category_tree');
select function_privs_are('public', 'create_category_tree', array['uuid', 'category_kind', 'jsonb'],
  'authenticated', array['EXECUTE'], 'authenticated calls create_category_tree');
select function_privs_are('private', 'is_space_editor', array['uuid'], 'anon',
  array[]::text[], 'anon cannot call the editor helper');
select function_privs_are('private', 'can_see_account', array['uuid'], 'anon',
  array[]::text[], 'anon cannot call the account visibility helper');
select function_privs_are('private', 'account_group_of', array['account_kind'], 'anon',
  array[]::text[], 'anon cannot call the account group helper');
select function_privs_are('private', 'set_account_defaults', array[]::text[], 'authenticated',
  array[]::text[], 'nobody calls the account defaults trigger function directly');
select function_privs_are('private', 'clear_unreachable_default_account', array[]::text[], 'authenticated',
  array[]::text[], 'nobody calls the default account cleanup directly');
select function_privs_are('private', 'check_category_hierarchy', array[]::text[], 'authenticated',
  array[]::text[], 'nobody calls the category hierarchy check directly');
select ok(
  not has_schema_privilege('anon', 'private', 'USAGE'),
  'the private schema is not reachable for anon'
);

-- ── F1d: movements, deferrals and exchange rates ─────────────────────────────
select table_privs_are('public', 'transactions', 'anon', array[]::text[], 'anon has no access to transactions');
select table_privs_are('public', 'transaction_tags', 'anon', array[]::text[], 'anon has no access to transaction_tags');
select table_privs_are('public', 'installment_plans', 'anon', array[]::text[], 'anon has no access to installment_plans');
select table_privs_are('public', 'exchange_rates', 'anon', array[]::text[], 'anon has no access to exchange_rates');

select table_privs_are('public', 'transactions', 'authenticated', array['SELECT', 'DELETE'],
  'authenticated reads and deletes transactions (RLS decides which)');
select table_privs_are('public', 'transaction_tags', 'authenticated', array['SELECT', 'DELETE'],
  'authenticated reads and removes transaction tags (RLS decides which)');
select table_privs_are('public', 'installment_plans', 'authenticated', array['SELECT', 'DELETE'],
  'authenticated reads and deletes installment plans (RLS decides which)');
select table_privs_are('public', 'exchange_rates', 'authenticated', array['SELECT', 'DELETE'],
  'authenticated reads and deletes exchange rates (RLS decides which)');

select table_privs_are('public', 'transactions', 'service_role', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
  'service_role has CRUD on transactions');
select table_privs_are('public', 'transaction_tags', 'service_role', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
  'service_role has CRUD on transaction_tags');
select table_privs_are('public', 'installment_plans', 'service_role', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
  'service_role has CRUD on installment_plans');
select table_privs_are('public', 'exchange_rates', 'service_role', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
  'service_role has CRUD on exchange_rates');

select column_privs_are('public', 'transactions', 'id', 'authenticated', array['SELECT', 'INSERT'],
  'the client picks the id of a new movement, so a retry does not duplicate it');
select column_privs_are('public', 'transactions', 'amount', 'authenticated', array['SELECT', 'INSERT', 'UPDATE'],
  'the amount is set on insert and editable');
select column_privs_are('public', 'transactions', 'space_id', 'authenticated', array['SELECT', 'INSERT'],
  'a movement never moves to another space');
select column_privs_are('public', 'transactions', 'currency', 'authenticated', array['SELECT'],
  'the currency of a movement comes from its account');
select column_privs_are('public', 'transactions', 'created_by', 'authenticated', array['SELECT'],
  'nobody picks the author of a movement');
select column_privs_are('public', 'transactions', 'source', 'authenticated', array['SELECT'],
  'the source is set by automation, never by the client');
select column_privs_are('public', 'transactions', 'status', 'authenticated', array['SELECT'],
  'the client only records confirmed movements');
select column_privs_are('public', 'transactions', 'external_id', 'authenticated', array['SELECT'],
  'external ids belong to imports and automation');
select column_privs_are('public', 'transactions', 'financing_plan_id', 'authenticated', array['SELECT'],
  'financing links arrive with debts (F2)');
select column_privs_are('public', 'transaction_tags', 'tag_id', 'authenticated', array['SELECT', 'INSERT'],
  'transaction tags are never edited in place');
select column_privs_are('public', 'installment_plans', 'installments', 'authenticated', array['SELECT', 'INSERT', 'UPDATE'],
  'the installments of a deferral are editable');
select column_privs_are('public', 'installment_plans', 'kind', 'authenticated', array['SELECT', 'INSERT'],
  'the kind of a plan is set once');
select column_privs_are('public', 'installment_plans', 'source_transaction_id', 'authenticated', array['SELECT', 'INSERT'],
  'a deferral never moves to another purchase');
select column_privs_are('public', 'exchange_rates', 'rate', 'authenticated', array['SELECT', 'INSERT'],
  'rates are replaced, never edited in place');
select column_privs_are('public', 'exchange_rates', 'source', 'authenticated', array['SELECT'],
  'the client only writes manual rates');

select function_privs_are('public', 'save_transaction',
  array['uuid', 'uuid', 'transaction_type', 'date', 'bigint', 'uuid', 'uuid', 'uuid', 'bigint',
        'adjustment_direction', 'text', 'boolean', 'uuid[]', 'integer', 'numeric'],
  'anon', array[]::text[], 'anon cannot call save_transaction');
select function_privs_are('public', 'save_transaction',
  array['uuid', 'uuid', 'transaction_type', 'date', 'bigint', 'uuid', 'uuid', 'uuid', 'bigint',
        'adjustment_direction', 'text', 'boolean', 'uuid[]', 'integer', 'numeric'],
  'authenticated', array['EXECUTE'], 'authenticated calls save_transaction');
select function_privs_are('public', 'category_totals', array['uuid', 'date', 'date', 'date[]'], 'anon',
  array[]::text[], 'anon cannot call category_totals');
select function_privs_are('public', 'category_totals', array['uuid', 'date', 'date', 'date[]'], 'authenticated',
  array['EXECUTE'], 'authenticated calls category_totals');
select function_privs_are('public', 'accounts_total', array['uuid', 'date'], 'anon',
  array[]::text[], 'anon cannot call accounts_total');
select function_privs_are('public', 'accounts_total', array['uuid', 'date'], 'authenticated',
  array['EXECUTE'], 'authenticated calls accounts_total');
select function_privs_are('public', 'save_exchange_rate', array['uuid', 'date', 'text', 'text', 'numeric'], 'anon',
  array[]::text[], 'anon cannot call save_exchange_rate');
select function_privs_are('public', 'save_exchange_rate', array['uuid', 'date', 'text', 'text', 'numeric'],
  'authenticated', array['EXECUTE'], 'authenticated calls save_exchange_rate');
select function_privs_are('private', 'can_write_account', array['uuid'], 'anon',
  array[]::text[], 'anon cannot call the account write helper');
select function_privs_are('private', 'exchange_rate', array['uuid', 'text', 'text', 'date'], 'anon',
  array[]::text[], 'anon cannot call the exchange rate helper');
select function_privs_are('private', 'convert_minor', array['bigint', 'text', 'text', 'uuid', 'date'], 'anon',
  array[]::text[], 'anon cannot call the conversion helper');
select function_privs_are('private', 'prepare_transaction', array[]::text[], 'authenticated',
  array[]::text[], 'nobody calls the transaction trigger function directly');
select function_privs_are('private', 'lock_account_with_transactions', array[]::text[], 'authenticated',
  array[]::text[], 'nobody calls the account lock directly');
select function_privs_are('private', 'check_installment_plan', array[]::text[], 'authenticated',
  array[]::text[], 'nobody calls the deferral check directly');
select function_privs_are('private', 'sync_card_deferral', array[]::text[], 'authenticated',
  array[]::text[], 'nobody calls the deferral sync directly');
select function_privs_are('private', 'delete_space_transactions', array[]::text[], 'authenticated',
  array[]::text[], 'nobody calls the space cleanup directly');

select * from finish();
rollback;
