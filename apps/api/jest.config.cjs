'use strict'

/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: '<rootDir>/../tsconfig.spec.json',
      },
    ],
  },
  // Strip .js extension from relative imports so ts-jest resolves .ts source files.
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  // Coverage scope: every executable source file, minus non-executable glue
  // (bootstrap entrypoints, declaration files, and module/dto files whose
  // validation is proven behaviorally by integration suites).
  collectCoverageFrom: [
    '**/*.ts',
    '!**/*.spec.ts',
    '!**/*.module.ts',
    '!main.ts',
    '!**/*.dto.ts',
    '!**/*.d.ts',
  ],
  coverageThreshold: {
    global: { branches: 100, functions: 100, lines: 100, statements: 100 },
  },
  coverageReporters: ['text', 'text-summary', 'json-summary'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  maxWorkers: '50%',
}
