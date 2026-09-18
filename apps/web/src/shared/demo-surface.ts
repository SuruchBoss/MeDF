/**
 * What the public demo is allowed to use.
 *
 * `apps/demo` compiles this app's source through a `@/*` tsconfig alias, which
 * means it *could* reach any file here — and a rename on this side would break
 * the static build silently, discovered only when the Pages deploy ran.
 *
 * This file is the contract instead. The demo imports from here and nowhere
 * else (a unit test checks that), so anything listed below is a public surface:
 * changing its props or its name is a change to two apps, not one.
 *
 * The alias itself has to stay wide, because these modules import their own
 * dependencies through it. What is narrowed is what the demo may *name*.
 */

export { DemoEditor } from '@/components/demo/demo-editor';
export { FontFaces } from '@/components/font-faces';
export { Landing } from '@/components/marketing/landing';
export { LocaleProvider } from '@/lib/i18n/provider';
