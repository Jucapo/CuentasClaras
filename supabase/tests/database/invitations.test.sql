-- Invitations: only the owner invites, resends and revokes; the token is stored as a hash, expires
-- in 7 days, is single use and is bound to the invited email. Accepting creates the membership.
begin;
create extension if not exists pgtap with schema extensions;
select plan(61);

-- Ana owns "Hogar" with Beto (editor) and Dani (viewer). Caro owns an empty space. The rest are
-- invitees; Fede never confirmed his email.
insert into auth.users (id, email, email_confirmed_at) values
  ('a0000000-0000-4000-8000-000000000000', 'ana@example.com', now()),
  ('b0000000-0000-4000-8000-000000000000', 'beto@example.com', now()),
  ('c0000000-0000-4000-8000-000000000000', 'caro@example.com', now()),
  ('d0000000-0000-4000-8000-00000000000d', 'dani@example.com', now()),
  ('e0000000-0000-4000-8000-00000000000e', 'eva@example.com', now()),
  ('f0000000-0000-4000-8000-00000000000f', 'fede@example.com', null),
  ('e1000000-0000-4000-8000-000000000001', 'gabi@example.com', now()),
  ('e1000000-0000-4000-8000-000000000002', 'hugo@example.com', now()),
  ('e1000000-0000-4000-8000-000000000003', 'kike@example.com', now()),
  ('e1000000-0000-4000-8000-000000000004', 'juli@example.com', now()),
  ('e1000000-0000-4000-8000-000000000005', 'leo@example.com', now());

set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000000"}';
do $$
declare
  space uuid := public.create_space('Hogar', 'COP', 1, 'monday');
  new_id uuid;
begin
  perform set_config('t.space', space::text, true);
  insert into public.accounts (space_id, name, kind, currency, initial_balance_date, icon, color)
  values (space, 'Banco', 'bank', 'COP', '2026-11-01', 'account_balance', 'blue')
  returning id into new_id;
  perform set_config('t.bank', new_id::text, true);
  insert into public.accounts (space_id, name, kind, currency, initial_balance_date, icon, color)
  values (space, 'Efectivo', 'cash', 'COP', '2026-11-01', 'payments', 'green')
  returning id into new_id;
  perform set_config('t.cash', new_id::text, true);
  perform public.set_default_account(space, new_id);
end $$;
set local request.jwt.claims to '{"sub": "c0000000-0000-4000-8000-000000000000"}';
do $$ begin perform set_config('t.caro_space', public.create_space('Caro', 'COP', 1, 'monday')::text, true); end $$;

reset role;
insert into public.space_members (space_id, user_id, role) values
  (current_setting('t.space')::uuid, 'b0000000-0000-4000-8000-000000000000', 'editor'),
  (current_setting('t.space')::uuid, 'd0000000-0000-4000-8000-00000000000d', 'viewer');

-- ── create_invitation: only the owner ────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub": "b0000000-0000-4000-8000-000000000000"}';
select throws_ok(
  format($$select public.create_invitation(%L, 'eva@example.com', 'editor')$$, current_setting('t.space')),
  '42501', 'not_space_owner', 'an editor cannot invite'
);
set local request.jwt.claims to '{"sub": "d0000000-0000-4000-8000-00000000000d"}';
select throws_ok(
  format($$select public.create_invitation(%L, 'eva@example.com', 'editor')$$, current_setting('t.space')),
  '42501', 'not_space_owner', 'a viewer cannot invite'
);
set local request.jwt.claims to '{"sub": "c0000000-0000-4000-8000-000000000000"}';
select throws_ok(
  format($$select public.create_invitation(%L, 'eva@example.com', 'editor')$$, current_setting('t.space')),
  '42501', 'not_space_owner', 'a non-member cannot invite'
);
set local request.jwt.claims to '{}';
select throws_ok(
  format($$select public.create_invitation(%L, 'eva@example.com', 'editor')$$, current_setting('t.space')),
  '42501', 'not_space_owner', 'nobody invites without a session'
);

