import type { Metadata } from 'next';
import { EditorPage } from '@/components/editor/editor-page';
import { th } from '@/lib/i18n/th';

/**
 * Build-time metadata reads the Thai dictionary directly.
 *
 * A static export has one prerendered copy for everybody, so `t()` — which
 * needs a reader — cannot help here; the page has to pick a language before
 * anyone arrives, and MeDF is a Thai-market tool. Reading `th` rather than
 * typing the sentence keeps it in the one place translations live, so the
 * "no Thai outside the dictionary" test still holds.
 */
export const metadata: Metadata = {
  title: th['meta.tryTitle'],
  description: th['meta.tryDescription'],
};

/** The editor. There is no other one — `/try` is where the work happens. */
export default function TryPage() {
  return <EditorPage />;
}
