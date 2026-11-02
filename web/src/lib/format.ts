// Monday first, to match the API's day numbers: 1 is Monday and 7 is Sunday
export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// "18:00" from the API, written the way people read it in Ontario: "6:00 PM"
export function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${hours < 12 ? 'AM' : 'PM'}`;
}

// REQ-4.1.3 a stored website is user text. Only plain http and https addresses become links, so
// something like "javascript:alert(1)" can never run when someone clicks it.
export function safeWebUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}
