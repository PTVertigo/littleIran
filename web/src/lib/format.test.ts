import { DAY_NAMES, formatDateTime, formatEventWhen, formatTime, safeWebUrl } from './format';

describe('formatTime', () => {
  it.each([
    ['00:00', '12:00 AM'],
    ['00:30', '12:30 AM'],
    ['09:05', '9:05 AM'],
    ['11:59', '11:59 AM'],
    ['12:00', '12:00 PM'],
    ['13:15', '1:15 PM'],
    ['18:00', '6:00 PM'],
    ['23:45', '11:45 PM'],
  ])('writes %s as %s', (time, expected) => {
    expect(formatTime(time)).toBe(expected);
  });
});

describe('DAY_NAMES', () => {
  it('starts on Monday and has seven days, matching the API\'s day numbers', () => {
    expect(DAY_NAMES).toHaveLength(7);
    expect(DAY_NAMES[0]).toBe('Monday');
    expect(DAY_NAMES[6]).toBe('Sunday');
  });
});

// REQ-4.1.3
describe('safeWebUrl', () => {
  it.each(['https://example.com/pars', 'http://example.com', 'HTTPS://EXAMPLE.COM'])('turns %s into a link address', (value) => {
    expect(safeWebUrl(value)).toMatch(/^https?:\/\//);
  });

  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    'ftp://example.com',
    '//example.com',
    'example.com',
    'not a url',
    '',
    null,
  ])('does not turn %p into a link', (value) => {
    expect(safeWebUrl(value)).toBeNull();
  });
});

describe('formatDateTime', () => {
  it('writes the date and time as Ontario reads them', () => {
    expect(formatDateTime('2026-12-12T16:00:00.000Z')).toBe('Sat, December 12, 2026, 11:00 AM');
  });

  it('uses Ontario time, so the day can differ from UTC', () => {
    expect(formatDateTime('2026-12-21T00:30:00.000Z')).toBe('Sun, December 20, 2026, 7:30 PM');
  });

  it('follows daylight saving time: the same 3 pm UTC is 11 am in summer and 10 am in winter', () => {
    expect(formatDateTime('2026-07-01T15:00:00.000Z')).toBe('Wed, July 1, 2026, 11:00 AM');
    expect(formatDateTime('2026-01-15T15:00:00.000Z')).toBe('Thu, January 15, 2026, 10:00 AM');
  });

  it('writes midnight as 12:00 AM and noon as 12:00 PM', () => {
    expect(formatDateTime('2026-12-12T05:00:00.000Z')).toBe('Sat, December 12, 2026, 12:00 AM');
    expect(formatDateTime('2026-12-12T17:00:00.000Z')).toBe('Sat, December 12, 2026, 12:00 PM');
  });

  it('gives an empty string for something that is not a date', () => {
    expect(formatDateTime('soon')).toBe('');
    expect(formatDateTime('')).toBe('');
  });
});

describe('formatEventWhen', () => {
  it('shows the start and the end time when the event ends the same day', () => {
    expect(formatEventWhen('2026-12-12T16:00:00.000Z', '2026-12-13T00:00:00.000Z')).toBe('Sat, December 12, 2026, 11:00 AM – 7:00 PM');
  });

  it('uses the Ontario day, not the UTC day, to decide whether it ends the same day', () => {
    // 7 pm to 10 pm in Ontario is across midnight in UTC
    expect(formatEventWhen('2026-12-12T00:00:00.000Z', '2026-12-12T03:00:00.000Z')).toBe('Fri, December 11, 2026, 7:00 PM – 10:00 PM');
  });

  it('writes the whole end when it ends on another day', () => {
    expect(formatEventWhen('2026-12-12T16:00:00.000Z', '2026-12-14T02:00:00.000Z')).toBe(
      'Sat, December 12, 2026, 11:00 AM to Sun, December 13, 2026, 9:00 PM',
    );
  });

  it('shows only the start without an end time, or with one that is not a date', () => {
    expect(formatEventWhen('2026-12-12T16:00:00.000Z', null)).toBe('Sat, December 12, 2026, 11:00 AM');
    expect(formatEventWhen('2026-12-12T16:00:00.000Z', 'later')).toBe('Sat, December 12, 2026, 11:00 AM');
  });
});
