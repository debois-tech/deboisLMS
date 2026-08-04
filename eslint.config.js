import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

/**
 * `npm run lint` used to be a script pointing at an eslint that was not
 * installed, against a config that did not exist. This is the missing config.
 *
 * Deliberately close to the Vite React-TS default. The type-checked rule set is
 * not enabled: it needs a TS program per run and would flood a codebase this
 * size on first contact. Correctness rules that do not need type information are
 * on, plus the react-hooks rules, which catch real bugs.
 */
export default tseslint.config(
  { ignores: ['dist', 'supabase/functions/**'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,

      // Off, deliberately. Every hit is a Provider sitting next to its own hook
      // (AuthContext, ToastContext, ConfirmContext, ThemeContext) or a component
      // next to the constant that drives it (PortalNav + portalNavItems,
      // PortalStatus + statusLabel). That co-location is the point — splitting
      // six files so Fast Refresh can reload at a finer granularity in dev buys
      // nothing at runtime and scatters things that belong together.
      'react-refresh/only-export-components': 'off',

      // The Supabase client hands back `any` from joined selects, and the query
      // layer casts at the boundary on purpose. Warn so it stays visible without
      // failing the run.
      '@typescript-eslint/no-explicit-any': 'warn',

      // Unused args prefixed with _ are intentional signature placeholders.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // react-hooks v7 flags any setState in an effect body. Every hit in this
      // codebase is the same legitimate shape — reset loading/error state, then
      // fetch — and rewriting ~11 data-loading effects to satisfy it is a
      // refactor, not a lint fix. Kept as a warning so genuinely cascading
      // renders still surface rather than being switched off entirely.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
);
