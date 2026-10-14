import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import bcryptjs from 'bcryptjs';
import bcrypt from 'bcrypt';
import { PasswordHasherBcrypt } from '../PasswordHasherBcrypt.js';

const hasher = new PasswordHasherBcrypt();
const freshPassword = () => randomBytes(24).toString('base64url');

describe('PasswordHasherBcrypt compatibility', () => {
  it('verifies existing bcryptjs hashes without accepting a different password', async () => {
    const password = freshPassword();
    const stored = await bcryptjs.hash(password, 4);
    assert.equal(await hasher.verify(password, stored), true);
    assert.equal(await hasher.verify(freshPassword(), stored), false);
  });

  for (const prefix of ['$2a$', '$2y$']) {
    it(`preserves bcryptjs ${prefix} verification including passwords beyond 255 UTF-8 bytes`, async () => {
      // Exactly 256 bytes exposes native $2a$'s uint8 length wraparound.
      const password = freshPassword() + 'à'.repeat(112);
      assert.equal(Buffer.byteLength(password), 256);
      const stored = (await bcryptjs.hash(password, 4)).replace('$2b$', prefix);
      assert.equal(await bcryptjs.compare(password, stored), true);
      assert.equal(await hasher.verify(password, stored), true);
      assert.equal(await hasher.verify('different-' + password, stored), false);
    });
  }

  it('generates independently salted cost-10 hashes readable by both implementations', async () => {
    const password = freshPassword();
    const [first, second] = await Promise.all([hasher.hash(password), hasher.hash(password)]);
    assert.notEqual(first, second);
    for (const stored of [first, second]) {
      assert.equal(bcrypt.getRounds(stored), 10);
      assert.match(stored, /^\$2b\$10\$/);
      assert.equal(await bcryptjs.compare(password, stored), true);
      assert.equal(await bcrypt.compare(password, stored), true);
    }
  });

  it('keeps byte-based truncation when the 72-byte boundary splits a Unicode character', async () => {
    const password = 'x'.repeat(71) + '📚' + freshPassword();
    const stored = await bcryptjs.hash(password, 4);
    assert.equal(await hasher.verify(password, stored), true);
    assert.equal(await hasher.verify('y' + password.slice(1), stored), false);
  });

  it('keeps embedded NUL characters in the password', async () => {
    const prefix = freshPassword(), password = prefix + '\0' + freshPassword();
    const stored = await bcryptjs.hash(password, 4);
    assert.equal(await hasher.verify(password, stored), true);
    assert.equal(await hasher.verify(prefix, stored), false);
  });

  it('preserves legacy byte encoding for unpaired UTF-16 surrogates in existing and new hashes', async () => {
    // JSON accepts these strings even though they are not well-formed Unicode.
    for (const unpaired of ['\ud800', '\udc00']) {
      const prefix = freshPassword(), password = prefix + unpaired + '📚';
      const stored = await bcryptjs.hash(password, 4);
      assert.equal(await hasher.verify(password, stored), true);
      assert.equal(await hasher.verify(prefix + '\ufffd📚', stored), false);
      const generated = await hasher.hash(password);
      assert.equal(await bcryptjs.compare(password, generated), true);
      assert.equal(await hasher.verify(password, generated), true);
      assert.equal(await hasher.verify(prefix + '\ufffd📚', generated), false);
    }
  });

  it('rejects empty or truncated stored hashes', async () => {
    const password = freshPassword();
    assert.equal(await hasher.verify(password, ''), false);
    assert.equal(await hasher.verify(password, '$2b$10$invalid'), false);
  });
});
