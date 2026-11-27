import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../auth/auth.service';
import { SpaceMembersService } from './space-members.service';
import { SpaceService } from './space.service';
import { SpacesApi } from './spaces.api';

describe('SpaceMembersService', () => {
  const activeSpace = signal<{ id: string } | null>({ id: 'space-home' });
  const api = {
    fetchMembers: vi.fn(),
    updateMemberRole: vi.fn(),
    removeMember: vi.fn(),
  };
  const spaces = { activeSpace, reload: vi.fn() };
  let service: SpaceMembersService;

  beforeEach(() => {
    activeSpace.set({ id: 'space-home' });
    for (const mock of [...Object.values(api), spaces.reload]) {
      mock.mockReset();
    }
    api.fetchMembers.mockResolvedValue({ ok: true, value: [] });
    spaces.reload.mockResolvedValue({ ok: true });
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { user: signal({ id: 'user-1' }) } },
        { provide: SpacesApi, useValue: api },
        { provide: SpaceService, useValue: spaces },
      ],
    });
    service = TestBed.inject(SpaceMembersService);
  });

  it('changes a role and removes a member in the active space', async () => {
    api.updateMemberRole.mockResolvedValue({ ok: true });
    api.removeMember.mockResolvedValue({ ok: true });

    expect(await service.changeRole('beto', 'viewer')).toEqual({ ok: true });
    expect(api.updateMemberRole).toHaveBeenCalledWith('space-home', 'beto', 'viewer');
    expect(await service.remove('beto')).toEqual({ ok: true });
    expect(api.removeMember).toHaveBeenCalledWith('space-home', 'beto');
    expect(spaces.reload).not.toHaveBeenCalled();
  });

  it('leaves the active space as the signed-in user and reloads the spaces', async () => {
    api.removeMember.mockResolvedValue({ ok: true });

    expect(await service.leave()).toEqual({ ok: true });
    expect(api.removeMember).toHaveBeenCalledWith('space-home', 'user-1');
    expect(spaces.reload).toHaveBeenCalledTimes(1);
  });

  it('keeps the spaces when leaving fails, e.g. as the last owner', async () => {
    api.removeMember.mockResolvedValue({ ok: false, message: 'Necesita un propietario' });

    expect(await service.leave()).toEqual({ ok: false, message: 'Necesita un propietario' });
    expect(spaces.reload).not.toHaveBeenCalled();
  });

  it('does nothing without an active space', async () => {
    activeSpace.set(null);

    expect((await service.leave()).ok).toBe(false);
    expect((await service.changeRole('beto', 'owner')).ok).toBe(false);
    expect(api.removeMember).not.toHaveBeenCalled();
  });
});
