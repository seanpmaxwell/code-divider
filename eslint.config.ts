import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

import { onInitEslintPlugin } from './src/cli-helpers/onInit';

export default [
  {
    // Playground files are formatting fixtures for code-divider itself
    ignores: ['lib/', 'node_modules/'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // Turns off stylistic rules that would conflict with Prettier
  prettier,
  {
    plugins: { onInit: onInitEslintPlugin },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        projectService: {
          allowDefaultProject: ['bin/*.js'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-unused-vars': 'off',
      'no-console': 'warn',
      '@typescript-eslint/no-extraneous-class': 'error',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      'onInit/no-nested-oninit': 'error',
    },
  },
];
