import assert from 'node:assert/strict';
import { test } from 'node:test';
import Fastify from 'fastify';
import { parseTrustedProxies } from '../TrustedProxies.js';

test('proxy allowlist only accepts explicit literal addresses and nonzero valid CIDRs', () => {
    assert.equal(parseTrustedProxies('  '), false);
    assert.deepEqual(parseTrustedProxies('127.0.0.1, 10.0.1.0/24,::1,127.0.0.1'), ['127.0.0.1', '10.0.1.0/24', '::1']);
    for (const invalid of ['true', '1', 'localhost', 'loopback', '0.0.0.0/0', '::/0', '127.0.0.1/33', '::1/129',
        '10.0.0.1/', '10.0.0.1//24', '127.0.0.1,', '10.0.0.0/2.5']) assert.throws(() => parseTrustedProxies(invalid));
});

test('untrusted peers cannot spoof client IP, and an allowed proxy stops at the first untrusted hop', async () => {
    for (const allowlist of ['', '10.0.0.8/32']) {
        const app = Fastify({ trustProxy: parseTrustedProxies(allowlist) });
        app.get('/', request => ({ ip: request.ip }));
        try {
            const headers = { 'x-forwarded-for': '203.0.113.99, 192.0.2.4' };
            const direct = await app.inject({ url: '/', remoteAddress: '192.0.2.1', headers });
            assert.equal(direct.json().ip, '192.0.2.1');
            const proxy = await app.inject({ url: '/', remoteAddress: '10.0.0.8', headers });
            assert.equal(proxy.json().ip, allowlist ? '192.0.2.4' : '10.0.0.8');
        } finally { await app.close(); }
    }
});
