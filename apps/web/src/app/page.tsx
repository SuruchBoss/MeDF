import { Landing } from '@/components/marketing/landing';

/**
 * Nobody signs in any more, so there is no per-visitor state on this page and
 * nothing to render on demand. `signedIn` stays in `Landing`'s props for now
 * because the demo build still passes it; #8 folds the two together.
 */
export default function LandingPage() {
  return <Landing variant="product" signedIn={false} />;
}
