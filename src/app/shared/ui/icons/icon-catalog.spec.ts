import { ICON_CATALOG, UI_ICONS } from './icon-catalog';
import { ICON_CODEPOINTS } from './icon-codepoints.generated';
import { FALLBACK_ICON, iconGlyph, iconOrFallback, isIconName } from './icon-glyphs';
import {
  ICON_SUGGESTION_LIMIT,
  iconLabel,
  recentIcons,
  searchIcons,
  suggestIcons,
} from './icon-search';

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

  it('gives every group an icon of its own for the group menus', () => {
    for (const group of ICON_CATALOG) {
      expect(group.icons.map((icon) => icon.name)).toContain(group.icon);
    }
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

describe('icon suggestions', () => {
  const names = (icons: readonly { name: string }[]) => icons.map((icon) => icon.name);

  it('suggests icons whose words go with the name, accents and plurals aside', () => {
    const suggested = names(suggestIcons({ context: 'expense', name: 'Mercado', recent: [] }));
    expect(suggested).toContain('local_grocery_store');
    expect(names(suggestIcons({ context: 'expense', name: 'Arriendos', recent: [] }))).toContain(
      'key',
    );
    expect(names(suggestIcons({ context: 'expense', name: 'educacion', recent: [] }))).toContain(
      'school',
    );
  });

  it('puts the matches of the context first', () => {
    const suggested = names(suggestIcons({ context: 'account', name: 'Tarjeta Visa', recent: [] }));
    // The cards of Finanzas before the gift card of Compras.
    expect(suggested.indexOf('credit_card')).toBeGreaterThanOrEqual(0);
    expect(suggested.indexOf('credit_card')).toBeLessThan(suggested.indexOf('card_giftcard'));
  });

  it('follows with the recent icons of the space and then the context groups', () => {
    const suggested = names(
      suggestIcons({ context: 'income', name: '', recent: ['pets', 'not_an_icon', 'pets'] }),
    );
    expect(suggested[0]).toBe('pets');
    expect(suggested).not.toContain('not_an_icon');
    // Incomes come from work first, then from money.
    expect(suggested[1]).toBe('work');
  });

  it('suggests nothing for an expense without name or recent icons', () => {
    expect(suggestIcons({ context: 'expense', name: '', recent: [] })).toEqual([]);
    expect(suggestIcons({ context: null, name: 'de la', recent: [] })).toEqual([]);
  });

  it('never repeats an icon and stops at the limit', () => {
    const suggested = names(
      suggestIcons({ context: 'account', name: 'banco ahorro', recent: ['savings'] }),
    );
    expect(new Set(suggested).size).toBe(suggested.length);
    expect(suggested.length).toBeLessThanOrEqual(ICON_SUGGESTION_LIMIT);
  });

  it('lists the icons of the space from the newest item, without repeats', () => {
    expect(
      recentIcons(
        [
          { icon: 'home', created_at: '2026-11-01T00:00:00Z' },
          { icon: 'pets', created_at: '2026-11-03T00:00:00Z' },
          { icon: 'home', created_at: '2026-11-02T00:00:00Z' },
          { icon: 'work', created_at: '2026-10-01T00:00:00Z' },
        ],
        2,
      ),
    ).toEqual(['pets', 'home']);
  });
});
