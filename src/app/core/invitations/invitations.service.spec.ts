import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../auth/auth.service';
import { SpaceService } from '../spaces/space.service';
import { InvitationsApi } from './invitations.api';
import { InvitationsService } from './invitations.service';

describe('InvitationsService', () => {
  const activeSpace = signal<{ id: string } | null>({ id: 'space-home' });
  const api = {
    fetchPending: vi.fn(),
    fetchMine: vi.fn(),
    invite: vi.fn(),
    resend: vi.fn(),
    revoke: vi.fn(),
    accept: vi.fn(),
    decline: vi.fn(),
  };
  const spaces = {
    activeSpace,
    canConfigure: signal(true),
    reload: vi.fn(),
    select: vi.fn(),
  };
  let service: InvitationsService;

  beforeEach(() => {
    activeSpace.set({ id: 'space-home' });
    for (const mock of [...Object.values(api), spaces.reload, spaces.select]) {
      mock.mockReset();
    }
    api.fetchPending.mockResolvedValue({ ok: true, value: [] });
    api.fetchMine.mockResolvedValue({ ok: true, value: [] });
    spaces.reload.mockResolvedValue({ ok: true });
    spaces.select.mockResolvedValue({ ok: true });
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { user: signal({ id: 'user-1' }) } },
        { provide: InvitationsApi, useValue: api },
        { provide: SpaceService, useValue: spaces },
      ],
    });
    service = TestBed.inject(InvitationsService);
  });

  it('invites into the active space and returns how the invitation went out', async () => {
    api.invite.mockResolvedValue({ ok: true, value: { kind: 'email', email: 'eva@example.com' } });

    expect(await service.invite('  eva@example.com ', 'editor')).toEqual({
      ok: true,
      value: { kind: 'email', email: 'eva@example.com' },
    });
    expect(api.invite).toHaveBeenCalledWith('space-home', 'eva@example.com', 'editor');
  });

  it('returns the link to copy when the email already has an account', async () => {
    const link = { kind: 'link', email: 'ana@example.com', link: 'https://app/invitacion?token=x' };
    api.resend.mockResolvedValue({ ok: true, value: link });

    expect(await service.resend('invitation-1')).toEqual({ ok: true, value: link });
  });

  it('cannot invite without an active space', async () => {
    activeSpace.set(null);

    expect((await service.invite('eva@example.com', 'editor')).ok).toBe(false);
    expect(api.invite).not.toHaveBeenCalled();
  });

  it('after accepting, loads the spaces again and makes the joined one active', async () => {
    api.accept.mockResolvedValue({ ok: true, value: 'space-new' });

    expect(await service.accept({ invitationId: 'invitation-1' })).toEqual({
      ok: true,
      value: 'space-new',
    });
    expect(spaces.reload).toHaveBeenCalledTimes(1);
    expect(spaces.select).toHaveBeenCalledWith('space-new');
  });

  it('keeps the spaces when accepting fails', async () => {
    api.accept.mockResolvedValue({ ok: false, message: 'Esta invitación venció.' });

    expect((await service.accept({ token: 'token' })).ok).toBe(false);
    expect(spaces.reload).not.toHaveBeenCalled();
    expect(spaces.select).not.toHaveBeenCalled();
  });
});
