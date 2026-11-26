/** Lowercase text without accents, so "Educación" and "educacion" match. */
export function normalizeSearchText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

/** Search terms of a query: normalized words, without empty ones. */
export function searchTerms(query: string): string[] {
  return normalizeSearchText(query).split(/\s+/).filter(Boolean);
}

/** Whether every term appears somewhere in the normalized haystack. */
export function matchesAllTerms(haystack: string, terms: readonly string[]): boolean {
  return terms.every((term) => haystack.includes(term));
}
