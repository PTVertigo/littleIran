// Mirrors server/src/validation.ts, which stays the source of truth. The server re-checks everything.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BCRYPT_MAX_BYTES = 72;

export const NAME_MAX_LENGTH = 50;

export function isValidEmail(email: string) {
  return email.length <= 254 && EMAIL_PATTERN.test(email);
}

export const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'An uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'A lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { label: 'A number', test: (p: string) => /[0-9]/.test(p) },
  { label: 'A special character: ! @ # $ % ^ & *', test: (p: string) => /[!@#$%^&*]/.test(p) },
];

export function isStrongPassword(password: string) {
  return (
    PASSWORD_RULES.every((rule) => rule.test(password)) &&
    new TextEncoder().encode(password).length <= BCRYPT_MAX_BYTES
  );
}
