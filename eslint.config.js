import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import reactCompiler from 'eslint-plugin-react-compiler';
import reactNoManualMemo from 'eslint-plugin-react-no-manual-memo';
import tseslint from 'typescript-eslint';
import eslintPluginPrettier from 'eslint-plugin-prettier/recommended';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
    globalIgnores(['dist']),
    {
        files: ['**/*.{ts,tsx}'],
        extends: [
            js.configs.recommended,
            tseslint.configs.recommendedTypeChecked,
            reactHooks.configs.flat.recommended,
            reactRefresh.configs.vite,
            eslintPluginPrettier,
        ],
        languageOptions: {
            ecmaVersion: 2020,
            globals: globals.browser,
            parserOptions: {
                project: ['./tsconfig.app.json', './tsconfig.node.json'],
                tsconfigRootDir: import.meta.dirname,
            },
        },
        plugins: {
            'react-compiler': reactCompiler,
            'react-no-manual-memo': reactNoManualMemo,
        },
        rules: {
            'react-compiler/react-compiler': 'error',
            'react-hooks/exhaustive-deps': 'off',
            '@typescript-eslint/no-explicit-any': 'error',
            'spaced-comment': ['error', 'always', { markers: ['*'] }],
            // React Compiler handles memoization automatically - flag manual usage
            'react-no-manual-memo/no-component-memo': 'warn',
            'react-no-manual-memo/no-hook-memo': 'warn',
        },
    },
]);
