import { escapeLike, parseSearch, SEARCH_MAX_LENGTH } from '../src/search';

// REQ-3.7.1 / REQ-4.1.1
describe('parseSearch', () => {
  it('has no words when there is no search', () => {
    expect(parseSearch(undefined)).toEqual({ terms: [] });
    expect(parseSearch('')).toEqual({ terms: [] });
    expect(parseSearch('   \t ')).toEqual({ terms: [] });
  });

  it('splits what was typed into words, ignoring extra spaces', () => {
    expect(parseSearch('  persian   restaurant ')).toEqual({ terms: ['persian', 'restaurant'] });
  });

  it('keeps the case as typed, because the database compares without case', () => {
    expect(parseSearch('Persian')).toEqual({ terms: ['Persian'] });
  });

  it('keeps Persian words and symbols as they are', () => {
    expect(parseSearch('رستوران health & wellness')).toEqual({ terms: ['رستوران', 'health', '&', 'wellness'] });
  });

  it('uses only the first five words', () => {
    expect(parseSearch('a b c d e f g')).toEqual({ terms: ['a', 'b', 'c', 'd', 'e'] });
  });

  it('accepts a search at the length limit and refuses one over it', () => {
    expect(parseSearch('a'.repeat(SEARCH_MAX_LENGTH))).toEqual({ terms: ['a'.repeat(SEARCH_MAX_LENGTH)] });
    expect(parseSearch('a'.repeat(SEARCH_MAX_LENGTH + 1))).toEqual({ error: `Search for at most ${SEARCH_MAX_LENGTH} characters.` });
  });

  it.each([['a', 'b'], { x: 'y' }, 5, true, null])('refuses %p, which is not one phrase', (value) => {
    expect(parseSearch(value)).toEqual({ error: 'Search for a single phrase.' });
  });

  it('refuses a null character, which the database cannot store', () => {
    expect(parseSearch('pers\0ian')).toEqual({ error: 'That search contains characters that are not allowed.' });
  });
});

describe('escapeLike', () => {
  it.each([
    ['plain', 'plain'],
    ['50%', '50\\%'],
    ['a_b', 'a\\_b'],
    ['back\\slash', 'back\\\\slash'],
    ['%_\\', '\\%\\_\\\\'],
    ["'; DROP TABLE businesses;--", "'; DROP TABLE businesses;--"],
  ])('turns %p into %p', (input, expected) => {
    expect(escapeLike(input)).toBe(expected);
  });
});
