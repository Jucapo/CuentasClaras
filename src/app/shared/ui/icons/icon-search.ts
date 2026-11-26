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
export interface PickableIconGroup extends Omit<IconGroup, 'icons'> {
  readonly icons: readonly PickableIcon[];
}

interface IndexedIcon {
  readonly icon: PickableIcon;
  readonly haystack: string;
}

interface IndexedGroup {
  readonly group: PickableIconGroup;
  readonly icons: readonly IndexedIcon[];
}

function indexCatalog(groups: readonly IconGroup[]): IndexedGroup[] {
  return groups.map((group) => {
    const icons = group.icons.filter((icon): icon is PickableIcon => isIconName(icon.name));
    return {
      group: { ...group, icons },
      icons: icons.map((icon) => ({
        icon,
        haystack: normalizeSearchText(
          [icon.label, ...icon.keywords, group.label, icon.name.replaceAll('_', ' ')].join(' '),
        ),
      })),
    };
  });
}

const CATALOG_INDEX = indexCatalog(ICON_CATALOG);

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
  for (const group of ICON_CATALOG) {
    const found = group.icons.find((icon) => icon.name === name);
    if (found) {
      return found.label;
    }
  }
  return name;
}
