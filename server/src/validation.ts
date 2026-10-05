const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return email.length <= 254 && EMAIL_PATTERN.test(email);
}

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
