import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { preparePoolerAuth } from './lib/pgbouncer-auth.mjs';

try {
  if (process.argv.length !== 2 || !process.env.PGBOUNCER_BOOTSTRAP_DIRECT_URL) throw new Error('Missing explicit bootstrap URL');
  const prepared = preparePoolerAuth(process.env.PGBOUNCER_BOOTSTRAP_DIRECT_URL, randomBytes(32).toString('hex'));
  const root = fileURLToPath(new URL('../tmp/', import.meta.url));
  await mkdir(root, { recursive: true });
  const directory = join(root, `pgbouncer-config-${randomBytes(8).toString('hex')}`);
  const authFile = join(directory, 'users.txt'), composeEnv = join(directory, 'compose.env');
  // Single-quoted dotenv values prevent Compose interpolation of literal dollar signs in credentials.
  // Userinfo is canonicalized by preparePoolerAuth; reject apostrophes in the local path rather than emit ambiguous dotenv.
  const values = { POOLED_DATABASE_URL: prepared.pooledUrl, DIRECT_DATABASE_URL: prepared.directUrl,
    PGBOUNCER_AUTH_FILE: authFile.replaceAll('\\', '/') };
  if (Object.values(values).some(value => /['\r\n]/.test(value))) throw new Error('Unsupported quote in output path');
  await mkdir(directory, { mode: 0o700 });
  await writeFile(authFile, prepared.users, { flag: 'wx', mode: 0o600 });
  await writeFile(composeEnv, Object.entries(values).map(([key, value]) => `${key}='${value}'`).join('\n') + '\n', { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({ directory, authFile, composeEnv }, null, 2));
} catch {
  console.error('Could not prepare PgBouncer config. Supply PGBOUNCER_BOOTSTRAP_DIRECT_URL explicitly for db:5432/tluscholar; no app env is loaded and no DB role is changed.');
  process.exitCode = 1;
}