set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000000"}';
do $$
declare
  space uuid := current_setting('t.space')::uuid;
  created record;
begin
  select * into created from public.create_invitation(space, '  Eva@Example.com ', 'editor');
  perform set_config('t.eva_id', created.invitation_id::text, true);
  perform set_config('t.eva_token', created.token, true);
  perform set_config('t.eva_email', created.email, true);
  perform set_config('t.eva_has_account', created.invitee_has_account::text, true);
  perform set_config('t.eva_space_name', created.space_name, true);
  perform set_config('t.eva_inviter', created.inviter_name, true);

  select * into created from public.create_invitation(space, 'fede@example.com', 'viewer');
  perform set_config('t.fede_first_id', created.invitation_id::text, true);
  perform set_config('t.fede_has_account', created.invitee_has_account::text, true);

  select * into created from public.create_invitation(space, 'gabi@example.com', 'viewer');
  perform set_config('t.gabi_id', created.invitation_id::text, true);
  perform set_config('t.gabi_token', created.token, true);

  select * into created from public.create_invitation(space, 'hugo@example.com', 'editor');
  perform set_config('t.hugo_token', created.token, true);

  select * into created from public.create_invitation(space, 'leo@example.com', 'viewer');
  perform set_config('t.leo_token', created.token, true);
end $$;

select is(current_setting('t.eva_email'), 'eva@example.com', 'the email is trimmed and lowercased');
select is(current_setting('t.eva_has_account'), 'true', 'a confirmed account is reported');
select is(current_setting('t.fede_has_account'), 'false', 'an unconfirmed account counts as no account');
select is(current_setting('t.eva_space_name'), 'Hogar', 'it returns the space name for the email');
select is(current_setting('t.eva_inviter'), 'ana', 'it returns the inviter name for the email');
select ok(current_setting('t.eva_token') ~ '^[0-9a-f]{64}$', 'the token is 32 random bytes in hex');

select throws_ok(
  format($$select public.create_invitation(%L, 'eva@example.com', 'viewer')$$, current_setting('t.space')),
  'P0001', 'invitation_pending', 'a second open invitation for the same email is rejected'
);
select throws_ok(
  format($$select public.create_invitation(%L, 'BETO@example.com', 'viewer')$$, current_setting('t.space')),
  'P0001', 'already_member', 'a member cannot be invited'
);
select throws_ok(
  format($$select public.create_invitation(%L, 'no-es-correo', 'viewer')$$, current_setting('t.space')),
  '23514', null, 'the email must look like one'
);

reset role;
select ok(
  exists (
    select 1 from public.space_invitations
    where id = current_setting('t.eva_id')::uuid
      and token_hash = sha256(convert_to(current_setting('t.eva_token'), 'UTF8'))
  ),
  'only the sha256 of the token is stored'
);
select is_empty(
  format(
    $$select 1 from public.space_invitations i where i::text like '%%' || %L || '%%'$$,
    current_setting('t.eva_token')
  ),
  'the raw token is not stored anywhere in the row'
);
select is(
  (select expires_at from public.space_invitations where id = current_setting('t.eva_id')::uuid),
  now() + interval '7 days',
  'an invitation expires in 7 days'
);

-- An expired open invitation does not block a new one: it is revoked and replaced.
update public.space_invitations set expires_at = now() - interval '1 day'
  where id = current_setting('t.fede_first_id')::uuid;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000000"}';
do $$
declare created record;
begin
  select * into created from public.create_invitation(current_setting('t.space')::uuid, 'fede@example.com', 'viewer');
  perform set_config('t.fede_id', created.invitation_id::text, true);
  perform set_config('t.fede_token', created.token, true);
end $$;
reset role;
select results_eq(
  $$select count(*) filter (where revoked_at is not null), count(*)
    from public.space_invitations where email = 'fede@example.com'$$,
  $$values (1::bigint, 2::bigint)$$,
  'inviting again after expiry revokes the expired invitation'
);

