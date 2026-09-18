import { Landing } from '@/components/marketing/landing';

/** The public landing page. Static: there is no session to read here. */
export default function DemoLandingPage() {
  return <Landing variant="demo" tryHref="/try" />;
}
