module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  maxWorkers: 1, // suites share one test database and truncate it
  setupFiles: ['<rootDir>/tests/setup-env.ts'],
};
