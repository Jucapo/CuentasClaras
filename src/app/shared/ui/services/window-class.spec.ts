import { minWidthQuery, windowClassFor, WINDOW_QUERIES } from './window-class';

describe('windowClassFor', () => {
  it('is compact below the medium breakpoint', () => {
    expect(windowClassFor(false, false)).toBe('compact');
  });

  it('is medium from 600 px and expanded from 840 px', () => {
    expect(windowClassFor(true, false)).toBe('medium');
    expect(windowClassFor(true, true)).toBe('expanded');
  });

  it('trusts the expanded query even if the medium one lags behind', () => {
    expect(windowClassFor(false, true)).toBe('expanded');
  });
});

describe('WINDOW_QUERIES', () => {
  it('use the Material 3 breakpoints', () => {
    expect(WINDOW_QUERIES).toEqual({
      medium: '(min-width: 600px)',
      expanded: '(min-width: 840px)',
    });
    expect(minWidthQuery(1200)).toBe('(min-width: 1200px)');
  });
});
