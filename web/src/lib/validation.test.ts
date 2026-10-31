import { isStrongPassword, isValidEmail } from './validation';

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

// UT-003 (REQ-3.1.3)
describe('isStrongPassword', () => {
  it('accepts only passwords that meet every rule', () => {
    expect(isStrongPassword('weak')).toBe(false);
    expect(isStrongPassword('Strong1!')).toBe(true);
    expect(isStrongPassword('Strong1@')).toBe(true);
  });

  it.each([
    ['too short', 'Aa1!aaa'],
    ['no uppercase letter', 'strong1!'],
    ['no lowercase letter', 'STRONG1!'],
    ['no digit', 'Strong!!'],
    ['no special character from the list', 'Strong11'],
    ['a special character outside the list', 'Strong1?'],
  ])('rejects a password with %s', (_rule, password) => {
    expect(isStrongPassword(password)).toBe(false);
  });

  it('rejects passwords over 72 bytes, which bcrypt would truncate', () => {
    expect(isStrongPassword(`Aa1!${'a'.repeat(68)}`)).toBe(true);
    expect(isStrongPassword(`Aa1!${'a'.repeat(69)}`)).toBe(false);
  });
});
