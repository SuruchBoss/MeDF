import 'server-only';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AuthError } from './auth';
import { BillingError } from './billing';
import { DocumentError } from './documents';
import { QuotaError } from './quota';

/** Shared JSON response helpers and a single place to map errors to statuses. */

export function jsonOk<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data as object, init);
}

export function jsonError(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export function handleRouteError(error: unknown): NextResponse {
  if (error instanceof AuthError) return jsonError(error.message, error.status);
  if (error instanceof DocumentError) return jsonError(error.message, error.status);
  if (error instanceof BillingError) return jsonError(error.message, error.status);
  if (error instanceof QuotaError) {
    return jsonError(error.message, 402, { hint: error.hint, code: 'quota_exceeded' });
  }
  if (error instanceof z.ZodError) {
    const first = error.issues[0];
    return jsonError(first?.message ?? 'ข้อมูลไม่ถูกต้อง', 422, {
      issues: error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    });
  }
  console.error('[medf] unhandled route error', error);
  const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดที่ไม่คาดคิด';
  return jsonError(message, 500);
}

/** Parses and validates a JSON request body. */
export async function parseJson<T extends z.ZodTypeAny>(
  request: Request,
  schema: T,
): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new z.ZodError([
      { code: 'custom', message: 'เนื้อหาคำขอไม่ใช่ JSON ที่ถูกต้อง', path: [], input: undefined },
    ]);
  }
  return schema.parse(raw);
}
