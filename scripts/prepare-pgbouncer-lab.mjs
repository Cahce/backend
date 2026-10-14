import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

if (process.argv.length !== 2) throw new Error('Usage: node scripts/prepare-pgbouncer-lab.mjs');
const root = fileURLToPath(new URL('../tmp/', import.meta.url));
await mkdir(root, { recursive: true });
const directory = join(root, `pgbouncer-lab-${randomBytes(8).toString('hex')}`);
await mkdir(directory, { mode: 0o700 });
const password = randomBytes(32).toString('hex'), adminPassword = randomBytes(32).toString('hex');
const auth = join(directory, 'users.txt'), config = join(directory, 'pgbouncer.ini');
const composeEnv = join(directory, 'compose.env'), testEnv = join(directory, 'test.env');
const ini = `[databases]
pooler_test = host=postgres port=5432 dbname=pooler_test
[pgbouncer]
listen_addr = 0.0.0.0
listen_port = 6432
unix_socket_dir = /run/pgbouncer
pidfile = /run/pgbouncer/pgbouncer.pid
pool_mode = transaction
auth_type = scram-sha-256
auth_file = /run/pgbouncer/users.txt
admin_users = pooler_admin
max_client_conn = 40
default_pool_size = 2
reserve_pool_size = 0
max_db_connections = 2
max_prepared_statements = 200
query_wait_timeout = 1
server_connect_timeout = 3
server_idle_timeout = 30
log_connections = 0
log_disconnections = 0
`;
const compose = [`POOLER_TEST_PASSWORD=${password}`, `PGBOUNCER_LAB_AUTH_FILE=${auth.replaceAll('\\', '/')}`,
  `PGBOUNCER_LAB_INI=${config.replaceAll('\\', '/')}`].join('\n') + '\n';
const tests = [`TEST_PGBOUNCER_URL=postgresql://pooler_test:${password}@127.0.0.1:16432/pooler_test`,
  `TEST_PGBOUNCER_DIRECT_URL=postgresql://pooler_test:${password}@127.0.0.1:15432/pooler_test`,
  `TEST_PGBOUNCER_ADMIN_URL=postgresql://pooler_admin:${adminPassword}@127.0.0.1:16432/pgbouncer`].join('\n') + '\n';
for (const [path, contents] of [[auth, `"pooler_test" "${password}"\n"pooler_admin" "${adminPassword}"\n`],
  [config, ini], [composeEnv, compose], [testEnv, tests]]) await writeFile(path, contents, { flag: 'wx', mode: 0o600 });
// Paths only. No dotenv loading, app credential access, stdout secrets or existing-file overwrite.
console.log(JSON.stringify({ directory, composeEnv, testEnv }, null, 2));
