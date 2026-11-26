import { DOCUMENT, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { THEME_STORAGE_KEY } from '../config/app.constants';
import { UserSettings } from '../spaces/space.models';
import { userSettingsFixture } from '../spaces/space.testing';
import { UserSettingsService } from '../user-settings/user-settings.service';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  const settings = signal<UserSettings | null>(null);
  let root: HTMLElement;

  beforeEach(() => {
    settings.set(null);
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [{ provide: UserSettingsService, useValue: { settings } }],
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
});
