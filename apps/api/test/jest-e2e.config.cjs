'use strict'

/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '../',
  testRegex: '\\.e2e-spec\\.ts$',
  testPathIgnorePatterns: ['/node_modules/', '/\\.stryker-tmp/'],
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: '<rootDir>/test/tsconfig.json',
        ignoreCoverageForAllDecorators: true,
      },
    ],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testEnvironment: 'node',
  // NestJS module bootstrap is slower than a unit test; allow generous head-room.
  testTimeout: 30000,
  // Bounded worker pool, matching the unit Jest config — keeps memory predictable
  // when sibling-library-consuming suites reload the module graph per worker.
  maxWorkers: '50%',
}
