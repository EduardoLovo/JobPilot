import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import vue from 'eslint-plugin-vue'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**', 'docs/**', '**/generated/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...vue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: { parser: tseslint.parser },
    },
  },
  {
    files: ['apps/web/**'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['apps/api/**', 'apps/mcp/**', '*.js'],
    languageOptions: { globals: globals.node },
  },
  {
    // Parâmetros com _ são obrigatórios na assinatura mas não usados (ex.: next do error handler)
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  // Desliga regras de formatação que conflitam com o Prettier
  prettier,
)
