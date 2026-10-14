import type { HealthProbe } from '../domain/HealthProbe.js';

/** Probe at most once concurrently, including after its readiness deadline expired. */
export class ReadinessMonitor {
  private healthy = false;
  private checkedAt = 0;
  private running = false;
  private stopped = true;
  private generation = 0;
  private interval?: ReturnType<typeof setInterval>;
  private deadline?: ReturnType<typeof setTimeout>;
  private readonly limits;

  constructor(private readonly probe: HealthProbe,
    options: { intervalMs?: number; timeoutMs?: number; maxAgeMs?: number } = {}) {
    this.limits = { intervalMs: 1000, timeoutMs: 500, maxAgeMs: 2500, ...options };
  }

  get ready() { return !this.stopped && this.healthy && Date.now() - this.checkedAt < this.limits.maxAgeMs; }

  start() {
    if (!this.stopped) return;
    this.stopped = false; this.generation++;
    this.interval = setInterval(() => this.sample(), this.limits.intervalMs);
    this.interval.unref();
    this.sample();
  }

  stop() {
    this.stopped = true; this.healthy = false; this.generation++;
    clearInterval(this.interval); clearTimeout(this.deadline);
    this.interval = undefined; this.deadline = undefined;
  }

  private sample() {
    if (this.stopped || this.running) return;
    this.running = true;
    const generation = this.generation;
    let expired = false;
    this.deadline = setTimeout(() => {
      expired = true;
      if (!this.stopped && generation === this.generation) {
        this.healthy = false; this.checkedAt = Date.now();
      }
    }, this.limits.timeoutMs);
    this.deadline.unref();
    void (async () => {
      try {
        await this.probe.check();
        if (!this.stopped && generation === this.generation && !expired) {
          this.healthy = true; this.checkedAt = Date.now();
        }
      } catch {
        if (!this.stopped && generation === this.generation) {
          this.healthy = false; this.checkedAt = Date.now();
        }
      } finally {
        clearTimeout(this.deadline); this.deadline = undefined;
        this.running = false;
      }
    })();
  }
}
