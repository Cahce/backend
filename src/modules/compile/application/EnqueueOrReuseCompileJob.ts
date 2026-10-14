import type { CompileJob } from '../domain/CompileJob.js';
import type { CompileJobRepository, CreateCompileJobData } from '../domain/CompileJobRepository.js';
import type { CompileQueue } from '../domain/CompileQueue.js';

/** Shared admission for member exports and the admin's lazy artifact generation. */
export async function enqueueOrReuseCompileJob(repo: CompileJobRepository, queue: CompileQueue,
  data: CreateCompileJobData, timeoutMs: number): Promise<CompileJob> {
  const reusable = (job: CompileJob) => job.status === 'queued' ||
    (job.status === 'running' && (queue.hasJob(job.id) || job.updatedAt.getTime() >= Date.now() - (2 * timeoutMs + 60_000)));
  const existing = await repo.findActiveByEntry(data.projectId, data.entryPath);
  // Reusing already accepted work does not need another capacity reservation.
  if (existing && reusable(existing)) return existing;
  return queue.admit(JSON.stringify([data.projectId, data.entryPath]), async enqueue => {
    const current = await repo.findActiveByEntry(data.projectId, data.entryPath);
    if (current && reusable(current)) return current;
    if (current?.status === 'running') {
      current.fail([{ severity: 'error', message: 'Job quá hạn, đã bị hủy' }]);
      await repo.save(current);
    }
    const job = await repo.create(data);
    try { await enqueue(job.id); }
    catch (error) {
      job.fail([{ severity: 'error', message: 'Không thể đưa job vào hàng đợi biên dịch' }]);
      await repo.save(job);
      throw error;
    }
    return job;
  });
}