-- ── Reading: only the owner, and never the hash ──────────────────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000000"}';
select results_eq(
  $$select email from public.space_invitations where revoked_at is null order by email$$,
  $$values ('eva@example.com'), ('fede@example.com'), ('gabi@example.com'), ('hugo@example.com'), ('leo@example.com')$$,
  'the owner sees the invitations of the space'
);
select throws_ok(
  'select token_hash from public.space_invitations',
  '42501', null, 'not even the owner can read the token hash'
);
select throws_ok(
  'update public.space_invitations set revoked_at = now()',
  '42501', null, 'invitations are not updated directly'
);
set local request.jwt.claims to '{"sub": "b0000000-0000-4000-8000-000000000000"}';
select is_empty('select 1 from public.space_invitations', 'an editor sees no invitations');

-- ── invitation_preview ───────────────────────────────────────────────────────
set local role anon;
select results_eq(
  format(
    'select space_name, inviter_name, role, email, status from public.invitation_preview(%L)',
    current_setting('t.eva_token')
  ),
  $$values ('Hogar', 'ana', 'editor'::public.member_role, 'eva@example.com', 'pending')$$,
  'anyone with the token sees the invitation before signing in'
);
select is_empty(
  $$select 1 from public.invitation_preview('no-existe')$$,
  'an unknown token shows nothing'
);

-- ── rotate_invitation ────────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub": "b0000000-0000-4000-8000-000000000000"}';
select throws_ok(
  format('select public.rotate_invitation(%L)', current_setting('t.fede_id')),
  '42501', 'not_space_owner', 'an editor cannot resend'
);
reset role;
update public.space_invitations set expires_at = now() + interval '1 day'
  where id = current_setting('t.fede_id')::uuid;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000000"}';
do $$
declare rotated record;
begin
  select * into rotated from public.rotate_invitation(current_setting('t.fede_id')::uuid);
  perform set_config('t.fede_old_token', current_setting('t.fede_token'), true);
  perform set_config('t.fede_token', rotated.token, true);
  perform set_config('t.fede_rotated_expiry', rotated.expires_at::text, true);
end $$;
select isnt(current_setting('t.fede_token'), current_setting('t.fede_old_token'), 'resending creates a new token');
select is_empty(
  format('select 1 from public.invitation_preview(%L)', current_setting('t.fede_old_token')),
  'the previous link stops working'
);
select results_eq(
  format('select status from public.invitation_preview(%L)', current_setting('t.fede_token')),
  $$values ('pending')$$,
  'the new link works'
);
select is(
  current_setting('t.fede_rotated_expiry')::timestamptz,
  now() + interval '7 days',
  'resending extends the expiry to 7 days from now'
);

-- ── revoke_invitation ────────────────────────────────────────────────────────
set local request.jwt.claims to '{"sub": "b0000000-0000-4000-8000-000000000000"}';
select throws_ok(
  format('select public.revoke_invitation(%L)', current_setting('t.gabi_id')),
  '42501', 'not_space_owner', 'an editor cannot revoke'
);
set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000000"}';
select lives_ok(
  format('select public.revoke_invitation(%L)', current_setting('t.gabi_id')),
  'the owner revokes an invitation'
);
select results_eq(
  format('select status from public.invitation_preview(%L)', current_setting('t.gabi_token')),
  $$values ('revoked')$$,
  'a revoked invitation shows as revoked'
);
select throws_ok(
  format('select public.rotate_invitation(%L)', current_setting('t.gabi_id')),
  'P0001', 'invitation_closed', 'a revoked invitation cannot be resent'
);
select throws_ok(
  format('select public.revoke_invitation(%L)', current_setting('t.gabi_id')),
  'P0001', 'invitation_closed', 'a revoked invitation cannot be revoked again'
);

