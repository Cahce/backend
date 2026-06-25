/**
 * Password hashing port (admin module).
 *
 * Application use cases (account creation, password reset, profile-with-account
 * creation, and XLSX import) depend on this interface instead of importing
 * `bcrypt` directly — keeping `application` free of framework dependencies per
 * Clean Architecture. The infra adapter (BcryptPasswordHasher) implements it.
 */
export interface PasswordHasher {
  /** Hash a plaintext password. */
  hash(plainPassword: string): Promise<string>;
}
