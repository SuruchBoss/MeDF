import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  AppError,
  AuthError,
  BillingError,
  DocumentError,
  QuotaError,
} from '../src/lib/errors.ts';

/**
 * These look like tests of the obvious. They are not: `name` used to be
 * derived from the class identifier, which the production build renames, and
 * the one place that compared it stopped working there without a sound.
 */
describe('domain errors', () => {
  it('names itself after its own class, not its parent', () => {
    assert.equal(new AuthError('auth.error.signInRequired').name, 'AuthError');
    assert.equal(new DocumentError('doc.error.notFound').name, 'DocumentError');
    assert.equal(new BillingError('billing.error.noUser').name, 'BillingError');
    assert.equal(new QuotaError('quota.documents').name, 'QuotaError');
    assert.equal(new AppError('error.unexpectedTitle').name, 'AppError');
  });

  it('stays catchable as an AppError, which is what the route boundary uses', () => {
    for (const error of [
      new AuthError('auth.error.signInRequired'),
      new DocumentError('doc.error.notFound'),
      new BillingError('billing.error.noUser'),
      new QuotaError('quota.documents'),
    ]) {
      assert.ok(error instanceof AppError, `${error.name} must be an AppError`);
      assert.ok(error instanceof Error, `${error.name} must be an Error`);
    }
  });

  it('carries the key rather than a finished sentence', () => {
    const error = new AuthError('auth.error.tooManyAttempts', {
      status: 429,
      params: { minutes: 3 },
    });
    assert.equal(error.key, 'auth.error.tooManyAttempts');
    assert.deepEqual(error.params, { minutes: 3 });
    assert.equal(error.status, 429);
    // The message is the key too, so a server log names something searchable.
    assert.equal(error.message, 'auth.error.tooManyAttempts');
  });

  it('defaults a quota problem to 402 with a hint', () => {
    const error = new QuotaError('quota.documents');
    assert.equal(error.status, 402);
    assert.equal(error.hintKey, 'quota.hintUpgrade');
  });
});
