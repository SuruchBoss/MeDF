import { getCurrentUser } from '@/lib/auth';
import { Landing } from '@/components/marketing/landing';

export const dynamic = 'force-dynamic';

export default async function LandingPage() {
  const user = await getCurrentUser();
  return <Landing variant="product" signedIn={Boolean(user)} />;
}
