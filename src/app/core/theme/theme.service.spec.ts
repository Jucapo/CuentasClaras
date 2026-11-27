import { DOCUMENT, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActionResult } from '../action-result';
import { THEME_STORAGE_KEY } from '../config/app.constants';
import { UserSettings } from '../spaces/space.models';
import { userSettingsFixture } from '../spaces/space.testing';
import { UserSettingsService } from '../user-settings/user-settings.service';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  const settings = signal<UserSettings | null>(null);
  const update = vi.fn<() => Promise<ActionResult>>();
  let root: HTMLElement;

  beforeEach(() => {
    settings.set(null);
    update.mockReset();
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [{ provide: UserSettingsService, useValue: { settings, update } }],
    });
    root = TestBed.inject(DOCUMENT).documentElement;
    root.removeAttribute('data-theme');
  });

  it('follows the system until there is a preference', () => {
    TestBed.inject(ThemeService).init();
    TestBed.tick();
    expect(root.hasAttribute('data-theme')).toBe(false);
  });

  it('applies the cached preference before the user settings load', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    TestBed.inject(ThemeService).init();
    expect(root.getAttribute('data-theme')).toBe('dark');
  });

  it('applies and caches the user preference when it changes', () => {
    TestBed.inject(ThemeService).init();

    settings.set(userSettingsFixture({ theme: 'light' }));
    TestBed.tick();
    expect(root.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');

    settings.set(userSettingsFixture({ theme: 'system' }));
    TestBed.tick();
    expect(root.hasAttribute('data-theme')).toBe(false);
  });

  it('ignores an unknown cached value', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'neon');
    TestBed.inject(ThemeService).init();
    expect(root.hasAttribute('data-theme')).toBe(false);
  });

  // The status bar color follows the scheme on screen, also when it comes from the system (§13.2).
  it('resolves the scheme on screen from the preference', () => {
    const theme = TestBed.inject(ThemeService);
    theme.init();
    settings.set(userSettingsFixture({ theme: 'dark' }));
    TestBed.tick();
    expect(theme.preference()).toBe('dark');
    expect(theme.scheme()).toBe('dark');

    settings.set(userSettingsFixture({ theme: 'light' }));
    TestBed.tick();
    expect(theme.scheme()).toBe('light');
  });

  describe('set', () => {
    it('applies the theme before saving it', async () => {
      let release: (result: ActionResult) => void = () => undefined;
      update.mockImplementation(() => new Promise<ActionResult>((resolve) => (release = resolve)));
      const theme = TestBed.inject(ThemeService);
      theme.init();

      const saving = theme.set('dark');
      expect(root.getAttribute('data-theme')).toBe('dark');
      expect(update).toHaveBeenCalledWith({ theme: 'dark' });
      release({ ok: true });
      expect((await saving).ok).toBe(true);
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    });

    it('goes back to the previous theme when saving fails', async () => {
      update.mockResolvedValue({ ok: false, message: 'Sin conexión' });
      localStorage.setItem(THEME_STORAGE_KEY, 'light');
      const theme = TestBed.inject(ThemeService);
      theme.init();

      const result = await theme.set('dark');
      expect(result.ok).toBe(false);
      expect(root.getAttribute('data-theme')).toBe('light');
      expect(theme.preference()).toBe('light');
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    });
  });
});
