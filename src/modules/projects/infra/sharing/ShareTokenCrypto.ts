import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { ShareTokenPort } from '../../domain/sharing/Ports.js';

export class ShareTokenCrypto implements ShareTokenPort {
  generate() { return this.create().token; }
  hash(token: string) { return createHash('sha256').update(token).digest('hex'); }
  create() {
    const token = randomBytes(32).toString('base64url');
    return { token, hash: createHash('sha256').update(token).digest('hex') };
  }
  matches(token: string, hash: string) {
    if (!/^[a-zA-Z0-9_-]{43}$/.test(token) || !/^[a-f0-9]{64}$/.test(hash)) return false;
    return timingSafeEqual(createHash('sha256').update(token).digest(), Buffer.from(hash, 'hex'));
  }
}
