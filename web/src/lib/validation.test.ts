import { isValidEmail } from './validation';

// UT-002 (REQ-3.1.2)
describe('isValidEmail', () => {
  it('accepts a valid address and rejects one with no dot in the domain', () => {
    expect(isValidEmail('test@domain.com')).toBe(true);
    expect(isValidEmail('test@invalid')).toBe(false);
  });

  it('rejects spaces, a missing @, a missing name and addresses longer than 254 characters', () => {
    expect(isValidEmail('te st@domain.com')).toBe(false);
    expect(isValidEmail('domain.com')).toBe(false);
    expect(isValidEmail('@domain.com')).toBe(false);
    expect(isValidEmail(`${'a'.repeat(250)}@d.com`)).toBe(false);
  });
});
