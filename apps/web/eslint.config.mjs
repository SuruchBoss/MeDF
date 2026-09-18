import coreWebVitals from 'eslint-config-next/core-web-vitals';
import typescriptConfig from 'eslint-config-next/typescript';

const config = [
  ...coreWebVitals,
  ...typescriptConfig,
  {
    ignores: ['.next/**', 'node_modules/**', 'public/**', 'next-env.d.ts'],
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],

      /**
       * Keep `src/` loadable by Node's strip-only TypeScript support.
       *
       * The unit tests import these modules directly with `node --test` — no
       * bundler, no transpiler, no dependency. That only works while the source
       * sticks to syntax Node can erase. These three constructs emit runtime
       * code instead, so they would silently cut a module off from unit
       * testing. Plain fields, `as const` objects and ES modules cover every
       * case we have.
       */
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSParameterProperty',
          message:
            'Node cannot strip constructor parameter properties. Declare the field and assign it in the constructor body.',
        },
        {
          selector: 'TSEnumDeclaration',
          message: "Node cannot strip enums. Use an `as const` object plus a `typeof x[keyof typeof x]` type.",
        },
        {
          selector: 'TSModuleDeclaration[kind="namespace"]',
          message: 'Node cannot strip namespaces. Use an ES module.',
        },
      ],
    },
  },
];

export default config;
