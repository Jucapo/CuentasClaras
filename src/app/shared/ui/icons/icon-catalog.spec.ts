import { ICON_CATALOG, UI_ICONS } from './icon-catalog';
import { ICON_CODEPOINTS } from './icon-codepoints.generated';
import { FALLBACK_ICON, iconGlyph, iconOrFallback, isIconName } from './icon-glyphs';
import { iconLabel, searchIcons } from './icon-search';

const catalogNames = ICON_CATALOG.flatMap((group) => group.icons.map((icon) => icon.name));

describe('icon catalog', () => {
  it('has several hundred icons in the groups of the spec', () => {
    expect(catalogNames.length).toBeGreaterThanOrEqual(300);
    expect(ICON_CATALOG.map((group) => group.label)).toEqual([
      'Hogar',
      'Comida',
      'Transporte',
      'Salud',
      'Familia y niños',
      'Mascotas',
      'Educación',
      'Ocio',
      'Compras',
      'Tecnología',
      'Finanzas',
      'Viajes',
      'Trabajo',
      'Otros',
    ]);
  });

  it('lists every icon once, with a Spanish label', () => {
    expect(new Set(catalogNames).size).toBe(catalogNames.length);
    for (const group of ICON_CATALOG) {
      for (const icon of group.icons) {
        expect(icon.label.trim()).not.toBe('');
      }
    }
  });

  // Fails when the catalog changed but `npm run icons:build` was not run.
  it('is fully covered by the self-hosted font subset', () => {
    const missing = [...catalogNames, ...UI_ICONS].filter((name) => !isIconName(name));
    expect(missing).toEqual([]);
  });

  it('uses keys the database accepts', () => {
    for (const name of Object.keys(ICON_CODEPOINTS)) {
      expect(name).toMatch(/^[a-z0-9_]{1,64}$/);
    }
  });
});

describe('icon glyphs', () => {
  it('renders an icon as its codepoint', () => {
    expect(iconGlyph('savings')).toBe(String.fromCodePoint(ICON_CODEPOINTS.savings));
  });

  it('falls back for keys outside the subset', () => {
    expect(iconOrFallback('savings')).toBe('savings');
    expect(iconOrFallback('not_an_icon')).toBe(FALLBACK_ICON);
    expect(iconOrFallback(null)).toBe(FALLBACK_ICON);
  });
});

describe('icon search', () => {
  it('returns every group for an empty query', () => {
    expect(searchIcons('  ').length).toBe(ICON_CATALOG.length);
  });

  it('matches Spanish keywords without accents', () => {
    const names = searchIcons('credito').flatMap((group) => group.icons.map((icon) => icon.name));
    expect(names).toContain('credit_card');
  });

  it('matches the group name', () => {
    const groups = searchIcons('mascotas');
    expect(groups.map((group) => group.label)).toContain('Mascotas');
    expect(groups.find((group) => group.label === 'Mascotas')?.icons.length).toBeGreaterThan(5);
  });

  it('drops groups without matches', () => {
    expect(searchIcons('zzzz')).toEqual([]);
  });

  it('names icons in Spanish', () => {
    expect(iconLabel('credit_card')).toBe('Tarjeta de crédito');
    expect(iconLabel('add')).toBe('add');
  });
});
