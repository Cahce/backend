/**
 * Bcrypt implementation of the admin PasswordHasher port.
 *
 * Confines the `bcrypt` framework dependency to the infra layer; application
 * use cases depend only on the PasswordHasher domain port.
 */

import bcrypt from "bcrypt";
import type { PasswordHasher } from "../domain/shared/PasswordHasher.js";

/** Cost factor — matches the rounds previously hardcoded across the use cases. */
const BCRYPT_ROUNDS = 10;

export class BcryptPasswordHasher implements PasswordHasher {
  async hash(plainPassword: string): Promise<string> {
    return bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
  }
}
