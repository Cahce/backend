import { PasswordWorkUnavailable } from '../domain/PasswordWorkUnavailable.js';

export interface PasswordWorkLimits { concurrency: number; maxOutstanding: number; queueWaitMs: number }
export const DEFAULT_PASSWORD_WORK_LIMITS: Readonly<PasswordWorkLimits> = {
    concurrency: 4, maxOutstanding: 128, queueWaitMs: 5000,
};
interface WaitingWork {
    deadline: number;
    start(): void;
    reject(error: PasswordWorkUnavailable): void;
    clean(): void;
}

/** Holds capacity until work actually settles; only queued work has a deadline. */
export class PasswordWorkAdmission {
    private readonly queue = new Set<WaitingWork>();
    private running = 0;
    private closed = false;
    private readonly counts = { admitted: 0, rejected: 0, expired: 0, cancelled: 0, completed: 0 };
    private readonly limits: Readonly<PasswordWorkLimits>;

    constructor(limits: PasswordWorkLimits = DEFAULT_PASSWORD_WORK_LIMITS, private readonly now = () => performance.now(),
        private readonly observe?: (phase: 'queue' | 'execution', milliseconds: number) => void) {
        if (!Number.isInteger(limits.concurrency) || limits.concurrency < 1 || limits.concurrency > 32 ||
            !Number.isInteger(limits.maxOutstanding) || limits.maxOutstanding < limits.concurrency || limits.maxOutstanding > 1024 ||
            !Number.isInteger(limits.queueWaitMs) || limits.queueWaitMs < 1 || limits.queueWaitMs > 30000) {
            throw new Error('Invalid password work limits');
        }
        this.limits = { ...limits };
    }

    run<T>(work: () => Promise<T>, signal?: AbortSignal): Promise<T> {
        if (this.closed || this.running + this.queue.size >= this.limits.maxOutstanding) {
            this.counts.rejected++;
            return Promise.reject(new PasswordWorkUnavailable());
        }
        if (signal?.aborted) {
            this.counts.cancelled++;
            return Promise.reject(new PasswordWorkUnavailable());
        }
        this.counts.admitted++;
        const queuedAt = this.now();
        return new Promise<T>((resolve, reject) => {
            const start = () => {
                this.running++;
                const startedAt = this.now();
                this.record('queue', startedAt - queuedAt);
                // Keep the slot on disconnect/close. Never race an active password mutation against a timer.
                const finish = () => {
                    this.running--;
                    this.counts.completed++;
                    this.record('execution', this.now() - startedAt);
                    this.pump();
                };
                Promise.resolve().then(work).then(value => { finish(); resolve(value); }, error => { finish(); reject(error); });
            };
            if (this.running < this.limits.concurrency) { start(); return; }
            const cancel = () => this.remove(waiting, 'cancelled');
            const timer = setTimeout(() => this.remove(waiting, 'expired'), this.limits.queueWaitMs);
            timer.unref();
            const waiting: WaitingWork = {
                deadline: this.now() + this.limits.queueWaitMs,
                start, reject,
                clean: () => { clearTimeout(timer); signal?.removeEventListener('abort', cancel); },
            };
            this.queue.add(waiting);
            signal?.addEventListener('abort', cancel, { once: true });
        });
    }

    private remove(waiting: WaitingWork, reason: 'cancelled' | 'expired' | 'rejected') {
        if (!this.queue.delete(waiting)) return;
        waiting.clean();
        this.counts[reason]++;
        waiting.reject(new PasswordWorkUnavailable());
    }

    private pump() {
        while (!this.closed && this.running < this.limits.concurrency && this.queue.size) {
            const waiting = this.queue.values().next().value!;
            // Check monotonic time even if the timer was delayed by a busy event loop.
            if (this.now() >= waiting.deadline) { this.remove(waiting, 'expired'); continue; }
            this.queue.delete(waiting);
            waiting.clean();
            waiting.start();
        }
    }

    private record(phase: 'queue' | 'execution', milliseconds: number) {
        // Optional instrumentation must never prevent a task from settling or releasing its slot.
        try { this.observe?.(phase, Math.max(0, milliseconds)); } catch { /* metrics are best effort */ }
    }

    close() {
        this.closed = true;
        for (const waiting of this.queue) this.remove(waiting, 'rejected');
    }

    snapshot() { return { ...this.counts, running: this.running, queued: this.queue.size }; }
}
