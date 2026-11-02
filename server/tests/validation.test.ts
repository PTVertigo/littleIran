import { isStrongPassword, isValidEmail, validateNames } from '../src/validation';

// REQ-3.1.1 and REQ-3.2.2
describe('validateNames', () => {
  it('accepts two ordinary names', () => {
    expect(validateNames('Sara', 'Ahmadi')).toEqual({});
  });

  it('accepts names at the 50 character limit', () => {
    expect(validateNames('a'.repeat(50), 'b'.repeat(50))).toEqual({});
  });

  it('names each missing or too long field', () => {
    expect(validateNames('', 'Ahmadi')).toEqual({ firstName: 'Enter your first name.' });
    expect(validateNames('Sara', 'b'.repeat(51))).toEqual({ lastName: 'Enter your last name.' });
    expect(Object.keys(validateNames('', ''))).toEqual(['firstName', 'lastName']);
  });
});

// UT-002 (REQ-3.1.2)
describe('isValidEmail', () => {
  it('accepts a normal address', () => {
    expect(isValidEmail('test@domain.com')).toBe(true);
  });

  it.each(['test@invalid', 'test.domain.com', '@domain.com', 'a b@domain.com', ''])(
    'rejects %p',
    (email) => {
      expect(isValidEmail(email)).toBe(false);
    },
  );

  it('rejects addresses longer than 254 characters', () => {
    expect(isValidEmail(`${'a'.repeat(250)}@x.com`)).toBe(false);
  });
});

// UT-003 (REQ-3.1.3)
describe('isStrongPassword', () => {
  it.each(['Strong1!', 'Strong1@'])('accepts %p', (password) => {
    expect(isStrongPassword(password)).toBe(true);
  });

  it.each([
    ['weak', 'too short and missing classes'],
    ['Str1!', 'under 8 characters'],
    ['strong1!', 'no uppercase'],
    ['STRONG1!', 'no lowercase'],
    ['Strongg!', 'no digit'],
    ['Strong12', 'no special character'],
    ['Strong1?', 'special character outside the allowed set'],
  ])('rejects %p (%s)', (password) => {
    expect(isStrongPassword(password)).toBe(false);
  });
});

describe('isStrongPassword length cap', () => {
  it('rejects passwords over 72 bytes, which bcrypt would truncate', () => {
    expect(isStrongPassword(`Aa1!${'x'.repeat(69)}`)).toBe(false);
    expect(isStrongPassword(`Aa1!${'x'.repeat(68)}`)).toBe(true);
  });
});
