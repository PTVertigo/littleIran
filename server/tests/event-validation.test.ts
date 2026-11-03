import { EVENT_LIMITS, validateEvent } from '../src/event-validation';

const valid = () => ({
  title: 'Yalda Night',
  categoryId: '3',
  description: 'Poetry and pomegranates.',
  location: 'Mississauga Banquet Hall, 45 Example Road',
  date: '2027-12-21',
  startTime: '19:00',
  endTime: '23:00',
  organizerName: 'Peel Persian Community',
  organizerContact: 'info@peel.example.com',
});
const errorsFor = (changes: object) => validateEvent({ ...valid(), ...changes }).errors;

// UT-006 event validation (REQ-3.4, REQ-4.1.7)
describe('validateEvent', () => {
  it('accepts a complete event and returns it cleaned up', () => {
    const { errors, value } = validateEvent({ ...valid(), title: '  Yalda Night  ', location: ' Hall ' });

    expect(errors).toEqual({});
    expect(value).toEqual({ ...valid(), title: 'Yalda Night', location: 'Hall' });
  });

  it('accepts an event with no end time', () => {
    for (const endTime of ['', undefined, null, '   ']) {
      const { errors, value } = validateEvent({ ...valid(), endTime });
      expect(errors).toEqual({});
      expect(value?.endTime).toBeNull();
    }
  });

  it('gives one message per missing field when everything is empty', () => {
    expect(validateEvent({}).errors).toEqual({
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

  it.each([undefined, null, 'text', 42, [], true])('treats %p as an empty body', (body) => {
    expect(Object.keys(validateEvent(body).errors)).toHaveLength(8);
    expect(validateEvent(body).value).toBeUndefined();
  });

  it('treats fields that are not text as missing', () => {
    const errors = errorsFor({ title: 5, description: {}, location: ['x'], organizerName: null, organizerContact: true, date: 20271221 });

    expect(Object.keys(errors).sort()).toEqual(['date', 'description', 'location', 'organizerContact', 'organizerName', 'title']);
  });

  it.each([
    ['title', EVENT_LIMITS.title],
    ['description', EVENT_LIMITS.description],
    ['location', EVENT_LIMITS.location],
    ['organizerName', EVENT_LIMITS.organizerName],
    ['organizerContact', EVENT_LIMITS.organizerContact],
  ])('accepts a %s of exactly %p characters and refuses one more', (field, limit) => {
    expect(errorsFor({ [field]: 'x'.repeat(limit) })).toEqual({});
    expect(errorsFor({ [field]: 'x'.repeat(limit + 1) })[field]).toMatch(/at most/);
  });

  it('counts the length after trimming', () => {
    expect(errorsFor({ title: ` ${'x'.repeat(EVENT_LIMITS.title)} ` })).toEqual({});
  });

  it.each(['abc', '0', '-1', '1.5', '', ' ', '1 OR 1=1', 5])('refuses the category %p', (categoryId) => {
    expect(errorsFor({ categoryId }).categoryId).toBe('Choose a category.');
  });

  it.each(['2027-12-21', '2028-02-29', '2027-01-01', '2027-12-31'])('accepts the date %p', (date) => {
    expect(errorsFor({ date })).toEqual({});
  });

  it.each(['2027-02-30', '2027-02-29', '2027-13-01', '2027-00-10', '2027-04-31', '2027-1-1', '21/12/2027', 'tomorrow', '2027-12-21T10:00', '12-21-2027'])(
    'refuses the date %p',
    (date) => {
      expect(errorsFor({ date }).date).toBe('Enter a real date.');
    },
  );

  it.each(['00:00', '09:05', '12:00', '23:59'])('accepts the start time %p', (startTime) => {
    expect(errorsFor({ startTime, endTime: '' })).toEqual({});
  });

  it.each(['24:00', '7:00', '19:60', '19', '7pm', 'noon', '19:00:00', '1900'])('refuses the start time %p', (startTime) => {
    expect(errorsFor({ startTime }).startTime).toBe('Enter a time like 18:30.');
  });

  it.each(['24:00', '9pm', '23:60', 'late'])('refuses the end time %p', (endTime) => {
    expect(errorsFor({ endTime }).endTime).toBe('Enter a time like 21:00.');
  });

  it('refuses an end that is not after the start, but accepts one a minute later', () => {
    expect(errorsFor({ startTime: '19:00', endTime: '19:00' }).endTime).toBe('The event must end after it starts.');
    expect(errorsFor({ startTime: '19:00', endTime: '18:59' }).endTime).toBe('The event must end after it starts.');
    expect(errorsFor({ startTime: '19:00', endTime: '19:01' })).toEqual({});
  });

  it('does not also complain about the end when the start time is the problem', () => {
    expect(Object.keys(errorsFor({ startTime: 'noon', endTime: '10:00' }))).toEqual(['startTime']);
  });

  // UT-004 / REQ-4.1.3 markup is kept as text; the pages escape it
  it('keeps markup as text rather than rewriting it', () => {
    const { value } = validateEvent({ ...valid(), title: '<script>alert(1)</script>' });

    expect(value?.title).toBe('<script>alert(1)</script>');
  });

  it('returns no value when anything is wrong', () => {
    expect(validateEvent({ ...valid(), date: 'x' }).value).toBeUndefined();
  });
});
