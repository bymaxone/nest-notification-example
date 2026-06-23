import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'
import globals from 'globals'

export default tseslint.config(
  {
    ignores: [
      '**/dist',
      '**/.next',
      '**/out',
      '**/coverage',
      '**/node_modules',
      '**/*.d.ts',
      // Stryker mutation-testing artefacts.
      '**/.stryker-tmp',
      '**/reports',
      // Next.js + Prisma CLI config files are loaded by their own runtimes, not
      // by the app's TypeScript compiler, so they are excluded from the
      // type-aware project service the same way this config file is.
      '**/next.config.*',
      '**/prisma.config.ts',
    ],
  },
  js.configs.recommended,
  {
    // Plain JavaScript files (config scripts, ESM/CJS helpers) need Node globals
    // declared explicitly. They are intentionally NOT type-checked: the
    // type-aware ruleset below is scoped to TypeScript files only, so the
    // TypeScript project service never has to resolve a non-TS file.
    files: ['**/*.{js,cjs,mjs}'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    // TypeScript sources get the full type-checked ruleset via the project
    // service, which resolves each file against the nearest app tsconfig.
    files: ['**/*.{ts,tsx,mts,cts}'],
    ignores: ['**/*.spec.ts', '**/*.spec.tsx', '**/*.e2e-spec.ts', '**/test/**', '**/e2e/**'],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // Relax unsafe-type and explicit-any rules in tests: Jest/Vitest globals and
    // mock objects are unresolvable at the ESLint level without full type
    // augmentation, producing false-positive errors.
    //
    // Scoped to apps/api so its tsconfig.spec.json drives type-aware linting of
    // the API test files only. The web app brings its own test setup and tsconfig;
    // a repo-wide glob would type-check future apps/web specs against the API
    // project and error, so the globs stay anchored under apps/api/.
    files: [
      'apps/api/**/*.spec.ts',
      'apps/api/**/*.spec.tsx',
      'apps/api/**/*.test.ts',
      'apps/api/**/*.test.tsx',
      'apps/api/**/*.e2e-spec.ts',
      'apps/api/**/test/**',
      'apps/api/**/e2e/**',
    ],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: {
        project: ['./apps/api/tsconfig.spec.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      // Test assertions on parsed JSON use `!` and String() on `unknown` values;
      // these are intentional and safe in the context of test fixtures.
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      '@typescript-eslint/no-base-to-string': 'off',
      // `expect(mock.method).toHaveBeenCalled()` references an unbound method by
      // design — the documented Jest false-positive for this rule.
      '@typescript-eslint/unbound-method': 'off',
      // Mocks frequently need an `async` signature to match the mocked contract
      // without awaiting anything inside the stub body.
      '@typescript-eslint/require-await': 'off',
      // Stub return values are intentionally loosely typed in fixtures.
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },
  prettier,
)
