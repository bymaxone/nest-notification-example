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
        // Unit specs construct classes directly (no Nest DI container), so the
        // `design:*` reflection metadata is unnecessary. Compiling without
        // `emitDecoratorMetadata` (see tsconfig.spec.json) avoids emitting the
        // `__metadata("design:paramtypes", …)` guards whose `: Object` fallback
        // arms are unreachable phantom branches; combined with
        // `ignoreCoverageForAllDecorators` this keeps the 100% gate meaningful.
        tsconfig: '<rootDir>/../tsconfig.spec.json',
        ignoreCoverageForAllDecorators: true,
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
