# Editor Backend — Design

## Architecture Summary

The backend stays a Fastify modular monolith with Clean Architecture. Editor work touches:

- **`compile`** — new HTTP delivery + worker (was schema-only).
- **`projects`** (extended) — new sub-route file `ProjectSettings/Routes.ts` and `ProjectSettings/Dto.ts`.
- **`shared/storage/`** — new cross-module port and adapters for blob storage.
- **`project-files`** (extended) — small fixes for binary streaming + conflict handling; no module restructure.

Module dependency stays one-way: `delivery -> application -> domain`; `infra` implements ports. The `compile` module depends on `project-files` only through a domain port (`ProjectFileSnapshotPort`), never directly on `project-files` infra.

## Directory Structure

Lines marked `(new)` are created in this spec; `(modify)` are edited in place; everything else is context.

```txt
backend/
├─ src/
│  ├─ app.ts                                                        (modify)
│  ├─ config/index.ts                                               (modify)
│  ├─ shared/
│  │  └─ storage/                                                   (new)
│  │     ├─ BlobStorage.ts                                          (new) port
│  │     ├─ LocalBlobStorage.ts                                     (new) infra
│  │     ├─ S3BlobStorage.ts                                        (new) placeholder
│  │     ├─ BlobStorageFactory.ts                                   (new) selects driver
│  │     └─ Errors.ts                                               (new)
│  ├─ plugins/
│  │  └─ Storage.ts                                                 (new) decorates app.storage
│  ├─ modules/
│  │  ├─ projects/
│  │  │  ├─ application/
│  │  │  │  ├─ GetProjectSettings.ts                                (new)
│  │  │  │  └─ UpdateProjectSettings.ts                             (new)
│  │  │  ├─ domain/
│  │  │  │  ├─ ProjectSettings.ts                                   (new) entity + invariants
│  │  │  │  └─ ProjectSettingsRepository.ts                         (new) port
│  │  │  ├─ infra/
│  │  │  │  └─ PrismaProjectSettingsRepository.ts                   (new)
│  │  │  └─ delivery/http/
│  │  │     └─ ProjectSettings/
│  │  │        ├─ Routes.ts                                         (new)
│  │  │        └─ Dto.ts                                            (new)
│  │  ├─ project-files/
│  │  │  ├─ delivery/http/ProjectFile/
│  │  │  │  ├─ Routes.ts                                            (modify) binary streaming + conflicts
│  │  │  │  └─ Dto.ts                                               (modify) add error codes
│  │  │  └─ infra/
│  │  │     └─ PrismaProjectFileRepository.ts                       (modify) bump lastEditedAt
│  │  └─ compile/
│  │     ├─ Container.ts                                            (new) DI wiring
│  │     ├─ application/
│  │     │  ├─ EnqueueCompileJob.ts                                 (new)
│  │     │  ├─ ListCompileJobs.ts                                   (new)
│  │     │  ├─ GetCompileJob.ts                                     (new)
│  │     │  ├─ GetLatestArtifact.ts                                 (new)
│  │     │  └─ ProcessCompileJob.ts                                 (new) worker handler
│  │     ├─ domain/
│  │     │  ├─ CompileJob.ts                                        (new) entity + state machine
│  │     │  ├─ CompileDiagnostic.ts                                 (new)
│  │     │  ├─ TypstCompileService.ts                               (new) port
│  │     │  ├─ CompileJobRepository.ts                              (new) port
│  │     │  ├─ CompileArtifactRepository.ts                         (new) port
│  │     │  ├─ ProjectFileSnapshotPort.ts                           (new) read-only port
│  │     │  ├─ Policies.ts                                          (new) project access check
│  │     │  └─ Errors.ts                                            (new)
│  │     ├─ infra/
│  │     │  ├─ NodeTypstCompileService.ts                           (new) child_process driver
│  │     │  ├─ PrismaCompileJobRepository.ts                        (new)
│  │     │  ├─ PrismaCompileArtifactRepository.ts                   (new)
│  │     │  ├─ PrismaProjectFileSnapshotAdapter.ts                  (new) implements port via project-files
│  │     │  └─ InProcessCompileQueue.ts                             (new) FIFO with single worker
│  │     └─ delivery/http/
│  │        ├─ Routes.ts                                            (new)
│  │        └─ Dto.ts                                               (new)
│  └─ generated/prisma/                                             (unchanged)
└─ prisma/
   └─ schema.prisma                                                 (unchanged) — models already exist
```

