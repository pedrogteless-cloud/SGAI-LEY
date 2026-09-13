import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

/**
 * O motivo principal desse arquivo existir: o build do Vite não reclama de
 * variável que não existe. Foi assim que um `M_NOTA_LIMPEZA` removido
 * continuou sendo referenciado numa tela e só ia estourar na mão de quem
 * usasse. `no-undef` pega isso antes.
 */
export default [
  { ignores: ['dist', 'supabase/migrations', 'node_modules'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.es2021 },
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      // Variável não usada é aviso, não erro — menos o que começa com
      // maiúscula (componente/constante importada e esquecida) e o `_`.
      'no-unused-vars': ['warn', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }],
      'react-refresh/only-export-components': 'off',
      // Dependência faltando em hook é aviso: tem caso no app onde a
      // omissão é proposital e está comentada no código.
      'react-hooks/exhaustive-deps': 'warn',
      // Aviso, não erro: o app usa em vários lugares o padrão "quando o
      // modal abre, preenche o formulário com o registro atual". Funciona
      // e é legível; a alternativa (derivar por `key`) daria uma reescrita
      // grande em 6 telas sem ganho pro usuário. Fica marcado como dívida
      // visível em vez de erro que obriga a desligar a regra.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  {
    files: ['**/*.test.js'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // O service worker roda no worker global scope, não no de janela:
    // `self`, `caches`, `clients` não existem no conjunto `browser`.
    files: ['public/sw.js'],
    languageOptions: { globals: { ...globals.serviceworker } },
  },
]
