// REQ-4.1.7 the same rules as server/src/event-validation.ts, checked before anything is sent.
// The server still checks everything again, and it is the copy that counts.
export const EVENT_LIMITS = { title: 100, description: 2000, location: 200, organizerName: 100, organizerContact: 100 } as const;

export type EventForm = {
  title: string;
  categoryId: string;
  description: string;
  location: string;
  date: string;
  startTime: string;
  endTime: string;
  organizerName: string;
  organizerContact: string;
};
export type EventFormErrors = Partial<Record<keyof EventForm, string>>;

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

// A real day on the calendar: 2027-02-30 matches the pattern but is not a date
function isCalendarDate(value: string): boolean {
  const match = DATE.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

// UT-006 (REQ-3.4): one message per field that is missing or wrong. Whether the date is still to come
// is decided by the server, which knows the time in Ontario.
export function validateEventForm(form: EventForm): EventFormErrors {
  const errors: EventFormErrors = {};
  const title = form.title.trim();
  const description = form.description.trim();
  const location = form.location.trim();
  const date = form.date.trim();
  const startTime = form.startTime.trim();
  const endTime = form.endTime.trim();
  const organizerName = form.organizerName.trim();
  const organizerContact = form.organizerContact.trim();

  if (!title) errors.title = 'Enter the event name.';
  else if (title.length > EVENT_LIMITS.title) errors.title = `The name can be at most ${EVENT_LIMITS.title} characters.`;

  if (!form.categoryId) errors.categoryId = 'Choose a category.';

  if (!description) errors.description = 'Describe the event.';
  else if (description.length > EVENT_LIMITS.description) {
    errors.description = `The description can be at most ${EVENT_LIMITS.description} characters.`;
  }

  if (!location) errors.location = 'Enter where the event is held.';
  else if (location.length > EVENT_LIMITS.location) errors.location = `The location can be at most ${EVENT_LIMITS.location} characters.`;

  if (!date) errors.date = 'Enter the date of the event.';
  else if (!isCalendarDate(date)) errors.date = 'Enter a real date.';

  if (!startTime) errors.startTime = 'Enter the time the event starts.';
  else if (!TIME.test(startTime)) errors.startTime = 'Enter a time like 18:30.';

  if (endTime && !TIME.test(endTime)) errors.endTime = 'Enter a time like 21:00.';
  else if (endTime && !errors.startTime && endTime <= startTime) errors.endTime = 'The event must end after it starts.';

  if (!organizerName) errors.organizerName = "Enter the organizer's name.";
  else if (organizerName.length > EVENT_LIMITS.organizerName) {
    errors.organizerName = `The organizer's name can be at most ${EVENT_LIMITS.organizerName} characters.`;
  }

  if (!organizerContact) errors.organizerContact = 'Enter an email address or phone number for the organizer.';
  else if (organizerContact.length > EVENT_LIMITS.organizerContact) {
    errors.organizerContact = `The contact can be at most ${EVENT_LIMITS.organizerContact} characters.`;
  }

  return errors;
}