## Module: storage abstraction

### Port

```ts
// backend/src/shared/storage/BlobStorage.ts
import type { Readable } from "node:stream";

export interface BlobMetadata {
  sizeBytes: number;
  sha256: string;
  contentType: string;
}

export interface BlobStorage {
  /**
   * Persist a stream and return content-addressable metadata.
   * The implementation MUST compute sha256 while streaming.
   */
  put(
    key: string,
    body: Readable | Buffer,
    contentType: string,
  ): Promise<BlobMetadata>;

  get(key: string): Promise<Readable>;

  head(key: string): Promise<BlobMetadata | null>;

  delete(key: string): Promise<void>;
}
```

### Local implementation (sketch)

```ts
// backend/src/shared/storage/LocalBlobStorage.ts
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { BlobMetadata, BlobStorage } from "./BlobStorage.js";

export class LocalBlobStorage implements BlobStorage {
  constructor(private readonly rootDir: string) {}

  private absPath(key: string): string {
    return join(this.rootDir, key.slice(0, 2), `${key}.bin`);
  }
  private metaPath(key: string): string {
    return `${this.absPath(key)}.json`;
  }

  async put(key: string, body: Readable | Buffer, contentType: string): Promise<BlobMetadata> {
    const file = this.absPath(key);
    await mkdir(dirname(file), { recursive: true });
    const hash = createHash("sha256");
    let sizeBytes = 0;
    const source = Buffer.isBuffer(body) ? Readable.from(body) : body;
    await pipeline(
      source,
      async function* (src) {
        for await (const chunk of src) {
          hash.update(chunk);
          sizeBytes += chunk.length;
          yield chunk;
        }
      },
      createWriteStream(file),
    );
    const meta: BlobMetadata = { sizeBytes, sha256: hash.digest("hex"), contentType };
    await writeFile(this.metaPath(key), JSON.stringify(meta));
    return meta;
  }

  async get(key: string): Promise<Readable> {
    return createReadStream(this.absPath(key));
  }

  async head(key: string): Promise<BlobMetadata | null> {
    try {
      const raw = await readFile(this.metaPath(key), "utf8");
      return JSON.parse(raw) as BlobMetadata;
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    await Promise.allSettled([unlink(this.absPath(key)), unlink(this.metaPath(key))]);
  }
}
```

### Plugin wiring

```ts
// backend/src/plugins/Storage.ts
import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { LocalBlobStorage } from "../shared/storage/LocalBlobStorage.js";
import { S3BlobStorage } from "../shared/storage/S3BlobStorage.js";
import type { BlobStorage } from "../shared/storage/BlobStorage.js";

declare module "fastify" {
  interface FastifyInstance {
    storage: BlobStorage;
  }
}

export default fp(async (app: FastifyInstance) => {
  const driver = process.env.BLOB_STORAGE_DRIVER ?? "local";
  const storage: BlobStorage =
    driver === "s3"
      ? new S3BlobStorage()
      : new LocalBlobStorage(process.env.STORAGE_DIR ?? "./.storage");
  app.decorate("storage", storage);
});
```

`app.ts` registers `Storage` between `Prisma` and `JWT`.

## Module: compile

### Domain entity

```ts
// backend/src/modules/compile/domain/CompileJob.ts
import { CompileJobError } from "./Errors.js";

export type CompileStatus = "queued" | "running" | "success" | "failed";

export class CompileJob {
  constructor(
    readonly id: string,
    readonly projectId: string,
    readonly entryPath: string,
    private _status: CompileStatus,
    private _diagnostics: ReadonlyArray<unknown>,
    private _latestArtifactId: string | null,
    readonly createdAt: Date,
    private _updatedAt: Date,
  ) {}

  get status() { return this._status; }
  get diagnostics() { return this._diagnostics; }
  get latestArtifactId() { return this._latestArtifactId; }
  get updatedAt() { return this._updatedAt; }

  start(): void {
    if (this._status !== "queued") throw new CompileJobError("INVALID_TRANSITION");
    this._status = "running";
    this._updatedAt = new Date();
  }

  succeed(artifactId: string): void {
    if (this._status !== "running") throw new CompileJobError("INVALID_TRANSITION");
    this._status = "success";
    this._latestArtifactId = artifactId;
    this._updatedAt = new Date();
  }

  fail(diagnostics: ReadonlyArray<unknown>): void {
    if (this._status !== "running" && this._status !== "queued") {
      throw new CompileJobError("INVALID_TRANSITION");
    }
    this._status = "failed";
    this._diagnostics = diagnostics;
    this._updatedAt = new Date();
  }
}
```

