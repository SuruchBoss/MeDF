import { Landing } from '@/shared/demo-surface';

/** The public landing page. Static: there is no session to read here. */
export default function DemoLandingPage() {
  return <Landing variant="demo" tryHref="/try" />;
}
