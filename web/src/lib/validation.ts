// REQ-4.1.7 the same rules as server/src/validation.ts, checked before anything is sent.
// The server still checks everything again.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// REQ-3.1.2
export function isValidEmail(email: string): boolean {
  return email.length <= 254 && EMAIL_PATTERN.test(email);
}
