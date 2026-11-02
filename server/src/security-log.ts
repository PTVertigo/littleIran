// REQ-4.2 security events. Only ids and request paths are logged, never emails, passwords or tokens.
type Details = { userId?: string; method?: string; path?: string };

export function logSecurity(event: string, details: Details = {}, level: 'info' | 'warn' = 'warn') {
  console[level](`security: ${event}`, details);
}
