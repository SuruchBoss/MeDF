/**
 * Lets `node --test` load the app's TypeScript modules directly.
 *
 * Node 22 strips the types itself; what it does not do is resolve the two
 * things a bundler resolves for us — the `@/` alias from tsconfig and
 * extensionless relative imports. Both are handled here, so unit tests need no
 * build step, no transpiler and no extra dependency.
 *
 * Only this app's own sources are touched. Anything reached from inside
 * `node_modules` is left to Node, or a dependency's CommonJS build would be
 * mislabelled as ESM.
 *
 * Usage: node --import ./scripts/register-ts-alias.mjs --test 'tests/*.test.ts'
 */
import fs from 'node:fs';
import path from 'node:path';
import { registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const srcRoot = path.join(import.meta.dirname, '..', 'src');

// `.tsx` is deliberately absent: Node cannot strip JSX, so a unit test that
// reaches a component should fail loudly at resolution rather than at parse.
const CANDIDATES = ['', '.ts', '.mts', '.js', '.mjs', '/index.ts'];

function resolveOnDisk(base) {
  for (const suffix of CANDIDATES) {
    const candidate = base + suffix;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    const isAlias = specifier.startsWith('@/');
    const isRelative = specifier.startsWith('./') || specifier.startsWith('../');
    if (!isAlias && !isRelative) return nextResolve(specifier, context);

    const parent = context.parentURL?.startsWith('file:')
      ? fileURLToPath(context.parentURL)
      : null;
    if (parent?.includes(`${path.sep}node_modules${path.sep}`)) {
      return nextResolve(specifier, context);
    }

    const base = isAlias
      ? path.join(srcRoot, specifier.slice(2))
      : path.resolve(path.dirname(parent ?? process.cwd()), specifier);

    const found = resolveOnDisk(base);
    // Imports Node can already resolve (a real extension, a package) fall through.
    if (!found) return nextResolve(specifier, context);
    return {
      url: pathToFileURL(found).href,
      shortCircuit: true,
      // `module-typescript` is what keeps Node's own type stripping in play.
      format: found.endsWith('.ts') || found.endsWith('.mts') ? 'module-typescript' : 'module',
    };
  },
});
