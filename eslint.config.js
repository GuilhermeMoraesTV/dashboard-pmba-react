import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    'dist',
    '.vite',
    'Backup',
    'Backup ModoQAP',
    'vite-dev.out',
    'vite-dev.err',
    '.firebase',
    // Arquivo desativado integralmente por comentário legado e sem imports ativos.
    'src/components/gamification/XPNotification.jsx',
  ]),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      // Dívida legada: mantida visível como warning enquanto hooks e sintaxe
      // continuam bloqueando o lint. Seeders duplicados estão fora desta leva.
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        varsIgnorePattern: '^[A-Z_]',
      }],
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-constant-binary-expression': 'warn',
      'no-useless-escape': 'warn',
      'no-control-regex': 'error',
      'react-refresh/only-export-components': 'warn',
    },
  },
  {
    files: ['functions/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    // Exceções locais pertencentes aos pipelines binários/PDF legados. A regra
    // permanece ativa para todo o restante do projeto, inclusive Questões.
    files: [
      'functions/anki/archive.js',
      'functions/ai/generation.js',
      'functions/documents/pdf.js',
      'src/services/anki/ankiService.js',
      'src/services/documents/documentsService.js',
    ],
    rules: {
      'no-control-regex': 'off',
    },
  },
])
