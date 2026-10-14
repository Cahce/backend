import { randomBytes, createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Generate new private files only; never rewrite a real environment or print credentials.
const namespace = process.argv[2] ?? 'tlu-stage';
if (process.argv.length > 3 || !/^[a-zA-Z0-9_-]{1,48}$/.test(namespace)) throw new Error('Usage: node scripts/prepare-redis-config.mjs [namespace]');
const backend = fileURLToPath(new URL('../', import.meta.url));
const root = path.resolve(backend, 'tmp');
await mkdir(root, { recursive: true });
const output = path.join(root, `redis-config-${randomBytes(8).toString('hex')}`);
await mkdir(output, { mode: 0o700 });
const password = randomBytes(32).toString('hex');
const secret = randomBytes(32).toString('hex');
const digest = createHash('sha256').update(password).digest('hex');
const acl = [
  'user default off',
  'user health on nopass -@all +ping',
  `user realtime on #${digest} ~${namespace}:{realtime-tickets}:* ~${namespace}:{rate-limit}:* ~${namespace}:{socket-leases}:* -@all +hello +ping +quit +client|setinfo +eval +time +exists +hget +hset +get +set +incr +pttl +del +pexpire +pexpireat +zadd +zrem +zremrangebyscore +zrangebyscore +zscore +zcard`,
].join('\n') + '\n';
const env = [
  `REDIS_URL=redis://realtime:${password}@realtime-redis:6379`,
  `REDIS_KEY_SECRET=${secret}`, `REDIS_NAMESPACE=${namespace}`,
  'REDIS_COMMAND_TIMEOUT_MS=500', 'REDIS_CONNECT_TIMEOUT_MS=2000', 'REDIS_MAX_PENDING=256',
].join('\n') + '\n';
await writeFile(path.join(output, 'users.acl'), acl, { flag: 'wx', mode: 0o600 });
await writeFile(path.join(output, 'app.env'), env, { flag: 'wx', mode: 0o600 });
console.log(JSON.stringify({ directory: output, aclFile: path.join(output, 'users.acl'), appEnvironmentFile: path.join(output, 'app.env') }, null, 2));
