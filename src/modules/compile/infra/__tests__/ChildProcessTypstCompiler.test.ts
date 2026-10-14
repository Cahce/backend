import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm, writeFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { ChildProcessTypstCompiler } from '../ChildProcessTypstCompiler.js';

const childFixture = new URL(import.meta.url.endsWith('.ts') ? './fixtures/BlockingCompileChild.ts' : './fixtures/BlockingCompileChild.js', import.meta.url);
async function removeTestDirectory(path: string) {
  const insideTemp = relative(resolve(tmpdir()), resolve(path));
  assert(/^typst-(?:child|timeout|close)-test-[^\\/]+$/.test(insideTemp), 'cleanup must remain in its generated test directory');
  await rm(resolve(path), { recursive: true, force: true });
}
async function waitForFile(path: string) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    try { await access(path); return; } catch { await new Promise(resolve => setTimeout(resolve, 10)); }
  }
  throw new Error('Child did not start');
}

test('native compile produces a PDF and diagnostics without running on the server event loop', async () => {
  const workDir = await mkdtemp(join(tmpdir(), 'typst-child-test-'));
  const compiler = new ChildProcessTypstCompiler({ fontDir: './var/fonts' });
  try {
    await writeFile(join(workDir, 'main.typ'), '= Native compile\nHello from the isolated compiler.');
    let ticks = 0;
    const ticker = setInterval(() => { ticks++; }, 5);
    try {
      const result = await compiler.compile({ workDir, entryPath: 'main.typ', outputPath: join(workDir, 'output.pdf'), timeoutMs: 30_000 });
      assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
      assert.equal((await readFile(join(workDir, 'output.pdf'))).subarray(0, 5).toString(), '%PDF-');
      assert(ticks > 0, 'parent timer must remain responsive during child startup/compile');
    } finally { clearInterval(ticker); }
    await writeFile(join(workDir, 'main.typ'), '#not_a_defined_function()');
    const invalid = await compiler.compile({ workDir, entryPath: 'main.typ', outputPath: join(workDir, 'invalid.pdf'), timeoutMs: 30_000 });
    assert.equal(invalid.ok, false);
    assert(invalid.diagnostics.some(diagnostic => diagnostic.severity === 'error'));
  } finally { await compiler.close(); await removeTestDirectory(workDir); }
});

test('deadline forcibly terminates a CPU-blocked child and parent timers keep running', async () => {
  const workDir = await mkdtemp(join(tmpdir(), 'typst-timeout-test-'));
  const compiler = new ChildProcessTypstCompiler({ fontDir: '.', childUrl: childFixture });
  try {
    let ticks = 0;
    const ticker = setInterval(() => { ticks++; }, 10);
    const started = Date.now();
    try {
      const outputPath = join(workDir, 'output.pdf');
      const result = await compiler.compile({ workDir, entryPath: 'main.typ', outputPath, timeoutMs: 1500 });
      assert.equal(result.ok, false);
      assert.equal(result.diagnostics[0].message, 'Compilation timeout exceeded');
      assert(Date.now() - started < 5000);
      assert(ticks > 10, 'CPU work in child must not block the parent event loop');
      const pid = Number(await readFile(`${outputPath}.started`, 'utf8'));
      assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' }, 'deadline must wait for child exit');
    } finally { clearInterval(ticker); }
  } finally { await compiler.close(); await removeTestDirectory(workDir); }
});

test('shutdown terminates an active child before cleanup and prevents future launches', async () => {
  const workDir = await mkdtemp(join(tmpdir(), 'typst-close-test-'));
  const compiler = new ChildProcessTypstCompiler({ fontDir: '.', childUrl: childFixture });
  const outputPath = join(workDir, 'output.pdf');
  try {
    const pending = compiler.compile({ workDir, entryPath: 'main.typ', outputPath, timeoutMs: 30_000 });
    await waitForFile(`${outputPath}.started`);
    const pid = Number(await readFile(`${outputPath}.started`, 'utf8'));
    await compiler.close();
    assert.equal((await pending).ok, false);
    assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
    assert.equal((await compiler.compile({ workDir, entryPath: 'main.typ', outputPath, timeoutMs: 1000 })).ok, false);
  } finally { await compiler.close(); await removeTestDirectory(workDir); }
});
