import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { ProcessCompileJob } from '../ProcessCompileJob.js';
import { CompileJob } from '../../domain/CompileJob.js';
import type { CompileJobRepository } from '../../domain/CompileJobRepository.js';
import type { CompileArtifactRepository, CompileArtifact } from '../../domain/CompileArtifactRepository.js';
import type { ProjectFileSnapshotPort } from '../../domain/ProjectFileSnapshotPort.js';
import type { TypstCompileInput, TypstCompileService } from '../../domain/TypstCompileService.js';
import type { BlobStorage, BlobMetadata } from '../../../../shared/storage/BlobStorage.js';

function makeJob(id = 'job-1', status: 'queued' | 'running' = 'queued') {
  return new CompileJob(id, 'proj-1', 'main.typ', status, [], null, new Date(), new Date());
}

function makeArtifact(jobId: string): CompileArtifact {
  return {
    id: 'artifact-1',
    projectId: 'proj-1',
    jobId,
    format: 'pdf',
    storageKey: 'some-uuid',
    sizeBytes: 1024,
    sha256: 'abc123',
    createdAt: new Date(),
  };
}

function makeSavedJobs(): Map<string, CompileJob> {
  return new Map();
}

function makeJobRepo(job: CompileJob, saved: Map<string, CompileJob>): CompileJobRepository {
  return {
    create: async () => job,
    findById: async (id) => (id === job.id ? job : null),
    findActiveByEntry: async () => null,
    listByProjectId: async () => [],
    save: async (j) => { saved.set(j.id, j); },
  };
}

function makeArtifactRepo(): CompileArtifactRepository {
  return {
    create: async (data) => makeArtifact(data.jobId),
    findById: async () => null,
    findByJobId: async () => null,
    findLatestByProjectId: async () => null,
  };
}

function makeSnapshot(files: { path: string; content: string }[] = []): ProjectFileSnapshotPort {
  return {
    // Port now returns AsyncIterable (B-8): yield each fixture file in turn.
    listFiles: async function* () {
      for (const file of files) {
        yield file;
      }
    },
  };
}

function makeStorage(returnMeta: BlobMetadata = { sizeBytes: 100, sha256: 'sha256hash', contentType: 'application/pdf' }): BlobStorage {
  return {
    put: async () => returnMeta,
    get: async () => Readable.from(Buffer.from('%PDF-1.4')),
    head: async () => returnMeta,
    delete: async () => {},
  };
}

function makeCompiler(result: { ok: boolean; diagnostics?: any[] }): TypstCompileService {
  return {
    compile: async (input: TypstCompileInput) => {
      if (result.ok) {
        // Write a dummy PDF so ProcessCompileJob can readFile(outputPath)
        await writeFile(input.outputPath, Buffer.from('%PDF-1.4 dummy'));
      }
      return { ok: result.ok, diagnostics: result.diagnostics ?? [] };
    },
  };
}

describe('ProcessCompileJob', () => {
  it('marks job success when compilation succeeds', async () => {
    const saved = makeSavedJobs();
    const job = makeJob();
    const useCase = new ProcessCompileJob(
      makeJobRepo(job, saved),
      makeArtifactRepo(),
      makeSnapshot([{ path: 'main.typ', content: '= Hello' }]),
      makeCompiler({ ok: true }),
      makeStorage(),
      5000,
    );

    await useCase.execute('job-1');

    const finalJob = saved.get('job-1')!;
    assert.equal(finalJob.status, 'success');
    assert.ok(finalJob.latestArtifactId);
  });

  it('marks job failed when compilation fails with diagnostics', async () => {
    const saved = makeSavedJobs();
    const job = makeJob();
    const diagnostics = [{ severity: 'error' as const, message: 'syntax error', file: 'main.typ', range: { start: { line: 1, column: 1 }, end: { line: 1, column: 5 } } }];
    const useCase = new ProcessCompileJob(
      makeJobRepo(job, saved),
      makeArtifactRepo(),
      makeSnapshot([{ path: 'main.typ', content: '#let x =' }]),
      makeCompiler({ ok: false, diagnostics }),
      makeStorage(),
      5000,
    );

    await useCase.execute('job-1');

    const finalJob = saved.get('job-1')!;
    assert.equal(finalJob.status, 'failed');
    assert.equal(finalJob.diagnostics.length, 1);
    assert.equal(finalJob.diagnostics[0].message, 'syntax error');
  });

  it('stores artifact with the UUID storageKey (not sha256)', async () => {
    const saved = makeSavedJobs();
    const job = makeJob();
    const storedKeys: string[] = [];

    const storage: BlobStorage = {
      put: async (key, _body, ct) => {
        storedKeys.push(key);
        return { sizeBytes: 100, sha256: 'sha256hash', contentType: ct };
      },
      get: async () => Readable.from(Buffer.alloc(0)),
      head: async () => null,
      delete: async () => {},
    };

    const createdArtifacts: any[] = [];
    const artifacts: CompileArtifactRepository = {
      create: async (d) => {
        createdArtifacts.push(d);
        return makeArtifact(d.jobId);
      },
      findById: async () => null,
      findByJobId: async () => null,
      findLatestByProjectId: async () => null,
    };

    const useCase = new ProcessCompileJob(
      makeJobRepo(job, saved),
      artifacts,
      makeSnapshot([{ path: 'main.typ', content: '= Hello' }]),
      makeCompiler({ ok: true }),
      storage,
      5000,
    );

    await useCase.execute('job-1');

    assert.equal(storedKeys.length, 1);
    const storedKey = storedKeys[0];
    assert.equal(createdArtifacts[0].storageKey, storedKey);
    assert.notEqual(createdArtifacts[0].storageKey, createdArtifacts[0].sha256);
  });

  it('does nothing when job not found', async () => {
    const saved = makeSavedJobs();
    const repo: CompileJobRepository = {
      create: async (_d) => makeJob(),
      findById: async () => null,
      findActiveByEntry: async () => null,
      listByProjectId: async () => [],
      save: async (j) => { saved.set(j.id, j); },
    };
    const useCase = new ProcessCompileJob(
      repo,
      makeArtifactRepo(),
      makeSnapshot(),
      makeCompiler({ ok: true }),
      makeStorage(),
      5000,
    );

    await useCase.execute('nonexistent');
    assert.equal(saved.size, 0);
  });
});
