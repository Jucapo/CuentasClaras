import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../auth/auth.service';
import { ProfileService } from '../profiles/profile.service';
import { AcceptInvitationFlow, NewAccountAcceptance } from './accept-invitation.flow';
import { InvitationsService } from './invitations.service';

describe('AcceptInvitationFlow', () => {
  const user = signal<{ email?: string } | null>(null);
  const calls: string[] = [];
  const auth = {
    user,
    verifyInvite: vi.fn(),
    updatePassword: vi.fn(),
  };
  const profile = { updateDisplayName: vi.fn() };
  const invitations = { accept: vi.fn() };
  let flow: AcceptInvitationFlow;

  const input: NewAccountAcceptance = {
    token: 'a'.repeat(64),
    tokenHash: 'hash',
    email: 'Eva@Example.com',
    displayName: 'Eva',
    password: 'una-clave-larga',
  };

  beforeEach(() => {
    user.set(null);
    calls.length = 0;
    auth.verifyInvite.mockReset().mockImplementation(async () => {
      calls.push('verify');
      user.set({ email: 'eva@example.com' });
      return { ok: true };
    });
    auth.updatePassword.mockReset().mockImplementation(async () => {
      calls.push('password');
      return { ok: true };
    });
    profile.updateDisplayName.mockReset().mockImplementation(async () => {
      calls.push('name');
      return { ok: true };
    });
    invitations.accept.mockReset().mockImplementation(async () => {
      calls.push('accept');
      return { ok: true, value: 'space-home' };
    });
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: ProfileService, useValue: profile },
        { provide: InvitationsService, useValue: invitations },
      ],
    });
    flow = TestBed.inject(AcceptInvitationFlow);
  });

  it('signs in with the email link, then saves the password and name, then accepts', async () => {
    expect(await flow.acceptAsNewAccount(input)).toEqual({ ok: true, spaceId: 'space-home' });
    expect(calls).toEqual(['verify', 'password', 'name', 'accept']);
    expect(auth.verifyInvite).toHaveBeenCalledWith('hash');
    expect(auth.updatePassword).toHaveBeenCalledWith('una-clave-larga');
    expect(profile.updateDisplayName).toHaveBeenCalledWith('Eva');
    expect(invitations.accept).toHaveBeenCalledWith({ token: input.token });
  });

  it('skips the email link when the browser is signed in as the invitee already (a retry)', async () => {
    user.set({ email: 'eva@example.com' });

    await flow.acceptAsNewAccount(input);
    expect(calls).toEqual(['password', 'name', 'accept']);
  });

  it('verifies again when the browser is signed in as someone else', async () => {
    user.set({ email: 'juan@example.com' });

    await flow.acceptAsNewAccount(input);
    expect(calls[0]).toBe('verify');
  });

  it('reports a spent or expired email link without touching the account', async () => {
    auth.verifyInvite.mockResolvedValue({ ok: false, message: 'Venció' });

    expect(await flow.acceptAsNewAccount(input)).toEqual({ ok: false, reason: 'link_used' });
    expect(auth.updatePassword).not.toHaveBeenCalled();
    expect(invitations.accept).not.toHaveBeenCalled();
  });

  it('stops at the first failing step with its message', async () => {
    auth.updatePassword.mockResolvedValue({ ok: false, message: 'Contraseña débil' });

    expect(await flow.acceptAsNewAccount(input)).toEqual({
      ok: false,
      reason: 'failed',
      message: 'Contraseña débil',
    });
    expect(profile.updateDisplayName).not.toHaveBeenCalled();
    expect(invitations.accept).not.toHaveBeenCalled();
  });

  it('reports a rejected invitation after the account is ready', async () => {
    invitations.accept.mockResolvedValue({ ok: false, message: 'Esta invitación ya se usó.' });

    expect(await flow.acceptAsNewAccount(input)).toEqual({
      ok: false,
      reason: 'failed',
      message: 'Esta invitación ya se usó.',
    });
  });
});
