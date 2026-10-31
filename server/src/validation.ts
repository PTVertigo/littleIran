const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return email.length <= 254 && EMAIL_PATTERN.test(email);
}

export const PASSWORD_RULES_MESSAGE =
  'Password must be 8-72 characters with an uppercase letter, a lowercase letter, a number and one of ! @ # $ % ^ & *.';

// bcrypt silently ignores everything past 72 bytes
export function isStrongPassword(password: string): boolean {
  return (
    password.length >= 8 &&
    Buffer.byteLength(password) <= 72 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[!@#$%^&*]/.test(password)
  );
}
