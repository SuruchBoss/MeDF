import 'server-only';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { AuthError } from './errors';
import {
  type UserRecord,
  mutate,
  newId,
  nowIso,
  readDb,
} from './db';
import {
  SESSION_COOKIE,
  SESSION_SECRET,
  SESSION_TTL_SECONDS,
  adminEmail,
  isProduction,
} from './env';
import type { PlanId, PlanStatus } from './plans';
import { loginRateLimiter } from './rate-limit';

const BCRYPT_ROUNDS = 11;
const secretKey = new TextEncoder().encode(SESSION_SECRET);

/**
 * Validation messages are message keys, not sentences: the schema runs on the
 * server with no idea which language the caller reads, and `handleRouteError`
 * renders them per request.
 */
export const credentialsSchema = z.object({
  email: z.string().trim().min(3).max(200).email('auth.validation.email'),
  password: z.string().min(8, 'auth.validation.password').max(200),
});

export const registerSchema = credentialsSchema.extend({
  name: z.string().trim().min(1, 'auth.validation.name').max(80),
});

/** The user shape that is safe to hand to the browser. */
export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: 'member' | 'admin';
  plan: PlanId;
  planStatus: PlanStatus;
  planInterval: 'monthly' | 'yearly' | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
}

export function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    plan: user.plan,
    planStatus: user.planStatus,
    planInterval: user.planInterval,
    currentPeriodEnd: user.currentPeriodEnd,
    cancelAtPeriodEnd: user.cancelAtPeriodEnd,
    createdAt: user.createdAt,
  };
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createUser(input: z.infer<typeof registerSchema>): Promise<UserRecord> {
  const emailKey = input.email.toLowerCase();
  const passwordHash = await hashPassword(input.password);

  return mutate((db) => {
    if (db.users.some((user) => user.emailKey === emailKey)) {
      throw new AuthError('auth.error.emailTaken', { status: 409 });
    }
    const isFirstUser = db.users.length === 0;
    const user: UserRecord = {
      id: newId('usr'),
      email: input.email,
      emailKey,
      name: input.name,
      passwordHash,
      // The very first member (or a configured address) administers the install.
      role: isFirstUser || emailKey === adminEmail ? 'admin' : 'member',
      createdAt: nowIso(),
      lastLoginAt: nowIso(),
      sessionVersion: 1,
      plan: 'free',
      planStatus: 'active',
      planInterval: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
    };
    db.users.push(user);
    return user;
  });
}

export async function authenticate(email: string, password: string): Promise<UserRecord> {
  const emailKey = email.toLowerCase();
  const db = await readDb();
  const user = db.users.find((candidate) => candidate.emailKey === emailKey);

  // Always run a bcrypt comparison so a missing account and a wrong password
  // take the same amount of time.
  const hash = user?.passwordHash ?? '$2a$11$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
  const ok = await verifyPassword(password, hash);
  if (!user || !ok) {
    throw new AuthError('auth.error.wrongCredentials', { status: 401 });
  }

  await mutate((current) => {
    const target = current.users.find((candidate) => candidate.id === user.id);
    if (target) target.lastLoginAt = nowIso();
  });

  return user;
}

export async function updatePassword(userId: string, currentPassword: string, nextPassword: string) {
  const db = await readDb();
  const user = db.users.find((candidate) => candidate.id === userId);
  if (!user) throw new AuthError('auth.error.noAccount', { status: 404 });
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new AuthError('auth.error.wrongCurrentPassword');
  }
  const passwordHash = await hashPassword(nextPassword);
  await mutate((current) => {
    const target = current.users.find((candidate) => candidate.id === userId);
    if (!target) return;
    target.passwordHash = passwordHash;
    // Invalidate sessions minted with the old password.
    target.sessionVersion += 1;
  });
}

async function signSession(user: UserRecord): Promise<string> {
  return new SignJWT({ v: user.sessionVersion })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setIssuer('medf')
    .setAudience('medf-web')
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey);
}

export async function startSession(user: UserRecord): Promise<void> {
  const token = await signSession(user);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    path: '/',
    maxAge: 0,
  });
}

/** Resolves the signed-in member, or `null` for anonymous visitors. */
export async function getCurrentUser(): Promise<UserRecord | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secretKey, {
      issuer: 'medf',
      audience: 'medf-web',
    });
    const db = await readDb();
    const user = db.users.find((candidate) => candidate.id === payload.sub);
    if (!user) return null;
    if (typeof payload.v === 'number' && payload.v !== user.sessionVersion) return null;
    return user;
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<UserRecord> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError('auth.error.signInRequired', { status: 401 });
  return user;
}

// --- Brute-force protection -------------------------------------------------
// The counting lives in `@/lib/rate-limit`, which knows nothing about members
// or sign-in; these three turn its verdict into the app's own error.

export async function checkLoginRate(key: string): Promise<void> {
  const verdict = await loginRateLimiter().check(key);
  if (!verdict.blocked) return;
  throw new AuthError('auth.error.tooManyAttempts', {
    status: 429,
    params: { minutes: verdict.retryInMinutes },
  });
}

export async function recordLoginFailure(key: string): Promise<void> {
  await loginRateLimiter().recordFailure(key);
}

export async function clearLoginFailures(key: string): Promise<void> {
  await loginRateLimiter().clear(key);
}
