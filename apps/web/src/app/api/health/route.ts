import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Liveness probe, and the last route handler standing.
 *
 * It used to report the datastore's schema version and member count; there is
 * no datastore any more. All it does now is let the end-to-end scripts know
 * the dev server has finished booting. #8 turns this app into a static export,
 * at which point there is no server to probe and this goes too.
 */
export async function GET() {
  return NextResponse.json({ ok: true, time: new Date().toISOString() });
}