### Application use case

```ts
// backend/src/modules/compile/application/EnqueueCompileJob.ts
import type { CompileJob } from "../domain/CompileJob.js";
import type { CompileJobRepository } from "../domain/CompileJobRepository.js";
import type { ProjectAccessPolicy } from "../domain/Policies.js";
import type { CompileQueue } from "../domain/CompileQueue.js";

export interface EnqueueCompileJobCommand {
  projectId: string;
  userId: string;
  entryPath: string;
  format: "pdf";
  engine: "node";
}

export class EnqueueCompileJob {
  constructor(
    private readonly repo: CompileJobRepository,
    private readonly access: ProjectAccessPolicy,
    private readonly queue: CompileQueue,
  ) {}

  async execute(cmd: EnqueueCompileJobCommand): Promise<CompileJob> {
    await this.access.requireProjectAccess(cmd.projectId, cmd.userId);
    const existing = await this.repo.findActiveByEntry(cmd.projectId, cmd.entryPath);
    if (existing) return existing; // dedupe
    const job = await this.repo.create({
      projectId: cmd.projectId,
      entryPath: cmd.entryPath,
      format: cmd.format,
      engine: cmd.engine,
    });
    await this.queue.enqueue(job.id);
    return job;
  }
}
```

### Compile service port

```ts
// backend/src/modules/compile/domain/TypstCompileService.ts

// 1-based line/column matching Typst CLI output and frontend expectation.
export interface DiagnosticPosition {
  line: number;
  column: number;
}

export interface DiagnosticRange {
  start: DiagnosticPosition;
  end: DiagnosticPosition;
}

export type DiagnosticSeverity = "error" | "warning" | "hint" | "info";

/**
 * Wire format for compile diagnostics. The same shape is used in the domain,
 * persisted in CompileJob.diagnostics (Prisma JSON), and returned by the HTTP
 * route. The frontend wraps it with `source: "server"` and renders it through
 * the same CodeMirror lint pipeline as client-side WASM diagnostics.
 */
export interface CompileDiagnostic {
  severity: DiagnosticSeverity;
  message: string;
  /** Project-relative path of the offending file. Undefined for global errors
   *  (e.g. "main.typ not found"); the frontend renders these in the Issues
   *  panel without an inline marker. */
  file?: string;
  /** Source span. REQUIRED for the inline squiggle to render. Omit only when
   *  the compiler genuinely has no source location. */
  range?: DiagnosticRange;
  /** typst attaches "help: ..." notes alongside many errors; pass them through. */
  hints?: string[];
}

export interface TypstCompileInput {
  workDir: string;        // temp dir already populated with project files
  entryPath: string;      // relative to workDir
  outputPath: string;     // absolute, where the PDF should be written
  timeoutMs: number;
}

export interface TypstCompileResult {
  ok: boolean;
  diagnostics: CompileDiagnostic[];
}

export interface TypstCompileService {
  compile(input: TypstCompileInput): Promise<TypstCompileResult>;
}
```

### Parsing typst CLI diagnostics

`typst compile` writes diagnostics to stderr in a stable but ad-hoc format:

```
error: type mismatch (found integer, expected string)
  ┌─ /tmp/typst-XYZ/main.typ:12:14
  │
12 │ #let x = 1 + "two"
  │              ^^^^^^^
  │
  = help: convert with `str(...)`
```

`NodeTypstCompileService` must parse this into `CompileDiagnostic[]`. Use the
`--diagnostic-format=short` flag when available (typst >= 0.11) to get a
machine-readable single-line form:

```
/tmp/typst-XYZ/main.typ:12:14: error: type mismatch (found integer, expected string)
```

Sketch:

