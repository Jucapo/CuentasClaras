import {
  matchesAllTerms,
  normalizeSearchText,
  searchTerms,
} from '../../../domain/text/search-text';
import { CatalogIcon, ICON_CATALOG, IconGroup } from './icon-catalog';
import { IconName, isIconName } from './icon-glyphs';

/** A catalog icon whose name is known to be in the font subset. */
export interface PickableIcon extends CatalogIcon {
  readonly name: IconName;
}

/** A catalog group with its pickable icons. */
export interface PickableIconGroup extends Omit<IconGroup, 'icons' | 'icon'> {
  readonly icon: IconName;
  readonly icons: readonly PickableIcon[];
}

/** What the icon is for; it decides the groups suggested first (spec §13.3). */
export type IconContext = 'account' | 'expense' | 'income' | 'space';

/** Groups suggested for each context: accounts are money, incomes come from work and money. */
export const ICON_CONTEXT_GROUPS: Readonly<Record<IconContext, readonly string[]>> = {
  account: ['finance'],
  income: ['work', 'finance'],
  expense: [],
  space: [],
};

/** Most icons the "Sugeridos" section shows. */
export const ICON_SUGGESTION_LIMIT = 16;

/** Most icons recently used in the space that count as suggestions. */
export const RECENT_ICON_LIMIT = 8;

/** Shortest word of a name that suggests icons; shorter ones are articles and the like. */
const MIN_SUGGESTION_WORD = 3;

/** Common words of category and account names that say nothing about an icon. */
const NAME_STOPWORDS = new Set(['del', 'los', 'las', 'para', 'por', 'con', 'una', 'uno', 'mis']);

interface IndexedIcon {
  readonly icon: PickableIcon;
  readonly haystack: string;
  /** Normalized words of the label. */
  readonly labelWords: readonly string[];
  /** Normalized keywords. */
  readonly keywordWords: readonly string[];
}

interface IndexedGroup {
  readonly group: PickableIconGroup;
  readonly icons: readonly IndexedIcon[];
}

function indexCatalog(groups: readonly IconGroup[]): IndexedGroup[] {
  return groups.map((group) => {
    const icons = group.icons.filter((icon): icon is PickableIcon => isIconName(icon.name));
    const groupIcon = isIconName(group.icon) ? group.icon : (icons[0]?.name ?? 'category');
    return {
      group: { ...group, icon: groupIcon, icons },
      icons: icons.map((icon) => ({
        icon,
        haystack: normalizeSearchText(
          [icon.label, ...icon.keywords, group.label, icon.name.replaceAll('_', ' ')].join(' '),
        ),
        labelWords: searchTerms(icon.label),
        keywordWords: icon.keywords.flatMap((keyword) => searchTerms(keyword)),
      })),
    };
  });
}

const CATALOG_INDEX = indexCatalog(ICON_CATALOG);
const ICONS_BY_NAME = new Map<string, PickableIcon>(
  CATALOG_INDEX.flatMap(({ icons }) => icons.map(({ icon }) => [icon.name, icon] as const)),
);

/** Catalog groups whose icons match every word of the query (label, keywords, group or name). */
export function searchIcons(query: string): PickableIconGroup[] {
  const terms = searchTerms(query);
  if (terms.length === 0) {
    return CATALOG_INDEX.map(({ group }) => group);
  }
  return CATALOG_INDEX.map(({ group, icons }) => ({
    ...group,
    icons: icons.filter(({ haystack }) => matchesAllTerms(haystack, terms)).map(({ icon }) => icon),
  })).filter((group) => group.icons.length > 0);
}

/** Spanish label of a catalog icon, for accessible names; the name itself if it is not listed. */
export function iconLabel(name: string): string {
  return ICONS_BY_NAME.get(name)?.label ?? name;
}

/** Whether a word of an icon goes with a word of a name: one starts with the other. */
function wordsMatch(iconWord: string, nameWord: string): boolean {
  return (
    iconWord.startsWith(nameWord) ||
    (iconWord.length > MIN_SUGGESTION_WORD && nameWord.startsWith(iconWord))
  );
}

/** What suggests icons for an item (spec §13.3). */
export interface IconSuggestionSource {
  readonly context: IconContext | null;
  /** Name typed for the item, e.g. "Mercado del mes". */
  readonly name: string;
  /** Icons of the space, most recent first. */
  readonly recent: readonly string[];
  readonly limit?: number;
}

/**
 * The "Sugeridos" section of the icon picker, without repeats: icons whose label or keywords go
 * with the words of the name (those of the context groups first, then label before keywords),
 * then the ones used recently in the space, then the rest of the context groups.
 */
export function suggestIcons(source: IconSuggestionSource): PickableIcon[] {
  const limit = source.limit ?? ICON_SUGGESTION_LIMIT;
  const contextGroups = source.context ? ICON_CONTEXT_GROUPS[source.context] : [];
  const picked = new Map<string, PickableIcon>();
  const add = (icon: PickableIcon | undefined) => {
    if (icon && picked.size < limit && !picked.has(icon.name)) {
      picked.set(icon.name, icon);
    }
  };

  const words = searchTerms(source.name).filter(
    (word) => word.length >= MIN_SUGGESTION_WORD && !NAME_STOPWORDS.has(word),
  );
  if (words.length > 0) {
    const matches = (iconWords: readonly string[]) =>
      iconWords.some((iconWord) => words.some((word) => wordsMatch(iconWord, word)));
    const ranked = CATALOG_INDEX.flatMap(({ group, icons }) =>
      icons.map((indexed) => ({
        icon: indexed.icon,
        inContext: contextGroups.includes(group.id),
        byLabel: matches(indexed.labelWords),
        byKeyword: matches(indexed.keywordWords),
      })),
    )
      .filter(({ byLabel, byKeyword }) => byLabel || byKeyword)
      // Stable sort: the catalog order stays within each rank.
      .sort(
        (a, b) =>
          Number(b.inContext) - Number(a.inContext) || Number(b.byLabel) - Number(a.byLabel),
      );
    ranked.forEach(({ icon }) => add(icon));
  }

  source.recent.forEach((name) => add(ICONS_BY_NAME.get(name)));

  for (const groupId of contextGroups) {
    CATALOG_INDEX.find(({ group }) => group.id === groupId)?.group.icons.forEach(add);
  }
  return [...picked.values()];
}

/** An item of the space with an icon, e.g. an account or a category. */
export interface IconUse {
  readonly icon: string;
  readonly created_at: string;
}

/** Icons used in the space, from the newest item to the oldest, without repeats. */
export function recentIcons(
  items: readonly IconUse[],
  limit: number = RECENT_ICON_LIMIT,
): string[] {
  const sorted = [...items].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return [...new Set(sorted.map((item) => item.icon))].slice(0, limit);
}
