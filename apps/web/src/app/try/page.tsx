import type { Metadata } from 'next';
import { DemoEditor } from '@/components/demo/demo-editor';

export const metadata: Metadata = {
  title: 'Try it now',
  description:
    'Edit a PDF with MeDF right in your browser — no account, and nothing is uploaded.',
};

/** The no-signup editor, available on the product site as well as the demo. */
export default function TryPage() {
  return <DemoEditor />;
}
