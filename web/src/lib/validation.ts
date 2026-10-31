// REQ-4.1.7 the same rules as server/src/validation.ts, checked before anything is sent.
// The server still checks everything again.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// REQ-3.1.2
export function isValidEmail(email: string): boolean {
  return email.length <= 254 && EMAIL_PATTERN.test(email);
}

// REQ-3.1.3
export const PASSWORD_RULES_MESSAGE =
  'Password must be 8-72 characters with an uppercase letter, a lowercase letter, a number and one of ! @ # $ % ^ & *.';

// bcrypt silently ignores everything past 72 bytes
export function isStrongPassword(password: string): boolean {
  return (
    password.length >= 8 &&
    new TextEncoder().encode(password).length <= 72 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[!@#$%^&*]/.test(password)
  );
}
