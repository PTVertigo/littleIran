import { BUSINESS_LIMITS, validateBusiness } from '../src/business-validation';

const valid = () => ({
  name: 'Norouz Restaurant',
  categoryId: '1',
  description: 'Kebabs and stews.',
  street: '210 Sample Street',
  city: 'Hamilton',
  postalCode: 'L8P 1A1',
  phone: '905-555-0101',
  email: 'info@norouz.example.com',
  website: 'https://example.com/norouz',
  hours: [{ day: 1, opens: '11:00', closes: '22:00' }],
});

// UT-005 (REQ-3.3): a listing with missing required fields gets validation errors
describe('validateBusiness', () => {
  it('accepts a complete listing and returns it cleaned up', () => {
    const { errors, value } = validateBusiness(valid());

    expect(errors).toEqual({});
    expect(value).toEqual(valid());
  });

  it('returns one error per missing required field when everything is missing', () => {
    const { errors, value } = validateBusiness({});

    expect(value).toBeUndefined();
    expect(Object.keys(errors).sort()).toEqual([
      'categoryId', 'city', 'description', 'email', 'hours', 'name', 'phone', 'postalCode', 'street',
    ]);
  });

  it.each(['name', 'categoryId', 'description', 'street', 'city', 'postalCode', 'phone', 'email', 'hours'])(
    'reports only %s when only that one is missing',
    (field) => {
      const input: Record<string, unknown> = valid();
      delete input[field];

      const { errors, value } = validateBusiness(input);

      expect(value).toBeUndefined();
      expect(Object.keys(errors)).toEqual([field]);
    },
  );

  it('treats a field with only spaces as missing', () => {
    const { errors } = validateBusiness({ ...valid(), name: '   ', description: '\t\n', city: ' ' });

    expect(Object.keys(errors).sort()).toEqual(['city', 'description', 'name']);
  });

  it('does not need a website', () => {
    const { errors, value } = validateBusiness({ ...valid(), website: undefined });

    expect(errors).toEqual({});
    expect(value?.website).toBeNull();
  });

  it('trims every text field', () => {
    const { value } = validateBusiness({ ...valid(), name: '  Norouz Restaurant ', city: ' Hamilton  ', street: ' 210 Sample Street ' });

    expect(value).toMatchObject({ name: 'Norouz Restaurant', city: 'Hamilton', street: '210 Sample Street' });
  });

  it.each([null, undefined, 'a string', 42, [], true])('rejects a body that is %p', (body) => {
    const { errors, value } = validateBusiness(body);

    expect(value).toBeUndefined();
    expect(Object.keys(errors).length).toBeGreaterThan(0);
  });

  it('rejects fields that are not text', () => {
    const { errors } = validateBusiness({ ...valid(), name: 5, description: { a: 1 }, street: ['x'], phone: 9055550101 });

    expect(Object.keys(errors).sort()).toEqual(['description', 'name', 'phone', 'street']);
  });

  it('rejects text longer than the limits, and accepts text at the limit', () => {
    const tooLong = validateBusiness({
      ...valid(),
      name: 'a'.repeat(BUSINESS_LIMITS.name + 1),
      description: 'a'.repeat(BUSINESS_LIMITS.description + 1),
      street: 'a'.repeat(BUSINESS_LIMITS.street + 1),
      city: 'a'.repeat(BUSINESS_LIMITS.city + 1),
    });
    const atLimit = validateBusiness({
      ...valid(),
      name: 'a'.repeat(BUSINESS_LIMITS.name),
      description: 'a'.repeat(BUSINESS_LIMITS.description),
      street: 'a'.repeat(BUSINESS_LIMITS.street),
      city: 'a'.repeat(BUSINESS_LIMITS.city),
    });

    expect(Object.keys(tooLong.errors).sort()).toEqual(['city', 'description', 'name', 'street']);
    expect(atLimit.errors).toEqual({});
  });

  describe('category', () => {
    it.each(['abc', '0', '-1', '1.5', '1 OR 1=1', '', '9'.repeat(30)])('rejects %p', (categoryId) => {
      expect(validateBusiness({ ...valid(), categoryId }).errors.categoryId).toBeDefined();
    });

    it('rejects a number, because ids travel as text', () => {
      expect(validateBusiness({ ...valid(), categoryId: 1 }).errors.categoryId).toBeDefined();
    });
  });

  describe('postal code', () => {
    it.each([
      ['L8P 1A1', 'L8P 1A1'],
      ['l8p1a1', 'L8P 1A1'],
      ['  m5v-2c3 ', 'M5V 2C3'],
    ])('accepts %p and writes it as %p', (input, expected) => {
      expect(validateBusiness({ ...valid(), postalCode: input }).value?.postalCode).toBe(expected);
    });

    it.each(['12345', 'L8P1A', 'LLL 111', 'L8P 1A1 2', '90210', 'L8P  1A1x'])('rejects %p', (postalCode) => {
      expect(validateBusiness({ ...valid(), postalCode }).errors.postalCode).toBe('Enter a postal code like L8P 1A1.');
    });
  });

  describe('phone', () => {
    it.each([
      ['905-555-0101', '905-555-0101'],
      ['(905) 555 0101', '905-555-0101'],
      ['905.555.0101', '905-555-0101'],
      ['9055550101', '905-555-0101'],
      ['+1 905 555 0101', '905-555-0101'],
      ['1-905-555-0101', '905-555-0101'],
    ])('accepts %p and writes it as %p', (input, expected) => {
      expect(validateBusiness({ ...valid(), phone: input }).value?.phone).toBe(expected);
    });

    it.each(['555-0101', '905-555-010', '105-555-0101', '905-155-0101', 'call us', '905-555-0101 ext 4', '12345678901234', '<script>'])(
      'rejects %p',
      (phone) => {
        expect(validateBusiness({ ...valid(), phone }).errors.phone).toBe('Enter a 10-digit phone number like 905-555-0101.');
      },
    );
  });

  describe('email', () => {
    it('lowercases a valid address', () => {
      expect(validateBusiness({ ...valid(), email: ' Info@Norouz.Example.COM ' }).value?.email).toBe('info@norouz.example.com');
    });

    it.each(['info', 'info@norouz', '@example.com', 'a b@example.com'])('rejects %p', (email) => {
      expect(validateBusiness({ ...valid(), email }).errors.email).toBe('Enter a valid email address.');
    });
  });

  // REQ-4.1.3 a website becomes a link, so only plain web addresses are allowed
  describe('website', () => {
    it.each(['https://example.com', 'http://example.com/menu?lang=fa', 'HTTPS://EXAMPLE.COM'])('accepts %p', (website) => {
      expect(validateBusiness({ ...valid(), website }).errors).toEqual({});
    });

    it.each([
      'javascript:alert(1)',
      'JaVaScRiPt:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
      'file:///etc/passwd',
      'ftp://example.com',
      'example.com',
      '//example.com',
      'not a url',
      `https://example.com/${'a'.repeat(BUSINESS_LIMITS.website)}`,
    ])('rejects %p', (website) => {
      expect(validateBusiness({ ...valid(), website }).errors.website).toBe('Enter a web address that starts with http:// or https://.');
    });
  });

  describe('hours', () => {
    const withHours = (hours: unknown) => validateBusiness({ ...valid(), hours });

    it('accepts several days and puts them in day order', () => {
      const { value } = withHours([
        { day: 6, opens: '09:30', closes: '17:45' },
        { day: 1, opens: '10:00', closes: '19:00' },
      ]);

      expect(value?.hours).toEqual([
        { day: 1, opens: '10:00', closes: '19:00' },
        { day: 6, opens: '09:30', closes: '17:45' },
      ]);
    });

    it('accepts all seven days', () => {
      const week = [1, 2, 3, 4, 5, 6, 7].map((day) => ({ day, opens: '09:00', closes: '17:00' }));

      expect(withHours(week).errors).toEqual({});
    });

    it.each([[undefined], [[]], ['monday'], [{}], [null]])('requires at least one open day (%p)', (hours) => {
      expect(withHours(hours).errors.hours).toBe('Enter the opening and closing time for at least one day.');
    });

    it('names the day when it closes before or when it opens', () => {
      expect(withHours([{ day: 3, opens: '17:00', closes: '09:00' }]).errors.hours).toBe('Wednesday must close after it opens.');
      expect(withHours([{ day: 3, opens: '09:00', closes: '09:00' }]).errors.hours).toBe('Wednesday must close after it opens.');
    });

    it('names the day for a time that is not a time', () => {
      for (const bad of ['9:00', '24:00', '12:60', 'noon', '', '09:00:00']) {
        expect(withHours([{ day: 5, opens: bad, closes: '18:00' }]).errors.hours).toBe("Enter Friday's opening and closing times.");
      }
      expect(withHours([{ day: 5, opens: '09:00' }]).errors.hours).toBe("Enter Friday's opening and closing times.");
    });

    it.each([0, 8, 1.5, '1', null, -1])('rejects the day %p', (day) => {
      expect(withHours([{ day, opens: '09:00', closes: '17:00' }]).errors.hours).toBe('Each opening time needs a day from Monday to Sunday.');
    });

    it('rejects the same day twice', () => {
      const twice = [
        { day: 2, opens: '09:00', closes: '12:00' },
        { day: 2, opens: '13:00', closes: '17:00' },
      ];

      expect(withHours(twice).errors.hours).toBe('Tuesday is listed more than once.');
    });

    it('rejects more than seven entries', () => {
      const eight = Array.from({ length: 8 }, () => ({ day: 1, opens: '09:00', closes: '17:00' }));

      expect(withHours(eight).errors.hours).toBe('There are only seven days in a week.');
    });

    it('does not break on an entry that is not an object', () => {
      expect(withHours([null]).errors.hours).toBeDefined();
      expect(withHours(['x', 5]).errors.hours).toBeDefined();
    });
  });

  it('ignores fields it does not know, so a request cannot set the status or owner', () => {
    const { value } = validateBusiness({ ...valid(), status: 'approved', user_id: '1', userId: '1', rejection_reason: 'x' });

    expect(Object.keys(value!).sort()).toEqual([
      'categoryId', 'city', 'description', 'email', 'hours', 'name', 'phone', 'postalCode', 'street', 'website',
    ]);
  });
});
