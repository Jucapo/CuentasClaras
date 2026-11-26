import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../auth/auth.service';
import { UserSettings } from './space.models';
import { UserSettingsService } from '../user-settings/user-settings.service';
import { SpaceService } from './space.service';
import { membershipFixture, spaceSettingsFixture, userSettingsFixture } from './space.testing';
import { SpacesApi } from './spaces.api';

describe('SpaceService', () => {
  const user = signal<{ id: string } | null>({ id: 'user-1' });
  const settings = signal<UserSettings | null>(null);
  const api = {
    fetchMemberships: vi.fn(),
    createSpace: vi.fn(),
    renameSpace: vi.fn(),
    updateSettings: vi.fn(),
  };
  const userSettings = {
    settings,
    load: vi.fn(),
    update: vi.fn(),
    reset: vi.fn(),
  };
  let service: SpaceService;

  const home = membershipFixture('space-home', 'Hogar');
  const personal = membershipFixture('space-personal', 'Personal', 'viewer');

  beforeEach(() => {
    user.set({ id: 'user-1' });
    settings.set(userSettingsFixture());
    for (const mock of [
      ...Object.values(api),
      userSettings.load,
      userSettings.update,
      userSettings.reset,
    ]) {
      mock.mockReset();
    }
    userSettings.load.mockResolvedValue({ ok: true });
    userSettings.update.mockResolvedValue({ ok: true });
    api.fetchMemberships.mockResolvedValue({ ok: true, value: [home, personal] });

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { user } },
        { provide: SpacesApi, useValue: api },
        { provide: UserSettingsService, useValue: userSettings },
      ],
    });
    service = TestBed.inject(SpaceService);
  });

  it('loads the memberships and the user settings once per user', async () => {
    expect(await service.ensureLoaded()).toEqual({ ok: true });
    await service.ensureLoaded();

    expect(api.fetchMemberships).toHaveBeenCalledTimes(1);
    expect(api.fetchMemberships).toHaveBeenCalledWith('user-1');
    expect(userSettings.load).toHaveBeenCalledWith('user-1');
    expect(service.memberships()).toEqual([home, personal]);
    expect(service.hasSpace()).toBe(true);
  });

  it('shares one request between concurrent callers', async () => {
    await Promise.all([service.ensureLoaded(), service.ensureLoaded()]);
    expect(api.fetchMemberships).toHaveBeenCalledTimes(1);
  });

  it('reports a failed load and stays empty', async () => {
    api.fetchMemberships.mockResolvedValue({ ok: false, message: 'Sin conexión' });

    expect(await service.ensureLoaded()).toEqual({ ok: false, message: 'Sin conexión' });
    expect(service.hasSpace()).toBe(false);
  });

  it('knows when the user has no space yet', async () => {
    api.fetchMemberships.mockResolvedValue({ ok: true, value: [] });
    await service.ensureLoaded();

    expect(service.hasSpace()).toBe(false);
    expect(service.activeSpace()).toBeNull();
  });

  it('activates the remembered space when the user still belongs to it', async () => {
    settings.set(userSettingsFixture({ last_space_id: 'space-personal' }));
    await service.ensureLoaded();

    expect(service.activeSpace()?.name).toBe('Personal');
    expect(service.activeRole()).toBe('viewer');
    expect(service.canConfigure()).toBe(false);
  });

  it('falls back to the first space when the remembered one is gone', async () => {
    settings.set(userSettingsFixture({ last_space_id: 'space-deleted' }));
    await service.ensureLoaded();

    expect(service.activeSpace()?.name).toBe('Hogar');
    expect(service.canConfigure()).toBe(true);
  });

  it('remembers the selected space in the user settings', async () => {
    await service.ensureLoaded();

    expect(await service.select('space-personal')).toEqual({ ok: true });
    expect(service.activeSpace()?.id).toBe('space-personal');
    expect(userSettings.update).toHaveBeenCalledWith({ last_space_id: 'space-personal' });
  });

  it('creates a space, reloads and makes it the active one', async () => {
    api.fetchMemberships.mockResolvedValueOnce({ ok: true, value: [] });
    await service.ensureLoaded();
    const created = membershipFixture('space-new', 'Casa');
    api.createSpace.mockResolvedValue({ ok: true, value: 'space-new' });
    api.fetchMemberships.mockResolvedValueOnce({ ok: true, value: [created] });

    const input = {
      name: 'Casa',
      mainCurrency: 'COP',
      monthStartDay: 28,
      weekStart: 'monday' as const,
    };
    expect(await service.createSpace(input)).toEqual({ ok: true, value: 'space-new' });

    expect(api.createSpace).toHaveBeenCalledWith(input);
    expect(service.activeSpace()).toEqual({ id: 'space-new', name: 'Casa' });
    expect(userSettings.update).toHaveBeenCalledWith({ last_space_id: 'space-new' });
  });

  it('does not touch anything when the space cannot be created', async () => {
    await service.ensureLoaded();
    api.createSpace.mockResolvedValue({ ok: false, message: 'Revisa los datos' });

    const result = await service.createSpace({
      name: 'Casa',
      mainCurrency: 'COP',
      monthStartDay: 1,
      weekStart: 'monday',
    });

    expect(result).toEqual({ ok: false, message: 'Revisa los datos' });
    expect(api.fetchMemberships).toHaveBeenCalledTimes(1);
    expect(userSettings.update).not.toHaveBeenCalled();
  });

  it('renames the active space and updates its settings in place', async () => {
    await service.ensureLoaded();
    api.renameSpace.mockResolvedValue({ ok: true });
    const saved = spaceSettingsFixture({ space_id: 'space-home', month_start_day: 28 });
    api.updateSettings.mockResolvedValue({ ok: true, value: saved });

    expect(await service.renameActiveSpace('Casa')).toEqual({ ok: true });
    expect(await service.updateActiveSettings({ month_start_day: 28 })).toEqual({ ok: true });

    expect(api.renameSpace).toHaveBeenCalledWith('space-home', 'Casa');
    expect(api.updateSettings).toHaveBeenCalledWith('space-home', { month_start_day: 28 });
    expect(service.activeSpace()?.name).toBe('Casa');
    expect(service.activeSettings()?.month_start_day).toBe(28);
  });

  it('forgets the spaces when the session ends', async () => {
    await service.ensureLoaded();

    user.set(null);
    TestBed.tick();

    expect(service.hasSpace()).toBe(false);
    expect(userSettings.reset).toHaveBeenCalled();
  });

  it('loads the spaces of a different user after a switch', async () => {
    await service.ensureLoaded();
    user.set({ id: 'user-2' });
    TestBed.tick();

    await service.ensureLoaded();
    expect(api.fetchMemberships).toHaveBeenLastCalledWith('user-2');
  });
});
