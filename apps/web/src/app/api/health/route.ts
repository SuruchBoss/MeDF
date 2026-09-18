import { NextResponse } from 'next/server';
import { readDb } from '@/lib/db';
import { billingMode } from '@/lib/billing';

export const dynamic = 'force-dynamic';

/** Liveness probe. The desktop shell polls this before showing the window. */
export async function GET() {
  const db = await readDb();
  return NextResponse.json({
    ok: true,
    schemaVersion: db.schemaVersion,
    members: db.users.length,
    documents: db.documents.length,
    billing: billingMode(),
    time: new Date().toISOString(),
  });
}
