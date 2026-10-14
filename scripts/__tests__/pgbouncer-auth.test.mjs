import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { test } from 'node:test';
import { parse } from 'dotenv';
import { preparePoolerAuth } from '../lib/pgbouncer-auth.mjs';

test('existing credentials are preserved and userlist quoting prevents extra fields/lines', () => {
  const password = randomBytes(24).toString('hex') + '\'"$#:@/%';
  const admin = randomBytes(32).toString('hex');
  const direct = new URL('postgresql://db:5432/tluscholar');
  direct.username = 'tlu'; direct.password = encodeURIComponent(password);
  const result = preparePoolerAuth(direct.toString(), admin);
  assert.equal(result.users, `"tlu" "${password.replaceAll('"', '""')}"\n"pooler_admin" "${admin}"\n`);
  assert.equal(decodeURIComponent(new URL(result.pooledUrl).password), password);
  assert.equal(new URL(result.pooledUrl).hostname, 'pgbouncer');
  assert.equal(new URL(result.directUrl).hostname, 'db');
  assert.equal(parse(`DIRECT_DATABASE_URL='${result.directUrl}'`).DIRECT_DATABASE_URL, result.directUrl);
});
test('invalid endpoints, missing credentials, control characters and console-role reuse fail', () => {
  const password = randomBytes(24).toString('hex'), admin = randomBytes(32).toString('hex');
  const valid = new URL(`postgresql://tlu:${password}@db:5432/tluscholar`);
  for (const change of [url => { url.hostname = 'other'; }, url => { url.port = '6432'; },
    url => { url.pathname = '/other'; }, url => { url.username = 'pooler_admin'; },
    url => { url.password = ''; }, url => { url.password = 'line\nbreak'; },
    url => { url.password = 'md5' + randomBytes(16).toString('hex'); },
    url => { url.search = '?options=anything'; }, url => { url.hash = '#invalid'; }]) {
    const url = new URL(valid); change(url); assert.throws(() => preparePoolerAuth(url.toString(), admin));
  }
});
