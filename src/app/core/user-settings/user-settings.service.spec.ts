import { TestBed } from '@angular/core/testing';
import { userSettingsFixture } from '../spaces/space.testing';
import { UserSettingsApi } from './user-settings.api';
import { UserSettingsService } from './user-settings.service';

describe('UserSettingsService', () => {
  const api = { fetch: vi.fn(), update: vi.fn() };
  let service: UserSettingsService;

  beforeEach(() => {
    api.fetch.mockReset();
    api.update.mockReset();
    TestBed.configureTestingModule({ providers: [{ provide: UserSettingsApi, useValue: api }] });
    service = TestBed.inject(UserSettingsService);
  });

  it('loads the settings of a user', async () => {
    api.fetch.mockResolvedValue({ ok: true, value: userSettingsFixture({ theme: 'dark' }) });

    expect(await service.load('user-1')).toEqual({ ok: true });
    expect(api.fetch).toHaveBeenCalledWith('user-1');
    expect(service.settings()?.theme).toBe('dark');
  });

  it('saves a patch for the loaded user and keeps the saved row', async () => {
    api.fetch.mockResolvedValue({ ok: true, value: userSettingsFixture() });
    api.update.mockResolvedValue({
      ok: true,
      value: userSettingsFixture({ show_decimals: false }),
    });
    await service.load('user-1');

    expect(await service.update({ show_decimals: false })).toEqual({ ok: true });
    expect(api.update).toHaveBeenCalledWith('user-1', { show_decimals: false });
    expect(service.settings()?.show_decimals).toBe(false);
  });

  it('keeps the previous values when saving fails', async () => {
    api.fetch.mockResolvedValue({ ok: true, value: userSettingsFixture() });
    api.update.mockResolvedValue({ ok: false, message: 'Sin conexión' });
    await service.load('user-1');

    expect(await service.update({ theme: 'dark' })).toEqual({ ok: false, message: 'Sin conexión' });
    expect(service.settings()?.theme).toBe('system');
  });

  it('cannot save before loading and forgets everything on reset', async () => {
    expect((await service.update({ theme: 'dark' })).ok).toBe(false);
    expect(api.update).not.toHaveBeenCalled();

    api.fetch.mockResolvedValue({ ok: true, value: userSettingsFixture() });
    await service.load('user-1');
    service.reset();
    expect(service.settings()).toBeNull();
  });
});
