import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

export class SecretCipher {
    private key: Buffer;

    constructor(jwtSecret: string) {
        this.key = Buffer.from(
            hkdfSync("sha256", jwtSecret, Buffer.alloc(0), "zotero-token-v1", 32)
        );
    }

    encrypt(plain: string): string {
        const iv = randomBytes(12);
        const cipher = createCipheriv("aes-256-gcm", this.key, iv);
        
        const encrypted = Buffer.concat([
            cipher.update(plain, "utf8"),
            cipher.final(),
        ]);
        
        const tag = cipher.getAuthTag();
        
        return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
    }

    decrypt(blob: string): string {
        const parts = blob.split(":");
        if (parts.length !== 4) {
            throw new Error("Invalid cipher blob format");
        }
        
        const [version, ivB64, tagB64, encB64] = parts;
        
        if (version !== "v1") {
            throw new Error(`Unsupported cipher version: ${version}`);
        }
        
        const iv = Buffer.from(ivB64, "base64");
        const tag = Buffer.from(tagB64, "base64");
        const encrypted = Buffer.from(encB64, "base64");
        
        const decipher = createDecipheriv("aes-256-gcm", this.key, iv);
        decipher.setAuthTag(tag);
        
        const decrypted = Buffer.concat([
            decipher.update(encrypted),
            decipher.final(),
        ]);
        
        return decrypted.toString("utf8");
    }
}
