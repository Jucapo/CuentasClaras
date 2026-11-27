-- Local development data (applied by `npm run db:reset`; never pushed to production).
-- Users (password cuentas-claras-dev for both); the sign-up trigger creates their profiles:
-- - dev@cuentasclaras.test: the dev user.
-- - ana@cuentasclaras.test: a second account without a space, to try inviting an existing account.

-- GoTrue scans these token columns into non-null strings, so they must be '' instead of NULL.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000',
  seed.id,
  'authenticated',
  'authenticated',
  seed.email,
  extensions.crypt('cuentas-claras-dev', extensions.gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{}',
  now(),
  now(),
  '', '', '', ''
from (values
  ('d0000000-0000-4000-8000-000000000001'::uuid, 'dev@cuentasclaras.test'),
  ('d0000000-0000-4000-8000-000000000002'::uuid, 'ana@cuentasclaras.test')
) as seed (id, email);

insert into auth.identities (
  user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
)
select
  u.id,
  u.id::text,
  'email',
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  now(),
  now(),
  now()
from auth.users u
where u.email in ('dev@cuentasclaras.test', 'ana@cuentasclaras.test');