```ts
// backend/src/modules/compile/infra/NodeTypstCompileService.ts (excerpt)
import { spawn } from "node:child_process";
import { relative } from "node:path";
import type {
  CompileDiagnostic, TypstCompileInput, TypstCompileResult, TypstCompileService,
} from "../domain/TypstCompileService.js";

const SHORT_LINE_RE = /^(.+?):(\d+):(\d+):\s*(error|warning|hint|info):\s*(.+)$/;

export class NodeTypstCompileService implements TypstCompileService {
  async compile(input: TypstCompileInput): Promise<TypstCompileResult> {
    const bin = process.env.TYPST_BIN ?? "typst";
    const args = [
      "compile",
      "--diagnostic-format=short",
      input.entryPath,
      input.outputPath,
    ];
    return new Promise((resolve) => {
      const proc = spawn(bin, args, { cwd: input.workDir });
      const chunks: Buffer[] = [];
      proc.stderr.on("data", (c) => chunks.push(c));
      const timer = setTimeout(() => proc.kill("SIGKILL"), input.timeoutMs);
      proc.on("close", (code) => {
        clearTimeout(timer);
        const stderr = Buffer.concat(chunks).toString("utf8");
        const diagnostics = this.parse(stderr, input.workDir);
        resolve({ ok: code === 0, diagnostics });
      });
    });
  }

  private parse(stderr: string, workDir: string): CompileDiagnostic[] {
    const out: CompileDiagnostic[] = [];
    let pending: CompileDiagnostic | null = null;

    for (const raw of stderr.split(/\r?\n/)) {
      const m = SHORT_LINE_RE.exec(raw);
      if (m) {
        if (pending) out.push(pending);
        const [, absFile, line, col, severity, message] = m;
        const file = relative(workDir, absFile).replace(/\\/g, "/");
        pending = {
          severity: severity as CompileDiagnostic["severity"],
          message,
          file: file.startsWith("..") ? undefined : file,
          range: {
            start: { line: Number(line), column: Number(col) },
            // typst short format gives a point, not a range. Frontend will
            // widen empty spans to one character so the squiggle is visible.
            end:   { line: Number(line), column: Number(col) },
          },
          hints: [],
        };
      } else if (pending && raw.startsWith("  = help:")) {
        pending.hints!.push(raw.replace(/^\s*= help:\s*/, ""));
      }
    }
    if (pending) out.push(pending);
    return out;
  }
}
```

**Why `--diagnostic-format=short`?** It collapses the multi-line "fancy" output
into one line per diagnostic, which is robust to terminal width, ANSI colors,
and non-ASCII source. If the installed typst is too old to support the flag,
fall back to a more careful parser that walks the fancy form (headers
`error:`/`warning:` followed by a `┌─ path:line:col` indicator). Track this in
`NodeTypstCompileService.parse` with a `--version` probe at startup.

**End span improvement (post-MVP)**: typst >= 0.12 includes end positions in
the JSON output (`typst compile --diagnostic-format=json`). When that lands,
swap the parser to JSON and populate true `end` positions, which lets the
frontend draw real range squiggles instead of single-char widened ones.

### Worker (Process use case)

```ts
// backend/src/modules/compile/application/ProcessCompileJob.ts
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import type { CompileJobRepository } from "../domain/CompileJobRepository.js";
import type { CompileArtifactRepository } from "../domain/CompileArtifactRepository.js";
import type { ProjectFileSnapshotPort } from "../domain/ProjectFileSnapshotPort.js";
import type { TypstCompileService } from "../domain/TypstCompileService.js";
import type { BlobStorage } from "../../../shared/storage/BlobStorage.js";

export class ProcessCompileJob {
  constructor(
    private readonly jobs: CompileJobRepository,
    private readonly artifacts: CompileArtifactRepository,
    private readonly snapshot: ProjectFileSnapshotPort,
    private readonly compiler: TypstCompileService,
    private readonly storage: BlobStorage,
    private readonly timeoutMs: number,
  ) {}

  async execute(jobId: string): Promise<void> {
    const job = await this.jobs.findById(jobId);
    if (!job) return;
    job.start();
    await this.jobs.save(job);

    const workDir = await mkdtemp(join(tmpdir(), "typst-"));
    try {
      const files = await this.snapshot.listFiles(job.projectId);
      for (const f of files) {
        const dest = join(workDir, f.path);
        await mkdir(dirname(dest), { recursive: true });
        await writeFile(dest, f.content);
      }
      const outputPath = join(workDir, "output.pdf");
      const result = await this.compiler.compile({
        workDir, entryPath: job.entryPath, outputPath, timeoutMs: this.timeoutMs,
      });
      if (!result.ok) {
        job.fail(result.diagnostics);
        await this.jobs.save(job);
        return;
      }
      const pdf = await readFile(outputPath);
      const meta = await this.storage.put(crypto.randomUUID(), pdf, "application/pdf");
      const artifact = await this.artifacts.create({
        projectId: job.projectId,
        jobId: job.id,
        format: "pdf",
        storageKey: meta.sha256,
        sizeBytes: meta.sizeBytes,
        sha256: meta.sha256,
      });
      job.succeed(artifact.id);
      await this.jobs.save(job);
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }
}
```

