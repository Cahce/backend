/**
 * Test Runner for Projects Module Unit Tests
 */

import { run } from 'node:test';
import { spec as specReporter } from 'node:test/reporters';
import { glob } from 'glob';

async function runTests() {
  const testFiles = await glob('src/modules/projects/__tests__/**/*.test.ts');
  
  const stream = run({
    files: testFiles,
    concurrency: true,
  });

  stream.compose(specReporter).pipe(process.stdout);
}

runTests().catch(console.error);
