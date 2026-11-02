// REQ-3.7.1 turns what someone typed into the words to search for. Nothing here is put into SQL text:
// the words only ever travel as query parameters (REQ-4.1.1).
export const SEARCH_MAX_LENGTH = 100;
const MAX_TERMS = 5;

export function parseSearch(raw: unknown): { terms: string[] } | { error: string } {
  if (raw === undefined) return { terms: [] };
  // ?search=a&search=b arrives as a list, and ?search[x]=y as an object; only one phrase is accepted
  if (typeof raw !== 'string') return { error: 'Search for a single phrase.' };

  const text = raw.trim();
  if (text.length > SEARCH_MAX_LENGTH) return { error: `Search for at most ${SEARCH_MAX_LENGTH} characters.` };
  // The database refuses a null character in text, which would otherwise surface as a server error
  if (text.includes('\0')) return { error: 'That search contains characters that are not allowed.' };

  return { terms: text.split(/\s+/).filter(Boolean).slice(0, MAX_TERMS) };
}

// In a LIKE pattern, % and _ are wildcards and \ is the escape. A search for "50%" means those characters.
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, '\\$&');
}
