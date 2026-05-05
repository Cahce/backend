import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CompileJob } from '../CompileJob.js';
import { CompileJobError } from '../Errors.js';

function makeJob(status: 'queued' | 'running' | 'success' | 'failed' = 'queued') {
  const job = new CompileJob(
    'job-1',
    'project-1',
    'main.typ',
    status,
    [],
    null,
    new Date('2024-01-01'),
    new Date('2024-01-01'),
  );
  return job;
}

describe('CompileJob state machine', () => {
  describe('start()', () => {
    it('transitions queued → running', () => {
      const job = makeJob('queued');
      job.start();
      assert.equal(job.status, 'running');
    });

    it('throws INVALID_TRANSITION when already running', () => {
      const job = makeJob('running');
      assert.throws(() => job.start(), (err: unknown) => {
        assert.ok(err instanceof CompileJobError);
        assert.equal(err.code, 'INVALID_TRANSITION');
        return true;
      });
    });

    it('throws INVALID_TRANSITION when success', () => {
      const job = makeJob('success');
      assert.throws(() => job.start(), (err: unknown) => {
        assert.ok(err instanceof CompileJobError);
        return true;
      });
    });

    it('throws INVALID_TRANSITION when failed', () => {
      const job = makeJob('failed');
      assert.throws(() => job.start(), (err: unknown) => {
        assert.ok(err instanceof CompileJobError);
        return true;
      });
    });
  });

  describe('succeed()', () => {
    it('transitions running → success and sets artifactId', () => {
      const job = makeJob('running');
      job.succeed('artifact-1');
      assert.equal(job.status, 'success');
      assert.equal(job.latestArtifactId, 'artifact-1');
    });

    it('throws INVALID_TRANSITION when queued', () => {
      const job = makeJob('queued');
      assert.throws(() => job.succeed('artifact-1'), (err: unknown) => {
        assert.ok(err instanceof CompileJobError);
        assert.equal(err.code, 'INVALID_TRANSITION');
        return true;
      });
    });

    it('throws INVALID_TRANSITION when already success', () => {
      const job = makeJob('success');
      assert.throws(() => job.succeed('artifact-2'), (err: unknown) => {
        assert.ok(err instanceof CompileJobError);
        return true;
      });
    });
  });

  describe('fail()', () => {
    it('transitions running → failed with diagnostics', () => {
      const job = makeJob('running');
      const diags = [{ severity: 'error' as const, message: 'syntax error' }];
      job.fail(diags);
      assert.equal(job.status, 'failed');
      assert.deepEqual(job.diagnostics, diags);
    });

    it('transitions queued → failed (immediate rejection)', () => {
      const job = makeJob('queued');
      job.fail([{ severity: 'error' as const, message: 'enqueue error' }]);
      assert.equal(job.status, 'failed');
    });

    it('throws INVALID_TRANSITION when already failed', () => {
      const job = makeJob('failed');
      assert.throws(() => job.fail([]), (err: unknown) => {
        assert.ok(err instanceof CompileJobError);
        assert.equal(err.code, 'INVALID_TRANSITION');
        return true;
      });
    });

    it('throws INVALID_TRANSITION when success', () => {
      const job = makeJob('success');
      assert.throws(() => job.fail([]), (err: unknown) => {
        assert.ok(err instanceof CompileJobError);
        return true;
      });
    });
  });

  describe('updatedAt', () => {
    it('advances on start()', async () => {
      const job = makeJob('queued');
      const before = job.updatedAt.getTime();
      await new Promise((r) => setTimeout(r, 5));
      job.start();
      assert.ok(job.updatedAt.getTime() >= before);
    });

    it('advances on succeed()', async () => {
      const job = makeJob('running');
      const before = job.updatedAt.getTime();
      await new Promise((r) => setTimeout(r, 5));
      job.succeed('art-1');
      assert.ok(job.updatedAt.getTime() >= before);
    });
  });
});
