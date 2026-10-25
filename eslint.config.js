import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'dist-e2e', 'playwright-report', 'test-results']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // AGF-S1-16: keep the browser console free of application data
      'no-console': 'warn',
    },
  },
  {
    // AGF-S2-28: the E2E suite and its config run in Node, not the browser
    files: ['e2e/**/*.{ts,mjs}', 'playwright.config.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
])
