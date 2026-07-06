import bcrypt from "bcryptjs";
import type { IPasswordHasher } from "../domain/Ports.js";

export class PasswordHasherBcrypt implements IPasswordHasher {
    async verify(plainPassword: string, hash: string): Promise<boolean> {
        return bcrypt.compare(plainPassword, hash);
    }

    async hash(plainPassword: string): Promise<string> {
        const saltRounds = 10;
        return bcrypt.hash(plainPassword, saltRounds);
    }
}
