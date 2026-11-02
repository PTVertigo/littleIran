import { BUSINESS_LIMITS, validateBusinessForm, type BusinessForm } from './business-validation';

const week = (open: number[] = [1]) =>
  [1, 2, 3, 4, 5, 6, 7].map((day) => ({ open: open.includes(day), opens: '09:00', closes: '17:00' }));

const valid = (): BusinessForm => ({
  name: 'Norouz Restaurant',
  categoryId: '1',
  description: 'Kebabs and stews.',
  street: '210 Sample Street',
  city: 'Hamilton',
  postalCode: 'L8P 1A1',
  phone: '905-555-0101',
  email: 'info@norouz.example.com',
  website: 'https://example.com/norouz',
  hours: week(),
});

// UT-005 (REQ-3.3) and REQ-4.1.7: the same rules as the server, applied before anything is sent
describe('validateBusinessForm', () => {
  it('accepts a complete listing', () => {
    expect(validateBusinessForm(valid())).toEqual({});
  });

  it('asks for every required field when the form is empty', () => {
    const empty: BusinessForm = {
      name: '', categoryId: '', description: '', street: '', city: '', postalCode: '', phone: '', email: '', website: '', hours: week([]),
    };

    expect(Object.keys(validateBusinessForm(empty)).sort()).toEqual([
      'categoryId', 'city', 'description', 'email', 'hours', 'name', 'phone', 'postalCode', 'street',
    ]);
  });

  it.each(['name', 'description', 'street', 'city', 'postalCode', 'phone', 'email'] as const)('treats a %s of only spaces as missing', (field) => {
    expect(Object.keys(validateBusinessForm({ ...valid(), [field]: '   ' }))).toEqual([field]);
  });

  it('does not need a website', () => {
    expect(validateBusinessForm({ ...valid(), website: '' })).toEqual({});
  });

  it('refuses text over the limits and accepts text at them', () => {
    const over = validateBusinessForm({
      ...valid(),
      name: 'a'.repeat(BUSINESS_LIMITS.name + 1),
      description: 'a'.repeat(BUSINESS_LIMITS.description + 1),
      street: 'a'.repeat(BUSINESS_LIMITS.street + 1),
      city: 'a'.repeat(BUSINESS_LIMITS.city + 1),
    });
    const at = validateBusinessForm({ ...valid(), name: 'a'.repeat(BUSINESS_LIMITS.name), city: 'a'.repeat(BUSINESS_LIMITS.city) });

    expect(Object.keys(over).sort()).toEqual(['city', 'description', 'name', 'street']);
    expect(at).toEqual({});
  });

  it.each(['L8P 1A1', 'l8p1a1', ' M5V-2C3 '])('accepts the postal code %p', (postalCode) => {
    expect(validateBusinessForm({ ...valid(), postalCode }).postalCode).toBeUndefined();
  });

  it.each(['12345', 'L8P1A', 'LLL 111', '90210'])('refuses the postal code %p', (postalCode) => {
    expect(validateBusinessForm({ ...valid(), postalCode }).postalCode).toBe('Enter a postal code like L8P 1A1.');
  });

  it.each(['905-555-0101', '(905) 555 0101', '9055550101', '+1 905 555 0101'])('accepts the phone number %p', (phone) => {
    expect(validateBusinessForm({ ...valid(), phone }).phone).toBeUndefined();
  });

  it.each(['555-0101', '105-555-0101', 'call us', '905-555-0101 ext 4', '<script>'])('refuses the phone number %p', (phone) => {
    expect(validateBusinessForm({ ...valid(), phone }).phone).toBe('Enter a 10-digit phone number like 905-555-0101.');
  });

  it.each(['info', 'info@norouz', '@example.com'])('refuses the email %p', (email) => {
    expect(validateBusinessForm({ ...valid(), email }).email).toBe('Enter a valid email address.');
  });

  // REQ-4.1.3
  it.each(['https://example.com', 'http://example.com/menu'])('accepts the website %p', (website) => {
    expect(validateBusinessForm({ ...valid(), website }).website).toBeUndefined();
  });

  it.each(['javascript:alert(1)', 'data:text/html,x', 'file:///etc/passwd', 'ftp://example.com', 'example.com', 'not a url'])(
    'refuses the website %p',
    (website) => {
      expect(validateBusinessForm({ ...valid(), website }).website).toBe('Enter a web address that starts with http:// or https://.');
    },
  );

  describe('hours', () => {
    it('needs at least one open day', () => {
      expect(validateBusinessForm({ ...valid(), hours: week([]) }).hours).toBe('Enter the opening and closing time for at least one day.');
    });

    it('ignores the times of a day that is not open', () => {
      const hours = week([2]);
      hours[0] = { open: false, opens: '25:99', closes: '' };

      expect(validateBusinessForm({ ...valid(), hours }).hours).toBeUndefined();
    });

    it('names the day that closes before or when it opens', () => {
      const hours = week([3]);
      hours[2] = { open: true, opens: '17:00', closes: '09:00' };
      expect(validateBusinessForm({ ...valid(), hours }).hours).toBe('Wednesday must close after it opens.');

      hours[2] = { open: true, opens: '09:00', closes: '09:00' };
      expect(validateBusinessForm({ ...valid(), hours }).hours).toBe('Wednesday must close after it opens.');
    });

    it('names the day with a missing time', () => {
      const hours = week([5]);
      hours[4] = { open: true, opens: '', closes: '18:00' };

      expect(validateBusinessForm({ ...valid(), hours }).hours).toBe("Enter Friday's opening and closing times.");
    });

    it('accepts all seven days', () => {
      expect(validateBusinessForm({ ...valid(), hours: week([1, 2, 3, 4, 5, 6, 7]) })).toEqual({});
    });
  });
});
