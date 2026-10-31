import { createHash, randomBytes } from 'node:crypto';

export function generateToken() {
  return randomBytes(32).toString('hex');
}

// Only hashes are stored, so a leaked database cannot be used to hijack sessions or resets
export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
