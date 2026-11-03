/** @type {import('jest').Config} */
export default {
  // jsdom plus the fetch globals (Request, Response, TextEncoder) that react-router needs
  testEnvironment: 'jest-fixed-jsdom',
  roots: ['<rootDir>/src'],
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  transform: {
    '^.+\\.[tj]sx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
  },
  // react-router ships ESM only; the test script's --experimental-vm-modules lets Jest load it as is
  // Form tests type a lot of text one key at a time, which is slow when many suites run at once
  testTimeout: 15_000,
  moduleNameMapper: { '\\.css$': 'identity-obj-proxy' },
};
