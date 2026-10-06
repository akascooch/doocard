import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

/**
 * Per-user unreachable bootstrap hash for imported customers.
 * The plaintext exists only inside this function and is discarded after hashing.
 * User has no activation or password-reset flag, so this credential is not
 * delivered, logged, or recoverable. Password login with a shared import
 * fallback must fail. A future activation flow is required before these
 * accounts can choose a known password.
 */
export async function hashUnreachableCustomerBootstrap(): Promise<string> {
  const secret = crypto.randomBytes(32).toString('hex');
  return bcrypt.hash(secret, 10);
}