### Routes + DTOs

```ts
// backend/src/modules/compile/delivery/http/Dto.ts
import { z } from "zod";

export const enqueueCompileBodySchema = z.object({
  entryPath: z.string().min(1).optional(),
  format: z.literal("pdf").optional(),
  engine: z.literal("node").optional(),
});

export type EnqueueCompileBody = z.infer<typeof enqueueCompileBodySchema>;

// Wire shape of a single diagnostic. Mirrors the domain CompileDiagnostic so
// the frontend can decode it directly and just add `source: "server"`.
export interface CompileDiagnosticDto {
  severity: "error" | "warning" | "hint" | "info";
  message: string;
  file?: string;
  range?: {
    start: { line: number; column: number };
    end:   { line: number; column: number };
  };
  hints?: string[];
}

export interface CompileJobResponse {
  id: string;
  projectId: string;
  entryPath: string;
  status: "queued" | "running" | "success" | "failed";
  diagnostics: CompileDiagnosticDto[];
  latestArtifactId: string | null;
  createdAt: string;
  updatedAt: string;
}
```

The route layer maps the persisted `CompileJob.diagnostics` (Prisma JSON) into
this typed shape; do NOT pass the raw Prisma value through. A small mapper in
`infra/PrismaCompileJobRepository.ts` validates the JSON against a Zod schema
on read, so a corrupted DB row produces a logged error rather than a wire-shape
violation.

```ts
// backend/src/modules/compile/delivery/http/Routes.ts
import type { FastifyInstance } from "fastify";
import { enqueueCompileBodySchema } from "./Dto.js";
import type { CompileContainer } from "../../Container.js";

export async function registerCompileRoutes(
  app: FastifyInstance,
  c: CompileContainer,
): Promise<void> {
  app.post("/projects/:projectId/compile", {
    preHandler: app.auth.verify,
    handler: async (req, reply) => {
      const { projectId } = req.params as { projectId: string };
      const body = enqueueCompileBodySchema.parse(req.body ?? {});
      const userId = req.user.sub;
      const job = await c.enqueueCompileJob.execute({
        projectId,
        userId,
        entryPath: body.entryPath ?? (await c.settings.getMainPath(projectId)),
        format: body.format ?? "pdf",
        engine: body.engine ?? "node",
      });
      reply.code(202).send({ job: c.toResponse(job) });
    },
  });

  app.get("/projects/:projectId/compile", {
    preHandler: app.auth.verify,
    handler: async (req) => {
      const { projectId } = req.params as { projectId: string };
      const jobs = await c.listCompileJobs.execute({ projectId, userId: req.user.sub });
      return { jobs: jobs.map(c.toResponse) };
    },
  });

  app.get("/projects/:projectId/compile/:jobId", {
    preHandler: app.auth.verify,
    handler: async (req) => {
      const { projectId, jobId } = req.params as { projectId: string; jobId: string };
      const job = await c.getCompileJob.execute({ projectId, jobId, userId: req.user.sub });
      return { job: c.toResponse(job) };
    },
  });

  app.get("/projects/:projectId/compile/:jobId/artifact", {
    preHandler: app.auth.verify,
    handler: async (req, reply) => {
      const { projectId, jobId } = req.params as { projectId: string; jobId: string };
      const { stream, metadata } = await c.getLatestArtifact.execute({
        projectId, jobId, userId: req.user.sub,
      });
      reply
        .header("Content-Type", metadata.contentType)
        .header("Content-Length", metadata.sizeBytes)
        .header("ETag", `"${metadata.sha256}"`);
      return reply.send(stream);
    },
  });
}
```

### Container

