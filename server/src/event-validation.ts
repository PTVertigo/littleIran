import { isRecordId } from './validation';

// REQ-4.1.7 the rules for a submitted event. web/src/lib/event-validation.ts applies the same ones in the
// browser; this is the copy that counts, because requests can skip the page.
export const EVENT_LIMITS = { title: 100, description: 2000, location: 200, organizerName: 100, organizerContact: 100 } as const;

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

// The date and times are what the organizer reads off their calendar and clock in Ontario. The route
// turns them into an instant, so the browser's own time zone never decides when an event happens.
export type ValidEvent = {
  title: string;
  categoryId: string;
  description: string;
  location: string;
  date: string;
  startTime: string;
  endTime: string | null;
  organizerName: string;
  organizerContact: string;
};

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

// A real day on the calendar: 2026-02-30 matches the pattern but is not a date
function isCalendarDate(value: string): boolean {
  const match = DATE.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

// UT-006 / REQ-3.4: an event with missing or bad fields gets one message per field, and nothing else
export function validateEvent(body: unknown): { errors: Record<string, string>; value?: ValidEvent } {
  const input = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const errors: Record<string, string> = {};

  const title = text(input.title);
  if (!title) errors.title = 'Enter the event name.';
  else if (title.length > EVENT_LIMITS.title) errors.title = `The name can be at most ${EVENT_LIMITS.title} characters.`;

  const categoryId = typeof input.categoryId === 'string' ? input.categoryId.trim() : '';
  if (!isRecordId(categoryId)) errors.categoryId = 'Choose a category.';

  const description = text(input.description);
  if (!description) errors.description = 'Describe the event.';
  else if (description.length > EVENT_LIMITS.description) {
    errors.description = `The description can be at most ${EVENT_LIMITS.description} characters.`;
  }

  const location = text(input.location);
  if (!location) errors.location = 'Enter where the event is held.';
  else if (location.length > EVENT_LIMITS.location) errors.location = `The location can be at most ${EVENT_LIMITS.location} characters.`;

  const date = text(input.date);
  if (!date) errors.date = 'Enter the date of the event.';
  else if (!isCalendarDate(date)) errors.date = 'Enter a real date.';

  const startTime = text(input.startTime);
  if (!startTime) errors.startTime = 'Enter the time the event starts.';
  else if (!TIME.test(startTime)) errors.startTime = 'Enter a time like 18:30.';

  // The end is optional, and an event ends on the day it starts
  const endTime = text(input.endTime);
  if (endTime && !TIME.test(endTime)) errors.endTime = 'Enter a time like 21:00.';
  else if (endTime && !errors.startTime && endTime <= startTime) errors.endTime = 'The event must end after it starts.';

  const organizerName = text(input.organizerName);
  if (!organizerName) errors.organizerName = 'Enter the organizer\'s name.';
  else if (organizerName.length > EVENT_LIMITS.organizerName) {
    errors.organizerName = `The organizer's name can be at most ${EVENT_LIMITS.organizerName} characters.`;
  }

  const organizerContact = text(input.organizerContact);
  if (!organizerContact) errors.organizerContact = 'Enter an email address or phone number for the organizer.';
  else if (organizerContact.length > EVENT_LIMITS.organizerContact) {
    errors.organizerContact = `The contact can be at most ${EVENT_LIMITS.organizerContact} characters.`;
  }

  if (Object.keys(errors).length > 0) return { errors };
  return {
    errors,
    value: { title, categoryId, description, location, date, startTime, endTime: endTime || null, organizerName, organizerContact },
  };
}
