import 'server-only';
import type { MessageKey, MessageParams } from './i18n';

/**
 * Domain errors.
 *
 * The message is a *key*, not a sentence: an error thrown deep in `lib/` has
 * no idea which language the member reads, and by the time the route handler
 * knows, the string would already be fixed. Carrying the key and its
 * parameters lets the boundary render it in whichever language the request
 * asked for.
 *
 * `super(key)` on purpose, so a stack trace and a server log still name
 * something searchable rather than an empty message.
 */
export class AppError extends Error {
  readonly key: MessageKey;
  readonly params?: MessageParams;
  readonly status: number;

  constructor(
    key: MessageKey,
    options: { status?: number; params?: MessageParams } = {},
  ) {
    super(key);
    this.name = new.target.name;
    this.key = key;
    this.params = options.params;
    this.status = options.status ?? 400;
  }
}

/** Sign-in, sign-up and session problems. */
export class AuthError extends AppError {}

/** Anything about a document, its file, or its overlay. */
export class DocumentError extends AppError {}

/** Subscriptions and payments. */
export class BillingError extends AppError {}

/**
 * A plan limit was reached. Always 402, and always carries a hint, because the
 * answer is the same every time: the member needs to know what to do next.
 */
export class QuotaError extends AppError {
  readonly hintKey: MessageKey;

  constructor(
    key: MessageKey,
    options: { params?: MessageParams; hintKey?: MessageKey } = {},
  ) {
    super(key, { status: 402, params: options.params });
    this.hintKey = options.hintKey ?? 'quota.hintUpgrade';
  }
}
