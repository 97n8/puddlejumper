// @eslint/js pinned to ^9.39.3 — v10 requires eslint ^10.0.0 (peer dep mismatch with eslint ^9)
// and adds no-useless-assignment + no-unassigned-vars to recommended, breaking existing code.
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist'] },
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
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: [
      'src/components/WorkspaceIcon.tsx',
      'src/components/ui/**/*.{ts,tsx}',
      'src/lib/colorContext.tsx',
      'src/services/auth/AuthContext.tsx',
    ],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    files: [
      'src/components/SaveToCloudDialog.tsx',
      'src/components/VaultPanel.tsx',
      'src/features/flows/components/FlowsPanel.tsx',
      'src/features/logicdocs/components/LogicDocsPanel.tsx',
      'src/features/m365/components/M365Manager.tsx',
      'src/features/vault/components/VaultEnvironmentWorkspace.tsx',
    ],
    rules: {
      'react-hooks/exhaustive-deps': 'off',
    },
  },
)