```ts
// backend/src/modules/compile/Container.ts
import type { FastifyInstance } from "fastify";
import { EnqueueCompileJob } from "./application/EnqueueCompileJob.js";
import { ListCompileJobs } from "./application/ListCompileJobs.js";
import { GetCompileJob } from "./application/GetCompileJob.js";
import { GetLatestArtifact } from "./application/GetLatestArtifact.js";
import { ProcessCompileJob } from "./application/ProcessCompileJob.js";
import { PrismaCompileJobRepository } from "./infra/PrismaCompileJobRepository.js";
import { PrismaCompileArtifactRepository } from "./infra/PrismaCompileArtifactRepository.js";
import { PrismaProjectFileSnapshotAdapter } from "./infra/PrismaProjectFileSnapshotAdapter.js";
import { NodeTypstCompileService } from "./infra/NodeTypstCompileService.js";
import { InProcessCompileQueue } from "./infra/InProcessCompileQueue.js";

export interface CompileContainer {
  enqueueCompileJob: EnqueueCompileJob;
  listCompileJobs: ListCompileJobs;
  getCompileJob: GetCompileJob;
  getLatestArtifact: GetLatestArtifact;
  settings: { getMainPath(projectId: string): Promise<string> };
  toResponse(job: unknown): unknown;
}

export function buildCompileContainer(app: FastifyInstance): CompileContainer {
  const jobs = new PrismaCompileJobRepository(app.prisma);
  const artifacts = new PrismaCompileArtifactRepository(app.prisma);
  const snapshot = new PrismaProjectFileSnapshotAdapter(app.prisma);
  const compiler = new NodeTypstCompileService();

  const process = new ProcessCompileJob(
    jobs, artifacts, snapshot, compiler, app.storage,
    Number(process.env.COMPILE_TIMEOUT_MS ?? 60000),
  );
  const queue = new InProcessCompileQueue(process, {
    enabled: process.env.COMPILE_WORKER_ENABLED === "true",
    log: app.log,
  });

  // ... wire use cases, return container
  return {/* ... */} as CompileContainer;
}
```

## Module: project-settings

### DTO

```ts
// backend/src/modules/projects/delivery/http/ProjectSettings/Dto.ts
import { z } from "zod";

export const updateProjectSettingsSchema = z.object({
  mainPath: z
    .string()
    .min(1)
    .refine((p) => !p.startsWith("/") && !p.includes(".."), "INVALID_MAIN_PATH")
    .optional(),
  compileOptions: z
    .object({ ppi: z.number().int().min(72).max(600).optional() })
    .partial()
    .optional(),
  zoteroConfig: z.unknown().optional(),
});

export interface ProjectSettingsResponse {
  projectId: string;
  mainPath: string;
  compileOptions: Record<string, unknown>;
  zoteroConfig: Record<string, unknown> | null;
  updatedAt: string;
}
```

### Routes

```ts
// backend/src/modules/projects/delivery/http/ProjectSettings/Routes.ts
import type { FastifyInstance } from "fastify";
import { updateProjectSettingsSchema } from "./Dto.js";

export async function registerProjectSettingsRoutes(
  app: FastifyInstance,
  c: { get: GetProjectSettings; update: UpdateProjectSettings },
): Promise<void> {
  app.get("/projects/:projectId/settings", {
    preHandler: app.auth.verify,
    handler: async (req) => {
      const { projectId } = req.params as { projectId: string };
      const settings = await c.get.execute({ projectId, userId: req.user.sub });
      return { settings };
    },
  });

  app.put("/projects/:projectId/settings", {
    preHandler: app.auth.verify,
    handler: async (req) => {
      const { projectId } = req.params as { projectId: string };
      const body = updateProjectSettingsSchema.parse(req.body);
      const settings = await c.update.execute({ projectId, userId: req.user.sub, patch: body });
      return { settings };
    },
  });
}
```

### Validation rule for `mainPath`

The Zod refinement above only catches the easy cases. The use case `UpdateProjectSettings` must additionally call `ProjectFileRepository.exists(projectId, mainPath)` and throw `INVALID_MAIN_PATH` if missing.

## Module: project-files (modifications)

- `Routes.ts`: when fetching a `kind = image|data` file, send `Content-Type: file.mimeType ?? "application/octet-stream"` and stream `app.storage.get(file.storageKey)`. For text files, keep current JSON envelope `{ file }`.
- `Routes.ts`: `POST` returns `409 FILE_PATH_CONFLICT` when path already exists; `PATCH :rename` returns `409 RENAME_TARGET_EXISTS`.
- `PrismaProjectFileRepository.ts`: in `update` and `create`, set both `file.lastEditedAt = now` and `project.lastEditedAt = now` in the same transaction.

## App.ts Registration Order

