const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return email.length <= 254 && EMAIL_PATTERN.test(email);
}

export const NAME_MAX_LENGTH = 50;

// REQ-3.1.1 and REQ-3.2.2 both names are required. Expects them already trimmed.
export function validateNames(firstName: string, lastName: string): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!firstName || firstName.length > NAME_MAX_LENGTH) errors.firstName = 'Enter your first name.';
  if (!lastName || lastName.length > NAME_MAX_LENGTH) errors.lastName = 'Enter your last name.';
  return errors;
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
