import { EVENT_LIMITS, validateEventForm, type EventForm } from './event-validation';

const valid = (): EventForm => ({
  title: 'Yalda Night',
  categoryId: '3',
  description: 'Poetry and pomegranates.',
  location: 'Mississauga Banquet Hall',
  date: '2027-12-21',
  startTime: '19:00',
  endTime: '23:00',
  organizerName: 'Peel Persian Community',
  organizerContact: 'info@peel.example.com',
});
const errorsFor = (changes: Partial<EventForm>) => validateEventForm({ ...valid(), ...changes });

// UT-006
describe('validateEventForm', () => {
  it('accepts a complete event, with or without an end time', () => {
    expect(validateEventForm(valid())).toEqual({});
    expect(errorsFor({ endTime: '' })).toEqual({});
    expect(errorsFor({ endTime: '   ' })).toEqual({});
  });

  it('gives one message per empty field', () => {
    const empty: EventForm = { title: '', categoryId: '', description: '', location: '', date: '', startTime: '', endTime: '', organizerName: '', organizerContact: '' };

    expect(validateEventForm(empty)).toEqual({
      title: 'Enter the event name.',
      categoryId: 'Choose a category.',
      description: 'Describe the event.',
      location: 'Enter where the event is held.',
      date: 'Enter the date of the event.',
      startTime: 'Enter the time the event starts.',
      organizerName: "Enter the organizer's name.",
      organizerContact: 'Enter an email address or phone number for the organizer.',
    });
  });

  it('treats a field of only spaces as empty', () => {
    expect(errorsFor({ title: '   ', location: '  ' })).toEqual({ title: 'Enter the event name.', location: 'Enter where the event is held.' });
  });

  it.each(Object.entries(EVENT_LIMITS))('accepts %s of exactly %p characters and refuses one more', (field, limit) => {
    expect(errorsFor({ [field]: 'x'.repeat(limit) })).toEqual({});
    expect(errorsFor({ [field]: 'x'.repeat(limit + 1) })[field as keyof EventForm]).toMatch(/at most/);
  });

  it.each(['2027-02-30', '2027-13-01', '2027-04-31', '2027-1-1', 'tomorrow', '21/12/2027'])('refuses the date %p', (date) => {
    expect(errorsFor({ date }).date).toBe('Enter a real date.');
  });

  it('accepts 29 February in a leap year only', () => {
    expect(errorsFor({ date: '2028-02-29' })).toEqual({});
    expect(errorsFor({ date: '2027-02-29' }).date).toBe('Enter a real date.');
  });

  it.each(['24:00', '7:00', '19:60', '7pm'])('refuses the start time %p', (startTime) => {
    expect(errorsFor({ startTime }).startTime).toBe('Enter a time like 18:30.');
  });

  it('refuses an end that is not after the start, and accepts one a minute later', () => {
    expect(errorsFor({ startTime: '19:00', endTime: '19:00' }).endTime).toBe('The event must end after it starts.');
    expect(errorsFor({ startTime: '19:00', endTime: '18:00' }).endTime).toBe('The event must end after it starts.');
    expect(errorsFor({ startTime: '19:00', endTime: '19:01' })).toEqual({});
  });

  it('refuses an end time that is not a time', () => {
    expect(errorsFor({ endTime: '9pm' }).endTime).toBe('Enter a time like 21:00.');
  });

  it('does not also complain about the end when the start time is the problem', () => {
    expect(Object.keys(errorsFor({ startTime: '', endTime: '10:00' }))).toEqual(['startTime']);
  });

  it('does not decide whether the date has passed: the server does, in Ontario time', () => {
    expect(errorsFor({ date: '2001-01-01' })).toEqual({});
  });
});
