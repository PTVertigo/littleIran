module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  maxWorkers: 1, // suites share one test database and truncate it
  testTimeout: 30_000, // bcrypt at 12 rounds is slow, and a busy machine can make several logins in one test take seconds
  setupFiles: ['<rootDir>/tests/setup-env.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/silence-security-log.ts'],
};
