export interface PasswordHasher {
  hash(plainPassword: string): Promise<string>;
}
