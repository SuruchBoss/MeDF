import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

/**
 * `apps/demo` compiles this app's source through a `@/*` alias, so nothing in
 * the build stops it reaching any file here — and a rename on this side would
 * break the static Pages build without a word until the deploy ran.
 *
 * `src/shared/demo-surface.ts` is the contract. These tests are what makes it
 * one: the demo may name only what that file exports, and everything it
 * exports has to exist.
 */

const webSrc = path.join(import.meta.dirname, '..', 'src');
const demoSrc = path.join(import.meta.dirname, '..', '..', 'demo', 'src');
const surfaceFile = path.join(webSrc, 'shared', 'demo-surface.ts');

/** Non-relative `@/…` imports, and the stylesheet the demo is allowed. */
const ALLOWED_PREFIXES = ['@/shared/', '@/styles/'];

function sources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sources(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

describe('the demo/web boundary', () => {
  it('lets the demo import only from the declared surface', () => {
    const offenders: string[] = [];
    for (const file of sources(demoSrc)) {
      const text = fs.readFileSync(file, 'utf8');
      for (const [index, line] of text.split('\n').entries()) {
        const match = line.match(/from '(@\/[^']+)'/);
        if (!match) continue;
        if (ALLOWED_PREFIXES.some((prefix) => match[1].startsWith(prefix))) continue;
        offenders.push(`${path.relative(demoSrc, file)}:${index + 1}: ${match[1]}`);
      }
    }
    assert.deepEqual(
      offenders,
      [],
      `The demo may only import from @/shared — add it to demo-surface.ts first:\n${offenders.join('\n')}`,
    );
  });

  it('exports something the demo actually uses', () => {
    const surface = fs.readFileSync(surfaceFile, 'utf8');
    const exported = [...surface.matchAll(/export \{ (\w+) \}/g)].map((match) => match[1]);
    assert.ok(exported.length > 0, 'the surface file exports nothing');

    const demoText = sources(demoSrc)
      .map((file) => fs.readFileSync(file, 'utf8'))
      .join('\n');
    for (const name of exported) {
      assert.ok(
        new RegExp(`\\b${name}\\b`).test(demoText),
        `${name} is on the demo surface but the demo does not use it`,
      );
    }
  });

  it('points every surface export at a file that exists', () => {
    const surface = fs.readFileSync(surfaceFile, 'utf8');
    for (const match of surface.matchAll(/from '@\/([^']+)'/g)) {
      const base = path.join(webSrc, match[1]);
      const found = ['.ts', '.tsx', '/index.ts', '/index.tsx'].some((suffix) =>
        fs.existsSync(base + suffix),
      );
      assert.ok(found, `demo-surface.ts points at @/${match[1]}, which does not exist`);
    }
  });
});
