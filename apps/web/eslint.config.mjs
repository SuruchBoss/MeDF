import coreWebVitals from 'eslint-config-next/core-web-vitals';
import typescriptConfig from 'eslint-config-next/typescript';

/** Files that carry `import 'server-only'`; see the rule at the bottom. */
const SERVER_ONLY_MODULES = [
  '@/lib/api',
  '@/lib/auth',
  '@/lib/billing',
  '@/lib/db',
  '@/lib/documents',
  '@/lib/pdf/fonts-node',
  '@/lib/pro',
  '@/lib/quota',
  '@/lib/storage',
];

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
       * The native modals cannot be styled or translated, block the main
       * thread while they are open, and are invisible to the browser tests.
       * `useDialog()` from `@/components/ui/dialog` replaces all three.
       */
      'no-restricted-globals': [
        'error',
        ...['alert', 'confirm', 'prompt'].map((name) => ({
          name,
          message: `ใช้ useDialog() จาก @/components/ui/dialog แทน ${name}()`,
        })),
      ],
      'no-restricted-properties': [
        'error',
        ...['alert', 'confirm', 'prompt'].map((property) => ({
          object: 'window',
          property,
          message: `ใช้ useDialog() จาก @/components/ui/dialog แทน window.${property}()`,
        })),
      ],

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

  /**
   * Layering. Dependencies point one way — `app/` may use `components/`, which
   * may use `lib/`, and never the reverse. Without this, a route's concerns
   * leak into a component and the component stops being reusable (the demo
   * build reuses the whole editor with no server behind it), or `lib/` picks up
   * a React import and stops being unit-testable.
   */
  {
    files: ['src/lib/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/components/*', '@/app/*', '**/components/*', '**/app/*'],
              message:
                'src/lib ต้องไม่ขึ้นกับ UI — ย้ายตรรกะที่ใช้ร่วมกันมาไว้ใน lib แล้วให้ component เรียกใช้',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/app/*', '**/app/*'],
              message:
                'component ต้องไม่ขึ้นกับ route — ส่งสิ่งที่ต้องใช้เข้ามาทาง props แทน',
            },
          ],
        },
      ],

      /**
       * Server-only modules, as types only.
       *
       * A component may name `DocumentRecord` or `PublicUser` — a type import
       * is erased at build time and reaches no runtime. A *value* import from
       * the same file pulls `server-only` into the client bundle and fails the
       * build, and until now nothing said which of the two you had written.
       * `allowTypeImports` draws exactly that line.
       *
       * Keep this list in step with the files carrying `import 'server-only'`.
       */
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: SERVER_ONLY_MODULES.map((name) => ({
            name,
            allowTypeImports: true,
            message: `${name} เป็นโมดูลฝั่งเซิร์ฟเวอร์ — นำเข้าได้เฉพาะ \`import type\` เท่านั้น`,
          })),
        },
      ],
    },
  },
];

export default config;
