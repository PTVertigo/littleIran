import { DAY_NAMES, formatTime, safeWebUrl } from './format';

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
