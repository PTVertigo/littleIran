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

const EVENT_ZONE = 'America/Toronto';
const dateFormat = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric', timeZone: EVENT_ZONE });
const clockFormat = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: EVENT_ZONE });

// An instant from the API ("2026-12-12T23:00:00.000Z") as Ontario reads it: "Sat, December 12, 2026, 6:00 PM".
// Events are in Southern Ontario, so every visitor sees the time on the clocks there. The time is built
// from its parts, because the built-in time text differs between browsers (some put a narrow space before PM).
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const clock = Object.fromEntries(clockFormat.formatToParts(date).map((p) => [p.type, p.value]));
  return `${dateFormat.format(date)}, ${formatTime(`${clock.hour}:${clock.minute}`)}`;
}

// When an event takes place: "Sat, December 12, 2026, 11:00 AM – 7:00 PM" when it ends the same day,
// the end written in full when it ends on another day, and only the start when there is no end time
export function formatEventWhen(startsAt: string, endsAt: string | null): string {
  const start = formatDateTime(startsAt);
  if (!endsAt) return start;
  const end = formatDateTime(endsAt);
  if (!end) return start;
  const sameDay = dateFormat.format(new Date(startsAt)) === dateFormat.format(new Date(endsAt));
  return sameDay ? `${start} – ${end.slice(end.lastIndexOf(', ') + 2)}` : `${start} to ${end}`;
}
