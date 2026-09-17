/** Isolated unit-test runner for date hardening. Does not replace Cypress e2e. */
module.exports = {
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/src/lib/__tests__/**/*.spec.ts'],
  modulePathIgnorePatterns: ['<rootDir>/.next/'],
  transform: {
    '^.+\\.tsx?$': [
      require.resolve('../backend/node_modules/ts-jest'),
      {
        diagnostics: false,
        tsconfig: {
          esModuleInterop: true,
          allowJs: true,
          strict: true,
          module: 'commonjs',
          target: 'ES2020',
          moduleResolution: 'node',
          skipLibCheck: true,
          isolatedModules: true,
        },
      },
    ],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testTimeout: 15000,
  verbose: true,
};
