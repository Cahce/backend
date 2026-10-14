import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateConnectionBudget, verifyPoolerConfig } from './lib/connection-budget.mjs';

try {
  if (process.argv.length > 3) throw new Error('Usage: node scripts/check-connection-budget.mjs [manifest.json]');
  const manifest = process.argv[2] ? resolve(process.argv[2]) : fileURLToPath(new URL('../../deploy/pgbouncer/connection-budget.json', import.meta.url));
  const result = evaluateConnectionBudget(JSON.parse(await readFile(manifest, 'utf8')));
  for (const pooler of result.plan.poolers) verifyPoolerConfig(await readFile(resolve(dirname(manifest), pooler.configFile), 'utf8'), pooler);
  const { plan: _plan, ...summary } = result;
  console.log(JSON.stringify({ ...summary, scope: 'Declared envelope and INI consistency only; verify live settings before rollout.' }, null, 2));
  if (!result.passed) process.exitCode = 1;
} catch {
  // Avoid echoing a mistakenly supplied secret/config file into CI logs.
  console.error('Connection budget/config validation failed. Review manifest, INI and file paths.');
  process.exitCode = 1;
}