```ts
// backend/src/app.ts (excerpt)
await app.register(configPlugin);
await app.register(corsPlugin);
await app.register(prismaPlugin);
await app.register(storagePlugin);   // (new)
await app.register(jwtPlugin);
await app.register(swaggerPlugin);

await app.register(authRoutes,            { prefix: "/api/v1/auth" });
await app.register(adminRoutes,           { prefix: "/api/v1/admin" });
await app.register(projectRoutes,         { prefix: "/api/v1" });
await app.register(projectSettingsRoutes, { prefix: "/api/v1" });   // (new)
await app.register(projectFileRoutes,     { prefix: "/api/v1" });
await app.register(compileRoutes,         { prefix: "/api/v1" });   // (new)
```

## Environment

```env
# Existing
DATABASE_URL=postgresql://...
JWT_SECRET=...
PORT=3000
HOST=0.0.0.0
SWAGGER_ROUTE_PREFIX=/docs

# New
BLOB_STORAGE_DRIVER=local           # local | s3
STORAGE_DIR=./.storage              # for local driver
COMPILE_WORKER_ENABLED=true         # toggle in-process worker
COMPILE_TIMEOUT_MS=60000
TYPST_BIN=typst                     # path/name of the Typst CLI on PATH
```

`backend/.env.example` must list these so `.env` validation in `src/config/index.ts` doesn't fail silently.

## Reference Repos

Use these only as patterns; do not copy code:

| Concept | Reference path |
|---|---|
| Server-side Typst CLI invocation | `backend/references/typst-online-editor/` (see how files are written to a temp dir before compile) |
| Stream-based PDF response | Fastify docs (no reference repo needed) |
| Storage key structure for content addressing | `backend/references/texlyre/` (`/public/core/typst-ts-renderer/` shows how artifacts are addressed) |

## Error Catalog

All errors use `{ error: { code, message } }`. New codes:

| Code | HTTP | Meaning |
|---|---|---|
| `PROJECT_ACCESS_DENIED` | 403 | Reused from existing module |
| `INVALID_MAIN_PATH` | 400 | mainPath escapes project, missing, or invalid |
| `FILE_PATH_CONFLICT` | 409 | POST /files at existing path |
| `RENAME_TARGET_EXISTS` | 409 | PATCH :rename to existing path |
| `COMPILE_JOB_NOT_FOUND` | 404 | jobId mismatch |
| `COMPILE_ARTIFACT_NOT_READY` | 404 | job exists but no artifact yet |
| `COMPILE_TIMEOUT` | 408 | typst timeout |
| `STORAGE_NOT_FOUND` | 404 | blob missing in storage |

## Diagrams

### Compile request flow

```
Frontend ──POST /projects/:id/compile──▶ EnqueueCompileJob
                                              │
                                              ▼
                                       CompileJobRepository.create (status=queued)
                                              │
                                              ▼
                                         CompileQueue.enqueue
                                              │
                          (worker, in-process)│
                                              ▼
                                       ProcessCompileJob
                                              │  job.start()
                                              │  ProjectFileSnapshotPort.listFiles
                                              │  TypstCompileService.compile
                                              │  storage.put(pdf)
                                              │  job.succeed(artifactId)
                                              ▼
Frontend ──GET /compile/:jobId──▶ status, diagnostics
Frontend ──GET /compile/:jobId/artifact──▶ stream PDF
```

## Test Strategy

| Layer | What to test | Tooling |
|---|---|---|
| Domain | `CompileJob` state transitions; `ProjectSettings` invariants | unit (`npm run test:unit:compile`) |
| Application | `EnqueueCompileJob` dedupe; `ProcessCompileJob` happy + failure | unit with in-memory ports |
| Infra | `LocalBlobStorage` round-trip (5KB); sha256 stability | unit |
| Delivery | `POST /compile`, `GET /compile/:jobId`, `GET /artifact`; auth gate | API smoke (`npm run test:api:compile` — new) |
| End-to-end | Full project: write `main.typ`, post compile, poll until success, download PDF | manual or future test:e2e |

## Open Decisions Resolved Here

- **Dedup window**: `findActiveByEntry` returns any `queued`/`running` job for the same `(projectId, entryPath)` regardless of age. Closes Q1.
- **Artifact retention**: out of scope for MVP; keep all. Closes Q2.
- **Server-side preview vs export**: server only does export. Frontend does client-side WASM preview. Closes Q3.
