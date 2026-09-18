import { withBasePath } from '@/lib/base-path';
import { SARABUN_FILES } from '@/lib/pdf/fonts';

/**
 * Declares the Sarabun web fonts.
 *
 * These live here rather than in the stylesheet because the URLs need the
 * deployment's base path, which CSS cannot read. It is the same file list the
 * PDF exporter embeds, so the on-screen and exported metrics cannot drift.
 */

const FACES: { file: string; weight: number; style: 'normal' | 'italic' }[] = [
  { file: SARABUN_FILES.regular, weight: 400, style: 'normal' },
  { file: SARABUN_FILES.italic, weight: 400, style: 'italic' },
  { file: SARABUN_FILES.bold, weight: 700, style: 'normal' },
  { file: SARABUN_FILES.boldItalic, weight: 700, style: 'italic' },
];

export function FontFaces() {
  const css = FACES.map(
    ({ file, weight, style }) => `@font-face{font-family:'Sarabun';src:url('${withBasePath(
      `/fonts/${file}`,
    )}') format('truetype');font-weight:${weight};font-style:${style};font-display:swap}`,
  ).join('');

  return <style>{css}</style>;
}
