import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

/**
 * SecretCipher provides AES-256-GCM encryption/decryption for sensitive data.
 * Key is derived from JWT_SECRET using HKDF for domain separation.
 */
export class SecretCipher {
    private key: Buffer; // 32 bytes for AES-256

    constructor(jwtSecret: string) {
        // Derive a 32-byte key from JWT_SECRET using HKDF
        // This provides domain separation from JWT signing
        this.key = Buffer.from(
            hkdfSync("sha256", jwtSecret, Buffer.alloc(0), "zotero-token-v1", 32)
        );
    }

    /**
     * Encrypt plaintext using AES-256-GCM.
     * Returns format: v1:iv:tag:ciphertext (all base64)
     */
    encrypt(plain: string): string {
        const iv = randomBytes(12); // 96-bit IV for GCM
        const cipher = createCipheriv("aes-256-gcm", this.key, iv);
        
        const encrypted = Buffer.concat([
            cipher.update(plain, "utf8"),
            cipher.final(),
        ]);
        
        const tag = cipher.getAuthTag();
        
        // Format: version:iv:tag:ciphertext
        return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
    }

    /**
     * Decrypt ciphertext encrypted with encrypt().
     * Throws if authentication tag verification fails or format is invalid.
     */
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
