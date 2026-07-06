
import bcrypt from "bcrypt";
import type { PasswordHasher } from "../domain/shared/PasswordHasher.js";

const BCRYPT_ROUNDS = 10;

export class BcryptPasswordHasher implements PasswordHasher {
  async hash(plainPassword: string): Promise<string> {
    return bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
  }
}
