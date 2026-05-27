import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SecretCipher } from "../SecretCipher.js";

describe("SecretCipher", () => {
    const testSecret = "test-jwt-secret-at-least-32-chars-long-for-security";

    it("should encrypt and decrypt successfully (round-trip)", () => {
        const cipher = new SecretCipher(testSecret);
        const plaintext = "my-secret-zotero-api-key-12345";
        
        const encrypted = cipher.encrypt(plaintext);
        const decrypted = cipher.decrypt(encrypted);
        
        assert.strictEqual(decrypted, plaintext);
    });

    it("should produce different ciphertexts for same plaintext (random IV)", () => {
        const cipher = new SecretCipher(testSecret);
        const plaintext = "same-plaintext";
        
        const encrypted1 = cipher.encrypt(plaintext);
        const encrypted2 = cipher.encrypt(plaintext);
        
        assert.notStrictEqual(encrypted1, encrypted2);
        assert.strictEqual(cipher.decrypt(encrypted1), plaintext);
        assert.strictEqual(cipher.decrypt(encrypted2), plaintext);
    });

    it("should throw error when ciphertext is tampered", () => {
        const cipher = new SecretCipher(testSecret);
        const plaintext = "secret-data";
        
        const encrypted = cipher.encrypt(plaintext);
        // Tamper with the ciphertext part
        const parts = encrypted.split(":");
        parts[3] = Buffer.from("tampered").toString("base64");
        const tampered = parts.join(":");
        
        assert.throws(() => {
            cipher.decrypt(tampered);
        }, /bad decrypt|Unsupported state or unable to authenticate data/);
    });

    it("should throw error when IV is tampered", () => {
        const cipher = new SecretCipher(testSecret);
        const plaintext = "secret-data";
        
        const encrypted = cipher.encrypt(plaintext);
        // Tamper with the IV
        const parts = encrypted.split(":");
        parts[1] = Buffer.from("tamperediv12").toString("base64");
        const tampered = parts.join(":");
        
        assert.throws(() => {
            cipher.decrypt(tampered);
        }, /bad decrypt|Unsupported state or unable to authenticate data/);
    });

    it("should throw error when using wrong secret for decryption", () => {
        const cipher1 = new SecretCipher(testSecret);
        const cipher2 = new SecretCipher("different-secret-key-at-least-32-chars");
        
        const plaintext = "secret-data";
        const encrypted = cipher1.encrypt(plaintext);
        
        assert.throws(() => {
            cipher2.decrypt(encrypted);
        }, /bad decrypt|Unsupported state or unable to authenticate data/);
    });

    it("should throw error when version prefix is missing or wrong", () => {
        const cipher = new SecretCipher(testSecret);
        
        // Missing version
        assert.throws(() => {
            cipher.decrypt("invalid:format:here");
        }, /Invalid cipher blob format/);
        
        // Wrong version
        const encrypted = cipher.encrypt("test");
        const wrongVersion = encrypted.replace("v1:", "v2:");
        
        assert.throws(() => {
            cipher.decrypt(wrongVersion);
        }, /Unsupported cipher version/);
    });
});
