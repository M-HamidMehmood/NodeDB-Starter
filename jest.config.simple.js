module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/basic/**/*.test.ts', '**/unit/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/db/migrations/**', '!src/db/seed.ts', '!src/types/**'],
  coverageReporters: ['text', 'lcov', 'html'],
  coverageDirectory: 'coverage',
  testTimeout: 10000,
  verbose: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  setupFiles: ['<rootDir>/tests/env.setup.js'],
  // Skip database setup for simple tests
  modulePathIgnorePatterns: ['<rootDir>/tests/globalSetup.ts', '<rootDir>/tests/globalTeardown.ts'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/tests/unit/role.queries.test.ts',
    '<rootDir>/tests/unit/role.queries.perfect.test.ts',
    '<rootDir>/tests/unit/role.service.perfect.test.ts',
  ],
};
