import { isStrongPassword, isValidEmail } from '../src/validation';

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
