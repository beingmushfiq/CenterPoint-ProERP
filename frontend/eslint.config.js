import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import jsxA11y from 'eslint-plugin-jsx-a11y';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'public', '*.config.*'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        {
          allowConstantExport: true,
          // `Object.assign(Component, { ...statics })` evaluates to the very
          // component it was handed, so the compound export in Tabs.tsx really
          // is a component export. The rule cannot see through the call on its
          // own, and without this it reports all four sub-components as
          // unreachable by fast refresh (§10.3 compound pattern).
          extraHOCs: ['assign'],
          // Four deliberate co-locations, each a single export sitting beside
          // the component that is its only reason to exist:
          //   notify          the imperative half of the toast surface
          //   useDelayedFlag  the 120ms gate Feedback's own skeletons consume
          //   STATUS_REGISTRY \ the one registry §10.4 mandates, kept with the
          //   resolveStatus   / badge that renders it
          // Name-scoped rather than a file- or rule-level exemption, so any
          // *new* non-component export still reports.
          allowExportNames: [
            'notify',
            'useDelayedFlag',
            'STATUS_REGISTRY',
            'resolveStatus',
            'router',
            'WORKSPACE_THEMES',
          ],
        },
      ],
      'jsx-a11y/no-static-element-interactions': 'error',
      'jsx-a11y/click-events-have-key-events': 'error',
      'jsx-a11y/no-noninteractive-element-interactions': 'error',
    },
  },
  {
    files: ['src/routes/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  }
);
