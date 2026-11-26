-- Local development data (applied by `npm run db:reset`; never pushed to production).
-- Dev user: dev@cuentasclaras.test / cuentas-claras-dev. The sign-up trigger creates its profile.

-- GoTrue scans these token columns into non-null strings, so they must be '' instead of NULL.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000000',
  'd0000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'dev@cuentasclaras.test',
  extensions.crypt('cuentas-claras-dev', extensions.gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{}',
  now(),
  now(),
  '', '', '', ''
);

insert into auth.identities (
  user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
) values (
  'd0000000-0000-4000-8000-000000000001',
  'd0000000-0000-4000-8000-000000000001',
  'email',
  '{"sub": "d0000000-0000-4000-8000-000000000001", "email": "dev@cuentasclaras.test", "email_verified": true}',
  now(),
  now(),
  now()
);