-- ── my_invitations ───────────────────────────────────────────────────────────
set local request.jwt.claims to '{"sub": "e0000000-0000-4000-8000-00000000000e"}';
select results_eq(
  'select space_name, inviter_name, role from public.my_invitations()',
  $$values ('Hogar', 'ana', 'editor'::public.member_role)$$,
  'an invitee sees the open invitations for their email'
);
set local request.jwt.claims to '{"sub": "c0000000-0000-4000-8000-000000000000"}';
select is_empty('select 1 from public.my_invitations()', 'nobody sees invitations for another email');
set local request.jwt.claims to '{"sub": "f0000000-0000-4000-8000-00000000000f"}';
select is_empty('select 1 from public.my_invitations()', 'an unconfirmed email sees no invitations');

-- ── Accepting: every rejection ───────────────────────────────────────────────
set local request.jwt.claims to '{}';
select throws_ok(
  format('select public.accept_invitation(%L)', current_setting('t.eva_token')),
  '42501', 'not_authenticated', 'accepting needs a session'
);
set local request.jwt.claims to '{"sub": "e0000000-0000-4000-8000-00000000000e"}';
select throws_ok(
  $$select public.accept_invitation('no-existe')$$,
  'P0001', 'invitation_not_found', 'an unknown token is rejected'
);
select throws_ok(
  'select public.accept_invitation()',
  'P0001', 'invitation_not_found', 'a token or an id is required'
);
select throws_ok(
  format('select public.accept_invitation(%L, %L)', current_setting('t.eva_token'), current_setting('t.eva_id')),
  'P0001', 'invitation_not_found', 'a token and an id together are rejected'
);
set local request.jwt.claims to '{"sub": "c0000000-0000-4000-8000-000000000000"}';
select throws_ok(
  format('select public.accept_invitation(%L)', current_setting('t.eva_token')),
  'P0001', 'invitation_email_mismatch', 'another email cannot accept the invitation'
);
set local request.jwt.claims to '{"sub": "f0000000-0000-4000-8000-00000000000f"}';
select throws_ok(
  format('select public.accept_invitation(%L)', current_setting('t.fede_token')),
  'P0001', 'invitation_email_mismatch', 'an unconfirmed email cannot accept'
);
set local request.jwt.claims to '{"sub": "e1000000-0000-4000-8000-000000000001"}';
select throws_ok(
  format('select public.accept_invitation(%L)', current_setting('t.gabi_token')),
  'P0001', 'invitation_revoked', 'a revoked invitation cannot be accepted'
);

reset role;
update public.space_invitations set expires_at = now() - interval '1 minute'
  where token_hash = sha256(convert_to(current_setting('t.hugo_token'), 'UTF8'));
-- Beto is already a member: an invitation that reached him anyway (inserted directly) is rejected.
insert into public.space_invitations (space_id, email, role, token_hash, invited_by, expires_at)
values (
  current_setting('t.space')::uuid, 'beto@example.com', 'viewer', sha256(convert_to('beto-token', 'UTF8')),
  'a0000000-0000-4000-8000-000000000000', now() + interval '7 days'
);
set local role authenticated;
set local request.jwt.claims to '{"sub": "e1000000-0000-4000-8000-000000000002"}';
select throws_ok(
  format('select public.accept_invitation(%L)', current_setting('t.hugo_token')),
  'P0001', 'invitation_expired', 'an expired invitation cannot be accepted'
);
select results_eq(
  format('select status from public.invitation_preview(%L)', current_setting('t.hugo_token')),
  $$values ('expired')$$,
  'an expired invitation shows as expired'
);
set local request.jwt.claims to '{"sub": "b0000000-0000-4000-8000-000000000000"}';
select throws_ok(
  $$select public.accept_invitation('beto-token')$$,
  'P0001', 'already_member', 'a member cannot join the same space twice'
);

