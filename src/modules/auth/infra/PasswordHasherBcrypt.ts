import bcrypt from "bcrypt";
import type { IPasswordHasher } from "../domain/Ports.js";

// bcryptjs encoded lone UTF-16 surrogates as three bytes. Preserve those rare
// existing passwords; Node's default UTF-8 conversion replaces them with U+FFFD.
function passwordBytes(password: string): string | Buffer {
    if (password.isWellFormed()) return password;
    const bytes: number[] = [];
    for (const character of password) {
        const point = character.codePointAt(0)!;
        if (point < 0x80) bytes.push(point);
        else if (point < 0x800) bytes.push(0xc0 | (point >> 6), 0x80 | (point & 63));
        else if (point < 0x10000) bytes.push(0xe0 | (point >> 12), 0x80 | ((point >> 6) & 63), 0x80 | (point & 63));
        else bytes.push(0xf0 | (point >> 18), 0x80 | ((point >> 12) & 63), 0x80 | ((point >> 6) & 63), 0x80 | (point & 63));
    }
    return Buffer.from(bytes);
}

export class PasswordHasherBcrypt implements IPasswordHasher {
    async verify(plainPassword: string, hash: string): Promise<boolean> {
        // bcryptjs used corrected length handling for both legacy prefixes.
        const compatibleHash = hash.replace(/^\$2[ay]\$/, '$2b$');
        return bcrypt.compare(passwordBytes(plainPassword), compatibleHash);
    }

    async hash(plainPassword: string): Promise<string> {
        const saltRounds = 10;
        return bcrypt.hash(passwordBytes(plainPassword), saltRounds);
    }
}
