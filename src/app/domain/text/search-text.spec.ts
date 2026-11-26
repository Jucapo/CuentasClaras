import { matchesAllTerms, normalizeSearchText, searchTerms } from './search-text';

describe('search text', () => {
  it('ignores case and accents', () => {
    expect(normalizeSearchText('  Educación Ñandú ')).toBe('educacion nandu');
  });

  it('splits a query into normalized terms', () => {
    expect(searchTerms('  Fútbol   AMERICANO ')).toEqual(['futbol', 'americano']);
    expect(searchTerms('   ')).toEqual([]);
  });

  it('matches only when every term is present', () => {
    const haystack = normalizeSearchText('Tarjeta de crédito deuda');
    expect(matchesAllTerms(haystack, searchTerms('credito'))).toBe(true);
    expect(matchesAllTerms(haystack, searchTerms('tarj deu'))).toBe(true);
    expect(matchesAllTerms(haystack, searchTerms('tarjeta ahorro'))).toBe(false);
    expect(matchesAllTerms(haystack, [])).toBe(true);
  });
});