-- ── Accepting ────────────────────────────────────────────────────────────────
set local request.jwt.claims to '{"sub": "e0000000-0000-4000-8000-00000000000e"}';
select is(
  public.accept_invitation(current_setting('t.eva_token')),
  current_setting('t.space')::uuid,
  'accepting returns the space'
);
reset role;
select results_eq(
  $$select role, default_account_id from public.space_members
    where user_id = 'e0000000-0000-4000-8000-00000000000e'$$,
  format($$values ('editor'::public.member_role, %L::uuid)$$, current_setting('t.cash')),
  'the invitee joins with the role, and the inviter''s shared default account as theirs'
);
select is(
  (select last_space_id from public.user_settings where user_id = 'e0000000-0000-4000-8000-00000000000e'),
  current_setting('t.space')::uuid,
  'the joined space becomes the last used one'
);
select results_eq(
  format('select accepted_by, accepted_at from public.space_invitations where id = %L', current_setting('t.eva_id')),
  $$values ('e0000000-0000-4000-8000-00000000000e'::uuid, now())$$,
  'the invitation is marked as accepted'
);
set local role authenticated;
set local request.jwt.claims to '{"sub": "e0000000-0000-4000-8000-00000000000e"}';
select throws_ok(
  format('select public.accept_invitation(%L)', current_setting('t.eva_token')),
  'P0001', 'invitation_used', 'an invitation is single use'
);
select results_eq(
  format('select status from public.invitation_preview(%L)', current_setting('t.eva_token')),
  $$values ('accepted')$$,
  'a used invitation shows as accepted'
);

-- Without the inviter's default account: the first shared account of the Cuentas group.
set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000000"}';
do $$
declare created record;
begin
  perform public.set_default_account(current_setting('t.space')::uuid, null);
  select * into created from public.create_invitation(current_setting('t.space')::uuid, 'kike@example.com', 'editor');
  perform set_config('t.kike_id', created.invitation_id::text, true);
end $$;
-- From inside the app (by id): the confirmed email is the proof.
set local request.jwt.claims to '{"sub": "c0000000-0000-4000-8000-000000000000"}';
select throws_ok(
  format('select public.accept_invitation(target_invitation_id => %L)', current_setting('t.kike_id')),
  'P0001', 'invitation_email_mismatch', 'by id, another email still cannot accept'
);
set local request.jwt.claims to '{"sub": "e1000000-0000-4000-8000-000000000003"}';
select is(
  public.accept_invitation(target_invitation_id => current_setting('t.kike_id')::uuid),
  current_setting('t.space')::uuid,
  'an invitee accepts from inside the app by id'
);
reset role;
select is(
  (select default_account_id from public.space_members where user_id = 'e1000000-0000-4000-8000-000000000003'),
  current_setting('t.bank')::uuid,
  'without the inviter''s default, the first shared account of the Cuentas group'
);

-- A space without accounts: no default account.
set local role authenticated;
set local request.jwt.claims to '{"sub": "c0000000-0000-4000-8000-000000000000"}';
do $$
declare created record;
begin
  select * into created from public.create_invitation(current_setting('t.caro_space')::uuid, 'juli@example.com', 'viewer');
  perform set_config('t.juli_token', created.token, true);
end $$;
set local request.jwt.claims to '{"sub": "e1000000-0000-4000-8000-000000000004"}';
select lives_ok(
  format('select public.accept_invitation(%L)', current_setting('t.juli_token')),
  'an invitee joins a space without accounts'
);
reset role;
select is(
  (select default_account_id from public.space_members where user_id = 'e1000000-0000-4000-8000-000000000004'),
  null,
  'without shared accounts there is no default account'
);

-- ── Declining ────────────────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub": "c0000000-0000-4000-8000-000000000000"}';
select throws_ok(
  format('select public.decline_invitation(%L)', current_setting('t.leo_token')),
  'P0001', 'invitation_email_mismatch', 'another email cannot decline the invitation'
);
set local request.jwt.claims to '{"sub": "e1000000-0000-4000-8000-000000000005"}';
select lives_ok(
  format('select public.decline_invitation(%L)', current_setting('t.leo_token')),
  'an invitee declines'
);
select throws_ok(
  format('select public.accept_invitation(%L)', current_setting('t.leo_token')),
  'P0001', 'invitation_used', 'a declined invitation cannot be accepted'
);
reset role;
select ok(
  not exists (select 1 from public.space_members where user_id = 'e1000000-0000-4000-8000-000000000005'),
  'declining does not create a membership'
);

select * from finish();
rollback;
